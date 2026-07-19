# CommitPass Product Brief

**Author:** Atakan Gündallı
**Project:** Programmable Money Hackathon 2026
**Status:** Arc Testnet prototype

## Problem

Scarce appointments and limited-capacity services lose value when either side fails to honour a reservation. Traditional deposits usually protect only the provider. Customers can still lose time and opportunity when a provider cancels late or fails to deliver.

## Product

CommitPass is a two-sided programmable commitment protocol. A provider and an invited customer each lock a small refundable USDC commitment under rules they can inspect before funding.

- When both sides attend, both commitments return.
- When either side cancels before the deadline, both commitments return.
- When the customer no-shows, the provider receives the customer commitment.
- When the provider no-shows, the customer receives their commitment plus pre-agreed compensation from the provider bond.
- A disputed no-show claim remains locked until an arbiter resolves it.

## Initial use case

The MVP demonstrates a mentoring appointment. This use case is deliberately narrow: it has a clear start time, a scarce slot, identifiable counterparties and measurable opportunity cost.

## Why programmable money

CommitPass does not ask one party to hold the other's money. The settlement rule is defined before funding and executed by the contract. Arc provides the testnet settlement environment, while USDC is the shared denomination for commitments, refunds and compensation.

## MVP scope

1. Provider creates and funds an invitation.
2. Customer accepts and funds the reservation.
3. Either party can cancel before the free-cancellation deadline.
4. Both parties can confirm attendance during a limited check-in window.
5. A party can open a no-show claim after the grace period.
6. The counterparty can dispute during a fixed window.
7. Undisputed claims settle automatically.
8. The arbiter can resolve disputed claims or issue an emergency refund.
9. Duplicate settlement is prevented.
10. Unaccepted invitations can expire and return the provider bond.

## Non-goals for the first release

- Mainnet or real funds
- A general event-management platform
- Public reputation scoring
- NFT tickets or a token
- Automated legal adjudication
- Storing names, contact details or appointment notes onchain
- Claiming that a blockchain alone proves physical attendance

## Success criteria

- Contract tests cover every settlement path.
- A user can connect an injected wallet on Arc Testnet.
- A provider can create a reservation and a customer can accept it.
- The web interface can read reservation state and submit each core action.
- Every successful settlement is verifiable through Arcscan.
- No private key or personal data is committed to the repository.
