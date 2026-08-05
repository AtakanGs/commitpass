"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  isAddress,
  isHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import {
  ReservationActivity,
} from "@/components/ReservationActivity";
import {
  SettlementPreview,
} from "@/components/SettlementPreview";
import {
  acceptReservation,
  confirmAttendanceWithAttestation,
  disputeClaim,
  explainContractError,
  formatUsdc,
  openNoShowClaim,
  OUTCOME_LABELS,
  readArbiter,
  readReservation,
  resolveDispute,
  STATUS_LABELS,
  writeSimple,
} from "@/lib/contract";
import {
  getConnectedAccount,
  WALLET_ACCOUNT_EVENT,
} from "@/lib/wallet";
import {
  verifyReservationMetadata,
} from "@/lib/metadata";

const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function sameAddress(
  first?: string,
  second?: string,
) {
  return Boolean(
    first &&
      second &&
      first.toLowerCase() ===
        second.toLowerCase(),
  );
}

function compact(address: string) {
  return (
    address.slice(0, 6) +
    "..." +
    address.slice(-4)
  );
}

function compactHash(hash: string) {
  return (
    hash.slice(0, 10) +
    "..." +
    hash.slice(-8)
  );
}

function formatDate(
  timestamp: number,
) {
  if (!timestamp) {
    return "-";
  }

  return new Date(
    timestamp * 1000,
  ).toLocaleString();
}

type ManageReservationProps = {
  initialId?: string;
  autoLoad?: boolean;
  reservationTitle?: string;
  reservationSalt?: string;
};

