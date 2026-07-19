"use client";

import { FormEvent, useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { createReservation } from "@/lib/contract";

function defaultStart() {
  const date = new Date(Date.now() + 48 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

export function CreateReservationForm() {
  const [customer, setCustomer] = useState("");
  const [title, setTitle] = useState("30-minute mentoring session");
  const [providerBond, setProviderBond] = useState("5");
  const [customerBond, setCustomerBond] = useState("2");
  const [compensation, setCompensation] = useState("2");
  const [start, setStart] = useState(defaultStart);
  const [cancelHours, setCancelHours] = useState("24");
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);

  const valid = useMemo(() => {
    return (
      isAddress(customer) &&
      Number(providerBond) > 0 &&
      Number(customerBond) > 0 &&
      Number(compensation) >= 0 &&
      Number(compensation) <= Number(providerBond) &&
      new Date(start).getTime() > Date.now() + Number(cancelHours) * 3600_000
    );
  }, [customer, providerBond, customerBond, compensation, start, cancelHours]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setStatus("Approve the provider commitment in your wallet…");
    try {
      const hash = await createReservation({
        customer: customer as Address,
        providerCommitment: providerBond,
        customerCommitment: customerBond,
        providerCompensation: compensation,
        startTime: new Date(start),
        freeCancellationHours: Number(cancelHours),
        title,
      });
      setStatus(`Reservation created. Transaction: ${hash}`);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="formCard card" onSubmit={submit}>
      <div className="formHeader">
        <span>New commitment</span>
        <span className="secureTag">Testnet only</span>
      </div>

      <label>
        Session title
        <input value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <label>
        Customer wallet
        <input
          value={customer}
          onChange={(event) => setCustomer(event.target.value)}
          placeholder="0x…"
          spellCheck={false}
          required
        />
      </label>
      <div className="fieldGrid">
        <label>
          Provider bond
          <div className="moneyInput"><input value={providerBond} onChange={(e) => setProviderBond(e.target.value)} /><span>USDC</span></div>
        </label>
        <label>
          Customer bond
          <div className="moneyInput"><input value={customerBond} onChange={(e) => setCustomerBond(e.target.value)} /><span>USDC</span></div>
        </label>
      </div>
      <div className="fieldGrid">
        <label>
          Provider no-show compensation
          <div className="moneyInput"><input value={compensation} onChange={(e) => setCompensation(e.target.value)} /><span>USDC</span></div>
        </label>
        <label>
          Free cancellation window
          <div className="moneyInput"><input value={cancelHours} onChange={(e) => setCancelHours(e.target.value)} /><span>hours</span></div>
        </label>
      </div>
      <label>
        Reservation start
        <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required />
      </label>

      <button className="button primary full" type="submit" disabled={!valid || busy}>
        {busy ? "Creating…" : "Lock provider commitment"}
      </button>
      <p className="formNote">Two wallet confirmations are expected: USDC approval and reservation creation.</p>
      {status ? <div className="transactionStatus">{status}</div> : null}
    </form>
  );
}
