import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseEventLogs,
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import {
  commitmentEscrowAbi,
  erc20Abi,
} from "@/lib/abis";
import {
  arcTestnet,
  ARC_TESTNET_RPC,
  ARC_USDC_ADDRESS,
} from "@/lib/arc";
import {
  createEvidenceReference,
  createMetadataSalt,
  hashReservationMetadata,
} from "@/lib/metadata";
import { connectWallet } from "@/lib/wallet";

const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_TESTNET_RPC),
});

const FINAL_V3_ADDRESS =
  "0x66592bDB161b2C68ceFB4133Cfa0dB08eD2Ff791";

const GRACE_PERIOD = 15n * 60n;
const CLAIM_WINDOW = 24n * 60n * 60n;
const DISPUTE_WINDOW = 24n * 60n * 60n;
const ARBITER_WINDOW = 72n * 60n * 60n;

export const STATUS_LABELS = [
  "None",
  "Awaiting customer",
  "Active",
  "Claim pending",
  "Disputed",
  "Resolved",
  "Cancelled",
] as const;

export const OUTCOME_LABELS = [
  "None",
  "Completed",
  "Customer no-show",
  "Provider no-show",
  "Refund both",
] as const;

export type AttendanceMode =
  | "self"
  | "platform";

export function getContractAddress(): Address {
  const configured =
    process.env
      .NEXT_PUBLIC_COMMITPASS_CONTRACT_ADDRESS;

  const value =
    configured && isAddress(configured)
      ? configured
      : FINAL_V3_ADDRESS;

  return getAddress(value);
}

export function usdc(value: string) {
  return parseUnits(value, 6);
}

export function formatUsdc(value: bigint) {
  return `${formatUnits(value, 6)} USDC`;
}

export function explainContractError(
  caught: unknown,
) {
  const message =
    caught instanceof Error
      ? caught.message
      : String(caught);

  if (
    /request limit reached|request exceeds defined limit|rate limited/i.test(
      message,
    )
  ) {
    return "Arc Testnet RPC is temporarily rate-limited. Wait a few seconds and retry.";
  }

  if (/TooLate|0xecdd1c29/i.test(message)) {
    return "This action is no longer available because its deadline has passed.";
  }

  if (/TooEarly/i.test(message)) {
    return "This action is not available yet.";
  }

  if (/Unauthorized/i.test(message)) {
    return "The connected wallet is not authorized to perform this action.";
  }

  if (/InvalidState/i.test(message)) {
    return "This action is not available in the reservation's current state.";
  }

  if (/AttendanceNotConfirmed/i.test(message)) {
    return "Your attendance must be recorded before opening this no-show claim.";
  }

  if (/PlatformAttestationRequired/i.test(message)) {
    return "This reservation requires a signed platform attendance attestation.";
  }

  if (/PlatformAttestationNotEnabled/i.test(message)) {
    return "This reservation uses self-attested attendance and does not accept platform signatures.";
  }

  if (/InvalidAttestationSignature/i.test(message)) {
    return "The attendance signature is invalid for this reservation, participant, chain, contract, or platform signer.";
  }

  if (/AttestationExpired/i.test(message)) {
    return "The platform attendance attestation has expired.";
  }

  if (/InvalidEvidence/i.test(message)) {
    return "A non-empty salted evidence reference is required.";
  }

  if (/InvalidOutcome/i.test(message)) {
    return "The selected outcome is not valid for this reservation.";
  }

  if (/InvalidSchedule/i.test(message)) {
    return "The reservation schedule or deadline is invalid.";
  }

  if (/InvalidAmount/i.test(message)) {
    return "The commitment must be between 0.10 and 10,000 USDC.";
  }

  if (/InvalidAddress/i.test(message)) {
    return "One or more wallet addresses are invalid or conflict with a protected role.";
  }

  return message;
}

export async function approveCommitment(
  amount: bigint,
): Promise<Hash> {
  const {
    account,
    walletClient,
    publicClient,
  } = await connectWallet();

  const hash = await walletClient.writeContract({
    account,
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: [getContractAddress(), amount],
  });

  await publicClient.waitForTransactionReceipt({
    hash,
  });

  return hash;
}

export async function createReservation(input: {
  customer: Address;
  attendanceMode: AttendanceMode;
  attendanceAttestor?: string;
  commitmentAmount: string;
  startTime: Date;
  freeCancellationHours: number;
  title: string;
}) {
  const commitmentAmount =
    usdc(input.commitmentAmount);

  const startTime = BigInt(
    Math.floor(
      input.startTime.getTime() / 1000,
    ),
  );

  const cancellationLead = BigInt(
    Math.floor(
      input.freeCancellationHours * 3600,
    ),
  );

  if (cancellationLead <= 0n) {
    throw new Error(
      "The free-cancellation lead must be positive.",
    );
  }

  const cancellationDeadline =
    startTime - cancellationLead;

  let attendanceAttestor: Address =
    zeroAddress;

  if (input.attendanceMode === "platform") {
    if (
      !input.attendanceAttestor ||
      !isAddress(input.attendanceAttestor)
    ) {
      throw new Error(
        "A valid platform attestor address is required.",
      );
    }

    attendanceAttestor = getAddress(
      input.attendanceAttestor,
    );
  }

  const metadataSalt = createMetadataSalt();
  const metadataHash =
    hashReservationMetadata(
      input.title,
      metadataSalt,
    );

  await approveCommitment(
    commitmentAmount,
  );

  const {
    account,
    walletClient,
    publicClient,
  } = await connectWallet();

  const { request } =
    await publicClient.simulateContract({
      account,
      address: getContractAddress(),
      abi: commitmentEscrowAbi,
      functionName: "createReservation",
      args: [
        input.customer,
        attendanceAttestor,
        commitmentAmount,
        startTime,
        cancellationDeadline,
        GRACE_PERIOD,
        CLAIM_WINDOW,
        DISPUTE_WINDOW,
        ARBITER_WINDOW,
        metadataHash,
      ],
    });

  const hash =
    await walletClient.writeContract(
      request,
    );

  const receipt =
    await publicClient
      .waitForTransactionReceipt({
        hash,
      });

  const [createdLog] = parseEventLogs({
    abi: commitmentEscrowAbi,
    logs: receipt.logs,
    eventName: "ReservationCreated",
  });

  if (!createdLog) {
    throw new Error(
      "The reservation transaction succeeded, but its creation event could not be read.",
    );
  }

  return {
    hash,
    reservationId:
      createdLog.args.reservationId,
    metadataSalt,
    attendanceAttestor,
  };
}

