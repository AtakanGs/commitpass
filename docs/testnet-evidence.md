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
-> Customer accepts
-> Both USDC commitments are locked
-> Reservation is cancelled within the free-cancellation window
-> Both commitments are refunded
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
-> Customer accepts
-> Customer confirms attendance
-> Provider confirms attendance
-> Contract settles automatically
-> Both commitments are refunded
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

## Verified flow 3: Undisputed customer no-show claim

Reservation `#5` completed the following optimistic claim flow:

```text
Provider creates reservation
-> Customer accepts
-> Both USDC commitments are locked
-> The check-in window closes without customer attendance confirmation
-> Provider opens a customer no-show claim
-> Customer does not dispute within the 12-hour dispute window
-> Provider finalizes the undisputed claim
-> Provider receives the 5 USDC provider commitment plus the 2 USDC customer commitment
```

### Onchain transactions

- Reservation created: https://testnet.arcscan.app/tx/0x1f638b10757e0f36e991deef6719e592b7c500e8eb8c805d0d8433f0976262bc
- Customer accepted: https://testnet.arcscan.app/tx/0x69e40f52074e6314688604774d891ff545aa531eda7514af7ab62cbb2438abc7
- Customer no-show claim opened: https://testnet.arcscan.app/tx/0xcbab93c5a4b30b090d126436e029fb29d6fc5d0772c3b86084bcdd3cedf6360d
- Undisputed claim finalized: https://testnet.arcscan.app/tx/0x110f399d820e5d672de9a4d28702cae2974c01266382d9b51ab855d74043a882

### Final state

- Status: `Resolved`
- Outcome: `CustomerNoShow`
- Provider commitment: `5 USDC`
- Customer commitment: `2 USDC`
- Provider settlement: `7 USDC`
- Provider attendance: `Pending`
- Customer attendance: `Pending`
- Dispute deadline: `30 July 2026, 23:56:39 Europe/Istanbul`
- Check-in reference: `CP-000005`

This flow demonstrates CommitPass's optimistic dispute mechanism. A no-show claim can be challenged by the accused party during the dispute window. Because Reservation `#5` was not disputed, the pending customer no-show outcome became final after the deadline.

## Verified flow 4: Undisputed provider no-show claim

Reservation `#7` completed the following optimistic claim flow:

```text
Provider creates reservation
-> Customer accepts
-> Both USDC commitments are locked
-> Customer confirms attendance during the check-in window
-> Provider does not confirm attendance
-> Customer opens a provider no-show claim after the check-in window closes
-> Provider does not dispute within the 12-hour dispute window
-> Customer finalizes the undisputed claim
-> Customer receives the 2 USDC customer commitment plus 2 USDC compensation
-> Provider receives the remaining 3 USDC of the provider commitment
```

### Onchain transactions

- Reservation created: https://testnet.arcscan.app/tx/0xf7a45f6c39e96c7851b6a9ffad0cae93906863d3f6aab13eef274188f9ad175e
- Customer accepted: https://testnet.arcscan.app/tx/0xd55ff5e10dd421fac0410bbb00a6a66fa14c21c8ef3a2e9e179798b8345868f1
- Customer confirmed attendance: https://testnet.arcscan.app/tx/0xde8f715a1eb15217b927fac826fa7ba9d795f27c130786e850092fcaa0b15083
- Provider no-show claim opened: https://testnet.arcscan.app/tx/0xfadd86cca5f776d55a37632f50cf5f31f5f743a7ae8511c69d8c51247ba8f787
- Undisputed claim finalized: https://testnet.arcscan.app/tx/0xcafd717d69f7f03531b28b58a22782260557903529a774ae0d53e8adbc9da3ea

### Final state

- Status: `Resolved`
- Outcome: `ProviderNoShow`
- Provider commitment: `5 USDC`
- Customer commitment: `2 USDC`
- Provider compensation: `2 USDC`
- Provider settlement: `3 USDC`
- Customer settlement: `4 USDC`
- Provider attendance: `Pending`
- Customer attendance: `Confirmed`
- Dispute deadline: `1 August 2026, 12:45:40 Europe/Istanbul`
- Check-in reference: `CP-000007`

This is the strongest live no-show proof in the current evidence set because the claimant confirmed attendance during the valid check-in window before opening the provider no-show claim.

Evidence last updated on 2 August 2026.
