# CommitPass Architecture

**Author:** Atakan Gündallı

## Components

### 1. Web application

A statically exported Next.js application provides two main workflows:

- **Create:** the provider defines the invited customer, commitments, compensation and time windows.
- **Manage:** either party loads a reservation and submits contract actions.

The browser connects to an injected EVM wallet and requests Arc Testnet when needed. The application never receives or stores a private key. Production assets are generated into `out/` and can be hosted on a static platform; settlement remains entirely in the wallet and contract.

### 2. Settlement contract

`MutualCommitmentEscrow.sol` is the source of truth for commitment custody and state transitions.

```text
AwaitingCustomer
  ├─ provider cancels early ──────────────> Cancelled / RefundBoth
  ├─ invitation expires ──────────────────> Cancelled / RefundBoth
  └─ customer accepts ────────────────────> Active

Active
  ├─ early cancellation ──────────────────> Cancelled / RefundBoth
  ├─ both confirm attendance ─────────────> Resolved / Completed
  └─ no-show claim ───────────────────────> ClaimPending

ClaimPending
  ├─ dispute window expires ──────────────> Resolved / claimed outcome
  └─ counterparty disputes ───────────────> Disputed

Disputed
  └─ arbiter resolves ────────────────────> Resolved / selected outcome
```

### 3. Token

The deployment script targets Arc Testnet's ERC-20 USDC interface. The contract treats all commitment amounts as USDC base units. The frontend formats and parses values at six decimal places.

### 4. Metadata

The contract stores only a `bytes32 metadataHash`. The intended value is a salted hash or non-identifying offchain reference. Names, email addresses, meeting notes and QR payloads must remain offchain.

## Trust boundaries

- **Contract:** enforces custody, deadlines and settlement arithmetic.
- **Wallet:** authenticates the transaction sender.
- **Parties:** attest attendance or make no-show claims.
- **Arbiter:** resolves disputed claims in this hackathon version.
- **Frontend:** improves usability but is not trusted for custody or settlement.

CommitPass does not claim to independently observe the physical world. A check-in is an attestation made by an authorised participant, not mathematical proof that a service was fully delivered.

## Security controls

- OpenZeppelin `SafeERC20`
- OpenZeppelin `ReentrancyGuard`
- State changes before outbound transfers
- Explicit state machine
- Single-settlement terminal states
- Compensation cannot exceed provider commitment
- Customer cannot accept after the cancellation deadline
- Check-in is restricted to a defined time window
- Only the non-claiming counterparty can dispute
- Only the configured arbiter can resolve disputes
- No personal information is required onchain

## Known limitations

- The arbiter is centralised and immutable in the MVP.
- There is no decentralised evidence or arbitration system.
- A reservation can remain active until a party opens a claim or the arbiter refunds it.
- The human-readable check-in reference is not yet a signed, one-time QR credential.
- The contract has not received an independent security audit.
