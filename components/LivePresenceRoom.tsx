"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useSearchParams,
} from "next/navigation";
import {
  type Address,
  type Hex,
} from "viem";

import {
  connectWallet,
} from "@/lib/wallet";
import {
  presenceAuthorizationMessage,
} from "@/lib/presenceProtocol";

type RoomStatus = {
  reservationId: string;
  provider: Address;
  customer: Address;
  startTime: number;
  policy: {
    scheduledMinutes: number;
    issueWindowMinutes: number;
    completionThresholdMinutes: number;
  };
  providerConnected: boolean;
  customerConnected: boolean;
  overlapSeconds: number;
  thresholdSeconds: number;
  thresholdReached: boolean;
  attendanceDeadline: number;
  settlement?: {
    providerTransaction?: Hex;
    customerTransaction?: Hex;
    finalOutcome: number;
    status: number;
  };
};

type AuthResult = {
  token: string;
  role:
    | "provider"
    | "customer";
  status: RoomStatus;
};

function formatClock(
  seconds: number,
) {
  const value =
    Math.max(
      0,
      Math.floor(seconds),
    );
  const minutes =
    Math.floor(value / 60);
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
    });

  const payload =
    await response.json();

  if (!response.ok) {
    throw new Error(
      payload.error ||
        "Live presence request failed.",
    );
  }

  return payload as T;
}

