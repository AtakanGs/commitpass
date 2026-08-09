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
  path: string,
  body: unknown,
) {
  const response =
    await fetch(path, {
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
    useState("");
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
        "Google Meet participant sessions loaded. Confirm the identity mapping before evaluation.",
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
          Google Meet API, evaluates their
          verified overlap against the
          committed session policy and can
          relay V3 attendance after the
          meeting has ended.
        </p>
      </div>

      <div className="card formCard">
        <div className="formHeader">
          <span>
            Reservation #
            {reservationId || "-"}
          </span>
          <span className="secureTag">
            Google Meet + Arc
          </span>
        </div>

        {!termsReady ? (
          <div className="transactionStatus">
            Open this adapter from the
            original verified reservation
            link so the committed metadata
            and policy are available.
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
            !termsReady ||
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
                  <dt>
                    Conference
                  </dt>
                  <dd>
                    {evidence.meetingCode}
                  </dd>
                </div>
                <div>
                  <dt>
                    Meet record
                  </dt>
                  <dd>
                    {evidence.ended
                      ? "Ended"
                      : "Active"}
                  </dd>
                </div>
                <div>
                  <dt>
                    Start
                  </dt>
                  <dd>
                    {formatDate(
                      evidence.startTime,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>
                    End
                  </dt>
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
                        {" Google Meet session(s)"}
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
              Hackathon prototype boundary:
              Google signed-in identities are
              mapped to provider/customer
              manually. Automatic wallet-to-
              Google identity binding is not
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
          This local hackathon adapter
          verifies Google Meet participant
          records. The meeting code itself is
          not yet committed onchain, and the
          Google-to-wallet identity mapping is
          still manual.
        </p>
      </div>
    </section>
  );
}
