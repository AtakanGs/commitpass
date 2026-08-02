import {
  bytesToHex,
  keccak256,
  stringToHex,
  type Hash,
  type Hex,
} from "viem";

const METADATA_SALT_BYTES = 32;

export function createMetadataSalt(): Hex {
  const bytes = new Uint8Array(METADATA_SALT_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function hashReservationMetadata(
  title: string,
  salt?: string,
): Hash {
  const normalizedTitle = title.trim();
  const normalizedSalt = salt?.trim().toLowerCase();
  const value = normalizedSalt
    ? normalizedSalt + ":" + normalizedTitle
    : normalizedTitle;

  return keccak256(stringToHex(value));
}

export function verifyReservationMetadata(
  title: string,
  metadataHash: string,
  salt?: string,
) {
  if (!title.trim()) {
    return false;
  }

  return (
    hashReservationMetadata(title, salt).toLowerCase() ===
    metadataHash.toLowerCase()
  );
}