export function LivePresenceRoom() {
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

  const [token, setToken] =
    useState<string>();
  const [role, setRole] =
    useState<
      "provider" |
      "customer"
    >();
  const [status, setStatus] =
    useState<RoomStatus>();
  const [message, setMessage] =
    useState<string>();
  const [busy, setBusy] =
    useState(false);
  const settlementStarted =
    useRef(false);

  const termsReady =
    Boolean(
      reservationId &&
      title &&
      salt &&
      duration &&
      issue &&
      threshold,
    );

  const progress =
    useMemo(() => {
      if (!status) {
        return 0;
      }

      return Math.min(
        100,
        Math.round(
          (
            status.overlapSeconds /
            Math.max(
              1,
              status.thresholdSeconds,
            )
          ) *
            100,
        ),
      );
    }, [status]);

  const refreshStatus =
    useCallback(
      async (
        currentToken: string,
      ) => {
        const next =
          await postJson<
            RoomStatus
          >(
            "/api/presence/status",
            {
              token:
                currentToken,
            },
          );

        setStatus(next);
      },
      [],
    );

  async function joinRoom() {
    if (!termsReady) {
      setMessage(
        "Open this room from the original verified invitation so the committed session terms are available.",
      );
      return;
    }

    setBusy(true);
    setMessage(
      "Connect your reservation wallet and authorize presence...",
    );

    try {
      const {
        account,
        walletClient,
      } =
        await connectWallet();

      const expiresAt =
        Math.floor(
          Date.now() / 1000,
        ) + 60 * 60;
      const nonce =
        crypto.randomUUID();
      const authorization =
        presenceAuthorizationMessage({
          reservationId,
          participant:
            account,
          expiresAt,
          nonce,
        });

      const signature =
        await walletClient
          .signMessage({
            account,
            message:
              authorization,
          });

      const result =
        await postJson<
          AuthResult
        >(
          "/api/presence/auth",
          {
            reservationId,
            participant:
              account,
            expiresAt,
            nonce,
            signature,
            title,
            salt,
            policy: {
              duration,
              issue,
              threshold,
            },
          },
        );

      setToken(
        result.token,
      );
      setRole(
        result.role,
      );
      setStatus(
        result.status,
      );
      setMessage(
        `${result.role === "provider" ? "Provider" : "Customer"} joined. Keep this tab open.`,
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

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function heartbeat() {
      try {
        const next =
          await postJson<
            RoomStatus
          >(
            "/api/presence/heartbeat",
            { token },
          );

        if (!cancelled) {
          setStatus(next);
        }
      } catch (caught) {
        if (!cancelled) {
          setMessage(
            caught instanceof Error
              ? caught.message
              : String(caught),
          );
        }
      }
    }

    void heartbeat();

    const heartbeatTimer =
      window.setInterval(
        () => {
          void heartbeat();
        },
        5_000,
      );

    const statusTimer =
      window.setInterval(
        () => {
          void refreshStatus(
            token,
          ).catch(
            (caught) => {
              if (!cancelled) {
                setMessage(
                  caught instanceof Error
                    ? caught.message
                    : String(
                        caught,
                      ),
                );
              }
            },
          );
        },
        2_000,
      );

    return () => {
      cancelled = true;
      window.clearInterval(
        heartbeatTimer,
      );
      window.clearInterval(
        statusTimer,
      );
    };
  }, [
    refreshStatus,
    token,
  ]);

  useEffect(() => {
    if (
      !token ||
      role !== "provider" ||
      !status
        ?.thresholdReached ||
      status.settlement ||
      settlementStarted.current
    ) {
      return;
    }

    settlementStarted.current =
      true;
    setMessage(
      "Presence threshold reached. Signing and relaying V3 attendance...",
    );

    void postJson<
      RoomStatus["settlement"]
    >(
      "/api/presence/settle",
      { token },
    )
      .then(() =>
        refreshStatus(token),
      )
      .then(() => {
        setMessage(
          "Verified attendance reached the V3 contract.",
        );
      })
      .catch((caught) => {
        settlementStarted.current =
          false;
        setMessage(
          caught instanceof Error
            ? caught.message
            : String(caught),
        );
      });
  }, [
    refreshStatus,
    role,
    status,
    token,
  ]);

  return (
    <section className="shell section">
      <div className="sectionHead">
        <p className="eyebrow">
          EXPERIMENTAL LIVE ADAPTER
        </p>
        <h1>
          Verified presence,
          live.
        </h1>
        <p>
          Each participant authorizes this
          browser once with their reservation
          wallet. The local adapter records
          server-timestamped heartbeats,
          measures simultaneous presence and
          sends signed V3 attendance after the
          committed threshold is reached.
        </p>
      </div>

      <div className="card formCard">
        <div className="formHeader">
          <span>
            Reservation #
            {reservationId || "-"}
          </span>
          <span className="secureTag">
            Local prototype
          </span>
        </div>

        {!termsReady ? (
          <div className="transactionStatus">
            <strong>
              Verified invitation required
            </strong>
            <p>
              The live room needs the original
              title, salt and policy parameters
              so it can verify the committed
              metadata before recording
              presence.
            </p>
          </div>
        ) : null}

        {!token ? (
          <button
            className="button primary full"
            type="button"
            disabled={
              busy ||
              !termsReady
            }
            onClick={
              joinRoom
            }
          >
            {busy
              ? "Authorizing..."
              : "Join verified session"}
          </button>
        ) : null}

        {status ? (
          <>
            <div className="fieldGrid">
              <div className="transactionStatus">
                <strong>
                  Provider
                </strong>
                <p>
                  {status
                    .providerConnected
                    ? "Present now"
                    : "Waiting"}
                </p>
              </div>

              <div className="transactionStatus">
                <strong>
                  Customer
                </strong>
                <p>
                  {status
                    .customerConnected
                    ? "Present now"
                    : "Waiting"}
                </p>
              </div>
            </div>

            <div className="transactionStatus">
              <strong>
                Verified together
              </strong>
              <p>
                {formatClock(
                  status
                    .overlapSeconds,
                )}
                {" / "}
                {formatClock(
                  status
                    .thresholdSeconds,
                )}
              </p>

              <div
                style={{
                  height: 12,
                  borderRadius: 999,
                  background:
                    "rgba(15, 39, 84, 0.08)",
                  overflow:
                    "hidden",
                }}
              >
                <div
                  style={{
                    width:
                      progress + "%",
                    height:
                      "100%",
                    borderRadius:
                      999,
                    background:
                      "linear-gradient(90deg, #2f6df6, #7957f5)",
                    transition:
                      "width 400ms ease",
                  }}
                />
              </div>
            </div>

            <div className="reservationSummary">
              <dl>
                <div>
                  <dt>
                    Your role
                  </dt>
                  <dd>
                    {role}
                  </dd>
                </div>
                <div>
                  <dt>
                    Completion rule
                  </dt>
                  <dd>
                    {
                      status.policy
                        .completionThresholdMinutes
                    }{" "}
                    minutes together
                  </dd>
                </div>
                <div>
                  <dt>
                    Session duration
                  </dt>
                  <dd>
                    {
                      status.policy
                        .scheduledMinutes
                    }{" "}
                    minutes
                  </dd>
                </div>
                <div>
                  <dt>
                    Settlement
                  </dt>
                  <dd>
                    {status
                      .settlement
                      ? "Submitted onchain"
                      : status
                          .thresholdReached
                        ? "Threshold reached"
                        : "Waiting for threshold"}
                  </dd>
                </div>
              </dl>
            </div>

            {status
              .settlement ? (
              <div className="createdActions">
                {status
                  .settlement
                  .providerTransaction ? (
                  <a
                    className="button secondary"
                    href={
                      "https://testnet.arcscan.app/tx/" +
                      status
                        .settlement
                        .providerTransaction
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Provider attendance
                  </a>
                ) : null}

                {status
                  .settlement
                  .customerTransaction ? (
                  <a
                    className="button secondary"
                    href={
                      "https://testnet.arcscan.app/tx/" +
                      status
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
          </>
        ) : null}

        {message ? (
          <div className="transactionStatus">
            <strong>
              Live adapter
            </strong>
            <p>
              {message}
            </p>
          </div>
        ) : null}

        <p className="formNote">
          Hackathon prototype boundary: this
          adapter authenticates wallet control
          and measures browser presence on a
          single Node process. It is not a
          production meeting-integrity service
          and its in-memory room state is not
          suitable for multi-instance
          deployment.
        </p>
      </div>
    </section>
  );
}
