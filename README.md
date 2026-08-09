# CommitPass

**Both sides commit. Evidence settles the outcome.**

CommitPass is a two-sided programmable commitment protocol for digital sessions and scarce reservations. A provider and invited customer lock the same refundable USDC commitment on Arc. Shared terms are committed onchain, participation evidence is evaluated offchain, and the configured verifier can submit EIP-712 attendance to the final V3 contract.

Built by **Atakan Gündallı** for the Programmable Money Hackathon.

## Hackathon state

- Public stable app: https://commitpass.vercel.app/
- Experimental verifier branch: `experiment/live-presence-adapter`
- Network: Arc Testnet
- Chain ID: `5042002`
- Final V3 contract: `0x66592bDB161b2C68ceFB4133Cfa0dB08eD2Ff791`
- Verified contract: https://testnet.arcscan.app/address/0x66592bDB161b2C68ceFB4133Cfa0dB08eD2Ff791?tab=contract
- Arc Testnet USDC: `0x3600000000000000000000000000000000000000`

The public stable deployment intentionally remains separate from the local server-side verifier experiments. The experimental branch requires server-side secrets and is **not** presented as a production deployment.

## What is proven

### 1. Final V3 protocol on Arc Testnet

V3 implements equal refundable commitments, immutable metadata commitments, bounded cancellation/attendance/claim/dispute windows, EIP-712 platform attendance, no-show paths, arbitration and permissionless timeout recovery.

### 2. Live wallet-authenticated verifier → Arc settlement

Reservation `#5` used two wallet-authorized browser participants. The local verifier measured server-timestamped simultaneous presence and observed `10:35` against the committed `10:00` completion threshold. After session end it relayed signed attendance for both participants and V3 settled `Completed`.

- Provider attendance: https://testnet.arcscan.app/tx/0xc4cb2832096dbe79321f5cfaa292980930d1f37c2e4b4cd9a7934f8b7e33db4c
- Customer attendance: https://testnet.arcscan.app/tx/0xa2b181e740d8abc69d8b5bfc0d0e94b567bf138b643b21e0619e1460b18be640
- Structured proof: [deployments/arc-testnet-v3-proof-live-browser-session.json](deployments/arc-testnet-v3-proof-live-browser-session.json)

**Boundary:** this is real wallet-authenticated browser-presence evidence, not production-grade meeting-integrity evidence and not a claim of Google Meet/Zoom attendance.

### 3. Real Google Meet REST evidence ingestion

A completed Google Meet call was read with the Google Meet REST API using the `meetings.space.readonly` OAuth scope. CommitPass retrieved two signed-in participant records and their real join/leave session intervals. The observed simultaneous presence was `02:10`.

- Privacy-preserving captured evidence: [deployments/google-meet-real-evidence-2026-08-09.json](deployments/google-meet-real-evidence-2026-08-09.json)
- Adapter: [lib/server/googleMeetAdapter.ts](lib/server/googleMeetAdapter.ts)
- UI: [components/GoogleMeetEvidenceRoom.tsx](components/GoogleMeetEvidenceRoom.tsx)

Names, Google user resource IDs and the meeting code are intentionally removed from the committed evidence file.

**Boundary:** this specific Meet record was an evidence-ingestion test, not a reservation-bound end-to-end Google Meet → Arc settlement. Wallet-to-Google identity binding remains manual in the hackathon adapter.

### 4. Controlled policy → attestation → V3 settlement

Reservation `#2` proves the deterministic policy-to-attestation-to-contract path using controlled synthetic session intervals.

- Provider attendance: https://testnet.arcscan.app/tx/0x2ff976d6b5d5eba3cc8fd7bdb26bbe7b9a243753051aa8f88e6fab3f89e18536
- Customer attendance: https://testnet.arcscan.app/tx/0x9c133dd5c2a2ef199fb68dc23176fcad74a5bdc975de47c4caa87a144102984d
- Structured proof: [deployments/arc-testnet-v3-proof-platform-session.json](deployments/arc-testnet-v3-proof-platform-session.json)

### 5. Permissionless stale recovery

Reservation `#1` intentionally passed its lifecycle without attendance. After the timeout, a permissionless caller refunded both commitments.

- Refund transaction: https://testnet.arcscan.app/tx/0xad1d6dbedbbc663a0fe7fa1d474d3dfa2da99a41f0d75a21a13e90754d6d82de
- Structured proof: [deployments/arc-testnet-v3-proof-stale-refund.json](deployments/arc-testnet-v3-proof-stale-refund.json)

## Product mechanism

