import {
  formatUnits,
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
  type Hash,
} from "viem";
import { commitmentEscrowAbi, erc20Abi } from "@/lib/abis";
import { ARC_USDC_ADDRESS } from "@/lib/arc";
import { connectWallet } from "@/lib/wallet";

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
      : "0x02b02Cdb93B32a9bcDC9cb5904Cef2ABb2F7De6D";

  return getAddress(value);
}

export function usdc(value: string) {
  return parseUnits(value, 6);
}

export function formatUsdc(value: bigint) {
  return `${formatUnits(value, 6)} USDC`;
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
  const metadataHash = keccak256(stringToHex(input.title));

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
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function readReservation(id: bigint) {
  const { publicClient } = await connectWallet();
  return publicClient.readContract({
    address: getContractAddress(),
    abi: commitmentEscrowAbi,
    functionName: "getReservation",
    args: [id],
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
