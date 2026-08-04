const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  initiateDeveloperControlledWalletsClient,
} = require("@circle-fin/developer-controlled-wallets");
const {
  createPublicClient,
  encodeFunctionData,
  http,
  keccak256,
  stringToHex,
} = require("viem");

const RPC_URL = "https://rpc.drpc.testnet.arc.network";
const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000";
const COMMITPASS_ADDRESS =
  "0x8b28Ee06fD5d59d8886474733d7D3B58cDB33A5D";
const CUSTOMER_ADDRESS =
  "0x9e0c85CbF38CE6394192F10B3Aff6A4d8dE25E96";

const EXPECTED_RESERVATION_ID = 6n;
const PROVIDER_COMMITMENT = 1_000_000n;
const CUSTOMER_COMMITMENT = 1_000_000n;
const PROVIDER_COMPENSATION = 500_000n;
const GRACE_PERIOD = 3_600n;
const DISPUTE_WINDOW = 3_600n;
const TITLE = "Circle wallet proof";

const envPath = path.join(process.cwd(), ".env.local");
const walletPath = path.join(
  process.cwd(),
  "deployments",
  "circle-arc-testnet.json",
);
const proofPath = path.join(
  process.cwd(),
  "deployments",
  "circle-reservation-6.json",
);

const usdcAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const commitPassAbi = [
  {
    type: "function",
    name: "nextReservationId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createReservation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "customer", type: "address" },
      { name: "providerCommitment", type: "uint128" },
      { name: "customerCommitment", type: "uint128" },
      { name: "providerCompensation", type: "uint128" },
      { name: "startTime", type: "uint64" },
      {
        name: "freeCancellationDeadline",
        type: "uint64",
      },
      { name: "gracePeriod", type: "uint64" },
      { name: "disputeWindow", type: "uint64" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [
      { name: "reservationId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getReservation",
    stateMutability: "view",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "provider", type: "address" },
          { name: "customer", type: "address" },
          {
            name: "providerCommitment",
            type: "uint128",
          },
          {
            name: "customerCommitment",
            type: "uint128",
          },
          {
            name: "providerCompensation",
            type: "uint128",
          },
          { name: "startTime", type: "uint64" },
          {
            name: "freeCancellationDeadline",
            type: "uint64",
          },
          { name: "gracePeriod", type: "uint64" },
          { name: "disputeWindow", type: "uint64" },
          { name: "claimOpenedAt", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "pendingOutcome", type: "uint8" },
          { name: "finalOutcome", type: "uint8" },
          { name: "providerConfirmed", type: "bool" },
          { name: "customerConfirmed", type: "bool" },
          { name: "metadataHash", type: "bytes32" },
        ],
      },
    ],
  },
];

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(".env.local was not found.");
  }

  const values = {};

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  });

  fs.writeFileSync(
    filePath,
    JSON.stringify(value, null, 2) + "\n",
    "utf8",
  );
}

function createInitialProof(wallet) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const freeCancellationDeadline = now + 86_400n;
  const startTime = now + 172_800n;
  const salt =
    "0x" + crypto.randomBytes(32).toString("hex");
  const metadataHash = keccak256(
    stringToHex(
      salt.toLowerCase() + ":" + TITLE.trim(),
    ),
  );

  return {
    product: "Circle Developer-Controlled Wallets",
    network: "ARC-TESTNET",
    contractAddress: COMMITPASS_ADDRESS,
    usdcAddress: USDC_ADDRESS,
    reservationId: EXPECTED_RESERVATION_ID.toString(),
    provider: wallet.address,
    customer: CUSTOMER_ADDRESS,
    walletId: wallet.walletId,
    title: TITLE,
    salt,
    metadataHash,
    providerCommitment: PROVIDER_COMMITMENT.toString(),
    customerCommitment: CUSTOMER_COMMITMENT.toString(),
    providerCompensation:
      PROVIDER_COMPENSATION.toString(),
    freeCancellationDeadline:
      freeCancellationDeadline.toString(),
    startTime: startTime.toString(),
    gracePeriod: GRACE_PERIOD.toString(),
    disputeWindow: DISPUTE_WINDOW.toString(),
    approveIdempotencyKey: crypto.randomUUID(),
    createIdempotencyKey: crypto.randomUUID(),
    approveTransactionId: null,
    approveTransactionHash: null,
    createTransactionId: null,
    createTransactionHash: null,
    onchainVerifiedAt: null,
  };
}

function assertAddressEqual(actual, expected, label) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `${label} mismatch. Expected ${expected}, received ${actual}.`,
    );
  }
}

