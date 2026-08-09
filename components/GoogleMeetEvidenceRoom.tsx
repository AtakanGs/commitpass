"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  useSearchParams,
} from "next/navigation";

type MeetParticipant = {
  key: string;
  userId?: string;
  displayName: string;
  type:
    | "signed-in"
    | "anonymous"
    | "phone"
    | "unknown";
  sessions: {
    startTime: string;
    endTime?: string;
  }[];
};

type MeetEvidence = {
  meetingCode: string;
  conferenceRecord: string;
  space?: string;
  startTime?: string;
  endTime?: string;
  ended: boolean;
  participants: MeetParticipant[];
};

type EvaluationResult = {
  evidence: MeetEvidence;
  mapping: {
    provider: {
      wallet: string;
      googleUser?: string;
      displayName: string;
    };
    customer: {
      wallet: string;
      googleUser?: string;
      displayName: string;
    };
  };
  evaluation: {
    code: string;
    final: boolean;
    providerSeconds: number;
    customerSeconds: number;
    verifiedOverlapSeconds: number;
    completionThresholdSeconds: number;
    recommendedContractOutcome: string;
    reason: string;
  };
  settlement?: {
    providerTransaction?: string;
    customerTransaction?: string;
    finalOutcome: number;
    status: number;
  };
};

async function postJson<T>(
  route: string,
  body: unknown,
) {
  const response =
    await fetch(route, {
      method: "POST",
      headers: {
        "content-type":
          "application/json",
      },
      body:
        JSON.stringify(body),
      cache: "no-store",
    });

  const payload =
    await response.json();

  if (!response.ok) {
    throw new Error(
      payload.error ||
        "Google Meet evidence request failed.",
    );
  }

  return payload as T;
}

function formatSeconds(
  seconds: number,
) {
  const value =
    Math.max(
      0,
      Math.floor(seconds),
    );
  const minutes =
    Math.floor(
      value / 60,
    );
  const remainder =
    value % 60;

  return (
    String(minutes)
      .padStart(2, "0") +
    ":" +
    String(remainder)
      .padStart(2, "0")
  );
}

function formatDate(
  value?: string,
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  return Number.isFinite(
    date.getTime(),
  )
    ? date.toLocaleString()
    : value;
}

function normalizedIntervals(
  participant: MeetParticipant,
) {
  const intervals =
    participant.sessions
      .filter(
        (
          session,
        ): session is {
          startTime: string;
          endTime: string;
        } =>
          Boolean(
            session.startTime &&
            session.endTime,
          ),
      )
      .map((session) => ({
        joinedAt:
          Math.floor(
            Date.parse(
              session.startTime,
            ) / 1000,
          ),
        leftAt:
          Math.floor(
            Date.parse(
              session.endTime,
            ) / 1000,
          ),
      }))
      .filter(
        (interval) =>
          Number.isFinite(
            interval.joinedAt,
          ) &&
          Number.isFinite(
            interval.leftAt,
          ) &&
          interval.leftAt >
            interval.joinedAt,
      )
      .sort(
        (first, second) =>
          first.joinedAt -
          second.joinedAt,
      );

  const merged:
    {
      joinedAt: number;
      leftAt: number;
    }[] = [];

  for (const interval of
    intervals) {
    const previous =
      merged.at(-1);

    if (
      !previous ||
      interval.joinedAt >
        previous.leftAt
    ) {
      merged.push({
        ...interval,
      });
    } else {
      previous.leftAt =
        Math.max(
          previous.leftAt,
          interval.leftAt,
        );
    }
  }

  return merged;
}

