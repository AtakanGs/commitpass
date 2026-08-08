# Experimental live presence adapter

This branch contains a deliberately narrow hackathon prototype that closes the missing link between a real browser session and the existing CommitPass V3 attendance-attestation boundary.

## What it proves

1. A participant opens a live room from the original verified invitation.
2. The participant signs one wallet authorization message.
3. A Node server validates:
   - the participant is the provider or customer,
   - the reservation is Active,
   - the reservation uses the configured CommitPass testnet attestor,
   - the title, salt and digital-session policy match the onchain metadata hash.
4. The browser sends heartbeats every five seconds.
5. The server timestamps heartbeats and builds provider/customer presence intervals.
6. Simultaneous overlap is measured against the committed completion threshold.
7. When the threshold is reached, the provider browser asks the server to settle.
8. The server signs EIP-712 attendance for both participants with the configured V3 attestor and relays both calls to `confirmAttendanceWithAttestation`.
9. V3 settles the reservation according to the existing contract logic.

## Important boundary

This is **not** a production Zoom/Meet/WebRTC attendance service.

The prototype intentionally uses:

- one Node process,
- in-memory room state,
- wallet authorization as participant identity,
- browser heartbeats as presence evidence,
- a local/private testnet attestor key,
- a local/private testnet relayer key.

This is sufficient to demonstrate the end-to-end adapter boundary without pretending the prototype solves production-grade meeting integrity, distributed state, anti-bot checks, device attestation or managed key custody.

## Local run

The branch switches Next.js from static export to normal server mode because `/api/presence/*` requires server execution.

Required local secrets:

```text
PLATFORM_ATTESTOR_PRIVATE_KEY=0x...
PRESENCE_RELAYER_PRIVATE_KEY=0x...
```

`PRESENCE_RELAYER_PRIVATE_KEY` may be omitted when `DEPLOYER_PRIVATE_KEY` is already configured.

Optional:

```text
COMMITPASS_PRESENCE_SESSION_SECRET=long-random-secret
```

If omitted, the local prototype derives its HMAC token secret from the attestor private key. Production systems should use a separate managed secret.

Run:

```bash
npm run dev
```

Create a platform-verified reservation, let the customer accept it, then open the **Experimental live room** action from the reservation page in both participant browsers.

For a fast demo, Advanced settings may use:

- duration: 15 minutes
- arrival window: 1 minute
- completion requirement: 2 minutes

The V3 contract still enforces its normal attendance window and the reservation still commits those policy values in metadata.

## Production migration path

Replace the in-memory adapter with:

- authenticated Zoom/Meet/Teams/WebRTC event ingestion,
- durable session-event storage,
- replay-resistant internal event IDs,
- managed signer/HSM,
- rate limiting,
- auditable settlement logs,
- multi-instance locking/idempotency,
- privacy and retention controls.

The V3 contract interface does not need to change.
