import {
  bytesToHex,
  keccak256,
  stringToHex,
  type Hash,
  type Hex,
} from "viem";

import {
  canonicalizeDigitalSessionReceipt,
  type DigitalSessionReceipt,
} from "@/lib/sessionReceipt";
import {
  serializeSessionPolicy,
  type DigitalSessionPolicy,
} from "@/lib/sessionPolicy";

const REFERENCE_SALT_BYTES = 32;

export function createMetadataSalt(): Hex {
  const bytes = new Uint8Array(REFERENCE_SALT_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function hashReservationMetadata(
  title: string,
  salt?: string,
  sessionPolicy?: DigitalSessionPolicy,
): Hash {
  const normalizedTitle = title.trim();
  const normalizedSalt = salt?.trim().toLowerCase();
  const policyReference = sessionPolicy
    ? serializeSessionPolicy(sessionPolicy)
    : undefined;

  const terms = policyReference
    ? JSON.stringify({
        title: normalizedTitle,
        sessionPolicy: policyReference,
      })
    : normalizedTitle;

  const value = normalizedSalt
    ? normalizedSalt + ":" + terms
    : terms;

  return keccak256(stringToHex(value));
}

export function createEvidenceReference(
  evidenceNote: string,
) {
  const salt = createMetadataSalt();

  return {
    hash: hashReservationMetadata(
      evidenceNote,
      salt,
    ),
    salt,
  };
}

export function verifyReservationMetadata(
  title: string,
  metadataHash: string,
  salt?: string,
  sessionPolicy?: DigitalSessionPolicy,
) {
  if (!title.trim()) {
    return false;
  }

  return (
    hashReservationMetadata(
      title,
      salt,
      sessionPolicy,
    ).toLowerCase() ===
    metadataHash.toLowerCase()
  );
}

export function hashDigitalSessionReceipt(
  receipt: DigitalSessionReceipt,
): Hash {
  return keccak256(
    stringToHex(
      canonicalizeDigitalSessionReceipt(
        receipt,
      ),
    ),
  );
}
