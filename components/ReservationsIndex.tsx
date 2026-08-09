"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";

import {
  STATUS_LABELS,
  readReservation,
} from "@/lib/contract";
import {
  readSavedReservations,
  type SavedReservation,
} from "@/lib/recentReservations";

type ChainStatus = {
  label: string;
  loading: boolean;
};

function formatDate(value: string) {
  const date =
    new Date(value);

  if (
    !Number.isFinite(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

export function ReservationsIndex() {
  const [
    reservations,
    setReservations,
  ] =
    useState<SavedReservation[]>(
      [],
    );

  const [loaded, setLoaded] =
    useState(false);

  const [
    statuses,
    setStatuses,
  ] =
    useState<
      Record<
        string,
        ChainStatus
      >
    >({});

  const [
    copiedId,
    setCopiedId,
  ] =
    useState<string>();

  useEffect(() => {
    const saved =
      readSavedReservations();

    setReservations(saved);
    setLoaded(true);

    if (
      saved.length === 0
    ) {
      return;
    }

    setStatuses(
      Object.fromEntries(
        saved.map(
          (reservation) => [
            reservation.reservationId,
            {
              label:
                "Reading Arc...",
              loading: true,
            },
          ],
        ),
      ),
    );

    let cancelled = false;

    void Promise.all(
      saved.map(
        async (
          reservation,
        ) => {
          try {
            const onchain =
              await readReservation(
                BigInt(
                  reservation
                    .reservationId,
                ),
              );

            const index =
              Number(
                onchain.status,
              );

            return [
              reservation
                .reservationId,
              {
                label:
                  STATUS_LABELS[
                    index
                  ] ??
                  `Status ${index}`,
                loading: false,
              },
            ] as const;
          } catch {
            return [
              reservation
                .reservationId,
              {
                label:
                  "Saved locally",
                loading: false,
              },
            ] as const;
          }
        },
      ),
    ).then((entries) => {
      if (!cancelled) {
        setStatuses(
          Object.fromEntries(
            entries,
          ),
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function
  copyInvitation(
    reservation:
      SavedReservation,
  ) {
    try {
      await navigator.clipboard
        .writeText(
          reservation.shareUrl,
        );

      setCopiedId(
        reservation
          .reservationId,
      );

      window.setTimeout(
        () =>
          setCopiedId(
            undefined,
          ),
        1800,
      );
    } catch {
      setCopiedId(undefined);
    }
  }

  if (!loaded) {
    return (
      <div className="createdReservation">
        <p>
          Loading reservations saved
          in this browser...
        </p>
      </div>
    );
  }

  if (
    reservations.length === 0
  ) {
    return (
      <div className="createdReservation">
        <div>
          <span>
            No saved reservations yet
          </span>
          <strong>
            Your reservation workspace
            is empty.
          </strong>
          <p>
            Nothing is wrong. This
            browser has not created a
            CommitPass reservation yet.
            New reservations will appear
            here automatically after
            creation.
          </p>
          <p>
            Connecting a wallet does not
            rebuild local invitation
            metadata. You can still inspect
            any existing reservation
            directly by its onchain ID.
          </p>
        </div>

        <div className="createdActions">
          <Link
            className="button primary"
            href="/create"
          >
            Create reservation
          </Link>

          <Link
            className="button secondary"
            href="/reservation"
          >
            Open by onchain ID
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="recentReservationList">
      {reservations.map(
        (reservation) => {
          const status =
            statuses[
              reservation
                .reservationId
            ];

          return (
            <article
              className="recentReservationItem"
              key={
                reservation
                  .reservationId
              }
            >
              <div>
                <span>
                  Reservation #
                  {
                    reservation
                      .reservationId
                  }
                </span>

                <strong>
                  {
                    reservation
                      .title
                  }
                </strong>

                <small>
                  {formatDate(
                    reservation
                      .start,
                  )}
                  {" / "}
                  {
                    reservation
                      .commitmentAmount
                  }
                  {" USDC each"}
                </small>

                <small>
                  {status?.label ??
                    "Reading Arc..."}
                  {status?.loading
                    ? ""
                    : " / saved in this browser"}
                </small>
              </div>

              <div className="recentReservationActions">
                <a
                  className="button primary"
                  href={
                    reservation
                      .shareUrl
                  }
                >
                  Open reservation
                </a>

                <button
                  className="button secondary"
                  type="button"
                  onClick={() =>
                    copyInvitation(
                      reservation,
                    )
                  }
                >
                  {copiedId ===
                  reservation
                    .reservationId
                    ? "Link copied"
                    : "Copy invitation"}
                </button>

                <a
                  className="button secondary"
                  href={
                    "https://testnet.arcscan.app/tx/" +
                    reservation.hash
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Arcscan
                </a>
              </div>
            </article>
          );
        },
      )}
    </div>
  );
}
