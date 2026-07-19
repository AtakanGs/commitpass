# Checkpoint 2 Draft

## Repository

Public repository: `https://github.com/AtakanGs/commitpass`

## Progress summary

CommitPass now has a tested two-sided USDC commitment contract and a working Next.js interface prepared for Arc Testnet.

Completed:

- Provider-funded reservation creation
- Customer acceptance and funding
- Early cancellation refunds
- Expiry of unaccepted invitations
- Time-bounded attendance confirmation
- Customer and provider no-show claims
- Dispute window and arbiter resolution
- Duplicate-settlement protection
- Arc Testnet wallet configuration
- Reservation creation and management interface
- Automated contract tests and CI configuration

Next:

- Deploy the contract to Arc Testnet
- Complete end-to-end tests with two wallets
- Replace the temporary check-in reference with a signed one-time QR flow
- Add a hosted demo and Arcscan evidence
- Prepare the final video and deck

## Safety note

The current build is a testnet-only hackathon prototype. It is unaudited and must not be used with real funds.
