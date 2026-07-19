# Arc Testnet Release Checklist

**Owner:** Atakan Gündallı

## Before deployment

- [ ] `npm ci` completes from a clean checkout.
- [ ] `npm run contracts:compile` passes.
- [ ] `npm run contracts:test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] Deployer is a dedicated testnet wallet.
- [ ] Deployer has enough testnet gas balance.
- [ ] `ARBITER_ADDRESS` is confirmed.
- [ ] `.env` and `.env.local` are ignored by Git.
- [ ] No private key appears in Git history.

## Deployment

- [ ] Deploy `MutualCommitmentEscrow` to Arc Testnet.
- [ ] Record the transaction hash.
- [ ] Record the deployed contract address.
- [ ] Verify the constructor USDC and arbiter addresses.
- [ ] Add the contract address to `NEXT_PUBLIC_COMMITPASS_CONTRACT_ADDRESS`.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the deployed application URL.

## Smoke test

Use two fresh test wallets and small test values.

- [ ] Provider creates a reservation.
- [ ] Contract receives only the provider commitment.
- [ ] Customer accepts before the deadline.
- [ ] Contract balance equals both commitments.
- [ ] Early cancellation returns both commitments.
- [ ] Expired, unaccepted invitation returns the provider commitment.
- [ ] Mutual attendance returns both commitments.
- [ ] Customer no-show settlement pays the provider.
- [ ] Provider no-show settlement refunds and compensates the customer.
- [ ] Counterparty can dispute within the dispute window.
- [ ] Arbiter can resolve a dispute.
- [ ] A resolved reservation cannot settle twice.
- [ ] Each successful transaction opens in Arcscan.

## Submission evidence

- [ ] Public GitHub repository
- [ ] Live application URL
- [ ] Contract address and Arcscan link
- [ ] Test output screenshot
- [ ] Three-minute pitch/demo video
- [ ] Project deck
- [ ] Clear testnet-only disclaimer
