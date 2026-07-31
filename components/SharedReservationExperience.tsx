"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ManageReservation } from "@/components/ManageReservation";
import { WalletStatus } from "@/components/WalletStatus";

export function SharedReservationExperience() {
  const searchParams = useSearchParams();

  const id = (
    searchParams.get("id") ?? ""
  ).replace(/\D/g, "");

  const sharedTitle =
    searchParams.get("title")?.trim().slice(0, 160) ||
    undefined;

  return (
    <main className="sharedPage">
      <nav className="nav shell">
        <Link
          className="brand"
          href="/"
          aria-label="CommitPass home"
        >
          <span className="brandMark">C</span>
          <span>CommitPass</span>
        </Link>

        <div className="navMeta">
          <span className="networkPill">Arc Testnet</span>
          <WalletStatus />
        </div>
      </nav>

      <section className="sharedHero shell">
        <Link className="backLink" href="/">
          Back to CommitPass
        </Link>

        <p className="eyebrow">
          TWO-SIDED RESERVATION COMMITMENT
        </p>

        <h1>
          {id
            ? "Reservation #" + id
            : "Open a reservation"}
        </h1>

        <p>
          Review the terms, see every possible settlement
          and connect the invited wallet only when an action
          is required.
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
              <strong>Settled on Arc</strong>
              <p>
                Reservation state and USDC settlement remain
                independently verifiable.
              </p>
            </div>
          </div>
        </aside>

        <ManageReservation
          initialId={id || "1"}
          autoLoad={Boolean(id)}
          reservationTitle={sharedTitle}
        />
      </section>

      <footer className="shell footer">
        <div>
          <strong>CommitPass</strong>
          <p>
            Two-sided programmable reservation protection.
          </p>
        </div>

        <div className="footerLinks">
          <Link href="/">Create reservation</Link>
          <a
            href="https://github.com/AtakanGs/commitpass"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