async function waitForCircleTransaction(
  client,
  transactionId,
  label,
) {
  const successStates = new Set([
    "CONFIRMED",
    "COMPLETE",
  ]);
  const failureStates = new Set([
    "CANCELLED",
    "DENIED",
    "FAILED",
    "STUCK",
  ]);

  for (let attempt = 1; attempt <= 90; attempt += 1) {
    const response = await client.getTransaction({
      id: transactionId,
    });

    const transaction = response.data?.transaction;

    if (!transaction) {
      throw new Error(
        `Circle returned no transaction for ${label}.`,
      );
    }

    const state = transaction.state ?? "UNKNOWN";

    console.log(
      `${label}: ${state} (${attempt}/90)`,
    );

    if (successStates.has(state)) {
      return transaction;
    }

    if (failureStates.has(state)) {
      throw new Error(
        `${label} failed in state ${state}: ` +
          (transaction.errorReason ?? "No reason supplied."),
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 4_000),
    );
  }

  throw new Error(
    `${label} did not reach a terminal state in time.`,
  );
}

async function readReservationIfCreated(
  publicClient,
  wallet,
) {
  const nextReservationId =
    await publicClient.readContract({
      address: COMMITPASS_ADDRESS,
      abi: commitPassAbi,
      functionName: "nextReservationId",
    });

  if (nextReservationId <= EXPECTED_RESERVATION_ID) {
    return null;
  }

  const reservation =
    await publicClient.readContract({
      address: COMMITPASS_ADDRESS,
      abi: commitPassAbi,
      functionName: "getReservation",
      args: [EXPECTED_RESERVATION_ID],
    });

  assertAddressEqual(
    reservation.provider,
    wallet.address,
    "Reservation provider",
  );
  assertAddressEqual(
    reservation.customer,
    CUSTOMER_ADDRESS,
    "Reservation customer",
  );

  return reservation;
}

function verifyReservation(reservation, proof) {
  if (
    reservation.providerCommitment !==
    PROVIDER_COMMITMENT
  ) {
    throw new Error(
      "Provider commitment does not match.",
    );
  }

  if (
    reservation.customerCommitment !==
    CUSTOMER_COMMITMENT
  ) {
    throw new Error(
      "Customer commitment does not match.",
    );
  }

  if (
    reservation.providerCompensation !==
    PROVIDER_COMPENSATION
  ) {
    throw new Error(
      "Provider compensation does not match.",
    );
  }

  if (reservation.status !== 1) {
    throw new Error(
      `Unexpected reservation status: ${reservation.status}.`,
    );
  }

  if (
    reservation.metadataHash.toLowerCase() !==
    proof.metadataHash.toLowerCase()
  ) {
    throw new Error(
      "Reservation metadata hash does not match.",
    );
  }
}

