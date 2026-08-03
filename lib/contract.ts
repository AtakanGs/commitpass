import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseEventLogs,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { commitmentEscrowAbi, erc20Abi } from "@/lib/abis";
import { arcTestnet, ARC_TESTNET_RPC, ARC_USDC_ADDRESS } from "@/lib/arc";
import {
  createMetadataSalt,
  hashReservationMetadata,
} from "@/lib/metadata";
import { connectWallet } from "@/lib/wallet";

const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_TESTNET_RPC),
});

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

export function getContractAddress(): Address {
  const configured = process.env.NEXT_PUBLIC_COMMITPASS_CONTRACT_ADDRESS;
  const value =
    configured && isAddress(configured)
      ? configured
      : "0x8b28Ee06fD5d59d8886474733d7D3B58cDB33A5D";

  return getAddress(value);
}

export function usdc(value: string) {
  return parseUnits(value, 6);
}

export function formatUsdc(value: bigint) {
  return `${formatUnits(value, 6)} USDC`;
}

export function explainContractError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : String(caught);

  if (/request limit reached|request exceeds defined limit|rate limited/i.test(message)) {
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
    return "Confirm your own attendance during the check-in window before opening a no-show claim.";
  }

  if (/InvalidOutcome/i.test(message)) {
    return "The selected outcome is not valid for this reservation.";
  }

  if (/InvalidSchedule/i.test(message)) {
    return "The reservation schedule or deadline is invalid.";
  }

  if (/InvalidAmount/i.test(message)) {
    return "One or more commitment amounts are invalid.";
  }

  if (/InvalidAddress/i.test(message)) {
    return "One or more wallet addresses are invalid.";
  }

  return message;
}

export async function approveCommitment(amount: bigint): Promise<Hash> {
  const { account, walletClient, publicClient } = await connectWallet();
  const hash = await walletClient.writeContract({
    account,
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: [getContractAddress(), amount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function createReservation(input: {
  customer: Address;
  providerCommitment: string;
  customerCommitment: string;
  providerCompensation: string;
  startTime: Date;
  freeCancellationHours: number;
  title: string;
}) {
  const providerBond = usdc(input.providerCommitment);
  const customerBond = usdc(input.customerCommitment);
  const compensation = usdc(input.providerCompensation);
  const startTime = BigInt(Math.floor(input.startTime.getTime() / 1000));
  const cancellationDeadline = startTime - BigInt(input.freeCancellationHours * 3600);
  const metadataSalt = createMetadataSalt();
  const metadataHash = hashReservationMetadata(
    input.title,
    metadataSalt,
  );

  await approveCommitment(providerBond);
  const { account, walletClient, publicClient } = await connectWallet();
  const { request } = await publicClient.simulateContract({
    account,
    address: getContractAddress(),
    abi: commitmentEscrowAbi,
    functionName: "createReservation",
    args: [
      input.customer,
      providerBond,
      customerBond,
      compensation,
      startTime,
      cancellationDeadline,
      15n * 60n,
      12n * 60n * 60n,
      metadataHash,
    ],
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({
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
    reservationId: createdLog.args.reservationId,
    metadataSalt,
  };
}

export async function readReservation(id: bigint) {
  return arcPublicClient.readContract({
    address: getContractAddress(),
    abi: commitmentEscrowAbi,
    functionName: "getReservation",
    args: [id],
  });
}

export async function readArbiter(): Promise<Address> {
  return arcPublicClient.readContract({
    address: getContractAddress(),
    abi: commitmentEscrowAbi,
    functionName: "arbiter",
  });
}

export async function acceptReservation(id: bigint) {
  const reservation = await readReservation(id);
  await approveCommitment(reservation.customerCommitment);
  return writeSimple("acceptReservation", [id]);
}

export async function writeSimple(
  functionName:
    | "acceptReservation"
    | "cancelReservation"
    | "expireUnacceptedReservation"
    | "confirmAttendance"
    | "disputeClaim"
    | "finalizeUndisputedClaim",
  args: readonly [bigint],
) {
  const { account, walletClient, publicClient } = await connectWallet();
  const { request } = await publicClient.simulateContract({
    account,
    address: getContractAddress(),
    abi: commitmentEscrowAbi,
    functionName,
    args,
  });
  const hash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function openNoShowClaim(id: bigint, outcome: 2 | 3) {
  const { account, walletClient, publicClient } = await connectWallet();
  const { request } = await publicClient.simulateContract({
    account,
    address: getContractAddress(),
    abi: commitmentEscrowAbi,
    functionName: "openNoShowClaim",
    args: [id, outcome],
  });
  const hash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function resolveDispute(
  id: bigint,
  outcome: 1 | 2 | 3 | 4,
) {
  const { account, walletClient, publicClient } = await connectWallet();
  const { request } = await publicClient.simulateContract({
    account,
    address: getContractAddress(),
    abi: commitmentEscrowAbi,
    functionName: "resolveDispute",
    args: [id, outcome],
  });
  const hash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
