# CommitPass

**Both sides commit. Trust is programmable.**

## Live demo

- Web app: https://commitpass.vercel.app/
- Network: Arc Testnet
- Contract: `0x02b02Cdb93B32a9bcDC9cb5904Cef2ABb2F7De6D`
- Verified onchain flows: Reservation `#1` - early cancellation and mutual refund; Reservation `#3` - mutual attendance and automatic refunds
- Testnet evidence: [docs/testnet-evidence.md](docs/testnet-evidence.md)

CommitPass is a two-sided programmable commitment protocol for reservations and limited-capacity services. Customers and providers lock small refundable USDC commitments on Arc. When both honour the reservation, both commitments return. If one side no-shows, the other receives pre-agreed compensation.

Built by **Atakan Gündallı** for the Programmable Money Hackathon.

## Current MVP

- Provider-funded reservation creation
- Customer acceptance and commitment funding
- Early cancellation with automatic refunds
- Mutual attendance confirmation
- Customer no-show claims
- Provider no-show claims with asymmetric compensation
- Dispute window and arbiter resolution
- Duplicate-settlement protection
- Arc Testnet wallet connection
- Onchain reservation console

## Why Arc

Arc is the neutral programmable settlement layer. The MVP uses Arc Testnet, Arc's ERC-20 USDC interface for commitment custody, and one-confirmation deterministic settlement. No real funds are used.

## Network

| Setting | Value |
|---|---|
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| USDC interface | `0x3600000000000000000000000000000000000000` |

## Local setup

```bash
npm install
cp .env.example .env.local
npm run contracts:compile
npm run contracts:test
npm run dev
```

Open `http://localhost:3000`.

To verify the production export locally:

```bash
npm run build
npm start
```

The web application is exported as static files in `out/`, which keeps hosting simple and avoids a trusted application server in the settlement path.

## Deploy to Arc Testnet

1. Fund a dedicated testnet deployer with faucet USDC.
2. Copy `.env.example` to `.env`.
3. Add `DEPLOYER_PRIVATE_KEY` and optionally `ARBITER_ADDRESS` locally.
4. Never commit `.env`.
5. Run:

```bash
npm run deploy:arc
```

6. Add the deployed address to `.env.local`:

```bash
NEXT_PUBLIC_COMMITPASS_CONTRACT_ADDRESS=0x...
```

## Security boundaries

This repository is a testnet hackathon prototype and has not been independently audited. It must not be used with real funds. No personal data should be written onchain. The metadata field stores only a salted hash or non-identifying reference.

## Author

Atakan Gündallı
GitHub: [@AtakanGs](https://github.com/AtakanGs)

## License

MIT © 2026 Atakan Gündallı
