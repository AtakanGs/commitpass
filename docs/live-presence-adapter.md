# Experimental live browser presence adapter

This branch contains a narrow hackathon verifier that connects wallet-authenticated browser presence to the existing CommitPass V3 attendance-attestation boundary.

## Proven end-to-end result

Reservation `#5` completed the full local path:

1. Provider and customer each authorized once with their wallet.
2. The server verified reservation participation and committed metadata.
3. The browser targeted a heartbeat every 4 seconds.
4. The server built timestamped presence intervals.
5. Simultaneous overlap reached `10:35` against a `10:00` threshold.
6. The adapter waited until the committed session end.
7. The configured attestor signed EIP-712 attendance.
8. The relayer submitted attendance for both participants.
9. V3 settled the reservation as `Completed`.

Structured evidence:

`deployments/arc-testnet-v3-proof-live-browser-session.json`

## Continuity behavior

The server treats a participant as continuously present only while heartbeat gaps remain within 45 seconds. A longer gap creates a new interval and the gap does not count toward simultaneous presence.

During the live browser test, background-tab throttling caused verified overlap to lag wall-clock time. Keeping both tabs visible restored reliable heartbeat delivery. This is an important prototype limitation and one reason a production integration should prefer authoritative meeting-provider events.

## Security boundary

This is **not** production Zoom/Meet/WebRTC attendance infrastructure.

It intentionally uses:

- one Node process,
- in-memory room state,
- wallet authorization as browser participant identity,
- browser heartbeats as presence evidence,
- local/private testnet attestor and relayer keys.

It does not claim to solve managed key custody, durable distributed state, anti-bot checks, device attestation or meeting-provider integrity.

## Local run

Required server-side secrets:

```text
PLATFORM_ATTESTOR_PRIVATE_KEY=0x...
PRESENCE_RELAYER_PRIVATE_KEY=0x...
```

`PRESENCE_RELAYER_PRIVATE_KEY` may be omitted when `DEPLOYER_PRIVATE_KEY` is configured.

Optional:

```text
COMMITPASS_PRESENCE_SESSION_SECRET=long-random-secret
```

Run:

```bash
npm run dev
```

Create a platform-verified reservation, let the invited customer accept it, then open **Live presence adapter** from the verified reservation.

## Production migration

Replace browser heartbeat evidence with an authoritative provider adapter or first-party session backend, plus:

- durable event storage,
- replay-resistant internal event IDs,
- managed signer/HSM,
- rate limits,
- settlement idempotency/locking,
- privacy/retention controls,
- external identity binding.

The V3 contract interface does not need to change.
