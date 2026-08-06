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
import {
  DEFAULT_DIGITAL_SESSION_POLICY,
  attendanceGraceSeconds,
  sessionPolicyQuery,
  validateDigitalSessionPolicy,
  type DigitalSessionPolicy,
} from "@/lib/sessionPolicy";

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
  sessionPolicy?: DigitalSessionPolicy;
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
    scheduledMinutes,
    setScheduledMinutes,
  ] = useState(
    String(
      DEFAULT_DIGITAL_SESSION_POLICY
        .scheduledMinutes,
    ),
  );

  const [
    issueWindowMinutes,
    setIssueWindowMinutes,
  ] = useState(
    String(
      DEFAULT_DIGITAL_SESSION_POLICY
        .issueWindowMinutes,
    ),
  );

  const [
    completionThresholdMinutes,
    setCompletionThresholdMinutes,
  ] = useState(
    String(
      DEFAULT_DIGITAL_SESSION_POLICY
        .completionThresholdMinutes,
    ),
  );

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

  const platformAttestor =
    process.env
      .NEXT_PUBLIC_COMMITPASS_DEMO_ATTESTOR_ADDRESS ??
    "";

  const sessionPolicy = useMemo(
    () => ({
      version: 1 as const,
      kind: "digital-session" as const,
      scheduledMinutes: Number(
        scheduledMinutes,
      ),
      issueWindowMinutes: Number(
        issueWindowMinutes,
      ),
      completionThresholdMinutes:
        Number(
          completionThresholdMinutes,
        ),
    }),
    [
      completionThresholdMinutes,
      issueWindowMinutes,
      scheduledMinutes,
    ],
  );

  const sessionPolicyValidation =
    useMemo(
      () =>
        validateDigitalSessionPolicy(
          sessionPolicy,
        ),
      [sessionPolicy],
    );

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

    const requiredCancellationLeadMinutes =
      sessionPolicyValidation.valid
        ? attendanceGraceSeconds(
            sessionPolicy,
          ) /
            60 +
          15
        : Number.POSITIVE_INFINITY;

    const scheduleValid =
      Number.isFinite(startMs) &&
      Number.isFinite(
        cancellationLeadHours,
      ) &&
      cancellationLeadHours * 60 >=
        requiredCancellationLeadMinutes &&
      cancellationDeadlineMs >=
        Date.now() + 15 * 60_000;

    const attestorValid =
      attendanceMode === "self" ||
      (
        isAddress(
          platformAttestor,
        ) &&
        !sameAddress(
          platformAttestor,
          zeroAddress,
        ) &&
        (
          !customerValid ||
          !sameAddress(
            platformAttestor,
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
      attestorValid &&
      (
        attendanceMode === "self" ||
        sessionPolicyValidation.valid
      )
    );
  }, [
    attendanceMode,
    cancelHours,
    commitmentAmount,
    customer,
    platformAttestor,
    sessionPolicy,
    sessionPolicyValidation.valid,
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
      const committedSessionPolicy =
        attendanceMode === "platform"
          ? sessionPolicy
          : undefined;

      const result =
        await createReservation({
          customer:
            customer as Address,
          attendanceMode,
          attendanceAttestor:
            attendanceMode ===
            "platform"
              ? platformAttestor
              : undefined,
          commitmentAmount,
          startTime:
            new Date(start),
          freeCancellationHours:
            Number(cancelHours),
          title: title.trim(),
          sessionPolicy:
            committedSessionPolicy,
        });

      const params =
        new URLSearchParams({
          id:
            result.reservationId
              .toString(),
          title: title.trim(),
          salt: result.metadataSalt,
        });

      if (committedSessionPolicy) {
        const policyQuery =
          sessionPolicyQuery(
            committedSessionPolicy,
          );

        for (const [key, value] of
          Object.entries(
            policyQuery,
          )) {
          params.set(key, value);
        }
      }

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
        sessionPolicy:
          committedSessionPolicy,
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

      <div className="fieldGrid">
        <label>
          Scheduled session
          <div className="moneyInput">
            <input
              value={scheduledMinutes}
              onChange={(event) =>
                setScheduledMinutes(
                  event.target.value,
                )
              }
              inputMode="numeric"
            />
            <span>minutes</span>
          </div>
        </label>

        <label>
          Issue window
          <div className="moneyInput">
            <input
              value={issueWindowMinutes}
              onChange={(event) =>
                setIssueWindowMinutes(
                  event.target.value,
                )
              }
              inputMode="numeric"
            />
            <span>minutes</span>
          </div>
        </label>
      </div>

      <label>
        Completion threshold
        <div className="moneyInput">
          <input
            value={
              completionThresholdMinutes
            }
            onChange={(event) =>
              setCompletionThresholdMinutes(
                event.target.value,
              )
            }
            inputMode="numeric"
          />
          <span>minutes</span>
        </div>
        <small className="fieldHelp">
          The session completes only after
          both parties share the authenticated
          session for this long. The default
          30-minute policy uses a 5-minute
          issue window and a 20-minute
          completion threshold. These terms
          are committed and enforceable by the
          attendance adapter only in platform-
          verified mode.
        </small>
        {!sessionPolicyValidation.valid ? (
          <small className="metadataUnverified">
            {sessionPolicyValidation.errors[0]}
          </small>
        ) : null}
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
          Manual check-in
        </button>

        <button
          className={
            attendanceMode === "platform"
              ? "button primary"
              : "button secondary"
          }
          type="button"
          disabled={
            !isAddress(
              platformAttestor,
            )
          }
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
        Manual check-in lets each participant
        confirm directly and does not enforce
        the duration policy. The platform-
        verified demo uses the fixed
        CommitPass attestor configured by the
        deployment; providers cannot substitute
        an arbitrary signer.
      </p>

      {attendanceMode === "platform" ? (
        <div className="transactionStatus">
          Demo attestor: {platformAttestor}
        </div>
      ) : !isAddress(platformAttestor) ? (
        <p className="formNote">
          Platform verification remains disabled
          until the public demo attestor address
          is configured.
        </p>
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
          <small className="fieldHelp">
            Must close at least 15 minutes
            before the digital attendance
            window opens. Longer sessions may
            require a longer lead.
          </small>
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
                : "Manual check-in"}
              .
            </p>
            {created.sessionPolicy ? (
              <p>
                Digital session terms: {" "}
                {created.sessionPolicy
                  .scheduledMinutes}
                -minute session, {" "}
                {created.sessionPolicy
                  .issueWindowMinutes}
                -minute issue window and {" "}
                {created.sessionPolicy
                  .completionThresholdMinutes}
                -minute completion threshold.
              </p>
            ) : (
              <p>
                No platform-enforced duration
                policy is committed for manual
                check-in.
              </p>
            )}
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
