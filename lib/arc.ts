import { defineChain } from "viem";

export const ARC_TESTNET_CHAIN_ID = 5_042_002;
export const ARC_TESTNET_RPC =
  process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
export const ARC_EXPLORER = "https://testnet.arcscan.app";
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [ARC_TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: ARC_EXPLORER },
  },
  testnet: true,
});
