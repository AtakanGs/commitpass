import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type EIP1193Provider,
} from "viem";
import { arcTestnet, ARC_TESTNET_CHAIN_ID, ARC_TESTNET_RPC } from "@/lib/arc";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export function getInjectedProvider(): EIP1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No browser wallet found. Install MetaMask, Rabby, Coinbase Wallet or Rainbow.");
  }
  return window.ethereum;
}

export async function ensureArcTestnet(provider: EIP1193Provider) {
  const chainHex = `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainHex }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainHex,
          chainName: "Arc Testnet",
          nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
          rpcUrls: [ARC_TESTNET_RPC],
          blockExplorerUrls: ["https://testnet.arcscan.app"],
        },
      ],
    });
  }
}

export async function connectWallet() {
  const provider = getInjectedProvider();
  await ensureArcTestnet(provider);

  const walletClient = createWalletClient({ chain: arcTestnet, transport: custom(provider) });
  const [account] = await walletClient.requestAddresses();
  if (!account) throw new Error("Wallet connection was not approved.");

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(ARC_TESTNET_RPC) });
  return { account: account as Address, walletClient, publicClient };
}