function observedOverlapSeconds(
  first: MeetParticipant,
  second: MeetParticipant,
) {
  const firstIntervals =
    normalizedIntervals(first);
  const secondIntervals =
    normalizedIntervals(second);

  let firstIndex = 0;
  let secondIndex = 0;
  let overlap = 0;

  while (
    firstIndex <
      firstIntervals.length &&
    secondIndex <
      secondIntervals.length
  ) {
    const firstInterval =
      firstIntervals[firstIndex];
    const secondInterval =
      secondIntervals[
        secondIndex
      ];

    const start =
      Math.max(
        firstInterval.joinedAt,
        secondInterval.joinedAt,
      );
    const end =
      Math.min(
        firstInterval.leftAt,
        secondInterval.leftAt,
      );

    if (end > start) {
      overlap +=
        end - start;
    }

    if (
      firstInterval.leftAt <=
      secondInterval.leftAt
    ) {
      firstIndex += 1;
    } else {
      secondIndex += 1;
    }
  }

  return overlap;
}

export function
GoogleMeetEvidenceRoom() {
  const searchParams =
    useSearchParams();

  const reservationId =
    searchParams.get("id") || "";
  const title =
    searchParams.get("title") || "";
  const salt =
    searchParams.get("salt") || "";
  const duration =
    searchParams.get("duration") || "";
  const issue =
    searchParams.get("issue") || "";
  const threshold =
    searchParams.get("threshold") || "";

  const termsReady =
    Boolean(
      reservationId &&
      title &&
      salt &&
      duration &&
      issue &&
      threshold,
    );

  const [meetingCode, setMeetingCode] =
    useState(
      searchParams.get("meeting") ||
        "",
    );
  const [evidence, setEvidence] =
    useState<MeetEvidence>();
  const [
    providerGoogleUser,
    setProviderGoogleUser,
  ] = useState("");
  const [
    customerGoogleUser,
    setCustomerGoogleUser,
  ] = useState("");
  const [
    evaluation,
    setEvaluation,
  ] =
    useState<EvaluationResult>();
  const [message, setMessage] =
    useState<string>();
  const [busy, setBusy] =
    useState(false);

  const signedInParticipants =
    useMemo(
      () =>
        evidence?.participants
          .filter(
            (participant) =>
              participant.type ===
                "signed-in" &&
              participant.userId,
          ) || [],
      [evidence],
    );

  const rawOverlap =
    useMemo(
      () =>
        signedInParticipants.length ===
        2
          ? observedOverlapSeconds(
              signedInParticipants[0],
              signedInParticipants[1],
            )
          : undefined,
      [signedInParticipants],
    );

  const requestBody = {
    reservationId,
    title,
    salt,
    policy: {
      duration,
      issue,
      threshold,
    },
    meetingCode,
    providerGoogleUser,
    customerGoogleUser,
  };

  async function loadEvidence() {
    setBusy(true);
    setMessage(
      "Reading Google Meet conference evidence...",
    );
    setEvaluation(undefined);

    try {
      const result =
        await postJson<MeetEvidence>(
          "/api/meet/evidence",
          { meetingCode },
        );

      setEvidence(result);

      const signedIn =
        result.participants.filter(
          (participant) =>
            participant.type ===
              "signed-in" &&
            participant.userId,
        );

      if (
        signedIn.length === 2
      ) {
        setProviderGoogleUser(
          signedIn[0]
            .userId || "",
        );
        setCustomerGoogleUser(
          signedIn[1]
            .userId || "",
        );
      }

      setMessage(
        termsReady
          ? "Google Meet participant sessions loaded. Confirm the provider/customer mapping before policy evaluation."
          : "Real Google Meet participant-session evidence loaded. Reservation evaluation is intentionally disabled in evidence-only mode.",
      );
    } catch (caught) {
      setEvidence(undefined);
      setMessage(
        caught instanceof Error
          ? caught.message
          : String(caught),
      );
    } finally {
      setBusy(false);
    }
  }

  async function evaluateEvidence() {
    setBusy(true);
    setMessage(
      "Evaluating Google Meet sessions against the committed reservation policy...",
    );

    try {
      const result =
        await postJson<EvaluationResult>(
          "/api/meet/evidence",
          requestBody,
        );

      setEvaluation(
        result,
      );
      setEvidence(
        result.evidence,
      );
      setMessage(
        result.evaluation.reason,
      );
    } catch (caught) {
      setEvaluation(undefined);
      setMessage(
        caught instanceof Error
          ? caught.message
          : String(caught),
      );
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    setBusy(true);
    setMessage(
      "Signing Google Meet-backed attendance and relaying it to CommitPass V3...",
    );

    try {
      const result =
        await postJson<EvaluationResult>(
          "/api/meet/settle",
          requestBody,
        );

      setEvaluation(
        result,
      );
      setEvidence(
        result.evidence,
      );
      setMessage(
        "Google Meet attendance evidence settled on Arc.",
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : String(caught),
      );
    } finally {
      setBusy(false);
    }
  }

  const canEvaluate =
    termsReady &&
    Boolean(
      evidence &&
      providerGoogleUser &&
      customerGoogleUser &&
      providerGoogleUser !==
        customerGoogleUser,
    );

  const canSettle =
    Boolean(
      evaluation &&
      evaluation
        .evaluation.final &&
      evaluation
        .evaluation.code ===
        "completed" &&
      !evaluation.settlement,
    );

  return (
    <section className="shell section">
      <div className="sectionHead">
        <p className="eyebrow">
          GOOGLE MEET EVIDENCE ADAPTER
        </p>
        <h1>
          Meet evidence,
          programmable settlement.
        </h1>
        <p>
          CommitPass reads signed-in
          participant sessions from the
          Google Meet REST API. A verified
          reservation can then apply its
          committed overlap policy before
          V3 attendance is relayed.
        </p>
      </div>

      <div className="card formCard">
        <div className="formHeader">
          <span>
            {termsReady
              ? `Reservation #${reservationId}`
              : "Evidence-only mode"}
          </span>
          <span className="secureTag">
            Google Meet REST API
          </span>
        </div>

        {!termsReady ? (
          <div className="transactionStatus">
            <strong>
              Safe evidence-only demo
            </strong>
            <p>
              You can inspect a real completed
              Google Meet record here without
              claiming that it belongs to an
              Arc reservation. Open this page
              from a verified reservation link
              to enable policy evaluation and
              settlement.
            </p>
          </div>
        ) : null}

        <label>
          Google Meet code or URL
          <input
            value={meetingCode}
            onChange={(event) =>
              setMeetingCode(
                event.target.value,
              )
            }
            placeholder="abc-defg-hij"
            spellCheck={false}
          />
        </label>

        <button
          className="button primary full"
          type="button"
          disabled={
            busy ||
            !meetingCode.trim()
          }
          onClick={loadEvidence}
        >
          {busy
            ? "Working..."
            : "Load Google Meet evidence"}
        </button>

        {evidence ? (
          <>
            <div className="reservationSummary">
              <dl>
                <div>
                  <dt>Conference</dt>
                  <dd>
                    {evidence.meetingCode}
                  </dd>
                </div>
                <div>
                  <dt>Meet record</dt>
                  <dd>
                    {evidence.ended
                      ? "Ended"
                      : "Active"}
                  </dd>
                </div>
                <div>
                  <dt>
                    Signed-in participants
                  </dt>
                  <dd>
                    {
                      signedInParticipants.length
                    }
                  </dd>
                </div>
                {rawOverlap !==
                undefined ? (
                  <div>
                    <dt>
                      Observed simultaneous presence
                    </dt>
                    <dd>
                      {formatSeconds(
                        rawOverlap,
                      )}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Start</dt>
                  <dd>
                    {formatDate(
                      evidence.startTime,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>End</dt>
                  <dd>
                    {formatDate(
                      evidence.endTime,
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="recentReservationList">
              {evidence.participants.map(
                (participant) => (
                  <div
                    className="recentReservationItem"
                    key={
                      participant.key
                    }
                  >
                    <div>
                      <span>
                        {participant.type}
                      </span>
                      <strong>
                        {
                          participant.displayName
                        }
                      </strong>
                      <small>
                        {
                          participant.sessions
                            .length
                        }
                        {
                          " Google Meet session(s)"
                        }
                      </small>
                    </div>

                    <div>
                      {participant.sessions.map(
                        (
                          session,
                          index,
                        ) => (
                          <small
                            key={
                              session.startTime +
                              index
                            }
                          >
                            {formatDate(
                              session.startTime,
                            )}
                            {" -> "}
                            {formatDate(
                              session.endTime,
                            )}
                          </small>
                        ),
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>

            {termsReady ? (
              <>
                <div className="fieldGrid">
                  <label>
                    Provider Google identity
                    <select
                      value={
                        providerGoogleUser
                      }
                      onChange={(event) =>
                        setProviderGoogleUser(
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        Select provider
                      </option>
                      {signedInParticipants.map(
                        (participant) => (
                          <option
                            key={
                              participant.userId
                            }
                            value={
                              participant.userId
                            }
                          >
                            {
                              participant.displayName
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    Customer Google identity
                    <select
                      value={
                        customerGoogleUser
                      }
                      onChange={(event) =>
                        setCustomerGoogleUser(
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        Select customer
                      </option>
                      {signedInParticipants.map(
                        (participant) => (
                          <option
                            key={
                              participant.userId
                            }
                            value={
                              participant.userId
                            }
                          >
                            {
                              participant.displayName
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                <small className="fieldHelp">
                  Hackathon boundary: signed-in
                  Google identities are mapped
                  to provider/customer manually.
                  Automatic wallet-to-Google
                  identity binding is not
                  implemented yet.
                </small>

                <div className="createdActions">
                  <button
                    className="button secondary"
                    type="button"
                    disabled={
                      busy ||
                      !canEvaluate
                    }
                    onClick={
                      evaluateEvidence
                    }
                  >
                    Evaluate committed policy
                  </button>
                </div>
              </>
            ) : (
              <div className="transactionStatus">
                <strong>
                  Evidence loaded without an
                  onchain claim
                </strong>
                <p>
                  The record above is real Meet
                  API evidence. No wallet mapping
                  or Arc settlement is inferred
                  in this mode.
                </p>
              </div>
            )}
          </>
        ) : null}

        {evaluation ? (
          <div className="createdReservation">
            <div>
              <span>
                Google Meet policy result
              </span>
              <strong>
                {
                  evaluation
                    .evaluation
                    .recommendedContractOutcome
                }
              </strong>
              <p>
                Verified together:{" "}
                {formatSeconds(
                  evaluation
                    .evaluation
                    .verifiedOverlapSeconds,
                )}
                {" / "}
                {formatSeconds(
                  evaluation
                    .evaluation
                    .completionThresholdSeconds,
                )}
              </p>
              <p>
                {
                  evaluation
                    .mapping.provider
                    .displayName
                }
                {" -> provider / "}
                {
                  evaluation
                    .mapping.customer
                    .displayName
                }
                {" -> customer"}
              </p>
            </div>

            {canSettle ? (
              <button
                className="button primary"
                type="button"
                disabled={busy}
                onClick={settle}
              >
                Settle from Google Meet evidence
              </button>
            ) : null}

            {evaluation.settlement ? (
              <div className="createdActions">
                {evaluation
                  .settlement
                  .providerTransaction ? (
                  <a
                    className="button secondary"
                    href={
                      "https://testnet.arcscan.app/tx/" +
                      evaluation
                        .settlement
                        .providerTransaction
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Provider attendance
                  </a>
                ) : null}

                {evaluation
                  .settlement
                  .customerTransaction ? (
                  <a
                    className="button secondary"
                    href={
                      "https://testnet.arcscan.app/tx/" +
                      evaluation
                        .settlement
                        .customerTransaction
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Customer attendance
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <div className="transactionStatus">
            {message}
          </div>
        ) : null}

        <p className="formNote">
          Local hackathon adapter. Google
          participant records are real; the
          meeting code is not committed
          onchain and Google-to-wallet identity
          binding remains a prototype boundary.
        </p>
      </div>
    </section>
  );
}
