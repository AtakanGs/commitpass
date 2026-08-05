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
| Cancellation/check-in separation | Cancellation closes at least 15 minutes before check-in opens |

### No permanent fund lock

V3 adds two permissionless recovery functions:

- `refundStaleReservation`: refunds both parties when the attendance window and claim window have ended without a claim.
- `refundExpiredDispute`: refunds both parties when the arbiter does not resolve a dispute before the arbiter deadline.

Anyone may trigger these functions after their deadlines, but funds can only return to the reservation parties.

### Platform-verified attendance

Each reservation selects one immutable attendance mode at creation:

- `attendanceAttestor == address(0)`: self-attested mode, where each reservation party confirms its own attendance.
- `attendanceAttestor != address(0)`: platform-verified mode, where direct participant check-in is disabled and a valid platform signature is required.

Platform attestations use EIP-712 typed data with the following signed fields:

- reservation ID
- participant wallet
- attestation expiry

The EIP-712 domain binds every signature to the `CommitPass` name, version `3`, the current chain ID and the deployed contract address. A signature therefore cannot be reused for another participant, reservation, network or CommitPass deployment.

Any relayer may submit a valid attestation. The configured platform remains the authority because only its EOA or ERC-1271-compatible smart-contract signature is accepted. The attestor cannot also be the provider, customer or arbiter for that reservation.

If a platform never supplies attestations, neither party can create a no-show claim without confirmed attendance. After the claim window ends, `refundStaleReservation` returns both commitments.

A platform signature proves that the configured platform made the signed assertion. It does not independently prove physical presence or the correctness of the platform's underlying attendance data.

### Evidence commitments

A no-show claim and its dispute require nonzero evidence hashes:

- `claimEvidenceHash`
- `disputeEvidenceHash`

Evidence must remain offchain and must be salted before hashing. Personal data, photos, names, contact details, meeting links and raw evidence must not be placed onchain.

Evidence hashes provide timestamped integrity, not proof that the underlying evidence is true. An arbiter or verified platform attestor is still needed to assess disputed facts.

### Reduced arbiter authority

The arbiter may resolve only a reservation that is already disputed and only before the arbiter deadline.

V3 deliberately removes the V2 general-purpose emergency refund function. Automated stale-reservation and expired-dispute refunds provide liveness without allowing the arbiter to intervene in every active reservation.

The immutable arbiter address is also prohibited from acting as either reservation party. This prevents an arbiter from resolving a dispute in which the same address is the provider or customer.

### Deployment input validation

The constructor rejects zero addresses, an arbiter/token collision and token addresses without deployed contract code. Reservation creation rejects a start/grace combination that cannot produce a valid check-in opening before timestamp subtraction.

### Non-overlapping lifecycle windows

The free-cancellation deadline must close at least 15 minutes before the attendance window opens. This prevents acceptance or penalty-free cancellation from overlapping with check-in and keeps the state machine understandable for both parties.

## Remaining trust assumptions

V3 supports self-attested and platform-verified attendance. Platform verification proves which configured platform signed the attendance assertion, but the protocol still trusts that platform’s underlying attendance records.

The arbiter remains one immutable address. A production deployment should use a multisig or governed arbitration module and should undergo an independent audit.

This implementation is a testnet hackathon prototype, not production financial infrastructure.
