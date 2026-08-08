# CommitPass

**Both sides commit. Evidence settles the outcome.**

CommitPass is a two-sided programmable commitment protocol for digital sessions and scarce reservations. A provider and an invited customer lock the same refundable USDC commitment on Arc. Shared terms are committed onchain, attendance can be recorded through a configured verifier or manual fallback, and the contract settles according to deterministic lifecycle rules.

Built by **Atakan Gündallı** for the Programmable Money Hackathon.

## Current V3

- Web app: https://commitpass.vercel.app/
- Network: Arc Testnet
- Chain ID: `5042002`
- Final V3 contract: `0x66592bDB161b2C68ceFB4133Cfa0dB08eD2Ff791`
- Deployment transaction: https://testnet.arcscan.app/tx/0xec1f6ea00711c9917665244c8ab7b0bbf13c5cb1cec96ba90dac9ab0448bef06
- Verified source: https://testnet.arcscan.app/address/0x66592bDB161b2C68ceFB4133Cfa0dB08eD2Ff791?tab=contract
- USDC interface: `0x3600000000000000000000000000000000000000`

The V3 deployment is the current contract used by the V3 frontend. Earlier V1/V2 deployments remain historical testnet evidence only.

## What V3 does

- Equal refundable commitment from provider and customer
- Salted metadata commitment for invitation terms
- Customer acceptance only from the invited wallet
- Free cancellation before the programmed deadline
- Self-attested attendance mode
- Platform-verified attendance mode with EIP-712 attestations
- EOA and ERC-1271 attendance signers
- Replay protection across reservations, contracts and chain IDs
- Customer and provider no-show claim paths
- Salted claim and dispute evidence hashes
- Dedicated arbiter resolution window
- Permissionless stale-reservation refund
- Permissionless expired-dispute refund
- Deterministic terminal outcomes:
  - `Completed`
  - `CustomerNoShow`
  - `ProviderNoShow`
  - `RefundBoth`

The V3 contract intentionally does not contain a partial service-payment mechanism. Commitments are reservation-protection deposits, not the service fee.

## Digital-session policy

The frontend currently targets online lessons, consultations and expert sessions.

Default policy:

- Scheduled session: 30 minutes
- Arrival / issue window: 5 minutes
- Completion threshold: 20 minutes of verified simultaneous participation

The policy engine normalizes join/leave intervals, measures simultaneous overlap and produces a deterministic recommended outcome. Session-policy tests cover completion, no-show, early-exit, reconnection and ambiguous/manual-review cases.

The policy engine and V3 contract interface are implemented. **A production attendance backend is not.** The repository contains controlled integration tooling that can create valid testnet attestations after a policy evaluation. A real deployment must keep the verifier key in a protected server-side signer and source trustworthy session-presence events. The private verifier key must never be exposed to the browser.

## Public V3 evidence

### 1. Permissionless stale refund

Reservation `#1` was intentionally allowed to pass its attendance and claim lifecycle without attendance confirmation. After the timeout, a permissionless caller refunded both 0.1 USDC commitments.

- Final outcome: `RefundBoth`
- Provider refund: `0.1 USDC`
- Customer refund: `0.1 USDC`
- Transaction: https://testnet.arcscan.app/tx/0xad1d6dbedbbc663a0fe7fa1d474d3dfa2da99a41f0d75a21a13e90754d6d82de
- Structured proof: [deployments/arc-testnet-v3-proof-stale-refund.json](deployments/arc-testnet-v3-proof-stale-refund.json)

### 2. Controlled verified-session settlement

Reservation `#2` used the dedicated V3 attendance attestor and a controlled digital-session receipt. Valid signed attendance was submitted for both participants and V3 settled the reservation as `Completed`, returning both commitments.

