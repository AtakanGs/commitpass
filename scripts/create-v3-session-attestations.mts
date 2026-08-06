import fs from "node:fs";
import path from "node:path";
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  getAddress,
  isAddress,
  keccak256,
  toUtf8Bytes,
  verifyTypedData,
} from "ethers";
import {
  evaluateDigitalSession,
  serializeSessionPolicy,
  validateDigitalSessionPolicy,
  type DigitalSessionPolicy,
  type SessionInterval,
} from "../lib/sessionPolicy.ts";

const ARC_TESTNET_CHAIN_ID = 5_042_002n;
const DEFAULT_TTL_SECONDS = 300n;
const MAX_TTL_SECONDS = 900n;
const MIN_USABLE_TTL_SECONDS = 60n;

const ABI = [
  "function getReservation(uint256 reservationId) view returns (tuple(address provider,address customer,address attendanceAttestor,uint128 commitmentAmount,uint64 startTime,uint64 freeCancellationDeadline,uint64 gracePeriod,uint64 claimWindow,uint64 disputeWindow,uint64 arbiterWindow,uint64 claimOpenedAt,uint64 disputedAt,uint8 status,uint8 pendingOutcome,uint8 finalOutcome,bool providerConfirmed,bool customerConfirmed,bytes32 metadataHash,bytes32 claimEvidenceHash,bytes32 disputeEvidenceHash))",
  "function attendanceDeadline(uint256 reservationId) view returns (uint256)",
] as const;

function loadEnvFile(filename = ".env") {
  const location = path.join(process.cwd(), filename);

  if (!fs.existsSync(location)) {
    return;
  }

  for (const rawLine of fs.readFileSync(location, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function parsePositiveBigInt(name: string, value: string) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return BigInt(value);
}

function parseIntervals(value: unknown, name: string): SessionInterval[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }

  return value.map((entry, index) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("joinedAt" in entry) ||
      !("leftAt" in entry)
    ) {
      throw new Error(`${name}[${index}] is invalid.`);
    }

    const joinedAt = Number(entry.joinedAt);
    const leftAt = Number(entry.leftAt);

    if (!Number.isSafeInteger(joinedAt) || !Number.isSafeInteger(leftAt)) {
      throw new Error(`${name}[${index}] timestamps must be safe integers.`);
    }

    return { joinedAt, leftAt };
  });
}

function parsePolicy(value: unknown): DigitalSessionPolicy {
  if (typeof value !== "object" || value === null) {
    throw new Error("Receipt policy is missing.");
  }

  const record = value as Record<string, unknown>;
  const policy: DigitalSessionPolicy = {
    version: Number(record.version) as 1,
    kind: record.kind as "digital-session",
    scheduledMinutes: Number(record.scheduledMinutes),
    issueWindowMinutes: Number(record.issueWindowMinutes),
    completionThresholdMinutes: Number(
      record.completionThresholdMinutes,
    ),
  };
  const validation = validateDigitalSessionPolicy(policy);

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  return policy;
}

function canonicalReceiptForHash(input: {
  receipt: Record<string, unknown>;
  policy: DigitalSessionPolicy;
  providerIntervals: SessionInterval[];
  customerIntervals: SessionInterval[];
  evaluation: ReturnType<typeof evaluateDigitalSession>;
}) {
  return JSON.stringify({
    version: 1,
    reservationId: String(input.receipt.reservationId),
    chainId: Number(input.receipt.chainId),
    contractAddress: String(
      input.receipt.contractAddress,
    ).toLowerCase(),
    provider: String(input.receipt.provider).toLowerCase(),
    customer: String(input.receipt.customer).toLowerCase(),
    sessionId: String(input.receipt.sessionId),
    sessionStart: Number(input.receipt.sessionStart),
    generatedAt: Number(input.receipt.generatedAt),
    policy: serializeSessionPolicy(input.policy),
    providerIntervals: input.providerIntervals.map((interval) => [
      Math.floor(interval.joinedAt),
      Math.floor(interval.leftAt),
    ]),
    customerIntervals: input.customerIntervals.map((interval) => [
      Math.floor(interval.joinedAt),
      Math.floor(interval.leftAt),
    ]),
    evaluation: {
      code: input.evaluation.code,
      providerSeconds: input.evaluation.providerSeconds,
      customerSeconds: input.evaluation.customerSeconds,
      verifiedOverlapSeconds:
        input.evaluation.verifiedOverlapSeconds,
      recommendedContractOutcome:
        input.evaluation.recommendedContractOutcome,
      attestProvider: input.evaluation.attestProvider,
      attestCustomer: input.evaluation.attestCustomer,
    },
  });
}

