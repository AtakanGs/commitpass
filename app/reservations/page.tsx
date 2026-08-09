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
    "Return to CommitPass reservations saved on this device and inspect their current Arc Testnet status.",
};

export default function ReservationsPage() {
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
          RESERVATION WORKSPACE
        </p>

        <h1>My reservations.</h1>

        <p>
          Return to invitations created in this browser,
          reopen the live room and check the latest
          onchain reservation status.
        </p>
      </section>

      <section className="singleWorkbench shell">
        <aside className="taskSidebar card">
          <p className="eyebrow">
            SAVED ON THIS DEVICE
          </p>

          <h2>
            One place for your session flows.
          </h2>

          <div className="taskPoint">
            <span>01</span>
            <div>
              <strong>
                Resume a reservation
              </strong>
              <p>
                Open the original verified invitation
                without rebuilding its committed metadata.
              </p>
            </div>
          </div>

          <div className="taskPoint">
            <span>02</span>
            <div>
              <strong>
                Reopen the live room
              </strong>
              <p>
                Verified-session reservations keep their
                original live-room URL alongside the invitation.
              </p>
            </div>
          </div>

          <div className="taskPoint">
            <span>03</span>
            <div>
              <strong>
                Check Arc status
              </strong>
              <p>
                The workspace reads the current reservation
                status from Arc Testnet while keeping links only
                in this browser.
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
              Reservations on this device
            </span>
            <span className="secureTag">
              Arc Testnet
            </span>
          </div>

          <p className="formNote">
            Invitation metadata is stored locally for
            convenience. Private keys are never stored here.
          </p>

          <ReservationsIndex />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
