import {
  serializeSessionPolicy,
  type DigitalSessionPolicy,
  type SessionEvaluation,
  type SessionInterval,
} from "./sessionPolicy";

export type DigitalSessionReceipt = {
  version: 1;
  reservationId: string;
  chainId: number;
  contractAddress: string;
  provider: string;
  customer: string;
  sessionId: string;
  sessionStart: number;
  generatedAt: number;
  policy: DigitalSessionPolicy;
  providerIntervals: SessionInterval[];
  customerIntervals: SessionInterval[];
  evaluation: Pick<
    SessionEvaluation,
    | "code"
    | "providerSeconds"
    | "customerSeconds"
    | "verifiedOverlapSeconds"
    | "recommendedContractOutcome"
    | "attestProvider"
    | "attestCustomer"
  >;
};

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const RESERVATION_ID_PATTERN = /^[1-9]\d*$/;

function normalizeAddress(value: string, label: string) {
  const normalized = value.trim().toLowerCase();

  if (!ADDRESS_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a valid EVM address.`);
  }

  return normalized;
}

function normalizeIntervals(intervals: readonly SessionInterval[]) {
  return intervals.map((interval) => ({
    joinedAt: Math.floor(interval.joinedAt),
    leftAt: Math.floor(interval.leftAt),
  }));
}

export function createDigitalSessionReceipt(input: {
  reservationId: bigint | string;
  chainId: number;
  contractAddress: string;
  provider: string;
  customer: string;
  sessionId: string;
  sessionStart: number;
  generatedAt: number;
  policy: DigitalSessionPolicy;
  providerIntervals: readonly SessionInterval[];
  customerIntervals: readonly SessionInterval[];
  evaluation: SessionEvaluation;
}): DigitalSessionReceipt {
  const reservationId = String(input.reservationId);

  if (!RESERVATION_ID_PATTERN.test(reservationId)) {
    throw new Error("Reservation ID must be a positive integer.");
  }

  if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) {
    throw new Error("Chain ID must be a positive safe integer.");
  }

  const sessionId = input.sessionId.trim();

  if (!sessionId || sessionId.length > 128) {
    throw new Error("Session ID must contain 1-128 characters.");
  }

  if (!input.evaluation.final) {
    throw new Error("A final session evaluation is required.");
  }

  serializeSessionPolicy(input.policy);

  return {
    version: 1,
    reservationId,
    chainId: input.chainId,
    contractAddress: normalizeAddress(
      input.contractAddress,
      "Contract address",
    ),
    provider: normalizeAddress(input.provider, "Provider"),
    customer: normalizeAddress(input.customer, "Customer"),
    sessionId,
    sessionStart: Math.floor(input.sessionStart),
    generatedAt: Math.floor(input.generatedAt),
    policy: { ...input.policy },
    providerIntervals: normalizeIntervals(input.providerIntervals),
    customerIntervals: normalizeIntervals(input.customerIntervals),
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
  };
}

export function canonicalizeDigitalSessionReceipt(
  receipt: DigitalSessionReceipt,
) {
  return JSON.stringify({
    version: receipt.version,
    reservationId: receipt.reservationId,
    chainId: receipt.chainId,
    contractAddress: receipt.contractAddress.toLowerCase(),
    provider: receipt.provider.toLowerCase(),
    customer: receipt.customer.toLowerCase(),
    sessionId: receipt.sessionId,
    sessionStart: receipt.sessionStart,
    generatedAt: receipt.generatedAt,
    policy: serializeSessionPolicy(receipt.policy),
    providerIntervals: receipt.providerIntervals.map((interval) => [
      interval.joinedAt,
      interval.leftAt,
    ]),
    customerIntervals: receipt.customerIntervals.map((interval) => [
      interval.joinedAt,
      interval.leftAt,
    ]),
    evaluation: {
      code: receipt.evaluation.code,
      providerSeconds: receipt.evaluation.providerSeconds,
      customerSeconds: receipt.evaluation.customerSeconds,
      verifiedOverlapSeconds:
        receipt.evaluation.verifiedOverlapSeconds,
      recommendedContractOutcome:
        receipt.evaluation.recommendedContractOutcome,
      attestProvider: receipt.evaluation.attestProvider,
      attestCustomer: receipt.evaluation.attestCustomer,
    },
  });
}
