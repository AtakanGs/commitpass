import Link from "next/link";

import {
  SiteFooter,
} from "@/components/SiteFooter";
import {
  SiteNav,
} from "@/components/SiteNav";

const steps = [
  {
    number: "01",
    title: "Create the commitment",
    description:
      "The provider sets the session time, duration, cancellation deadline and one equal refundable USDC commitment for both sides.",
  },
  {
    number: "02",
    title: "Both sides lock the same amount",
    description:
      "The provider funds first. The invited customer verifies the committed terms, accepts them and locks the same refundable amount.",
  },
  {
    number: "03",
    title: "Verify participation",
    description:
      "CommitPass can evaluate server-timestamped wallet-authenticated browser presence or signed-in participant-session records read from Google Meet.",
  },
  {
    number: "04",
    title: "Evidence settles on Arc",
    description:
      "When committed policy conditions are satisfied, the configured verifier signs EIP-712 attendance and V3 settles the reservation on Arc.",
  },
] as const;

const proofPoints = [
  {
    title: "Final V3 deployed",
    description:
      "Source-verified on Arc Testnet with symmetric commitments, bounded lifecycle windows and permissionless timeout recovery.",
  },
  {
    title: "Live verifier → Arc proven",
    description:
      "Reservation #5 used two wallet-authorized browser participants, reached 10:35 of verified simultaneous presence and settled V3 as Completed.",
  },
  {
    title: "Real Google Meet records ingested",
    description:
      "The Meet REST adapter read two signed-in participants and their real join/leave sessions, measuring 02:10 of simultaneous presence in the completed test call.",
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

      <section
        className="homeHero shell"
        id="top"
      >
        <div className="homeHeroCopy">
          <p className="eyebrow">
            TWO-SIDED COMMITMENTS FOR
            DIGITAL SESSIONS
          </p>

          <h1>
            Both sides commit.
            <br />
            Evidence settles the outcome.
          </h1>

          <p className="lead">
            CommitPass protects online
            lessons, consultations and other
            scarce sessions with equal
            refundable USDC commitments on
            Arc. Honest participation returns
            both commitments; a proven
            no-show can compensate the side
            that kept the reservation.
          </p>
        </div>

        <div className="actionChooser card">
          <p className="eyebrow">
            START A FLOW
          </p>

          <h2>
            What do you need to do?
          </h2>

          <p className="chooserLead">
            The interface shows only the
            actions relevant to the connected
            wallet and current reservation
            state.
          </p>

          <div className="homeTaskGrid">
            <Link
              className="homeTaskCard homeTaskPrimary"
              href="/create"
            >
              <span className="taskRole">
                Provider
              </span>
              <h3>
                Create a protected session
              </h3>
              <p>
                Set the terms, lock your
                refundable commitment and
                send a verifiable invitation
                link.
              </p>
              <strong>
                Start provider flow
              </strong>
            </Link>

            <Link
              className="homeTaskCard"
              href="/reservations"
            >
              <span className="taskRole">
                Returning participant
              </span>
              <h3>My reservations</h3>
              <p>
                Return to reservations saved
                on this device and reopen
                their verified invitation
                context.
              </p>
              <strong>
                View reservations
              </strong>
            </Link>

            <Link
              className="homeTaskCard"
              href="/reservation"
            >
              <span className="taskRole">
                Customer or provider
              </span>
              <h3>
                Open by onchain ID
              </h3>
              <p>
                Open the original invitation
                link to verify committed terms,
                or inspect an existing
                reservation by Arc ID.
              </p>
              <strong>
                Open reservation
              </strong>
            </Link>
          </div>
        </div>
      </section>

      <section
        className="shell compactSection"
        id="how"
      >
        <div className="sectionHead compactSectionHead">
          <p className="eyebrow">
            HOW IT WORKS
          </p>
          <h2>
            Commit together. Verify
            participation. Settle on Arc.
          </h2>
        </div>

        <div className="flowSteps">
          {steps.map((step) => (
            <article
              className="flowStep"
              key={step.number}
            >
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell compactSection">
        <div className="sectionHead compactSectionHead">
          <p className="eyebrow">
            WHAT IS PROVEN TODAY
          </p>
          <h2>
            Protocol and verifier boundaries
            are inspectable.
          </h2>
        </div>

        <div className="flowSteps">
          {proofPoints.map(
            (point, index) => (
              <article
                className="flowStep"
                key={point.title}
              >
                <span>
                  {String(index + 1)
                    .padStart(2, "0")}
                </span>
                <h3>
                  {point.title}
                </h3>
                <p>
                  {point.description}
                </p>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="shell proofCta card">
        <div>
          <p className="eyebrow">
            ARC + VERIFIER EVIDENCE
          </p>
          <h2>
            Inspect what is proven and what
            is still a prototype boundary.
          </h2>
          <p>
            The proof page separates public
            Arc settlement transactions from
            real Google Meet API evidence and
            controlled integration evidence.
          </p>
        </div>

        <Link
          className="button secondary"
          href="/proof"
        >
          View proof
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
