"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import {
  isAddress,
  zeroAddress,
  type Address,
} from "viem";
import {
  createReservation,
  explainContractError,
  type AttendanceMode,
} from "@/lib/contract";
import {
  SettlementPreview,
} from "@/components/SettlementPreview";

function defaultStart() {
  const date = new Date(
    Date.now() +
      48 * 60 * 60 * 1000,
  );

  date.setMinutes(0, 0, 0);

  const localDate = new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60_000,
  );

  return localDate
    .toISOString()
    .slice(0, 16);
}

function validUsdcAmount(
  value: string,
) {
  if (
    !/^\d+(?:\.\d{1,6})?$/.test(
      value.trim(),
    )
  ) {
    return false;
  }

  const amount = Number(value);

  return (
    Number.isFinite(amount) &&
    amount >= 0.1 &&
    amount <= 10_000
  );
}

function sameAddress(
  first: string,
  second: string,
) {
  return (
    first.toLowerCase() ===
    second.toLowerCase()
  );
}

type CreatedReservation = {
  hash: string;
  reservationId: bigint;
  shareUrl: string;
  attendanceMode: AttendanceMode;
  attendanceAttestor: Address;
};

export function CreateReservationForm() {
  const [customer, setCustomer] =
    useState("");

  const [title, setTitle] = useState(
    "30-minute mentoring session",
  );

  const [
    commitmentAmount,
    setCommitmentAmount,
  ] = useState("2");

  const [
    attendanceMode,
    setAttendanceMode,
  ] = useState<AttendanceMode>("self");

  const [
    attendanceAttestor,
    setAttendanceAttestor,
  ] = useState("");

  const [start, setStart] =
    useState(defaultStart);

  const [cancelHours, setCancelHours] =
    useState("24");

  const [status, setStatus] =
    useState<string>();

  const [created, setCreated] =
    useState<CreatedReservation>();

  const [copied, setCopied] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const valid = useMemo(() => {
    const customerValid =
      isAddress(customer);

    const cancellationLeadHours =
      Number(cancelHours);

    const startMs =
      new Date(start).getTime();

    const cancellationDeadlineMs =
      startMs -
      cancellationLeadHours *
        3_600_000;

    const scheduleValid =
      Number.isFinite(startMs) &&
      Number.isFinite(
        cancellationLeadHours,
      ) &&
      cancellationLeadHours >= 1 &&
      cancellationDeadlineMs >=
        Date.now() + 15 * 60_000;

    const attestorValid =
      attendanceMode === "self" ||
      (
        isAddress(
          attendanceAttestor,
        ) &&
        !sameAddress(
          attendanceAttestor,
          zeroAddress,
        ) &&
        (
          !customerValid ||
          !sameAddress(
            attendanceAttestor,
            customer,
          )
        )
      );

    return (
      customerValid &&
      title.trim().length > 0 &&
      validUsdcAmount(
        commitmentAmount,
      ) &&
      scheduleValid &&
      attestorValid
    );
  }, [
    attendanceAttestor,
    attendanceMode,
    cancelHours,
    commitmentAmount,
    customer,
    start,
    title,
  ]);

  async function submit(
    event: FormEvent,
  ) {
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
      const result =
        await createReservation({
          customer:
            customer as Address,
          attendanceMode,
          attendanceAttestor,
          commitmentAmount,
          startTime:
            new Date(start),
          freeCancellationHours:
            Number(cancelHours),
          title: title.trim(),
        });

      const params =
        new URLSearchParams({
          id:
            result.reservationId
              .toString(),
          title: title.trim(),
          salt: result.metadataSalt,
        });

      const shareUrl =
        window.location.origin +
        "/reservation?" +
        params.toString();

      setCreated({
        hash: result.hash,
        reservationId:
          result.reservationId,
        shareUrl,
        attendanceMode,
        attendanceAttestor:
          result.attendanceAttestor,
      });

      setStatus(
        "Reservation #" +
          result.reservationId
            .toString() +
          " created successfully.",
      );
    } catch (caught) {
      setStatus(
        explainContractError(caught),
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyInvitation() {
    if (!created) {
      return;
    }

    try {
      await navigator.clipboard
        .writeText(
          created.shareUrl,
        );

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
    <form
      className="formCard card"
      onSubmit={submit}
    >
      <div className="formHeader">
        <span>New V3 commitment</span>
        <span className="secureTag">
          Final testnet contract
        </span>
      </div>

      <label>
        Session title
        <input
          value={title}
          onChange={(event) =>
            setTitle(
              event.target.value,
            )
          }
          maxLength={160}
          required
        />
        <small className="fieldHelp">
          Use a short label only. Do not
          include names, contact details or
          other personal information.
        </small>
      </label>

      <label>
        Customer wallet
        <input
          value={customer}
          onChange={(event) =>
            setCustomer(
              event.target.value,
            )
          }
          placeholder="0x..."
          spellCheck={false}
          required
        />
      </label>

      <label>
        Equal commitment per party
        <div className="moneyInput">
          <input
            value={commitmentAmount}
            onChange={(event) =>
              setCommitmentAmount(
                event.target.value,
              )
            }
            inputMode="decimal"
          />
          <span>USDC</span>
        </div>
        <small className="fieldHelp">
          The provider and customer lock the
          same amount. Allowed range:
          0.10-10,000 USDC.
        </small>
      </label>

      <label>
        Attendance verification
      </label>

      <div className="createdActions">
        <button
          className={
            attendanceMode === "self"
              ? "button primary"
              : "button secondary"
          }
          type="button"
          onClick={() =>
            setAttendanceMode("self")
          }
        >
          Self-attested
        </button>

        <button
          className={
            attendanceMode === "platform"
              ? "button primary"
              : "button secondary"
          }
          type="button"
          onClick={() =>
            setAttendanceMode(
              "platform",
            )
          }
        >
          Platform-verified
        </button>
      </div>

      <p className="formNote">
        Self-attested reservations let each
        participant check in directly.
        Platform-verified reservations require
        a valid EIP-712 signature from the
        configured platform signer.
      </p>

      {attendanceMode === "platform" ? (
        <label>
          Platform attestor wallet
          <input
            value={attendanceAttestor}
            onChange={(event) =>
              setAttendanceAttestor(
                event.target.value,
              )
            }
            placeholder="0x..."
            spellCheck={false}
            required
          />
          <small className="fieldHelp">
            This address becomes immutable for
            the reservation. It must differ
            from provider, customer and arbiter.
          </small>
        </label>
      ) : null}

      <div className="fieldGrid">
        <label>
          Free cancellation lead
          <div className="moneyInput">
            <input
              value={cancelHours}
              onChange={(event) =>
                setCancelHours(
                  event.target.value,
                )
              }
              inputMode="decimal"
            />
            <span>hours</span>
          </div>
        </label>

        <label>
          Reservation start
          <input
            type="datetime-local"
            value={start}
            onChange={(event) =>
              setStart(
                event.target.value,
              )
            }
            required
          />
        </label>
      </div>

      <SettlementPreview
        commitmentAmount={
          commitmentAmount
        }
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
        Two wallet confirmations are expected:
        USDC approval and reservation creation.
      </p>

      {created ? (
        <div className="createdReservation">
          <div>
            <span>Invitation ready</span>
            <strong>
              Reservation #
              {created.reservationId
                .toString()}
            </strong>
            <p>
              Attendance mode:{" "}
              {created.attendanceMode ===
              "platform"
                ? "Platform-verified"
                : "Self-attested"}
              .
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
              onClick={
                copyInvitation
              }
            >
              {copied
                ? "Link copied"
                : "Copy invitation"}
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
            View creation transaction on
            Arcscan
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