- Final outcome: `Completed`
- Provider commitment returned: `0.1 USDC`
- Customer commitment returned: `0.1 USDC`
- Provider attendance transaction: https://testnet.arcscan.app/tx/0x2ff976d6b5d5eba3cc8fd7bdb26bbe7b9a243753051aa8f88e6fab3f89e18536
- Customer attendance transaction: https://testnet.arcscan.app/tx/0x9c133dd5c2a2ef199fb68dc23176fcad74a5bdc975de47c4caa87a144102984d
- Structured proof: [deployments/arc-testnet-v3-proof-platform-session.json](deployments/arc-testnet-v3-proof-platform-session.json)
- Controlled receipt: [deployments/arc-testnet-v3-session-2-controlled-receipt.json](deployments/arc-testnet-v3-session-2-controlled-receipt.json)
- Attestations: [deployments/arc-testnet-v3-session-2-attestations.json](deployments/arc-testnet-v3-session-2-attestations.json)

**Important:** this is a controlled Arc Testnet integration proof using synthetic session intervals. It proves the policy-to-attestation-to-contract settlement path; it is not evidence of a real human meeting.

## Circle integration

The completed V3 proof used a Circle developer-controlled Arc Testnet wallet as the invited customer:

`0x2f149e3de871759f2aadc5a6185512b36730a37d`

Circle API transactions were used to approve USDC and accept the reservation. No Circle authentication secret, entity secret or wallet private key is committed to this repository.

## Test coverage

Current automated checks include:

- 77 Hardhat contract tests
- 22 digital-session policy tests
- TypeScript validation
- ESLint with zero warnings
- Next.js production static build

The contract tests cover settlement isolation, boundary timestamps, unauthorized actions, duplicate settlement, V3 lifecycle timeouts, attestation replay protection, signer binding, cross-contract replay, cross-chain replay, ERC-1271 support and deployment safeguards.

## Architecture

```text
Provider / Customer
        |
        v
Static CommitPass frontend
        |
        +---- shared salted invitation terms
        |
        v
MutualCommitmentEscrowV3 on Arc Testnet
        ^
        |
signed attendance attestation
        |
Configured verifier / future session adapter
```

The public frontend is statically exported. This keeps private signing material out of the browser. A production verifier must run separately from the static frontend.

## Network

| Setting | Value |
|---|---|
| Network | Arc Testnet |
| Chain ID | `5042002` |
| Primary RPC | `https://rpc.drpc.testnet.arc.network` |
| Fallback RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| USDC interface | `0x3600000000000000000000000000000000000000` |

## Local setup

```bash
npm install
cp .env.example .env.local
npm run contracts:compile
npm run contracts:test
npm run test:session-policy
npm run dev
```

Open `http://localhost:3000`.

Production validation:

```bash
npm run ci
npm run lint
```

The application uses Next.js static export and is served from `out/`.

## V3 deployment commands

Deployment is already complete. Do not redeploy simply to run the application.

For a separate test deployment, use local secrets only:

```bash
npm run deploy:arc:v3
npm run verify:arcscan:v3:source
```

Never commit `.env`, private keys, Circle API keys or entity secrets.

## Security boundaries

CommitPass is a **testnet hackathon prototype** and has not received an independent smart-contract audit, formal verification or production security review. It must not be used with real funds.

Important current boundaries:

- The configured attendance attestor is a trust boundary. Key compromise could create false attendance.
- ERC-1271 support inherits the security assumptions of the configured contract signer.
- The arbiter is a single immutable testnet address and is a centralization/liveness boundary for disputed claims.
- The production session-presence service does not exist yet; the current digital-session proof uses controlled synthetic intervals.
- Invitation metadata protects integrity, not secrecy. Session labels should not contain names, contact details or private information.
- Permissionless stale and expired-dispute refunds protect funds if attendance or arbitration stops progressing.

## Repository evidence

Useful V3 documents:

- [docs/v3-security-design.md](docs/v3-security-design.md)
- [docs/platform-attestation.md](docs/platform-attestation.md)
- [docs/digital-session-attendance.md](docs/digital-session-attendance.md)
- [docs/frontend-v3-migration.md](docs/frontend-v3-migration.md)
- [deployments/arc-testnet-v3.json](deployments/arc-testnet-v3.json)

Legacy V1/V2 evidence remains in the repository for development history but is not the current product deployment.

## Author

Atakan Gündallı
GitHub: [@AtakanGs](https://github.com/AtakanGs)

## License

MIT © 2026 Atakan Gündallı
