"use client";

import { useEffect, useState } from "react";
import { type Address } from "viem";
import {
  acceptReservation,
  explainContractError,
  formatUsdc,
  openNoShowClaim,
  OUTCOME_LABELS,
  readReservation,
  STATUS_LABELS,
  writeSimple,
} from "@/lib/contract";
import {
  getConnectedAccount,
  WALLET_ACCOUNT_EVENT,
} from "@/lib/wallet";

function sameAddress(first?: string, second?: string) {
  return Boolean(
    first &&
      second &&
      first.toLowerCase() === second.toLowerCase(),
  );
}

function compact(address: string) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

export function ManageReservation() {
  const [id, setId] = useState("1");
  const [reservation, setReservation] =
    useState<Awaited<ReturnType<typeof readReservation>>>();
  const [account, setAccount] = useState<Address>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 15_000);

    function handleWalletAccount(event: Event) {
      const walletEvent = event as CustomEvent<Address | undefined>;
      setAccount(walletEvent.detail);
    }

    window.addEventListener(
      WALLET_ACCOUNT_EVENT,
      handleWalletAccount,
    );

    void getConnectedAccount()
      .then(setAccount)
      .catch(() => undefined);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(
        WALLET_ACCOUNT_EVENT,
        handleWalletAccount,
      );
    };
  }, []);

  async function run(
    label: string,
    action: () => Promise<unknown>,
  ) {
    setBusy(true);
    setMessage(label + "...");

    try {
      await action();
      setMessage(label + " completed.");
      await load();
    } catch (caught) {
      setMessage(explainContractError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    setBusy(true);
    setMessage("Loading reservation...");

    try {
      const value = await readReservation(BigInt(id));
      const connectedAccount = await getConnectedAccount();

      setReservation(value);
      setAccount(connectedAccount);
      setMessage(undefined);
      setNow(Date.now());
    } catch (caught) {
      setReservation(undefined);
      setMessage(explainContractError(caught));
    } finally {
      setBusy(false);
    }
  }

  const reservationId = BigInt(id || "0");
  const status = reservation?.status;
  const nowSeconds = Math.floor(now / 1000);

  const isProvider = sameAddress(
    account,
    reservation?.provider,
  );
  const isCustomer = sameAddress(
    account,
    reservation?.customer,
  );
  const isParticipant = isProvider || isCustomer;

  const startTime = reservation
    ? Number(reservation.startTime)
    : 0;
  const cancellationDeadline = reservation
    ? Number(reservation.freeCancellationDeadline)
    : 0;
  const gracePeriod = reservation
    ? Number(reservation.gracePeriod)
    : 0;
  const checkInOpensAt = startTime - gracePeriod;
  const checkInClosesAt = startTime + gracePeriod;
  const claimDeadline = reservation
    ? Number(reservation.claimOpenedAt) +
      Number(reservation.disputeWindow)
    : 0;

  const isBeforeCancellationDeadline =
    nowSeconds <= cancellationDeadline;
  const isCheckInOpen =
    nowSeconds >= checkInOpensAt &&
    nowSeconds <= checkInClosesAt;
  const isNoShowOpen =
    nowSeconds > checkInClosesAt;

  const connectedPartyConfirmed = isProvider
    ? reservation?.providerConfirmed
    : isCustomer
      ? reservation?.customerConfirmed
      : false;

  const canDisputePendingClaim =
    status === 3 &&
    nowSeconds <= claimDeadline &&
    ((reservation?.pendingOutcome === 2 && isCustomer) ||
      (reservation?.pendingOutcome === 3 && isProvider));

  const canFinalizePendingClaim =
    status === 3 &&
    isParticipant &&
    nowSeconds > claimDeadline;

  let roleLabel = "Wallet not connected";
  let roleDescription =
    "Connect a wallet and reload the reservation to see your available actions.";

  if (account && isProvider) {
    roleLabel = "Provider";
    roleDescription =
      "You created this reservation and supplied the provider commitment.";
  } else if (account && isCustomer) {
    roleLabel = "Customer";
    roleDescription =
      "You were invited to this reservation and supplied the customer commitment.";
  } else if (account) {
    roleLabel = "Observer";
    roleDescription =
      "This wallet is not a participant in the loaded reservation.";
  }

  let actionHint: string | undefined;

  if (reservation && !account) {
    actionHint =
      "Connect the provider or customer wallet to manage this reservation.";
  } else if (reservation && account && !isParticipant) {
    actionHint =
      "Observers can inspect the reservation, but only its participants can act.";
  } else if (status === 1 && isCustomer) {
    actionHint = isBeforeCancellationDeadline
      ? "Accept before the free-cancellation deadline to activate the reservation."
      : "The customer acceptance deadline has passed.";
  } else if (status === 1 && isProvider) {
    actionHint = isBeforeCancellationDeadline
      ? "The invitation is waiting for the customer."
      : "The invitation has expired and the provider commitment can be reclaimed.";
  } else if (status === 2 && isParticipant) {
    if (connectedPartyConfirmed) {
      actionHint =
        "Your attendance is confirmed. Waiting for the other party.";
    } else if (nowSeconds < checkInOpensAt) {
      actionHint =
        "Attendance confirmation opens at " +
        formatDate(checkInOpensAt) +
        ".";
    } else if (isCheckInOpen) {
      actionHint =
        "The check-in window is open. Confirm attendance now.";
    } else {
      actionHint =
        "The check-in window has closed. An eligible party may open a no-show claim.";
    }
  } else if (status === 3 && isParticipant) {
    actionHint = nowSeconds <= claimDeadline
      ? "The no-show claim is inside its dispute window."
      : "The dispute window has ended. The pending claim can now be finalized.";
  } else if (status === 4) {
    actionHint =
      "The claim is disputed and is awaiting arbiter resolution.";
  } else if (status === 5) {
    actionHint =
      "This reservation has been resolved and no further participant action is required.";
  } else if (status === 6) {
    actionHint =
      "This reservation was cancelled and its applicable commitments were refunded.";
  }

  return (
    <div className="formCard card">
      <div className="formHeader">
        <span>Reservation console</span>
        <span className="secureTag">Onchain</span>
      </div>

      <div className="lookupRow">
        <input
          value={id}
          onChange={(event) =>
            setId(event.target.value.replace(/\D/g, ""))
          }
          aria-label="Reservation ID"
        />
        <button
          className="button secondary"
          type="button"
          onClick={load}
          disabled={busy || !id}
        >
          Load
        </button>
      </div>

      {reservation ? (
        <>
          <div className="roleBanner">
            <div className="roleBannerTop">
              <span>Connected role</span>
              <strong>{roleLabel}</strong>
            </div>
            <p>{roleDescription}</p>
            {account ? (
              <small>{compact(account)}</small>
            ) : null}
          </div>

          <div className="reservationSummary">
            <div className="summaryTop">
              <div>
                <span>Status</span>
                <strong>
                  {STATUS_LABELS[reservation.status]}
                </strong>
              </div>
              <div>
                <span>Outcome</span>
                <strong>
                  {OUTCOME_LABELS[reservation.finalOutcome]}
                </strong>
              </div>
            </div>

            <dl>
              <div>
                <dt>Provider</dt>
                <dd>{compact(reservation.provider)}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>{compact(reservation.customer)}</dd>
              </div>
              <div>
                <dt>Provider commitment</dt>
                <dd>
                  {formatUsdc(
                    reservation.providerCommitment,
                  )}
                </dd>
              </div>
              <div>
                <dt>Customer commitment</dt>
                <dd>
                  {formatUsdc(
                    reservation.customerCommitment,
                  )}
                </dd>
              </div>
              <div>
                <dt>Provider compensation</dt>
                <dd>
                  {formatUsdc(
                    reservation.providerCompensation,
                  )}
                </dd>
              </div>
              <div>
                <dt>Reservation start</dt>
                <dd>{formatDate(startTime)}</dd>
              </div>
              <div>
                <dt>Free cancellation deadline</dt>
                <dd>{formatDate(cancellationDeadline)}</dd>
              </div>
              <div>
                <dt>Check-in window</dt>
                <dd>
                  {formatDate(checkInOpensAt)} -{" "}
                  {formatDate(checkInClosesAt)}
                </dd>
              </div>
              <div>
                <dt>Provider attendance</dt>
                <dd>
                  {reservation?.providerConfirmed
                    ? "Confirmed"
                    : "Pending"}
                </dd>
              </div>
              <div>
                <dt>Customer attendance</dt>
                <dd>
                  {reservation?.customerConfirmed
                    ? "Confirmed"
                    : "Pending"}
                </dd>
              </div>

              {reservation.pendingOutcome !== 0 ? (
                <div>
                  <dt>Pending claim</dt>
                  <dd>
                    {
                      OUTCOME_LABELS[
                        reservation.pendingOutcome
                      ]
                    }
                  </dd>
                </div>
              ) : null}

              {Number(reservation.claimOpenedAt) > 0 ? (
                <div>
                  <dt>Dispute deadline</dt>
                  <dd>{formatDate(claimDeadline)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="checkinCode">
              <span>Check-in reference</span>
              <strong>
                {"CP-" + id.padStart(6, "0")}
              </strong>
              <small>
                Human-readable reference for this onchain
                reservation.
              </small>
            </div>
          </div>
        </>
      ) : null}

      <div className="actionGrid">
        {status === 1 && isCustomer ? (
          <button
            onClick={() =>
              run(
                "Accepting reservation",
                () => acceptReservation(reservationId),
              )
            }
            disabled={
              busy || !isBeforeCancellationDeadline
            }
          >
            Accept reservation
          </button>
        ) : null}

        {status === 1 && isProvider ? (
          <>
            <button
              onClick={() =>
                run(
                  "Cancelling invitation",
                  () =>
                    writeSimple(
                      "cancelReservation",
                      [reservationId],
                    ),
                )
              }
              disabled={
                busy || !isBeforeCancellationDeadline
              }
            >
              Cancel invitation
            </button>

            <button
              onClick={() =>
                run(
                  "Expiring invitation",
                  () =>
                    writeSimple(
                      "expireUnacceptedReservation",
                      [reservationId],
                    ),
                )
              }
              disabled={
                busy || isBeforeCancellationDeadline
              }
            >
              Reclaim expired commitment
            </button>
          </>
        ) : null}

        {status === 2 &&
        isParticipant &&
        !connectedPartyConfirmed ? (
          <button
            onClick={() =>
              run(
                "Confirming attendance",
                () =>
                  writeSimple(
                    "confirmAttendance",
                    [reservationId],
                  ),
              )
            }
            disabled={busy || !isCheckInOpen}
          >
            Confirm attendance
          </button>
        ) : null}

        {status === 2 && isParticipant ? (
          <button
            onClick={() =>
              run(
                "Cancelling reservation",
                () =>
                  writeSimple(
                    "cancelReservation",
                    [reservationId],
                  ),
              )
            }
            disabled={
              busy || !isBeforeCancellationDeadline
            }
          >
            Cancel early
          </button>
        ) : null}

        {status === 2 && isProvider ? (
          <button
            onClick={() =>
              run(
                "Opening customer no-show claim",
                () =>
                  openNoShowClaim(reservationId, 2),
              )
            }
            disabled={
              busy ||
              !isNoShowOpen ||
              reservation?.customerConfirmed
            }
          >
            Claim customer no-show
          </button>
        ) : null}

        {status === 2 && isCustomer ? (
          <button
            onClick={() =>
              run(
                "Opening provider no-show claim",
                () =>
                  openNoShowClaim(reservationId, 3),
              )
            }
            disabled={
              busy ||
              !isNoShowOpen ||
              reservation?.providerConfirmed
            }
          >
            Claim provider no-show
          </button>
        ) : null}

        {status === 3 && canDisputePendingClaim ? (
          <button
            onClick={() =>
              run(
                "Disputing claim",
                () =>
                  writeSimple(
                    "disputeClaim",
                    [reservationId],
                  ),
              )
            }
            disabled={busy}
          >
            Dispute no-show claim
          </button>
        ) : null}

        {status === 3 && isParticipant ? (
          <button
            onClick={() =>
              run(
                "Finalizing claim",
                () =>
                  writeSimple(
                    "finalizeUndisputedClaim",
                    [reservationId],
                  ),
              )
            }
            disabled={
              busy || !canFinalizePendingClaim
            }
          >
            Finalize undisputed claim
          </button>
        ) : null}
      </div>

      {actionHint ? (
        <div className="actionHint">{actionHint}</div>
      ) : null}

      {message ? (
        <div className="transactionStatus">
          {message}
        </div>
      ) : null}
    </div>
  );
}
