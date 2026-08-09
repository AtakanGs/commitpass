import type {
  Metadata,
} from "next";
import Link from "next/link";

import {
  ReservationsIndex,
} from "@/components/ReservationsIndex";
import {
  SiteFooter,
} from "@/components/SiteFooter";
import {
  SiteNav,
} from "@/components/SiteNav";

export const metadata: Metadata = {
  title:
    "My reservations | CommitPass",
  description:
    "Return to CommitPass reservations saved in this browser and inspect their current Arc Testnet status.",
};

export default function
ReservationsPage() {
  return (
    <main>
      <SiteNav />

      <section className="taskPageHero shell">
        <Link
          className="backLink"
          href="/"
        >
          Back to home
        </Link>

        <p className="eyebrow">
          MY RESERVATIONS
        </p>

        <h1>
          Your reservation workspace.
        </h1>

        <p>
          Reservations created in this
          browser are saved here with
          their verified invitation link.
          The current lifecycle status is
          read from Arc Testnet.
        </p>
      </section>

      <section className="singleWorkbench shell">
        <aside className="taskSidebar card">
          <p className="eyebrow">
            SAVED IN THIS BROWSER
          </p>

          <h2>
            Return without rebuilding
            committed terms.
          </h2>

          <div className="taskPoint">
            <span>01</span>
            <div>
              <strong>
                Resume a reservation
              </strong>
              <p>
                Reopen the original
                verified invitation
                context saved after
                creation.
              </p>
            </div>
          </div>

          <div className="taskPoint">
            <span>02</span>
            <div>
              <strong>
                Check Arc status
              </strong>
              <p>
                CommitPass reads the
                current onchain lifecycle
                state for locally saved
                reservation IDs.
              </p>
            </div>
          </div>

          <div className="taskPoint">
            <span>03</span>
            <div>
              <strong>
                Privacy by design
              </strong>
              <p>
                This convenience list is
                browser-local. It does not
                store wallet private keys
                or recover invitation
                metadata from a wallet.
              </p>
            </div>
          </div>

          <Link
            className="button primary full"
            href="/create"
          >
            Create another reservation
          </Link>
        </aside>

        <div className="formCard card">
          <div className="formHeader">
            <span>
              Reservations saved here
            </span>
            <span className="secureTag">
              Arc Testnet
            </span>
          </div>

          <p className="formNote">
            An empty list is a normal
            first-use state. New
            reservations created on this
            site will appear here
            automatically.
          </p>

          <ReservationsIndex />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