async function main() {
  const env = readEnvFile(envPath);
  const wallet = readJson(walletPath);

  if (!env.CIRCLE_API_KEY || !env.CIRCLE_ENTITY_SECRET) {
    throw new Error(
      "Circle credentials are missing from .env.local.",
    );
  }

  if (!wallet?.walletId || !wallet?.address) {
    throw new Error(
      "Circle wallet deployment record is incomplete.",
    );
  }

  const client =
    initiateDeveloperControlledWalletsClient({
      apiKey: env.CIRCLE_API_KEY,
      entitySecret: env.CIRCLE_ENTITY_SECRET,
    });

  const publicClient = createPublicClient({
    transport: http(RPC_URL),
  });

  let proof = readJson(proofPath);

  if (!proof) {
    const nextReservationId =
      await publicClient.readContract({
        address: COMMITPASS_ADDRESS,
        abi: commitPassAbi,
        functionName: "nextReservationId",
      });

    if (
      nextReservationId !== EXPECTED_RESERVATION_ID
    ) {
      throw new Error(
        `Expected nextReservationId 6, received ${nextReservationId}. No transaction was sent.`,
      );
    }

    proof = createInitialProof(wallet);
    writeJson(proofPath, proof);
  }

  assertAddressEqual(
    proof.provider,
    wallet.address,
    "Proof provider",
  );

  let reservation =
    await readReservationIfCreated(
      publicClient,
      wallet,
    );

  if (!reservation) {
    let allowance =
      await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: usdcAbi,
        functionName: "allowance",
        args: [
          wallet.address,
          COMMITPASS_ADDRESS,
        ],
      });

    if (allowance < PROVIDER_COMMITMENT) {
      if (!proof.approveTransactionId) {
        console.log(
          "Submitting Circle USDC approval...",
        );

        const approveCallData =
          encodeFunctionData({
            abi: usdcAbi,
            functionName: "approve",
            args: [
              COMMITPASS_ADDRESS,
              PROVIDER_COMMITMENT,
            ],
          });

        const response =
          await client.createContractExecutionTransaction({
            walletId: wallet.walletId,
            contractAddress: USDC_ADDRESS,
            callData: approveCallData,
            fee: {
              type: "level",
              config: {
                feeLevel: "HIGH",
              },
            },
            idempotencyKey:
              proof.approveIdempotencyKey,
            refId: "commitpass-circle-usdc-approval",
          });

        const transactionId = response.data?.id;

        if (!transactionId) {
          throw new Error(
            "Circle returned no approval transaction ID.",
          );
        }

        proof.approveTransactionId =
          transactionId;
        writeJson(proofPath, proof);
      }

      const approveTransaction =
        await waitForCircleTransaction(
          client,
          proof.approveTransactionId,
          "USDC approval",
        );

      proof.approveTransactionHash =
        approveTransaction.txHash ?? null;
      writeJson(proofPath, proof);

      allowance =
        await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: usdcAbi,
          functionName: "allowance",
          args: [
            wallet.address,
            COMMITPASS_ADDRESS,
          ],
        });

      if (allowance < PROVIDER_COMMITMENT) {
        throw new Error(
          "Approval transaction completed but allowance is insufficient.",
        );
      }
    } else {
      console.log(
        "Existing USDC allowance is sufficient.",
      );
    }

    if (!proof.createTransactionId) {
      console.log(
        "Submitting Circle CommitPass reservation...",
      );

      const createCallData =
        encodeFunctionData({
          abi: commitPassAbi,
          functionName: "createReservation",
          args: [
            CUSTOMER_ADDRESS,
            PROVIDER_COMMITMENT,
            CUSTOMER_COMMITMENT,
            PROVIDER_COMPENSATION,
            BigInt(proof.startTime),
            BigInt(
              proof.freeCancellationDeadline,
            ),
            GRACE_PERIOD,
            DISPUTE_WINDOW,
            proof.metadataHash,
          ],
        });

      const response =
        await client.createContractExecutionTransaction({
          walletId: wallet.walletId,
          contractAddress: COMMITPASS_ADDRESS,
          callData: createCallData,
          fee: {
            type: "level",
            config: {
              feeLevel: "HIGH",
            },
          },
          idempotencyKey:
            proof.createIdempotencyKey,
          refId:
            "commitpass-circle-reservation-6",
        });

      const transactionId = response.data?.id;

      if (!transactionId) {
        throw new Error(
          "Circle returned no reservation transaction ID.",
        );
      }

      proof.createTransactionId = transactionId;
      writeJson(proofPath, proof);
    }

    const createTransaction =
      await waitForCircleTransaction(
        client,
        proof.createTransactionId,
        "CommitPass reservation",
      );

    proof.createTransactionHash =
      createTransaction.txHash ?? null;
    writeJson(proofPath, proof);

    reservation =
      await readReservationIfCreated(
        publicClient,
        wallet,
      );

    if (!reservation) {
      throw new Error(
        "Circle transaction completed but Reservation #6 was not found onchain.",
      );
    }
  } else {
    console.log(
      "Reservation #6 already exists onchain. No duplicate transaction was sent.",
    );
  }

  verifyReservation(reservation, proof);

  proof.onchainVerifiedAt =
    new Date().toISOString();
  proof.status = "AwaitingCustomer";
  proof.arcscanTransactionUrl =
    proof.createTransactionHash
      ? `https://testnet.arcscan.app/tx/${proof.createTransactionHash}`
      : null;
  proof.arcscanReservationContractUrl =
    `https://testnet.arcscan.app/address/${COMMITPASS_ADDRESS}`;
  writeJson(proofPath, proof);

  console.log("");
  console.log("Circle CommitPass proof");
  console.log("-----------------------");
  console.log(
    "Reservation ID:",
    EXPECTED_RESERVATION_ID.toString(),
  );
  console.log("Provider:", wallet.address);
  console.log("Customer:", CUSTOMER_ADDRESS);
  console.log(
    "Provider commitment: 1 USDC",
  );
  console.log(
    "Customer commitment: 1 USDC",
  );
  console.log(
    "Provider compensation: 0.5 USDC",
  );
  console.log("Title:", proof.title);
  console.log("Salt:", proof.salt);
  console.log(
    "Metadata hash:",
    proof.metadataHash,
  );
  console.log(
    "Approve transaction:",
    proof.approveTransactionHash ??
      proof.approveTransactionId,
  );
  console.log(
    "Create transaction:",
    proof.createTransactionHash ??
      proof.createTransactionId,
  );
  console.log("Status: AwaitingCustomer");
  console.log("");
  console.log(
    "VERIFIED: Circle Developer-Controlled Wallet created CommitPass Reservation #6 on Arc Testnet.",
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "Circle CommitPass reservation creation failed:",
  );

  const details =
    error?.response?.data ??
    error?.cause?.response?.data ??
    error?.message ??
    error;

  console.error(
    typeof details === "string"
      ? details
      : JSON.stringify(details, null, 2),
  );

  process.exitCode = 1;
});
