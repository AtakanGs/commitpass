import type { Metadata } from "next";
import Link from "next/link";
import { CreateReservationForm } from "@/components/CreateReservationForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Create reservation | CommitPass",
  description:
    "Create a two-sided USDC reservation commitment on Arc.",
};

export default function CreateReservationPage() {
  return (
    <main>
      <SiteNav />

      <section className="taskPageHero shell">
        <Link className="backLink" href="/">
          Back to home
        </Link>

        <p className="eyebrow">PROVIDER FLOW</p>

        <h1>Create a reservation.</h1>

        <p>
          Define the commitments and cancellation terms. The
          provider funds first, then sends a verified invitation
          link to the customer.
        </p>
      </section>

      <section className="singleWorkbench shell">
        <aside className="taskSidebar card">
          <p className="eyebrow">BEFORE YOU START</p>
          <h2>One focused provider flow.</h2>

          <div className="taskPoint">
            <span>01</span>
            <div>
              <strong>Set the terms</strong>
              <p>
                Choose the start time, cancellation window and
                commitment amounts.
              </p>
            </div>
          </div>

          <div className="taskPoint">
            <span>02</span>
            <div>
              <strong>Lock the provider bond</strong>
              <p>
                Approve USDC and create the reservation on Arc
                Testnet.
              </p>
            </div>
          </div>

          <div className="taskPoint">
            <span>03</span>
            <div>
              <strong>Share the invitation</strong>
              <p>
                Send the generated reservation link to the
                invited customer.
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
