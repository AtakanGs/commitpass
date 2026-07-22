# Arc Testnet Evidence

CommitPass has been tested end to end using separate provider and customer wallets on Arc Testnet.

## Deployment

- Network: Arc Testnet
- Chain ID: `5042002`
- Contract: `0x02b02Cdb93B32a9bcDC9cb5904Cef2ABb2F7De6D`
- Provider: `0x329c253928e0727f31c7FfbdC83b143E55c36841`
- Customer: `0x9e0c85CbF38CE6394192F10B3Aff6A4d8dE25E96`

## Verified flow 1: Early cancellation

Reservation `#1` completed the following flow:

```text
Provider creates reservation
? Customer accepts
? Both USDC commitments are locked
? Reservation is cancelled within the free-cancellation window
? Both commitments are refunded
```

Final state:

- Status: `Cancelled`
- Outcome: `RefundBoth`
- Provider commitment: `5 USDC`
- Customer commitment: `2 USDC`

## Verified flow 2: Mutual attendance

Reservation `#3` completed the following flow:

```text
Provider creates reservation
? Customer accepts
? Customer confirms attendance
? Provider confirms attendance
? Contract settles automatically
? Both commitments are refunded
```

### Onchain transactions

- Reservation created: https://testnet.arcscan.app/tx/0x6cf0876f9ea16dcf76cdf8e383b7d4949e0a0c58af719c9ab08a025e1c4fc833
- Customer accepted: https://testnet.arcscan.app/tx/0x19f673a519f626301e000a816d3bcc8a381685fd0314ff145760adad4699a7f2
- Customer confirmed attendance: https://testnet.arcscan.app/tx/0x8cdcfacfc592333e116dd62cb7d31aaaad195b5b85db038d08c08f7c72a8f339
- Provider confirmed attendance: https://testnet.arcscan.app/tx/0x16d5c328c9216f7fc91f7759112d0a51d22f7659ff15232222c7fe88779cbeed
- Automatic settlement: https://testnet.arcscan.app/tx/0x16d5c328c9216f7fc91f7759112d0a51d22f7659ff15232222c7fe88779cbeed

### Final state

- Status: `Resolved`
- Outcome: `Completed`
- Provider commitment: `5 USDC`
- Customer commitment: `2 USDC`
- Provider attendance: `Confirmed`
- Customer attendance: `Confirmed`
- Check-in reference: `CP-000003`

The `Completed` outcome is only reached after both parties confirm attendance. Settlement then returns both commitments automatically.

Verified on 22 July 2026.
