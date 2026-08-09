# Google Meet REST evidence adapter

The experimental branch includes a post-meeting Google Meet adapter that reads real participant-session records and feeds them into the same CommitPass digital-session policy engine used by the live browser verifier.

## What has been tested

A completed Google Meet call was queried with the Google Meet REST API using the `meetings.space.readonly` OAuth scope.

The API returned:

- two signed-in participants,
- one participant-session interval for each,
- conference start/end timestamps,
- participant join/leave timestamps.

The observed simultaneous presence in that test call was `02:10`.

A privacy-preserving capture is committed at:

`deployments/google-meet-real-evidence-2026-08-09.json`

Raw participant names, Google user resource IDs and the meeting code remain local.

## Modes

### Evidence-only

Open:

`http://localhost:3000/meet-session`

Enter a completed Meet code or URL and load the evidence. This mode intentionally does **not** infer a wallet mapping or Arc settlement.

### Reservation-bound prototype

Open **Verify with Google Meet (local)** from an original verified reservation.

The adapter then:

1. re-verifies the reservation metadata and committed digital-session policy,
2. loads the completed Meet conference record,
3. requires two distinct signed-in Google identities,
4. lets the operator map those identities to provider/customer,
5. evaluates the authoritative Meet session intervals with the shared policy engine,
6. exposes the existing EIP-712/V3 settlement path only for a final `completed` policy result.

## Important boundary

The Google Meet ingestion is real. The identity binding is not production-ready.

Current limitations:

- wallet ↔ Google identity mapping is manual,
- the meeting code is not committed in reservation metadata,
- OAuth uses local Desktop credentials/tokens,
- the completed Meet evidence test was not tied to an Arc reservation,
- therefore the repository does **not** claim a completed single-run Google Meet → Arc settlement.

A production version should bind wallet identity to the Google account before the session, commit the provider/session reference in reservation metadata, and use protected server-side OAuth/token storage.

## Local OAuth files

Ignored local files:

```text
.secrets/google-meet-credentials.json
.secrets/google-meet-token.json
```

Probe:

```bash
npm run meet:probe -- abc-defg-hij
```

Never commit the OAuth client secret, access token or refresh token.
