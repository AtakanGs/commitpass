export const RECENT_RESERVATIONS_KEY =
  "commitpass:recent-reservations:v1";

export const MAX_RECENT_RESERVATIONS = 12;

export type SavedReservation = {
  reservationId: string;
  title: string;
  start: string;
  createdAt: string;
  shareUrl: string;
  hash: string;
  commitmentAmount: string;
};

export function readSavedReservations():
  SavedReservation[] {
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

    const parsed:
      unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (
          entry,
        ): entry is SavedReservation =>
          Boolean(
            entry &&
              typeof entry ===
                "object" &&
              "reservationId" in
                entry &&
              typeof entry
                .reservationId ===
                "string" &&
              "title" in entry &&
              typeof entry.title ===
                "string" &&
              "start" in entry &&
              typeof entry.start ===
                "string" &&
              "createdAt" in entry &&
              typeof entry.createdAt ===
                "string" &&
              "shareUrl" in entry &&
              typeof entry.shareUrl ===
                "string" &&
              "hash" in entry &&
              typeof entry.hash ===
                "string" &&
              "commitmentAmount" in
                entry &&
              typeof entry
                .commitmentAmount ===
                "string",
          ),
      )
      .slice(
        0,
        MAX_RECENT_RESERVATIONS,
      );
  } catch {
    return [];
  }
}

export function saveRecentReservation(
  reservation: SavedReservation,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const next = [
      reservation,
      ...readSavedReservations().filter(
        (entry) =>
          entry.reservationId !==
          reservation.reservationId,
      ),
    ].slice(
      0,
      MAX_RECENT_RESERVATIONS,
    );

    window.localStorage.setItem(
      RECENT_RESERVATIONS_KEY,
      JSON.stringify(next),
    );
  } catch {
    // Browser storage is convenience only.
  }
}
