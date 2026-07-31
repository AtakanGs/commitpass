"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { isAddress, type Address } from "viem";
import {
  createReservation,
  explainContractError,
} from "@/lib/contract";
import { SettlementPreview } from "@/components/SettlementPreview";

function defaultStart() {
  const date = new Date(
    Date.now() + 48 * 60 * 60 * 1000,
  );

  date.setMinutes(0, 0, 0);

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().slice(0, 16);
}

type CreatedReservation = {
  hash: string;
  reservationId: bigint;
  shareUrl: string;
};

export function CreateReservationForm() {
  const [customer, setCustomer] = useState("");
  const [title, setTitle] = useState(
    "30-minute mentoring session",
  );
  const [providerBond, setProviderBond] = useState("5");
  const [customerBond, setCustomerBond] = useState("2");
  const [compensation, setCompensation] = useState("2");
  const [start, setStart] = useState(defaultStart);
  const [cancelHours, setCancelHours] = useState("24");
  const [status, setStatus] = useState<string>();
  const [created, setCreated] =
    useState<CreatedReservation>();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const valid = useMemo(() => {
    return (
      isAddress(customer) &&
      title.trim().length > 0 &&
      Number(providerBond) > 0 &&
      Number(customerBond) > 0 &&
      Number(compensation) >= 0 &&
      Number(compensation) <= Number(providerBond) &&
      Number(cancelHours) > 0 &&
      new Date(start).getTime() >
        Date.now() + Number(cancelHours) * 3_600_000
    );
  }, [
    customer,
    providerBond,
    customerBond,
    compensation,
    start,
    cancelHours,
    title,
  ]);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!valid) {
      return;
    }

    setBusy(true);
    setCreated(undefined);
    setCopied(false);
    setStatus(
      "Approve the provider commitment in your wallet...",
    );

    try {
      const result = await createReservation({
        customer: customer as Address,
        providerCommitment: providerBond,
        customerCommitment: customerBond,
        providerCompensation: compensation,
        startTime: new Date(start),
        freeCancellationHours: Number(cancelHours),
        title: title.trim(),
      });

      const params = new URLSearchParams({
        id: result.reservationId.toString(),
        title: title.trim(),
      });

      const shareUrl =
        window.location.origin +
        "/reservation?" +
        params.toString();

      setCreated({
        hash: result.hash,
        reservationId: result.reservationId,
        shareUrl,
      });

      setStatus(
        "Reservation #" +
          result.reservationId.toString() +
          " created successfully.",
      );
    } catch (caught) {
      setStatus(explainContractError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvitation() {
    if (!created) {
      return;
    }

    try {
      await navigator.clipboard.writeText(created.shareUrl);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setStatus(
        "The invitation link could not be copied automatically.",
      );
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
        <input
          value={title}
          onChange={(event) =>
            setTitle(event.target.value)
          }
          required
        />
      </label>

      <label>
        Customer wallet
        <input
          value={customer}
          onChange={(event) =>
            setCustomer(event.target.value)
          }
          placeholder="0x..."
          spellCheck={false}
          required
        />
      </label>

      <div className="fieldGrid">
        <label>
          Provider bond
          <div className="moneyInput">
            <input
              value={providerBond}
              onChange={(event) =>
                setProviderBond(event.target.value)
              }
            />
            <span>USDC</span>
          </div>
        </label>

        <label>
          Customer bond
          <div className="moneyInput">
            <input
              value={customerBond}
              onChange={(event) =>
                setCustomerBond(event.target.value)
              }
            />
            <span>USDC</span>
          </div>
        </label>
      </div>

      <div className="fieldGrid">
        <label>
          Provider no-show compensation
          <div className="moneyInput">
            <input
              value={compensation}
              onChange={(event) =>
                setCompensation(event.target.value)
              }
            />
            <span>USDC</span>
          </div>
        </label>

        <label>
          Free cancellation window
          <div className="moneyInput">
            <input
              value={cancelHours}
              onChange={(event) =>
                setCancelHours(event.target.value)
              }
            />
            <span>hours</span>
          </div>
        </label>
      </div>

      <label>
        Reservation start
        <input
          type="datetime-local"
          value={start}
          onChange={(event) =>
            setStart(event.target.value)
          }
          required
        />
      </label>

      <SettlementPreview
        providerCommitment={providerBond}
        customerCommitment={customerBond}
        providerCompensation={compensation}
      />

      <button
        className="button primary full"
        type="submit"
        disabled={!valid || busy}
      >
        {busy
          ? "Creating..."
          : "Lock provider commitment"}
      </button>

      <p className="formNote">
        Two wallet confirmations are expected: USDC approval
        and reservation creation.
      </p>

      {created ? (
        <div className="createdReservation">
          <div>
            <span>Invitation ready</span>
            <strong>
              Reservation #
              {created.reservationId.toString()}
            </strong>
            <p>
              Send this verified reservation page to the
              invited customer.
            </p>
          </div>

          <div className="createdActions">
            <a
              className="button primary"
              href={created.shareUrl}
            >
              Open reservation
            </a>

            <button
              className="button secondary"
              type="button"
              onClick={copyInvitation}
            >
              {copied ? "Link copied" : "Copy invitation"}
            </button>
          </div>

          <a
            className="transactionLink"
            href={
              "https://testnet.arcscan.app/tx/" +
              created.hash
            }
            target="_blank"
            rel="noreferrer"
          >
            View creation transaction on Arcscan
          </a>
        </div>
      ) : null}

      {status ? (
        <div className="transactionStatus">
          {status}
        </div>
      ) : null}
    </form>
  );
}