export function ManageReservation({
  initialId = "1",
  autoLoad = false,
  reservationTitle,
  reservationSalt,
}: ManageReservationProps) {
  const [id, setId] =
    useState(initialId);

  const [reservation, setReservation] =
    useState<
      Awaited<
        ReturnType<
          typeof readReservation
        >
      >
    >();

  const [account, setAccount] =
    useState<Address>();

  const [arbiter, setArbiter] =
    useState<Address>();

  const [message, setMessage] =
    useState<string>();

  const [busy, setBusy] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const [now, setNow] =
    useState(0);

  const [
    claimEvidence,
    setClaimEvidence,
  ] = useState("");

  const [
    disputeEvidence,
    setDisputeEvidence,
  ] = useState("");

  const [
    attestationParticipant,
    setAttestationParticipant,
  ] = useState("");

  const [
    attestationValidUntil,
    setAttestationValidUntil,
  ] = useState("");

  const [
    attestationSignature,
    setAttestationSignature,
  ] = useState("");

  useEffect(() => {
    setNow(Date.now());

    const timer =
      window.setInterval(() => {
        setNow(Date.now());
      }, 15_000);

    function handleWalletAccount(
      event: Event,
    ) {
      const walletEvent =
        event as CustomEvent<
          Address | undefined
        >;

      setAccount(
        walletEvent.detail,
      );
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

  useEffect(() => {
    if (autoLoad && initialId) {
      void load(initialId);
    }

    // Auto-load is intentionally tied to
    // shared URL parameters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, initialId]);

  async function run<T>(
    label: string,
    action: () => Promise<T>,
    success?: (result: T) => string,
  ) {
    setBusy(true);
    setMessage(label + "...");

    try {
      const result =
        await action();

      await load(id, false);

      setMessage(
        success
          ? success(result)
          : label + " completed.",
      );
    } catch (caught) {
      setMessage(
        explainContractError(caught),
      );
    } finally {
      setBusy(false);
    }
  }

  async function load(
    targetId = id,
    announce = true,
  ) {
    if (
      !/^\d+$/.test(targetId) ||
      BigInt(targetId) <= 0n
    ) {
      setMessage(
        "Enter a valid reservation ID.",
      );
      return;
    }

    setBusy(true);

    if (announce) {
      setMessage(
        "Loading reservation...",
      );
    }

    setId(targetId);

    try {
      const [
        value,
        configuredArbiter,
        connectedAccount,
      ] = await Promise.all([
        readReservation(
          BigInt(targetId),
        ),
        readArbiter(),
        getConnectedAccount(),
      ]);

      setReservation(value);
      setArbiter(
        configuredArbiter,
      );
      setAccount(
        connectedAccount,
      );

      if (
        !attestationParticipant &&
        connectedAccount &&
        (
          sameAddress(
            connectedAccount,
            value.provider,
          ) ||
          sameAddress(
            connectedAccount,
            value.customer,
          )
        )
      ) {
        setAttestationParticipant(
          connectedAccount,
        );
      }

      if (announce) {
        setMessage(undefined);
      }

      setNow(Date.now());
    } catch (caught) {
      setReservation(undefined);

      const rawMessage =
        caught instanceof Error
          ? caught.message
          : String(caught);

      setMessage(
        /InvalidState/i.test(
          rawMessage,
        )
          ? "Reservation #" +
              targetId +
              " was not found on the final CommitPass V3 deployment."
          : explainContractError(
              caught,
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  const reservationId =
    /^\d+$/.test(id)
      ? BigInt(id)
      : 0n;

  const status =
    reservation?.status;

  const metadataVerified =
    Boolean(
      reservation &&
        reservationTitle &&
        verifyReservationMetadata(
          reservationTitle,
          reservation.metadataHash,
          reservationSalt,
        ),
    );

  const nowSeconds =
    Math.floor(now / 1000);

  const isProvider =
    sameAddress(
      account,
      reservation?.provider,
    );

  const isCustomer =
    sameAddress(
      account,
      reservation?.customer,
    );

  const isArbiter =
    sameAddress(
      account,
      arbiter,
    );

  const isParticipant =
    isProvider || isCustomer;

  const isPlatformVerified =
    Boolean(
      reservation &&
        !sameAddress(
          reservation
            .attendanceAttestor,
          zeroAddress,
        ),
    );

  const startTime =
    reservation
      ? Number(
          reservation.startTime,
        )
      : 0;

  const cancellationDeadline =
    reservation
      ? Number(
          reservation
            .freeCancellationDeadline,
        )
      : 0;

  const gracePeriod =
    reservation
      ? Number(
          reservation.gracePeriod,
        )
      : 0;

  const checkInOpensAt =
    startTime - gracePeriod;

  const checkInClosesAt =
    startTime + gracePeriod;

  const claimOpeningDeadline =
    reservation
      ? checkInClosesAt +
        Number(
          reservation.claimWindow,
        )
      : 0;

  const disputeDeadline =
    reservation &&
    Number(
      reservation.claimOpenedAt,
    ) > 0
      ? Number(
          reservation.claimOpenedAt,
        ) +
        Number(
          reservation.disputeWindow,
        )
      : 0;

  const arbiterDeadline =
    reservation &&
    Number(
      reservation.disputedAt,
    ) > 0
      ? Number(
          reservation.disputedAt,
        ) +
        Number(
          reservation.arbiterWindow,
        )
      : 0;

  const isBeforeCancellationDeadline =
    nowSeconds <=
    cancellationDeadline;

  const isCheckInOpen =
    nowSeconds >=
      checkInOpensAt &&
    nowSeconds <=
      checkInClosesAt;

  const isClaimWindowOpen =
    nowSeconds >
      checkInClosesAt &&
    nowSeconds <=
      claimOpeningDeadline;

  const connectedPartyConfirmed =
    isProvider
      ? Boolean(
          reservation
            ?.providerConfirmed,
        )
      : isCustomer
        ? Boolean(
            reservation
              ?.customerConfirmed,
          )
        : false;

  const canDisputePendingClaim =
    status === 3 &&
    nowSeconds <=
      disputeDeadline &&
    (
      (
        reservation
          ?.pendingOutcome === 2 &&
        isCustomer
      ) ||
      (
        reservation
          ?.pendingOutcome === 3 &&
        isProvider
      )
    );

  const canFinalizePendingClaim =
    status === 3 &&
    disputeDeadline > 0 &&
    nowSeconds >
      disputeDeadline;

  const canRefundStale =
    status === 2 &&
    claimOpeningDeadline > 0 &&
    nowSeconds >
      claimOpeningDeadline;

  const canRefundExpiredDispute =
    status === 4 &&
    arbiterDeadline > 0 &&
    nowSeconds >
      arbiterDeadline;

  const canArbiterResolve =
    status === 4 &&
    isArbiter &&
    arbiterDeadline > 0 &&
    nowSeconds <=
      arbiterDeadline;

  const attestationReady =
    isAddress(
      attestationParticipant,
    ) &&
    /^\d+$/.test(
      attestationValidUntil,
    ) &&
    Number(
      attestationValidUntil,
    ) > nowSeconds &&
    isHex(
      attestationSignature,
    ) &&
    attestationSignature.length > 2;

  let roleLabel =
    "Wallet not connected";

  let roleDescription =
    "Connect a participant, relayer or arbiter wallet to see available actions.";

  if (account && isProvider) {
    roleLabel = "Provider";
    roleDescription =
      "You created this V3 reservation and funded the provider commitment.";
  } else if (
    account &&
    isCustomer
  ) {
    roleLabel = "Customer";
    roleDescription =
      "You were invited and may fund the equal customer commitment.";
  } else if (
    account &&
    isArbiter
  ) {
    roleLabel = "Arbiter";
    roleDescription =
      "You may resolve a disputed claim before the immutable arbiter deadline.";
  } else if (account) {
    roleLabel =
      "Observer or relayer";
    roleDescription =
      "This wallet may inspect state and submit permissionless lifecycle calls or a valid platform signature.";
  }

  let actionHint:
    | string
    | undefined;

  if (
    reservation &&
    !account
  ) {
    actionHint =
      "Connect a wallet to submit an onchain action.";
  } else if (
    status === 1 &&
    isCustomer
  ) {
    actionHint =
      isBeforeCancellationDeadline
        ? "Accept before the free-cancellation deadline to activate the reservation."
        : "The invitation acceptance deadline has passed.";
  } else if (
    status === 1 &&
    isProvider
  ) {
    actionHint =
      isBeforeCancellationDeadline
        ? "The invitation is waiting for the customer."
        : "The invitation expired and its provider commitment can be reclaimed.";
  } else if (
    status === 2 &&
    isParticipant
  ) {
    if (
      connectedPartyConfirmed
    ) {
      actionHint =
        "Your attendance is recorded. Waiting for the other party or the next lifecycle deadline.";
    } else if (
      nowSeconds <
      checkInOpensAt
    ) {
      actionHint =
        "Attendance opens at " +
        formatDate(
          checkInOpensAt,
        ) +
        ".";
    } else if (
      isCheckInOpen &&
      isPlatformVerified
    ) {
      actionHint =
        "A valid platform signature is required. Any relayer may submit it.";
    } else if (
      isCheckInOpen
    ) {
      actionHint =
        "The self-attested check-in window is open.";
    } else if (
      isClaimWindowOpen
    ) {
      actionHint =
        connectedPartyConfirmed
          ? "You may open a no-show claim with a salted evidence reference."
          : "You cannot claim because your own attendance was not recorded.";
    } else if (
      canRefundStale
    ) {
      actionHint =
        "The claim window expired. Anyone may refund both commitments.";
    }
  } else if (
    status === 3
  ) {
    actionHint =
      nowSeconds <=
      disputeDeadline
        ? "The claim is inside its dispute window."
        : "The dispute window ended. Anyone may finalize the undisputed claim.";
  } else if (
    status === 4 &&
    canArbiterResolve
  ) {
    actionHint =
      "The arbiter may select the final outcome before the deadline.";
  } else if (
    status === 4 &&
    canRefundExpiredDispute
  ) {
    actionHint =
      "The arbiter deadline expired. Anyone may refund both commitments.";
  } else if (
    status === 4
  ) {
    actionHint =
      "The dispute is awaiting arbiter resolution.";
  } else if (
    status === 5
  ) {
    actionHint =
      "This reservation is resolved.";
  } else if (
    status === 6
  ) {
    actionHint =
      "This reservation is cancelled.";
  }

  function getSharePath() {
    const params =
      new URLSearchParams({
        id,
      });

    if (reservationTitle) {
      params.set(
        "title",
        reservationTitle,
      );
    }

    if (reservationSalt) {
      params.set(
        "salt",
        reservationSalt,
      );
    }

    return (
      "/reservation?" +
      params.toString()
    );
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard
        .writeText(
          window.location.origin +
            getSharePath(),
        );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setMessage(
        "The reservation link could not be copied automatically.",
      );
    }
  }

  return (
    <div className="formCard card">
      <div className="formHeader">
        <span>
          {autoLoad
            ? "V3 reservation details"
            : "V3 reservation console"}
        </span>

        <span className="secureTag">
          Final contract
        </span>
      </div>

      {!autoLoad ? (
        <div className="lookupRow">
          <input
            value={id}
            onChange={(event) =>
              setId(
                event.target.value
                  .replace(
                    /\D/g,
                    "",
                  ),
              )
            }
            aria-label="Reservation ID"
            placeholder="Reservation ID"
            inputMode="numeric"
          />

          <button
            className="button secondary"
            type="button"
            onClick={() =>
              void load()
            }
            disabled={
              busy || !id
            }
          >
            Load
          </button>
        </div>
      ) : null}

      {reservation ? (
        <>
          {reservationTitle ? (
            <div className="reservationTitle">
              <span>
                Shared session
              </span>

              <h3>
                {reservationTitle}
              </h3>

              <small
                className={
                  metadataVerified
                    ? "metadataVerified"
                    : "metadataUnverified"
                }
              >
                {metadataVerified
                  ? "Verified against the salted onchain metadata reference"
                  : "Shared label does not match the onchain metadata reference"}
              </small>
            </div>
          ) : null}

          <div className="roleBanner">
            <div className="roleBannerTop">
              <span>
                Connected role
              </span>
              <strong>
                {roleLabel}
              </strong>
            </div>

            <p>
              {roleDescription}
            </p>

            {account ? (
              <small>
                {compact(account)}
              </small>
            ) : null}
          </div>

          <div className="reservationSummary">
            <div className="summaryTop">
              <div>
                <span>Status</span>
                <strong>
                  {
                    STATUS_LABELS[
                      reservation.status
                    ]
                  }
                </strong>
              </div>

              <div>
                <span>Outcome</span>
                <strong>
                  {
                    OUTCOME_LABELS[
                      reservation
                        .finalOutcome
                    ]
                  }
                </strong>
              </div>
            </div>

            <dl>
              <div>
                <dt>Provider</dt>
                <dd>
                  {compact(
                    reservation.provider,
                  )}
                </dd>
              </div>

              <div>
                <dt>Customer</dt>
                <dd>
                  {compact(
                    reservation.customer,
                  )}
                </dd>
              </div>

              <div>
                <dt>
                  Attendance mode
                </dt>
                <dd>
                  {isPlatformVerified
                    ? "Platform-verified"
                    : "Self-attested"}
                </dd>
              </div>

              {isPlatformVerified ? (
                <div>
                  <dt>
                    Platform attestor
                  </dt>
                  <dd>
                    {compact(
                      reservation
                        .attendanceAttestor,
                    )}
                  </dd>
                </div>
              ) : null}

              <div>
                <dt>
                  Commitment per party
                </dt>
                <dd>
                  {formatUsdc(
                    reservation
                      .commitmentAmount,
                  )}
                </dd>
              </div>

              <div>
                <dt>
                  Total locked when active
                </dt>
                <dd>
                  {formatUsdc(
                    reservation
                      .commitmentAmount *
                      2n,
                  )}
                </dd>
              </div>

              <div>
                <dt>
                  Reservation start
                </dt>
                <dd>
                  {formatDate(
                    startTime,
                  )}
                </dd>
              </div>

              <div>
                <dt>
                  Free cancellation deadline
                </dt>
                <dd>
                  {formatDate(
                    cancellationDeadline,
                  )}
                </dd>
              </div>

              <div>
                <dt>
                  Check-in window
                </dt>
                <dd>
                  {formatDate(
                    checkInOpensAt,
                  )}
                  {" - "}
                  {formatDate(
                    checkInClosesAt,
                  )}
                </dd>
              </div>

              <div>
                <dt>
                  Claim opening deadline
                </dt>
                <dd>
                  {formatDate(
                    claimOpeningDeadline,
                  )}
                </dd>
              </div>

              <div>
                <dt>
                  Provider attendance
                </dt>
                <dd>
                  {reservation
                    .providerConfirmed
                    ? "Confirmed"
                    : "Pending"}
                </dd>
              </div>

              <div>
                <dt>
                  Customer attendance
                </dt>
                <dd>
                  {reservation
                    .customerConfirmed
                    ? "Confirmed"
                    : "Pending"}
                </dd>
              </div>

              {reservation
                .pendingOutcome !== 0 ? (
                <div>
                  <dt>
                    Pending claim
                  </dt>
                  <dd>
                    {
                      OUTCOME_LABELS[
                        reservation
                          .pendingOutcome
                      ]
                    }
                  </dd>
                </div>
              ) : null}

              {disputeDeadline > 0 ? (
                <div>
                  <dt>
                    Dispute deadline
                  </dt>
                  <dd>
                    {formatDate(
                      disputeDeadline,
                    )}
                  </dd>
                </div>
              ) : null}

              {arbiterDeadline > 0 ? (
                <div>
                  <dt>
                    Arbiter deadline
                  </dt>
                  <dd>
                    {formatDate(
                      arbiterDeadline,
                    )}
                  </dd>
                </div>
              ) : null}

              {reservation
                .claimEvidenceHash !==
              ZERO_HASH ? (
                <div>
                  <dt>
                    Claim evidence hash
                  </dt>
                  <dd title={
                    reservation
                      .claimEvidenceHash
                  }>
                    {compactHash(
                      reservation
                        .claimEvidenceHash,
                    )}
                  </dd>
                </div>
              ) : null}

              {reservation
                .disputeEvidenceHash !==
              ZERO_HASH ? (
                <div>
                  <dt>
                    Dispute evidence hash
                  </dt>
                  <dd title={
                    reservation
                      .disputeEvidenceHash
                  }>
                    {compactHash(
                      reservation
                        .disputeEvidenceHash,
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>

            <SettlementPreview
              commitmentAmount={
                reservation
                  .commitmentAmount
              }
            />

            <ReservationActivity
              reservationId={id}
              status={
                STATUS_LABELS[
                  reservation.status
                ]
              }
              outcome={
                OUTCOME_LABELS[
                  reservation
                    .finalOutcome
                ]
              }
              providerConfirmed={
                reservation
                  .providerConfirmed
              }
              customerConfirmed={
                reservation
                  .customerConfirmed
              }
              claimOpened={
                Number(
                  reservation
                    .claimOpenedAt,
                ) > 0
              }
              pendingOutcome={
                OUTCOME_LABELS[
                  reservation
                    .pendingOutcome
                ]
              }
            />

            <div className="shareActions">
              {!autoLoad ? (
                <a
                  className="button secondary"
                  href={getSharePath()}
                >
                  Open share page
                </a>
              ) : null}

              <button
                className="button secondary"
                type="button"
                onClick={
                  copyShareLink
                }
              >
                {copied
                  ? "Link copied"
                  : "Copy link"}
              </button>
            </div>

            <div className="checkinCode">
              <span>
                Check-in reference
              </span>
              <strong>
                {"CP-" +
                  id.padStart(
                    6,
                    "0",
                  )}
              </strong>
              <small>
                Human-readable reference
                for this final V3
                reservation.
              </small>
            </div>
          </div>

          {status === 2 &&
          isPlatformVerified &&
          (
            !reservation
              .providerConfirmed ||
            !reservation
              .customerConfirmed
          ) ? (
            <div className="roleBanner">
              <div className="roleBannerTop">
                <span>
                  Platform attestation relay
                </span>
                <strong>
                  Signed EIP-712
                </strong>
              </div>

              <p>
                Paste the participant,
                expiration and signature
                generated by the configured
                platform signer. Any connected
                wallet may relay it.
              </p>

              <label>
                Participant wallet
                <input
                  value={
                    attestationParticipant
                  }
                  onChange={(event) =>
                    setAttestationParticipant(
                      event.target.value,
                    )
                  }
                  placeholder="0x..."
                  spellCheck={false}
                />
              </label>

              <label>
                Valid-until Unix timestamp
                <input
                  value={
                    attestationValidUntil
                  }
                  onChange={(event) =>
                    setAttestationValidUntil(
                      event.target.value
                        .replace(
                          /\D/g,
                          "",
                        ),
                    )
                  }
                  placeholder="1780000000"
                  inputMode="numeric"
                />
              </label>

              <label>
                Platform signature
                <input
                  value={
                    attestationSignature
                  }
                  onChange={(event) =>
                    setAttestationSignature(
                      event.target.value,
                    )
                  }
                  placeholder="0x..."
                  spellCheck={false}
                />
              </label>

              <button
                className="button secondary"
                type="button"
                onClick={() =>
                  run(
                    "Submitting platform attendance",
                    () =>
                      confirmAttendanceWithAttestation(
                        reservationId,
                        attestationParticipant as Address,
                        BigInt(
                          attestationValidUntil,
                        ),
                        attestationSignature as Hex,
                      ),
                  )
                }
                disabled={
                  busy ||
                  !isCheckInOpen ||
                  !attestationReady
                }
              >
                Submit signed attendance
              </button>
            </div>
          ) : null}

          {status === 2 &&
          isProvider &&
          isClaimWindowOpen &&
          reservation
            .providerConfirmed &&
          !reservation
            .customerConfirmed ? (
            <label>
              Customer no-show evidence note
              <input
                value={claimEvidence}
                onChange={(event) =>
                  setClaimEvidence(
                    event.target.value,
                  )
                }
                maxLength={240}
                placeholder="Short offchain evidence reference"
              />
              <small className="fieldHelp">
                The note remains local. Only a
                salted hash is written onchain.
              </small>
            </label>
          ) : null}

          {status === 2 &&
          isCustomer &&
          isClaimWindowOpen &&
          reservation
            .customerConfirmed &&
          !reservation
            .providerConfirmed ? (
            <label>
              Provider no-show evidence note
              <input
                value={claimEvidence}
                onChange={(event) =>
                  setClaimEvidence(
                    event.target.value,
                  )
                }
                maxLength={240}
                placeholder="Short offchain evidence reference"
              />
              <small className="fieldHelp">
                The note remains local. Only a
                salted hash is written onchain.
              </small>
            </label>
          ) : null}

          {status === 3 &&
          canDisputePendingClaim ? (
            <label>
              Dispute evidence note
              <input
                value={
                  disputeEvidence
                }
                onChange={(event) =>
                  setDisputeEvidence(
                    event.target.value,
                  )
                }
                maxLength={240}
                placeholder="Short offchain evidence reference"
              />
              <small className="fieldHelp">
                The note remains local. Only a
                salted hash is written onchain.
              </small>
            </label>
          ) : null}
        </>
      ) : null}

      <div className="actionGrid">
        {status === 1 &&
        isCustomer ? (
          <button
            onClick={() =>
              run(
                "Accepting reservation",
                () =>
                  acceptReservation(
                    reservationId,
                  ),
              )
            }
            disabled={
              busy ||
              !isBeforeCancellationDeadline
            }
          >
            Accept equal commitment
          </button>
        ) : null}

        {status === 1 &&
        isProvider ? (
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
                busy ||
                !isBeforeCancellationDeadline
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
                busy ||
                isBeforeCancellationDeadline
              }
            >
              Reclaim expired commitment
            </button>
          </>
        ) : null}

        {status === 2 &&
        isParticipant &&
        !connectedPartyConfirmed &&
        !isPlatformVerified ? (
          <button
            onClick={() =>
              run(
                "Confirming self-attested attendance",
                () =>
                  writeSimple(
                    "confirmAttendance",
                    [reservationId],
                  ),
              )
            }
            disabled={
              busy ||
              !isCheckInOpen
            }
          >
            Confirm attendance
          </button>
        ) : null}

        {status === 2 &&
        isParticipant ? (
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
              busy ||
              !isBeforeCancellationDeadline
            }
          >
            Cancel early
          </button>
        ) : null}

        {status === 2 &&
        isProvider ? (
          <button
            onClick={() =>
              run(
                "Opening customer no-show claim",
                () =>
                  openNoShowClaim(
                    reservationId,
                    2,
                    claimEvidence,
                  ),
                (result) =>
                  "Claim opened. Evidence hash: " +
                  result.evidenceHash +
                  ". Save salt privately: " +
                  result.evidenceSalt,
              )
            }
            disabled={
              busy ||
              !isClaimWindowOpen ||
              !reservation
                ?.providerConfirmed ||
              reservation
                ?.customerConfirmed ||
              !claimEvidence.trim()
            }
          >
            Claim customer no-show
          </button>
        ) : null}

        {status === 2 &&
        isCustomer ? (
          <button
            onClick={() =>
              run(
                "Opening provider no-show claim",
                () =>
                  openNoShowClaim(
                    reservationId,
                    3,
                    claimEvidence,
                  ),
                (result) =>
                  "Claim opened. Evidence hash: " +
                  result.evidenceHash +
                  ". Save salt privately: " +
                  result.evidenceSalt,
              )
            }
            disabled={
              busy ||
              !isClaimWindowOpen ||
              !reservation
                ?.customerConfirmed ||
              reservation
                ?.providerConfirmed ||
              !claimEvidence.trim()
            }
          >
            Claim provider no-show
          </button>
        ) : null}

        {canRefundStale ? (
          <button
            onClick={() =>
              run(
                "Refunding stale reservation",
                () =>
                  writeSimple(
                    "refundStaleReservation",
                    [reservationId],
                  ),
              )
            }
            disabled={busy}
          >
            Refund stale reservation
          </button>
        ) : null}

        {status === 3 &&
        canDisputePendingClaim ? (
          <button
            onClick={() =>
              run(
                "Disputing claim",
                () =>
                  disputeClaim(
                    reservationId,
                    disputeEvidence,
                  ),
                (result) =>
                  "Claim disputed. Evidence hash: " +
                  result.evidenceHash +
                  ". Save salt privately: " +
                  result.evidenceSalt,
              )
            }
            disabled={
              busy ||
              !disputeEvidence.trim()
            }
          >
            Dispute no-show claim
          </button>
        ) : null}

        {canFinalizePendingClaim ? (
          <button
            onClick={() =>
              run(
                "Finalizing undisputed claim",
                () =>
                  writeSimple(
                    "finalizeUndisputedClaim",
                    [reservationId],
                  ),
              )
            }
            disabled={busy}
          >
            Finalize undisputed claim
          </button>
        ) : null}

        {canRefundExpiredDispute ? (
          <button
            onClick={() =>
              run(
                "Refunding expired dispute",
                () =>
                  writeSimple(
                    "refundExpiredDispute",
                    [reservationId],
                  ),
              )
            }
            disabled={busy}
          >
            Refund expired dispute
          </button>
        ) : null}

        {canArbiterResolve ? (
          <>
            <button
              onClick={() =>
                run(
                  "Resolving with both commitments refunded",
                  () =>
                    resolveDispute(
                      reservationId,
                      4,
                    ),
                )
              }
              disabled={busy}
            >
              Resolve: refund both
            </button>

            <button
              onClick={() =>
                run(
                  "Resolving as customer no-show",
                  () =>
                    resolveDispute(
                      reservationId,
                      2,
                    ),
                )
              }
              disabled={busy}
            >
              Resolve: customer no-show
            </button>

            <button
              onClick={() =>
                run(
                  "Resolving as provider no-show",
                  () =>
                    resolveDispute(
                      reservationId,
                      3,
                    ),
                )
              }
              disabled={busy}
            >
              Resolve: provider no-show
            </button>

            <button
              onClick={() =>
                run(
                  "Resolving as completed",
                  () =>
                    resolveDispute(
                      reservationId,
                      1,
                    ),
                )
              }
              disabled={busy}
            >
              Resolve: completed
            </button>
          </>
        ) : null}
      </div>

      {actionHint ? (
        <div className="actionHint">
          {actionHint}
        </div>
      ) : null}

      {message ? (
        <div className="transactionStatus">
          {message}
        </div>
      ) : null}
    </div>
  );
}