async function main() {
  loadEnvFile();

  const privateKey = requireValue("PLATFORM_ATTESTOR_PRIVATE_KEY");
  const rpcUrl =
    process.env.ARC_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_ARC_RPC_URL?.trim() ||
    "https://rpc.testnet.arc.network";
  const configuredContract = requireValue(
    "COMMITPASS_V3_CONTRACT_ADDRESS",
  );
  const receiptPath = path.resolve(
    requireValue("SESSION_RECEIPT_PATH"),
  );

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(
      "PLATFORM_ATTESTOR_PRIVATE_KEY must be a 32-byte hex private key.",
    );
  }

  if (!isAddress(configuredContract)) {
    throw new Error("COMMITPASS_V3_CONTRACT_ADDRESS is invalid.");
  }

  if (!fs.existsSync(receiptPath)) {
    throw new Error(`Session receipt not found: ${receiptPath}`);
  }

  const receipt = JSON.parse(
    fs.readFileSync(receiptPath, "utf8"),
  ) as Record<string, unknown>;

  if (Number(receipt.version) !== 1) {
    throw new Error("Unsupported digital session receipt version.");
  }

  const sessionId = String(receipt.sessionId ?? "").trim();

  if (!sessionId || sessionId.length > 128) {
    throw new Error("Receipt sessionId must contain 1-128 characters.");
  }

  const reservationId = parsePositiveBigInt(
    "receipt.reservationId",
    String(receipt.reservationId),
  );
  const chainId = BigInt(Number(receipt.chainId));
  const contractAddress = getAddress(String(receipt.contractAddress));
  const providerAddress = getAddress(String(receipt.provider));
  const customerAddress = getAddress(String(receipt.customer));
  const sessionStart = Number(receipt.sessionStart);
  const generatedAt = Number(receipt.generatedAt);
  const policy = parsePolicy(receipt.policy);
  const providerIntervals = parseIntervals(
    receipt.providerIntervals,
    "providerIntervals",
  );
  const customerIntervals = parseIntervals(
    receipt.customerIntervals,
    "customerIntervals",
  );

  if (chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error("The receipt is not bound to Arc Testnet.");
  }

  if (contractAddress !== getAddress(configuredContract)) {
    throw new Error(
      "The receipt contract does not match COMMITPASS_V3_CONTRACT_ADDRESS.",
    );
  }

  if (!Number.isSafeInteger(sessionStart) || !Number.isSafeInteger(generatedAt)) {
    throw new Error("Session timestamps must be safe integers.");
  }

  const evaluation = evaluateDigitalSession({
    policy,
    sessionStart,
    now: generatedAt,
    providerIntervals,
    customerIntervals,
  });

  if (!evaluation.final) {
    throw new Error("The session receipt does not contain a final outcome.");
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();

  if (network.chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(
      `RPC returned chain ${network.chainId.toString()}, expected Arc Testnet.`,
    );
  }

  const contract = new Contract(contractAddress, ABI, provider);
  const reservation = await contract.getReservation(reservationId);
  const attendanceDeadline = BigInt(
    await contract.attendanceDeadline(reservationId),
  );
  const latestBlock = await provider.getBlock("latest");

  if (!latestBlock) {
    throw new Error("Latest Arc Testnet block could not be read.");
  }

  const chainNow = BigInt(latestBlock.timestamp);
  const sessionEnd = BigInt(
    sessionStart + policy.scheduledMinutes * 60,
  );
  const wallet = new Wallet(privateKey);

  if (BigInt(generatedAt) > chainNow) {
    throw new Error(
      "Receipt generatedAt is later than the latest Arc block timestamp.",
    );
  }

  if (sessionEnd > attendanceDeadline) {
    throw new Error(
      "The reservation attendance window closes before the committed digital session can finish.",
    );
  }

  if (Number(reservation.status) !== 2) {
    throw new Error("The reservation is not Active.");
  }

  if (getAddress(reservation.provider) !== providerAddress) {
    throw new Error("Receipt provider does not match the reservation.");
  }

  if (getAddress(reservation.customer) !== customerAddress) {
    throw new Error("Receipt customer does not match the reservation.");
  }

  if (Number(reservation.startTime) !== sessionStart) {
    throw new Error("Receipt session start does not match the reservation.");
  }

  if (getAddress(reservation.attendanceAttestor) !== wallet.address) {
    throw new Error(
      "The configured private key does not match the reservation attestor.",
    );
  }

  if (chainNow >= attendanceDeadline) {
    throw new Error("The onchain attendance window has already closed.");
  }

  const requestedTtl = process.env.ATTESTATION_TTL_SECONDS
    ? parsePositiveBigInt(
        "ATTESTATION_TTL_SECONDS",
        process.env.ATTESTATION_TTL_SECONDS,
      )
    : DEFAULT_TTL_SECONDS;
  const ttl = requestedTtl > MAX_TTL_SECONDS
    ? MAX_TTL_SECONDS
    : requestedTtl;
  const validUntil =
    chainNow + ttl < attendanceDeadline
      ? chainNow + ttl
      : attendanceDeadline;

  if (validUntil <= chainNow) {
    throw new Error("No usable attestation validity remains.");
  }

  if (validUntil - chainNow < MIN_USABLE_TTL_SECONDS) {
    throw new Error(
      "Less than 60 seconds remain in the attendance window. Create a new session instead of issuing a fragile attestation.",
    );
  }

  const domain = {
    name: "CommitPass",
    version: "3",
    chainId: ARC_TESTNET_CHAIN_ID,
    verifyingContract: contractAddress,
  };
  const types = {
    AttendanceAttestation: [
      { name: "reservationId", type: "uint256" },
      { name: "participant", type: "address" },
      { name: "validUntil", type: "uint64" },
    ],
  } as const;

  const candidates = [
    {
      role: "provider",
      participant: providerAddress,
      shouldAttest: evaluation.attestProvider,
      alreadyConfirmed: Boolean(reservation.providerConfirmed),
    },
    {
      role: "customer",
      participant: customerAddress,
      shouldAttest: evaluation.attestCustomer,
      alreadyConfirmed: Boolean(reservation.customerConfirmed),
    },
  ] as const;
  const attestations = [];

  for (const candidate of candidates) {
    if (!candidate.shouldAttest || candidate.alreadyConfirmed) {
      continue;
    }

    const value = {
      reservationId,
      participant: candidate.participant,
      validUntil,
    };
    const signature = await wallet.signTypedData(
      domain,
      types,
      value,
    );
    const recovered = verifyTypedData(domain, types, value, signature);

    if (getAddress(recovered) !== wallet.address) {
      throw new Error(`Local ${candidate.role} signature verification failed.`);
    }

    attestations.push({
      role: candidate.role,
      participant: candidate.participant,
      validUntil: validUntil.toString(),
      signature,
    });
  }

  if (attestations.length === 0) {
    throw new Error(
      "The policy produced no new attendance attestation for this reservation.",
    );
  }

  const output = {
    network: "arc-testnet",
    chainId: ARC_TESTNET_CHAIN_ID.toString(),
    contractAddress,
    reservationId: reservationId.toString(),
    attestor: wallet.address,
    receiptPath,
    receiptHash: keccak256(
      toUtf8Bytes(
        canonicalReceiptForHash({
          receipt,
          policy,
          providerIntervals,
          customerIntervals,
          evaluation,
        }),
      ),
    ),
    evaluation,
    attendanceDeadline: attendanceDeadline.toString(),
    attestations,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(
    "Digital session attestation creation failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
