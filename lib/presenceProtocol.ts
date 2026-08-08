import {
  getAddress,
  isAddress,
  type Address,
} from "viem";

export type PresenceAuthorizationInput = {
  reservationId: string;
  participant: Address;
  expiresAt: number;
  nonce: string;
};

export type LivePresencePolicyInput = {
  duration: string;
  issue: string;
  threshold: string;
};

export function presenceAuthorizationMessage(
  input: PresenceAuthorizationInput,
) {
  return [
    "CommitPass Live Presence",
    "",
    `Reservation: ${input.reservationId}`,
    `Participant: ${getAddress(input.participant)}`,
    `Expires: ${input.expiresAt}`,
    `Nonce: ${input.nonce}`,
    "",
    "Authorize this browser to send server-timestamped presence heartbeats for this reservation.",
    "This does not transfer funds.",
  ].join("\n");
}

export function validPresenceParticipant(
  value: string,
): value is Address {
  return isAddress(value);
}
