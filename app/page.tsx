import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

const steps = [
  {
    number: "01",
    title: "Agree on the session",
    description:
      "The provider sets the time, duration, cancellation deadline and one equal refundable USDC commitment for both sides.",
  },
  {
    number: "02",
    title: "Both sides commit",
    description:
      "The provider funds first. The invited customer verifies the shared terms, accepts them and locks the same commitment.",
  },
  {
    number: "03",
    title: "Evidence drives settlement",
    description:
      "Verified-session mode accepts signed attendance from the configured verifier. Manual confirmation remains available as a fallback mode.",
  },
] as const;

const proofPoints = [
  {
    title: "Final V3 deployed",
    description:
      "Source-verified on Arc Testnet with symmetric commitments, bounded lifecycle windows and permissionless timeout recovery.",
  },
  {
    title: "Verified-session path proven",
    description:
      "A controlled integration proof submitted signed attendance for both parties and settled the reservation as Completed.",
  },
  {
    title: "Failure recovery proven",
    description:
      "A separate onchain proof expired a stale reservation and refunded both commitments after the lifecycle timeout.",
  },
] as const;

export default function Home() {
  return (
    <main>
      <SiteNav />

      <section className="homeHero shell" id="top">
        <div className="homeHeroCopy">
          <p className="eyebrow">
            TWO-SIDED COMMITMENTS FOR DIGITAL SESSIONS
          </p>

          <h1>
            Both sides commit.
            <br />
            Evidence settles the outcome.
          </h1>

          <p className="lead">
            CommitPass protects online lessons, consultations and
            other scarce sessions with equal refundable USDC
            commitments on Arc. Honest participation returns both
            commitments; a proven no-show can compensate the side
            that kept the reservation.
          </p>
        </div>

        <div className="actionChooser card">
          <p className="eyebrow">START A FLOW</p>

          <h2>What do you need to do?</h2>

          <p className="chooserLead">
            The interface shows only the actions relevant to the
            connected wallet and current reservation state.
          </p>

          <div className="homeTaskGrid">
            <Link
              className="homeTaskCard homeTaskPrimary"
              href="/create"
            >
              <span className="taskRole">Provider</span>
              <h3>Create a protected session</h3>
              <p>
                Set the terms, lock your refundable commitment and
                send a verifiable invitation link.
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
                Open the original invitation link to verify the
                committed terms, or inspect an existing reservation
                by its onchain ID.
              </p>
              <strong>Open reservation</strong>
            </Link>
          </div>
        </div>
      </section>

      <section className="shell compactSection" id="how">
        <div className="sectionHead compactSectionHead">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>
            Shared terms in. Deterministic settlement out.
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

      <section className="shell compactSection">
        <div className="sectionHead compactSectionHead">
          <p className="eyebrow">WHAT IS PROVEN TODAY</p>
          <h2>
            The V3 settlement paths are public and inspectable.
          </h2>
        </div>

        <div className="flowSteps">
          {proofPoints.map((point, index) => (
            <article className="flowStep" key={point.title}>
              <span>
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{point.title}</h3>
              <p>{point.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell proofCta card">
        <div>
          <p className="eyebrow">PUBLIC ARC TESTNET EVIDENCE</p>
          <h2>Inspect the V3 transactions yourself.</h2>
          <p>
            The proof page links directly to the final contract,
            completed verified-session transactions and a separate
            permissionless stale-refund transaction.
          </p>
        </div>

        <Link className="button secondary" href="/proof">
          View V3 proof
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
