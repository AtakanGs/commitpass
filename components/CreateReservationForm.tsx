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

const DEFAULT_PLATFORM_ATTESTOR =
  "0x57c165889e936692cf4a4aE4b97f8daDDa0b8E01";

const PLATFORM_ATTESTOR =
  process.env
    .NEXT_PUBLIC_COMMITPASS_DEMO_ATTESTOR_ADDRESS
    ?.trim() ||
  DEFAULT_PLATFORM_ATTESTOR;

const DURATION_PRESETS = [
  15,
  30,
  45,
  60,
  90,
] as const;

function defaultStart() {
  const date = new Date(
    Date.now() + 48 * 60 * 60 * 1000,
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

function validUsdcAmount(value: string) {
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

function recommendedPolicy(
  scheduledMinutes: number,
): DigitalSessionPolicy {
  const presets: Record<
    number,
    Pick<
      DigitalSessionPolicy,
      | "issueWindowMinutes"
      | "completionThresholdMinutes"
    >
  > = {
    15: {
      issueWindowMinutes: 3,
      completionThresholdMinutes: 10,
    },
    30: {
      issueWindowMinutes: 5,
      completionThresholdMinutes: 20,
    },
    45: {
      issueWindowMinutes: 5,
      completionThresholdMinutes: 30,
    },
    60: {
      issueWindowMinutes: 10,
      completionThresholdMinutes: 40,
    },
    90: {
      issueWindowMinutes: 10,
      completionThresholdMinutes: 60,
    },
  };

  const selected =
    presets[scheduledMinutes] ??
    presets[
      DEFAULT_DIGITAL_SESSION_POLICY
        .scheduledMinutes
    ];

  return {
    version: 1,
    kind: "digital-session",
    scheduledMinutes,
    ...selected,
  };
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
  const platformVerificationAvailable =
    isAddress(PLATFORM_ATTESTOR) &&
    !sameAddress(
      PLATFORM_ATTESTOR,
      zeroAddress,
    );

  const [customer, setCustomer] =
    useState("");

  const [title, setTitle] = useState(
    "Online session",
  );

  const [
    commitmentAmount,
    setCommitmentAmount,
  ] = useState("2");

  const [
    attendanceMode,
    setAttendanceMode,
  ] = useState<AttendanceMode>(
    platformVerificationAvailable
      ? "platform"
      : "self",
  );

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
      attendanceMode === "platform" &&
      sessionPolicyValidation.valid
        ? attendanceGraceSeconds(
            sessionPolicy,
          ) /
            60 +
          15
        : 30;

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
        platformVerificationAvailable &&
        (
          !customerValid ||
          !sameAddress(
            PLATFORM_ATTESTOR,
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
    platformVerificationAvailable,
    sessionPolicy,
    sessionPolicyValidation.valid,
    start,
    title,
  ]);

  function chooseDuration(
    duration: number,
  ) {
    const policy =
      recommendedPolicy(duration);

    setScheduledMinutes(
      String(policy.scheduledMinutes),
    );
    setIssueWindowMinutes(
      String(policy.issueWindowMinutes),
    );
    setCompletionThresholdMinutes(
      String(
        policy.completionThresholdMinutes,
      ),
    );
  }

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
      "Confirm the security deposit in your wallet...",
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
              ? PLATFORM_ATTESTOR
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
        "Invitation created. Share the link with the other participant.",
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
        <span>Create a protected session</span>
        <span className="secureTag">
          Arc Testnet
        </span>
      </div>

      <p className="formNote">
        Choose the session details. Both parties
        lock the same refundable security deposit.
      </p>

      <label>
        What is the session for?
        <input
          value={title}
          onChange={(event) =>
            setTitle(
              event.target.value,
            )
          }
          maxLength={160}
          placeholder="Online lesson, consultation or mentoring"
          required
        />
        <small className="fieldHelp">
          Use a short label. Do not include names,
          contact details or private information.
        </small>
      </label>

      <label>
        Other participant&apos;s wallet
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
        <small className="fieldHelp">
          Ask the invited participant to copy their
          connected wallet address.
        </small>
      </label>

      <div className="fieldGrid">
        <label>
          Date and time
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

        <label>
          Refundable deposit per person
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
            Allowed range: 0.10-10,000 USDC.
          </small>
        </label>
      </div>

      <label>How long is the session?</label>

      <div className="createdActions">
        {DURATION_PRESETS.map(
          (duration) => (
            <button
              key={duration}
              className={
                Number(scheduledMinutes) ===
                duration
                  ? "button primary"
                  : "button secondary"
              }
              type="button"
              onClick={() =>
                chooseDuration(duration)
              }
            >
              {duration} min
            </button>
          ),
        )}
      </div>

      <div className="transactionStatus">
        <strong>
          Simple rule
        </strong>
        <p>
          The session is completed after both
          participants are verified as present
          together for at least
          {" "}{completionThresholdMinutes} minutes.
          A {issueWindowMinutes}-minute arrival
          window is included.
        </p>
      </div>

      <div className="fieldGrid">
        <label>
          Free cancellation
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
            <span>hours before</span>
          </div>
        </label>

        <div className="transactionStatus">
          <strong>
            Attendance verification
          </strong>
          <p>
            {attendanceMode === "platform"
              ? "This reservation uses the configured Arc Testnet attendance verifier."
              : "Each participant confirms attendance manually."}
          </p>
        </div>
      </div>

      <details>
        <summary>
          Advanced settings
        </summary>

        <p className="formNote">
          The recommended values above are designed
          to keep the experience simple. Change these
          only when both participants understand the
          result.
        </p>

        <div className="fieldGrid">
          <label>
            Session duration
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
            Arrival window
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
          Completion requirement
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
            <span>minutes together</span>
          </div>
        </label>

        {!sessionPolicyValidation.valid ? (
          <small className="metadataUnverified">
            {sessionPolicyValidation.errors[0]}
          </small>
        ) : null}

        <label>
          Verification method
        </label>

        <div className="createdActions">
          <button
            className={
              attendanceMode === "platform"
                ? "button primary"
                : "button secondary"
            }
            type="button"
            disabled={
              !platformVerificationAvailable
            }
            onClick={() =>
              setAttendanceMode(
                "platform",
              )
            }
          >
            Verified session (testnet)
          </button>

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
            Manual fallback
          </button>
        </div>

        <small className="fieldHelp">
          The testnet verifier accepts signed
          attendance produced by CommitPass demo
          tooling. A production meeting-presence
          service is not deployed yet.
        </small>
      </details>

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
          ? "Creating invitation..."
          : `Create invitation and lock ${commitmentAmount || "0"} USDC`}
      </button>

      <p className="formNote">
        Your wallet may ask for two confirmations:
        token approval and the refundable deposit.
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
              Share the link below. The invited
              participant reviews the same terms and
              locks the same deposit.
            </p>
            {created.sessionPolicy ? (
              <p>
                {created.sessionPolicy
                  .scheduledMinutes}
                -minute session /{" "}
                {created.sessionPolicy
                  .completionThresholdMinutes}
                -minute verified completion /{" "}
                {commitmentAmount} USDC each
              </p>
            ) : (
              <p>
                Manual attendance confirmation /{" "}
                {commitmentAmount} USDC each
              </p>
            )}
          </div>

          <div className="createdActions">
            <a
              className="button primary"
              href={created.shareUrl}
            >
              Review invitation
            </a>

            <button
              className="button secondary"
              type="button"
              onClick={copyInvitation}
            >
              {copied
                ? "Link copied"
                : "Copy invitation link"}
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
            View creation transaction
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
