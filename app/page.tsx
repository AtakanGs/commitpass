import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

const steps = [
  {
    number: "01",
    title: "Both parties commit",
    description:
      "The provider and customer lock refundable USDC commitments before the reservation.",
  },
  {
    number: "02",
    title: "Attendance is recorded",
    description:
      "Each party confirms attendance during the programmed check-in window.",
  },
  {
    number: "03",
    title: "The contract settles",
    description:
      "Commitments are returned or compensation is distributed according to the agreed rules.",
  },
];

export default function Home() {
  return (
    <main>
      <SiteNav />

      <section className="homeHero shell" id="top">
        <div className="homeHeroCopy">
          <p className="eyebrow">
            PROGRAMMABLE RESERVATION PROTECTION
          </p>

          <h1>
            Both sides commit.
            <br />
            Trust is programmable.
          </h1>

          <p className="lead">
            CommitPass protects scarce appointments with
            two-sided refundable USDC commitments. Honest
            participation returns both commitments. A no-show
            compensates the party that kept the reservation.
          </p>
        </div>

        <div className="actionChooser card">
          <p className="eyebrow">CHOOSE YOUR TASK</p>

          <h2>What do you need to do?</h2>

          <p className="chooserLead">
            CommitPass shows only the flow relevant to your
            current task.
          </p>

          <div className="homeTaskGrid">
            <Link
              className="homeTaskCard homeTaskPrimary"
              href="/create"
            >
              <span className="taskRole">Provider</span>
              <h3>Create a reservation</h3>
              <p>
                Set the terms, lock the provider commitment and
                send the invitation link.
              </p>
              <strong>Start provider flow</strong>
            </Link>

            <Link
              className="homeTaskCard"
              href="/reservation"
            >
              <span className="taskRole">
                Customer or provider
              </span>
              <h3>Open a reservation</h3>
              <p>
                Use an invitation link or enter the onchain
                reservation ID to continue.
              </p>
              <strong>Open reservation console</strong>
            </Link>
          </div>
        </div>
      </section>

      <section className="shell compactSection" id="how">
        <div className="sectionHead compactSectionHead">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>
            One reservation. Three clear stages.
          </h2>
        </div>

        <div className="flowSteps">
          {steps.map((step) => (
            <article className="flowStep" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell proofCta card">
        <div>
          <p className="eyebrow">VERIFIED ON ARC TESTNET</p>
          <h2>Four outcomes. Independently verifiable.</h2>
          <p>
            Inspect completed cancellation, attendance and
            no-show scenarios with their recorded Arcscan
            transactions.
          </p>
        </div>

        <Link className="button secondary" href="/proof">
          View verified proof
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