export async function readReservation(
  id: bigint,
) {
  return arcPublicClient.readContract({
    address: getContractAddress(),
    abi: commitmentEscrowAbi,
    functionName: "getReservation",
    args: [id],
  });
}

export async function readArbiter():
Promise<Address> {
  return arcPublicClient.readContract({
    address: getContractAddress(),
    abi: commitmentEscrowAbi,
    functionName: "arbiter",
  });
}

export async function acceptReservation(
  id: bigint,
) {
  const reservation =
    await readReservation(id);

  await approveCommitment(
    reservation.commitmentAmount,
  );

  return writeSimple(
    "acceptReservation",
    [id],
  );
}

type SimpleFunctionName =
  | "acceptReservation"
  | "cancelReservation"
  | "expireUnacceptedReservation"
  | "confirmAttendance"
  | "finalizeUndisputedClaim"
  | "refundStaleReservation"
  | "refundExpiredDispute";

export async function writeSimple(
  functionName: SimpleFunctionName,
  args: readonly [bigint],
) {
  const {
    account,
    walletClient,
    publicClient,
  } = await connectWallet();

  const { request } =
    await publicClient.simulateContract({
      account,
      address: getContractAddress(),
      abi: commitmentEscrowAbi,
      functionName,
      args,
    });

  const hash =
    await walletClient.writeContract(
      request,
    );

  await publicClient
    .waitForTransactionReceipt({
      hash,
    });

  return hash;
}

export async function
confirmAttendanceWithAttestation(
  id: bigint,
  participant: Address,
  validUntil: bigint,
  signature: Hex,
) {
  const {
    account,
    walletClient,
    publicClient,
  } = await connectWallet();

  const { request } =
    await publicClient.simulateContract({
      account,
      address: getContractAddress(),
      abi: commitmentEscrowAbi,
      functionName:
        "confirmAttendanceWithAttestation",
      args: [
        id,
        participant,
        validUntil,
        signature,
      ],
    });

  const hash =
    await walletClient.writeContract(
      request,
    );

  await publicClient
    .waitForTransactionReceipt({
      hash,
    });

  return hash;
}

export async function openNoShowClaim(
  id: bigint,
  outcome: 2 | 3,
  evidenceNote: string,
) {
  const evidence =
    createEvidenceReference(
      evidenceNote,
    );

  const {
    account,
    walletClient,
    publicClient,
  } = await connectWallet();

  const { request } =
    await publicClient.simulateContract({
      account,
      address: getContractAddress(),
      abi: commitmentEscrowAbi,
      functionName: "openNoShowClaim",
      args: [
        id,
        outcome,
        evidence.hash,
      ],
    });

  const transactionHash =
    await walletClient.writeContract(
      request,
    );

  await publicClient
    .waitForTransactionReceipt({
      hash: transactionHash,
    });

  return {
    transactionHash,
    evidenceHash: evidence.hash,
    evidenceSalt: evidence.salt,
  };
}

export async function disputeClaim(
  id: bigint,
  evidenceNote: string,
) {
  const evidence =
    createEvidenceReference(
      evidenceNote,
    );

  const {
    account,
    walletClient,
    publicClient,
  } = await connectWallet();

  const { request } =
    await publicClient.simulateContract({
      account,
      address: getContractAddress(),
      abi: commitmentEscrowAbi,
      functionName: "disputeClaim",
      args: [
        id,
        evidence.hash,
      ],
    });

  const transactionHash =
    await walletClient.writeContract(
      request,
    );

  await publicClient
    .waitForTransactionReceipt({
      hash: transactionHash,
    });

  return {
    transactionHash,
    evidenceHash: evidence.hash,
    evidenceSalt: evidence.salt,
  };
}

export async function resolveDispute(
  id: bigint,
  outcome: 1 | 2 | 3 | 4,
) {
  const {
    account,
    walletClient,
    publicClient,
  } = await connectWallet();

  const { request } =
    await publicClient.simulateContract({
      account,
      address: getContractAddress(),
      abi: commitmentEscrowAbi,
      functionName: "resolveDispute",
      args: [id, outcome],
    });

  const hash =
    await walletClient.writeContract(
      request,
    );

  await publicClient
    .waitForTransactionReceipt({
      hash,
    });

  return hash;
}
