"use client";

import { useState } from "react";
import { connectWallet } from "@/lib/wallet";

function compact(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletStatus() {
  const [address, setAddress] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function connect() {
    setLoading(true);
    setError(undefined);
    try {
      const { account } = await connectWallet();
      setAddress(account);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet connection failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="walletWrap">
      <button className="walletButton" onClick={connect} disabled={loading} type="button">
        {loading ? "Connecting…" : address ? compact(address) : "Connect wallet"}
      </button>
      {error ? <span className="inlineError" title={error}>Wallet error</span> : null}
    </div>
  );
}
