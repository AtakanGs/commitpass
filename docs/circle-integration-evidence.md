# Circle Integration Evidence

CommitPass integrates Circle Developer-Controlled Wallets with the deployed CommitPass v2 contract on Arc Testnet.

## Integration

| Field | Value |
|---|---|
| Circle product | Developer-Controlled Wallets |
| Network | Arc Testnet |
| Circle wallet type | EOA |
| Circle wallet address | `0x2f149e3de871759f2aadc5a6185512b36730a37d` |
| CommitPass contract | `0x8b28Ee06fD5d59d8886474733d7D3B58cDB33A5D` |
| Arc Testnet USDC | `0x3600000000000000000000000000000000000000` |
| Created reservation | `#6` |
| Reservation status | `AwaitingCustomer` |
| Provider commitment | `1 USDC` |
| Customer commitment | `1 USDC` |
| Provider compensation | `0.5 USDC` |

## Onchain transactions

### USDC approval

- Transaction: `0x92041283ebd0ea2134a46562821acae828ddcaa4eacc4d3fdcdcb90eff7da668`
- Explorer: https://testnet.arcscan.app/tx/0x92041283ebd0ea2134a46562821acae828ddcaa4eacc4d3fdcdcb90eff7da668

### CommitPass Reservation #6 creation

- Transaction: `0x6d392879ae65b10b526f947f7c253ce8506484b8445f7df59e147f3cec274f4b`
- Explorer: https://testnet.arcscan.app/tx/0x6d392879ae65b10b526f947f7c253ce8506484b8445f7df59e147f3cec274f4b
- Provider: `0x2f149e3de871759f2aadc5a6185512b36730a37d`
- Customer: `0x9e0c85CbF38CE6394192F10B3Aff6A4d8dE25E96`
- Metadata hash: `0xe1da0704b94d4c220d4e93e66978f5cd76eabfef5458fdad568914ef99c2aeb4`

## Verification result

The Circle Developer-Controlled Wallet:

1. Held native Arc Testnet USDC for transaction fees.
2. Held ERC-20 Arc Testnet USDC for the commitment.
3. Approved the CommitPass contract to transfer `1 USDC`.
4. Called `createReservation` on the deployed CommitPass v2 contract.
5. Became the onchain provider of Reservation `#6`.

Circle API keys, entity secrets, recovery files, wallet IDs, wallet-set IDs and idempotency keys are intentionally excluded from this repository.
