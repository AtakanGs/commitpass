# Frontend V3 core migration

This change moves the interactive CommitPass frontend from the V2
contract interface to the final verified V3 deployment:

- Contract: `0x66592bDB161b2C68ceFB4133Cfa0dB08eD2Ff791`
- Network: Arc Testnet (`5042002`)
- Source verification: Arcscan verified
- V3 source commit: `546b3ebec17525431e482f93977eebc3e3cc3bbd`

## Included

- Symmetric equal commitments.
- V3 reservation tuple and lifecycle deadlines.
- Self-attested attendance.
- Platform-verified EIP-712 attendance relay.
- Salted claim and dispute evidence hashes.
- Permissionless stale-reservation refund.
- Permissionless expired-dispute refund.
- Final V3 address in the public frontend configuration.

## Deliberately not included

The existing `/proof` evidence set still refers to earlier verified V2
scenarios. It must not be presented as final V3 evidence. New V3
transactions will be generated and recorded in a separate proof update
before the production-facing Vercel deployment is switched.

No public arbitrary-signing API is added. A future platform signing
service must validate real attendance server-side and keep the attestor
key out of the browser.
