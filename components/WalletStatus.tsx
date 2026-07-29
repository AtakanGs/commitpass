"use client";

import { useEffect, useState } from "react";
import {
  getAddress,
  type Address,
  type EIP1193Provider,
} from "viem";
import {
  connectWallet,
  getConnectedAccount,
  publishWalletAccount,
} from "@/lib/wallet";

type AccountAwareProvider = EIP1193Provider & {
  on?: (
    event: "accountsChanged",
    listener: (accounts: string[]) => void,
  ) => void;
  removeListener?: (
    event: "accountsChanged",
    listener: (accounts: string[]) => void,
  ) => void;
};

function compact(address: string) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function normalizeAccount(value?: string): Address | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return getAddress(value);
  } catch {
    return undefined;
  }
}

export function WalletStatus() {
  const [address, setAddress] = useState<Address>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    void getConnectedAccount()
      .then((account) => {
        if (!active) {
          return;
        }

        setAddress(account);
        publishWalletAccount(account);
      })
      .catch(() => undefined);

    const provider = window.ethereum as AccountAwareProvider | undefined;

    function handleAccountsChanged(accounts: string[]) {
      const account = normalizeAccount(accounts[0]);
      setAddress(account);
      publishWalletAccount(account);
    }

    provider?.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      active = false;
      provider?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  async function connect() {
    setLoading(true);
    setError(undefined);

    try {
      const { account } = await connectWallet();
      setAddress(account);
      publishWalletAccount(account);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Wallet connection failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="walletWrap">
      <button
        className="walletButton"
        onClick={connect}
        disabled={loading}
        type="button"
      >
        {loading
          ? "Connecting..."
          : address
            ? compact(address)
            : "Connect wallet"}
      </button>

      {error ? (
        <span className="inlineError" title={error}>
          Wallet error
        </span>
      ) : null}
    </div>
  );
}
