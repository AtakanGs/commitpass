# Digitally Verified Session Attendance

CommitPass V3 remains a commitment protocol. It does not judge subjective service quality or hold the full service fee. This reference policy adds measurable digital-session terms that can be committed by the reservation metadata hash and evaluated by a trusted attendance adapter.

## Reference policy

The hackathon reference scenario is a 30-minute online lesson or expert session:

- scheduled duration: 30 minutes
- issue window: 5 minutes
- completion threshold: 20 minutes of verified simultaneous participation
- equal refundable commitment: configured per reservation

The issue window is not represented as a statutory cancellation right. It is an operational period for connection problems, wrong-session reports and clear no-show detection. Legal cancellation and consumer-right rules remain market-specific.

## Why simultaneous participation matters

Adding each party's individual connection time is insufficient. A provider could remain online for the first 20 minutes and a customer for the last 20 minutes without receiving the service together. The policy therefore normalizes reconnect intervals and calculates only the overlap during the scheduled session.

## Final outcomes

The adapter waits until the scheduled session ends before issuing a final result.

| Session record | Adapter action | V3 path |
|---|---|---|
| overlap reaches completion threshold | attest both parties | automatic `Completed` settlement |
| provider reaches threshold, customer does not | attest provider only | provider may open `CustomerNoShow` claim |
| customer reaches threshold, provider does not | attest customer only | customer may open `ProviderNoShow` claim |
| one party waits through issue window and the other never establishes attendance | attest waiting party only | corresponding no-show claim |
| both attend separately, both leave early or data is ambiguous | attest neither | manual review or eventual stale refund |

`CustomerNoShow` and `ProviderNoShow` are the existing V3 contract outcomes. At product level they can also represent a measurable early-exit breach. The proof page and pitch must explain this mapping rather than claiming that every such case is a literal failure to connect.

## Onchain compatibility

No new contract deployment is required.

V3 already allows each reservation to choose a grace period. The frontend now derives that period from the scheduled digital session plus a five-minute settlement buffer, while staying inside the contract's two-hour limit. This keeps the attestation window open long enough to evaluate a 20-minute threshold.

The reservation invitation includes the duration, issue window and completion threshold. These terms are included in the salted metadata hash. Changing a shared URL parameter therefore causes metadata verification to fail.

## Session receipt

A final adapter produces a canonical receipt containing:

- reservation ID, Arc chain ID and final V3 contract address
- provider and customer addresses
- platform session ID
- scheduled start and receipt time
- compact policy reference
- normalized provider and customer connection intervals
- verified overlap
- final evaluation and recommended V3 outcome

The receipt content can remain private or be stored in platform infrastructure. Its Keccak-256 hash can be used as a tamper-evident evidence reference. The hash proves that the referenced receipt did not change; it does not prove that the source event was honest.

## Security boundaries

The policy closes several product-level gaps but does not make digital attendance trustless:

- the session platform must authenticate join and leave events
- browser-provided timestamps alone are not sufficient
- the attestor must not sign arbitrary client-submitted intervals
- the attestor private key must remain server-side
- the adapter must bind events to the correct reservation and wallets
- collusion, compromised platform accounts and compromised attestor keys remain trust risks
- subjective quality complaints remain outside automatic settlement

A production adapter should use authenticated platform webhooks, idempotent event storage, replay protection, audit logs, rate limiting and managed key storage.

## Hackathon claim

The accurate product claim is:

> CommitPass commits measurable digital-session terms onchain, evaluates authenticated platform events offchain and uses a reservation-bound attestor signature to settle two-sided USDC commitments on Arc.

It should not be described as a trustless proof of service quality or identity.
