"use client";

import {
  FormEvent,
  useEffect,
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

const CANCELLATION_PRESETS = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "90 minutes" },
  { minutes: 120, label: "2 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 2880, label: "48 hours" },
] as const;

const RECENT_RESERVATIONS_KEY =
  "commitpass:recent-reservations:v1";
const MAX_RECENT_RESERVATIONS = 6;

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
  liveSessionUrl?: string;
  attendanceMode: AttendanceMode;
  attendanceAttestor: Address;
  sessionPolicy?: DigitalSessionPolicy;
};

type RecentReservation = {
  reservationId: string;
  title: string;
  start: string;
  createdAt: string;
  shareUrl: string;
  liveSessionUrl?: string;
  hash: string;
  commitmentAmount: string;
  cancellationMinutes: number;
  sessionPolicy?: DigitalSessionPolicy;
};

function readRecentReservations(): RecentReservation[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        RECENT_RESERVATIONS_KEY,
      );

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.slice(
          0,
          MAX_RECENT_RESERVATIONS,
        )
      : [];
  } catch {
    return [];
  }
}

function writeRecentReservations(
  reservations: RecentReservation[],
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      RECENT_RESERVATIONS_KEY,
      JSON.stringify(
        reservations.slice(
          0,
          MAX_RECENT_RESERVATIONS,
        ),
      ),
    );
  } catch {
    // Browser storage is a convenience only.
  }
}

function formatLocalDate(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

  const [
    cancellationMinutes,
    setCancellationMinutes,
  ] = useState("1440");

  const [status, setStatus] =
    useState<string>();

  const [created, setCreated] =
    useState<CreatedReservation>();

  const [copied, setCopied] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [
    recentReservations,
    setRecentReservations,
  ] = useState<RecentReservation[]>([]);

  const [
    copiedRecentId,
    setCopiedRecentId,
  ] = useState<string>();

  useEffect(() => {
    setRecentReservations(
      readRecentReservations(),
    );
  }, []);

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

  const cancellationLeadMinutes =
    Number(cancellationMinutes);

  const requiredCancellationLeadMinutes =
    attendanceMode === "platform" &&
    sessionPolicyValidation.valid
      ? attendanceGraceSeconds(
          sessionPolicy,
        ) /
          60 +
        15
      : 30;

  const startMs =
    new Date(start).getTime();

  const cancellationDeadlineMs =
    startMs -
    cancellationLeadMinutes *
      60_000;

  const cancellationDeadlineLabel =
    Number.isFinite(
      cancellationDeadlineMs,
    )
      ? new Date(
          cancellationDeadlineMs,
        ).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "-";

  const valid = useMemo(() => {
    const customerValid =
      isAddress(customer);

    const scheduleValid =
      Number.isFinite(startMs) &&
      Number.isFinite(
        cancellationLeadMinutes,
      ) &&
      cancellationLeadMinutes >=
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
    cancellationDeadlineMs,
    cancellationLeadMinutes,
    commitmentAmount,
    customer,
    platformVerificationAvailable,
    requiredCancellationLeadMinutes,
    sessionPolicyValidation.valid,
    startMs,
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
            cancellationLeadMinutes /
            60,
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

      const liveSessionUrl =
        committedSessionPolicy
          ? window.location.origin +
            "/live-session?" +
            params.toString()
          : undefined;

      setCreated({
        hash: result.hash,
        reservationId:
          result.reservationId,
        shareUrl,
        liveSessionUrl,
        attendanceMode,
        attendanceAttestor:
          result.attendanceAttestor,
        sessionPolicy:
          committedSessionPolicy,
      });

      const recentEntry: RecentReservation = {
        reservationId:
          result.reservationId.toString(),
        title: title.trim(),
        start,
        createdAt:
          new Date().toISOString(),
        shareUrl,
        liveSessionUrl,
        hash: result.hash,
        commitmentAmount,
        cancellationMinutes:
          cancellationLeadMinutes,
        sessionPolicy:
          committedSessionPolicy,
      };

      const nextRecent = [
        recentEntry,
        ...readRecentReservations().filter(
          (entry) =>
            entry.reservationId !==
            recentEntry.reservationId,
        ),
      ].slice(
        0,
        MAX_RECENT_RESERVATIONS,
      );

      writeRecentReservations(
        nextRecent,
      );
      setRecentReservations(
        nextRecent,
      );

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

  async function copyRecentInvitation(
    reservation: RecentReservation,
  ) {
    try {
      await navigator.clipboard.writeText(
        reservation.shareUrl,
      );

      setCopiedRecentId(
        reservation.reservationId,
      );

      window.setTimeout(() => {
        setCopiedRecentId(undefined);
      }, 1800);
    } catch {
      setStatus(
        "The saved invitation link could not be copied automatically.",
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

      {recentReservations.length > 0 ? (
        <details className="recentReservations">
          <summary>
            Recent reservations on this device
            {" "}({recentReservations.length})
          </summary>

          <p className="recentReservationsNote">
            Verified invitation links are stored only
            in this browser so you can return after a
            refresh or restart. No private keys are
            stored.
          </p>

          <div className="recentReservationList">
            {recentReservations.map(
              (reservation) => (
                <div
                  className="recentReservationItem"
                  key={reservation.reservationId}
                >
                  <div>
                    <span>
                      Reservation #
                      {reservation.reservationId}
                    </span>
                    <strong>
                      {reservation.title}
                    </strong>
                    <small>
                      {formatLocalDate(
                        reservation.start,
                      )}
                      {" / "}
                      {reservation.commitmentAmount}
                      {" USDC each"}
                    </small>
                  </div>

                  <div className="recentReservationActions">
                    <a
                      className="button secondary"
                      href={reservation.shareUrl}
                    >
                      Open reservation
                    </a>

                    <button
                      className="button secondary"
                      type="button"
                      onClick={() =>
                        copyRecentInvitation(
                          reservation,
                        )
                      }
                    >
                      {copiedRecentId ===
                      reservation.reservationId
                        ? "Link copied"
                        : "Copy invitation"}
                    </button>

                    {reservation.liveSessionUrl ? (
                      <a
                        className="button secondary"
                        href={
                          reservation.liveSessionUrl
                        }
                      >
                        Open live room
                      </a>
                    ) : null}
                  </div>
                </div>
              ),
            )}
          </div>
        </details>
      ) : null}

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
          Free cancellation before start
          <select
            value={cancellationMinutes}
            onChange={(event) =>
              setCancellationMinutes(
                event.target.value,
              )
            }
          >
            {CANCELLATION_PRESETS.map(
              (preset) => (
                <option
                  key={preset.minutes}
                  value={preset.minutes}
                >
                  {preset.label}
                </option>
              ),
            )}
          </select>

          {cancellationLeadMinutes <
          requiredCancellationLeadMinutes ? (
            <small className="metadataUnverified">
              These session terms require at least
              {" "}
              {requiredCancellationLeadMinutes}
              {" minutes of cancellation lead time."}
            </small>
          ) : (
            <small className="fieldHelp">
              Free cancellation until
              {" "}
              {cancellationDeadlineLabel}.
              {" Minimum for these terms: "}
              {requiredCancellationLeadMinutes}
              {" minutes."}
            </small>
          )}
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

            {created.liveSessionUrl ? (
              <a
                className="button secondary"
                href={created.liveSessionUrl}
              >
                Experimental live room
              </a>
            ) : null}
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
