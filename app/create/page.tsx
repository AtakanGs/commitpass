import type {
  Metadata,
} from "next";
import Link from "next/link";
import {
  CreateReservationForm,
} from "@/components/CreateReservationForm";
import {
  SiteFooter,
} from "@/components/SiteFooter";
import {
  SiteNav,
} from "@/components/SiteNav";

export const metadata: Metadata = {
  title:
    "Create reservation | CommitPass",
  description:
    "Create a digitally verifiable two-sided USDC session commitment on Arc.",
};

export default function
CreateReservationPage() {
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
          PROVIDER FLOW
        </p>

        <h1>Create a reservation.</h1>

        <p>
          Define one equal commitment, set
          measurable digital session terms,
          choose the attendance trust mode and
          send the customer a verifiable
          invitation.
        </p>
      </section>

      <section className="singleWorkbench shell">
        <aside className="taskSidebar card">
          <p className="eyebrow">
            BEFORE YOU START
          </p>

          <h2>
            One focused provider flow.
          </h2>

          <div className="taskPoint">
            <span>01</span>
            <div>
              <strong>
                Set symmetric terms
              </strong>
              <p>
                Choose the start time, equal
                commitment, issue window and
                completion threshold.
              </p>
            </div>
          </div>

          <div className="taskPoint">
            <span>02</span>
            <div>
              <strong>
                Choose attendance trust
              </strong>
              <p>
                Use direct self check-in or
                the fixed CommitPass testnet
                attestor for platform events.
              </p>
            </div>
          </div>

          <div className="taskPoint">
            <span>03</span>
            <div>
              <strong>
                Lock and share
              </strong>
              <p>
                Fund the provider side on Arc
                Testnet and send the generated
                invitation link.
              </p>
            </div>
          </div>
        </aside>

        <CreateReservationForm />
      </section>

      <SiteFooter />
    </main>
  );
}
