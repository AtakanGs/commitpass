# CommitPass V3 Security Design

CommitPass V3 is a hardened testnet design for symmetric, two-sided reservation commitments.

## What V3 changes

### Symmetric economics

Both parties lock the same commitment amount.

- Both attend: each party receives its own commitment back.
- Customer no-show: the provider receives both commitments.
- Provider no-show: the customer receives both commitments.
- Refund outcome: each party receives its own commitment back.

This removes the V2 configuration in which provider no-show compensation could be set to zero or materially below the customer commitment.

### Bounded reservation parameters

The contract enforces protocol-level limits rather than relying only on frontend validation:

| Parameter | V3 bound |
|---|---|
| Commitment | 0.10–10,000 USDC |
| Grace period | 5 minutes–2 hours |
| Claim window | 1–72 hours |
| Dispute window | 1–72 hours |
| Arbiter window | 1 hour–7 days |
| Cancellation lead | At least 15 minutes |
| Time between cancellation deadline and start | More than 15 minutes |

### No permanent fund lock

V3 adds two permissionless recovery functions:

- `refundStaleReservation`: refunds both parties when the attendance window and claim window have ended without a claim.
- `refundExpiredDispute`: refunds both parties when the arbiter does not resolve a dispute before the arbiter deadline.

Anyone may trigger these functions after their deadlines, but funds can only return to the reservation parties.

### Evidence commitments

A no-show claim and its dispute require nonzero evidence hashes:

- `claimEvidenceHash`
- `disputeEvidenceHash`

Evidence must remain offchain and must be salted before hashing. Personal data, photos, names, contact details, meeting links and raw evidence must not be placed onchain.

Evidence hashes provide timestamped integrity, not proof that the underlying evidence is true. An arbiter or verified platform attestor is still needed to assess disputed facts.

### Reduced arbiter authority

The arbiter may resolve only a reservation that is already disputed and only before the arbiter deadline.

V3 deliberately removes the V2 general-purpose emergency refund function. Automated stale-reservation and expired-dispute refunds provide liveness without allowing the arbiter to intervene in every active reservation.

## Remaining trust assumptions

V3 does not prove physical attendance. Attendance remains a wallet self-attestation unless a booking platform supplies a stronger signed attestation layer.

The arbiter remains one immutable address. A production deployment should use a multisig or governed arbitration module and should undergo an independent audit.

This implementation is a testnet hackathon prototype, not production financial infrastructure.