1. Provider creates a reservation and locks a refundable USDC commitment.
2. Invited customer verifies the shared terms and locks the same amount.
3. A verifier evaluates participation evidence against the committed digital-session policy.
4. If the completion condition is satisfied, signed attendance is relayed to V3.
5. V3 settles the programmed outcome. If infrastructure stops progressing, timeout recovery paths keep funds from remaining locked forever.

The commitment is **not** the service fee. It is a symmetric reservation-protection deposit.

## Digital-session policy

Default:

- Scheduled session: 30 minutes
- Arrival / issue window: 5 minutes
- Completion threshold: 20 minutes of verified simultaneous participation

The 15-minute preset uses:

- Scheduled session: 15 minutes
- Arrival / issue window: 3 minutes
- Completion threshold: 10 minutes

For dedicated short local testing, Advanced settings can use a 15 / 1 / 2 policy. V3 timing safeguards still apply to reservation creation and final attendance.

The policy engine clips, sorts and merges reconnections, measures simultaneous overlap, and covers completion, no-show, early-exit and ambiguous/manual-review cases.

## Verifier adapters

### Wallet-authenticated live browser presence

`/live-session`:

- one wallet authorization per participant
- server-timestamped heartbeats
- 4-second browser heartbeat target
- 45-second maximum continuity gap
- simultaneous overlap evaluated by the shared session-policy engine
- no final attestation before committed session end
- EIP-712 attendance relayed to V3

This adapter uses in-memory single-process state. Browser background throttling can reduce heartbeat continuity, so it is a hackathon verifier boundary rather than production meeting integrity.

### Google Meet REST adapter

`/meet-session` supports two modes:

- **Evidence-only mode:** load a completed real Meet record without making any onchain claim.
- **Reservation mode:** open from the original verified invitation, map signed-in Google identities to provider/customer, evaluate the committed policy, and expose the V3 settlement path when the policy is satisfied.

The adapter reads `conferenceRecords`, `participants` and `participantSessions`. Google-to-wallet identity mapping is currently manual. A production version should bind wallet identity to the external account before the meeting.

## Architecture

```text
Provider / Customer
        |
        v
Committed session terms + equal USDC deposits
        |
        v
MutualCommitmentEscrowV3 on Arc Testnet
        ^
        |
EIP-712 attendance attestation
        ^
        |
CommitPass verifier boundary
   /                     \
wallet-authenticated      Google Meet REST
browser presence          participant sessions
```

## Test coverage

Current validation:

- 77 Hardhat contract tests
- 22 digital-session policy tests
- TypeScript validation
- ESLint with zero warnings
- Next.js production build

Contract coverage includes settlement isolation, boundary timestamps, unauthorized actions, duplicate settlement, lifecycle timeouts, attestation signer/participant binding, replay protection across reservations/contracts/chains, ERC-1271 support and deployment safeguards.

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

Validation:

```bash
npm run ci
npm run lint
```

### Google Meet local OAuth

The Google Meet adapter uses local Desktop OAuth files under ignored `.secrets/` storage:

```text
.secrets/google-meet-credentials.json
.secrets/google-meet-token.json
```

Never commit either file. The helper command is:

```bash
npm run meet:probe -- abc-defg-hij
```

The production app should replace local Desktop OAuth with a proper server-side account-linking flow and protected token storage.

## Security boundaries

CommitPass is a **testnet hackathon prototype**. It has not received an independent smart-contract audit, formal verification or production security review and must not be used with real funds.

Current boundaries:

- The configured attendance attestor is trusted; signer compromise could create false attendance.
- The arbiter is a single immutable testnet address.
- The live browser adapter is single-process and in-memory.
- Browser background throttling can create heartbeat gaps.
- Google Meet OAuth credentials/tokens are local-only.
- Google-to-wallet identity binding is manual in the current Meet adapter.
- The tested Google Meet record is not claimed as an end-to-end Meet-to-Arc settlement.
- Invitation metadata protects integrity, not secrecy.
- Permissionless stale and expired-dispute refunds protect funds if attendance or arbitration stops progressing.

## Repository evidence

- [docs/v3-security-design.md](docs/v3-security-design.md)
- [docs/platform-attestation.md](docs/platform-attestation.md)
- [docs/digital-session-attendance.md](docs/digital-session-attendance.md)
- [docs/live-presence-adapter.md](docs/live-presence-adapter.md)
- [docs/google-meet-adapter.md](docs/google-meet-adapter.md)
- [deployments/arc-testnet-v3.json](deployments/arc-testnet-v3.json)

## Author

Atakan Gündallı
GitHub: [@AtakanGs](https://github.com/AtakanGs)

## License

MIT © 2026 Atakan Gündallı
