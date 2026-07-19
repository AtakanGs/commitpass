"use client";

import { useState } from "react";
import {
  acceptReservation,
  formatUsdc,
  openNoShowClaim,
  OUTCOME_LABELS,
  readReservation,
  STATUS_LABELS,
  writeSimple,
} from "@/lib/contract";

export function ManageReservation() {
  const [id, setId] = useState("1");
  const [reservation, setReservation] = useState<Awaited<ReturnType<typeof readReservation>>>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(true);
    setMessage(`${label}…`);
    try {
      await action();
      setMessage(`${label} completed.`);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : `${label} failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    setBusy(true);
    setMessage("Loading reservation…");
    try {
      const value = await readReservation(BigInt(id));
      setReservation(value);
      setMessage(undefined);
    } catch (caught) {
      setReservation(undefined);
      setMessage(caught instanceof Error ? caught.message : "Could not load reservation.");
    } finally {
      setBusy(false);
    }
  }

  const reservationId = BigInt(id || "0");

  return (
    <div className="formCard card">
      <div className="formHeader">
        <span>Reservation console</span>
        <span className="secureTag">Onchain</span>
      </div>
      <div className="lookupRow">
        <input value={id} onChange={(event) => setId(event.target.value.replace(/\D/g, ""))} aria-label="Reservation ID" />
        <button className="button secondary" type="button" onClick={load} disabled={busy || !id}>Load</button>
      </div>

      {reservation ? (
        <div className="reservationSummary">
          <div className="summaryTop">
            <div><span>Status</span><strong>{STATUS_LABELS[reservation.status]}</strong></div>
            <div><span>Outcome</span><strong>{OUTCOME_LABELS[reservation.finalOutcome]}</strong></div>
          </div>
          <dl>
            <div><dt>Provider commitment</dt><dd>{formatUsdc(reservation.providerCommitment)}</dd></div>
            <div><dt>Customer commitment</dt><dd>{formatUsdc(reservation.customerCommitment)}</dd></div>
            <div><dt>Provider compensation</dt><dd>{formatUsdc(reservation.providerCompensation)}</dd></div>
            <div><dt>Start</dt><dd>{new Date(Number(reservation.startTime) * 1000).toLocaleString()}</dd></div>
          </dl>
          <div className="checkinCode">
            <span>Check-in reference</span>
            <strong>CP-{id.padStart(6, "0")}</strong>
            <small>Temporary human-readable code. Signed one-time QR follows in the next milestone.</small>
          </div>
        </div>
      ) : null}

      <div className="actionGrid">
        <button onClick={() => run("Accepting reservation", () => acceptReservation(reservationId))} disabled={busy}>Accept</button>
        <button onClick={() => run("Confirming attendance", () => writeSimple("confirmAttendance", [reservationId]))} disabled={busy}>Confirm attendance</button>
        <button onClick={() => run("Cancelling reservation", () => writeSimple("cancelReservation", [reservationId]))} disabled={busy}>Cancel early</button>
        <button onClick={() => run("Expiring invitation", () => writeSimple("expireUnacceptedReservation", [reservationId]))} disabled={busy}>Expire invitation</button>
        <button onClick={() => run("Opening customer no-show claim", () => openNoShowClaim(reservationId, 2))} disabled={busy}>Customer no-show</button>
        <button onClick={() => run("Opening provider no-show claim", () => openNoShowClaim(reservationId, 3))} disabled={busy}>Provider no-show</button>
        <button onClick={() => run("Disputing claim", () => writeSimple("disputeClaim", [reservationId]))} disabled={busy}>Dispute claim</button>
        <button onClick={() => run("Finalizing claim", () => writeSimple("finalizeUndisputedClaim", [reservationId]))} disabled={busy}>Finalize claim</button>
      </div>
      {message ? <div className="transactionStatus">{message}</div> : null}
    </div>
  );
}
