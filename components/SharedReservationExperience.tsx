"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ManageReservation } from "@/components/ManageReservation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

export function SharedReservationExperience() {
  const searchParams = useSearchParams();

  const id = (
    searchParams.get("id") ?? ""
  ).replace(/\D/g, "");

  const sharedTitle =
    searchParams.get("title")?.trim().slice(0, 160) ||
    undefined;

  const rawSalt = searchParams.get("salt")?.trim();
  const sharedSalt =
    rawSalt && /^0x[0-9a-fA-F]{64}$/.test(rawSalt)
      ? rawSalt
      : undefined;

  return (
    <main className="sharedPage">
      <SiteNav />

      <section className="sharedHero shell">
        <Link className="backLink" href="/">
          Back to home
        </Link>

        <p className="eyebrow">
          TWO-SIDED RESERVATION COMMITMENT
        </p>

        <h1>
          {id
            ? "Reservation #" + id
            : "Open or manage a reservation"}
        </h1>

        <p>
          {id
            ? "Review the terms, see every possible settlement and connect the invited wallet only when an action is required."
            : "Enter the onchain reservation ID below. CommitPass will then show the current state and only the actions available to the connected role."}
        </p>
      </section>

      <section className="sharedLayout shell">
        <aside className="sharedTrustPanel card">
          <p className="eyebrow">WHY IT IS DIFFERENT</p>
          <h2>Both parties have something to lose.</h2>

          <div className="trustPoint">
            <span>01</span>
            <div>
              <strong>Refundable by default</strong>
              <p>
                Honest participation returns each party&apos;s
                commitment.
              </p>
            </div>
          </div>

          <div className="trustPoint">
            <span>02</span>
            <div>
              <strong>Rules visible in advance</strong>
              <p>
                Refund and compensation outcomes are
                programmed before acceptance.
              </p>
            </div>
          </div>

          <div className="trustPoint">
            <span>03</span>
            <div>
              <strong>Role-aware actions</strong>
              <p>
                Only actions relevant to the connected provider
                or customer are enabled.
              </p>
            </div>
          </div>
        </aside>

        <ManageReservation
          initialId={id}
          autoLoad={Boolean(id)}
          reservationTitle={sharedTitle}
          reservationSalt={sharedSalt}
        />
      </section>

      <SiteFooter />
    </main>
  );
}
