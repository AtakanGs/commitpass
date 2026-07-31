import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedReservationExperience } from "@/components/SharedReservationExperience";

export const metadata: Metadata = {
  title: "Reservation | CommitPass",
  description:
    "Review and manage a two-sided USDC reservation commitment on Arc.",
};

export default function ReservationPage() {
  return (
    <Suspense
      fallback={
        <main className="sharedLoading">
          Loading reservation...
        </main>
      }
    >
      <SharedReservationExperience />
    </Suspense>
  );
}
