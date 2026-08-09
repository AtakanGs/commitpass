import Link from "next/link";

import {
  SiteFooter,
} from "@/components/SiteFooter";
import {
  SiteNav,
} from "@/components/SiteNav";

const problems = [
  {
    title: "No-shows waste scarce time",
    description:
      "A tutor, consultant or mentor reserves a real time slot. If the other side never arrives, that capacity is already gone.",
  },
  {
    title: "One-sided claims are not enough",
    description:
      "After a missed session, each side can tell a different story. Settlement should not depend on whoever complains first.",
  },
  {
    title: "Payments do not prove participation",
    description:
      "A normal payment can move money, but it does not know whether both people actually showed up and completed the session.",
  },
] as const;

const steps = [
  {
    number: "01",
    title: "Create the commitment",
    description:
      "The provider sets the time, duration, cancellation deadline and an equal refundable USDC commitment for both sides.",
  },
  {
    number: "02",
    title: "Both sides lock the same amount",
    description:
      "The invited customer verifies the committed terms and locks the same amount. The commitment is reservation protection, not the service fee.",
  },
  {
    number: "03",
    title: "Verify participation",
    description:
      "CommitPass evaluates trustworthy session evidence against the committed attendance policy instead of relying on a unilateral claim.",
  },
  {
    number: "04",
    title: "Settle on Arc",
    description:
      "Signed evidence reaches V3 on Arc. The contract returns commitments, compensates a proven no-show path or safely recovers after timeouts.",
  },
] as const;

const builtItems = [
  {
    label: "ARC PROTOCOL",
    title: "MutualCommitmentEscrow V3",
    description:
      "A source-verified Arc Testnet contract for symmetric USDC commitments, bounded lifecycle windows, claims, disputes and deterministic outcomes.",
  },
  {
    label: "POLICY ENGINE",
    title: "Digital-session overlap logic",
    description:
      "Join/leave intervals are clipped, merged and evaluated as simultaneous presence, including reconnections, early exits and no-show cases.",
  },
  {
    label: "LIVE VERIFIER",
    title: "Wallet-authenticated browser presence",
    description:
      "Two authorized participants produced server-timestamped presence evidence that reached the V3 settlement path on Arc Testnet.",
  },
  {
    label: "MEETING ADAPTER",
    title: "Real Google Meet evidence ingestion",
    description:
      "CommitPass can read signed-in Meet participants and their actual participant-session intervals through the Google Meet REST API.",
  },
  {
    label: "ATTESTATION",
    title: "EIP-712 attendance evidence",
    description:
      "The verifier signs reservation-bound attendance that V3 validates with participant, contract and chain replay protection.",
  },
  {
    label: "LIVENESS + TESTS",
    title: "Failure recovery and hardening",
    description:
      "Permissionless timeout recovery protects locked funds. The current repository passes 77 contract tests and 22 session-policy tests.",
  },
] as const;

const proofPoints = [
  {
    title: "Final V3 deployed",
    metric: "Arc Testnet",
    description:
      "Source-verified symmetric commitment protocol with explicit cancellation, attendance, claim, dispute and recovery windows.",
  },
  {
    title: "Live verifier → Arc proven",
    metric: "10:35 / 10:00",
    description:
      "Reservation #5 reached its committed simultaneous-presence threshold and settled V3 as Completed.",
  },
  {
    title: "Real Meet records ingested",
    metric: "02:10 overlap",
    description:
      "A completed Google Meet returned two signed-in participant records and their real join/leave sessions.",
  },
  {
    title: "Failure recovery proven",
    metric: "RefundBoth",
    description:
      "A stale reservation passed its lifecycle timeout and both commitments were recovered through the permissionless refund path.",
  },
] as const;

const nextItems = [
  {
    number: "01",
    title: "Bind wallets to meeting identities",
    description:
      "A participant will sign with the wallet and link the same account to Google or another meeting provider before the session.",
  },
  {
    number: "02",
    title: "Production verifier infrastructure",
    description:
      "Move evidence state and signing to durable storage, managed keys and provider-grade event ingestion instead of local hackathon infrastructure.",
  },
  {
    number: "03",
    title: "Commitment Passport",
    description:
      "Turn repeated fulfilled commitments into a portable reputation layer so reliable participants can earn better trust and terms over time.",
  },
] as const;

export default function Home() {
  return (
    <main>
      <SiteNav />

      <section
        className="homeHero shell storyHero"
        id="top"
      >
        <div className="homeHeroCopy">
          <p className="eyebrow">
            PROGRAMMABLE COMMITMENT FOR
            DIGITAL SESSIONS
          </p>

          <h1>
            Both sides commit.
            <br />
            Evidence settles the outcome.
          </h1>

          <p className="lead">
            CommitPass protects online
            lessons, consultations, mentoring
            and other scarce sessions with
            equal refundable USDC commitments
            on Arc. Both sides have something
            at stake, and verifiable
            participation—not a one-sided
            claim—drives settlement.
          </p>

          <div className="heroActions">
            <Link
              className="button primary"
              href="/create"
            >
              Try the prototype
            </Link>

            <Link
              className="button secondary"
              href="/proof"
            >
              Inspect verified proof
            </Link>
          </div>
        </div>

        <div className="commitmentDemo card">
          <div className="commitmentDemoHeader">
            <div>
              <span className="taskRole">
                SIMPLE EXAMPLE
              </span>
              <h2>
                10 USDC each.
                <br />
                One shared outcome.
              </h2>
            </div>
            <span className="networkPill">
              Arc Testnet
            </span>
          </div>

          <div className="commitmentParties">
            <div>
              <span>Provider</span>
              <strong>Locks 10 USDC</strong>
            </div>

            <div className="commitmentPlus">
              +
            </div>

            <div>
              <span>Customer</span>
              <strong>Locks 10 USDC</strong>
            </div>
          </div>

          <div className="evidenceBridge">
            <span>
              SESSION EVIDENCE
            </span>
            <strong>
              Who actually kept the
              commitment?
            </strong>
            <p>
              Attendance policy + signed
              verifier evidence determine what
              V3 is allowed to settle.
            </p>
          </div>

          <div className="miniOutcomeGrid">
            <div>
              <span>Both participate</span>
              <strong>
                10 + 10 returned
              </strong>
            </div>
            <div>
              <span>Proven no-show</span>
              <strong>
                Programmed compensation
              </strong>
            </div>
            <div>
              <span>Infrastructure stalls</span>
              <strong>
                Timeout recovery
              </strong>
            </div>
          </div>

          <p className="commitmentNote">
            The commitment is not the service
            fee. It is symmetric reservation
            protection.
          </p>
        </div>
      </section>

      <section
        className="shell compactSection storySection"
        id="problem"
      >
        <div className="sectionHead storySectionHead">
          <p className="eyebrow">
            WHY COMMITPASS EXISTS
          </p>
          <h2>
            A reserved hour has value before
            anyone gets paid.
          </h2>
          <p className="storyLead">
            Digital sessions create a simple
            trust problem: both people can
            lose time, but ordinary payment
            infrastructure cannot verify who
            actually honored the appointment.
          </p>
        </div>

        <div className="storyGrid threeColumns">
          {problems.map((problem, index) => (
            <article
              className="storyCard"
              key={problem.title}
            >
              <span>
                {String(index + 1)
                  .padStart(2, "0")}
              </span>
              <h3>
                {problem.title}
              </h3>
              <p>
                {problem.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell compactSection storySection">
        <div className="mechanismPanel card">
          <div className="mechanismCopy">
            <p className="eyebrow">
              THE ECONOMIC MECHANISM
            </p>
            <h2>
              Make commitment mutual before
              making settlement programmable.
            </h2>
            <p>
              CommitPass does not ask one side
              to pay a penalty upfront. It asks
              both sides to lock the same
              refundable amount under the same
              committed terms.
            </p>
            <p>
              When participation evidence is
              final, V3 applies the programmed
              outcome. If the verifier or
              arbitration path stops
              progressing, lifecycle timeouts
              provide a recovery route.
            </p>
          </div>

          <div className="mechanismOutcomes">
            <div className="mechanismOutcome success">
              <span>
                BOTH KEEP THE SESSION
              </span>
              <strong>
                Both commitments return
              </strong>
              <p>
                Honest participation should
                not cost either side the
                reservation deposit.
              </p>
            </div>

            <div className="mechanismOutcome">
              <span>
                ONE SIDE NO-SHOWS
              </span>
              <strong>
                The kept commitment can be
                compensated
              </strong>
              <p>
                A valid no-show path can award
                the commitment pool to the side
                that honored the reservation.
              </p>
            </div>

            <div className="mechanismOutcome">
              <span>
                SYSTEM STOPS PROGRESSING
              </span>
              <strong>
                Funds do not stay locked
                forever
              </strong>
              <p>
                Permissionless timeout recovery
                protects both participants from
                stalled infrastructure.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="shell compactSection"
        id="how"
      >
        <div className="sectionHead compactSectionHead storySectionHead">
          <p className="eyebrow">
            HOW IT WORKS
          </p>
          <h2>
            Commit together. Verify
            participation. Settle on Arc.
          </h2>
          <p className="storyLead">
            The product keeps the user flow
            simple while the protocol handles
            immutable terms, evidence and
            lifecycle boundaries underneath.
          </p>
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

      <section
        className="shell compactSection storySection"
        id="built"
      >
        <div className="sectionHead storySectionHead">
          <p className="eyebrow">
            WHAT WE BUILT
          </p>
          <h2>
            More than a smart contract:
            a complete evidence-to-settlement
            prototype.
          </h2>
          <p className="storyLead">
            The hackathon work connects user
            commitments, session policy,
            verifier evidence and Arc
            settlement into one inspectable
            architecture.
          </p>
        </div>

        <div className="buildGrid">
          {builtItems.map((item) => (
            <article
              className="buildCard"
              key={item.title}
            >
              <span>{item.label}</span>
              <h3>{item.title}</h3>
              <p>
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="shell compactSection storySection"
        id="proven"
      >
        <div className="sectionHead storySectionHead">
          <p className="eyebrow">
            WHAT IS PROVEN TODAY
          </p>
          <h2>
            Separate the evidence from the
            promise.
          </h2>
          <p className="storyLead">
            CommitPass deliberately distinguishes
            public onchain settlement proof,
            real external API evidence and
            prototype boundaries.
          </p>
        </div>

        <div className="proofStoryGrid">
          {proofPoints.map(
            (point, index) => (
              <article
                className="proofStoryCard card"
                key={point.title}
              >
                <div className="proofStoryTop">
                  <span>
                    {String(index + 1)
                      .padStart(2, "0")}
                  </span>
                  <strong>
                    {point.metric}
                  </strong>
                </div>

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

        <div className="storyInlineAction">
          <Link
            className="button secondary"
            href="/proof"
          >
            Open public proof and Arcscan links
          </Link>
        </div>
      </section>

      <section
        className="shell compactSection storySection"
        id="next"
      >
        <div className="sectionHead storySectionHead">
          <p className="eyebrow">
            WHERE COMMITPASS GOES NEXT
          </p>
          <h2>
            Keep the protocol boundary.
            Upgrade the evidence boundary.
          </h2>
          <p className="storyLead">
            The next phase is not a new token
            or a more complicated escrow. It is
            stronger identity binding,
            production verifier infrastructure
            and portable trust built from
            fulfilled commitments.
          </p>
        </div>

        <div className="roadmapGrid">
          {nextItems.map((item) => (
            <article
              className="roadmapCard"
              key={item.number}
            >
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell finalPrototypeCta card">
        <div className="finalPrototypeIntro">
          <p className="eyebrow">
            TRY THE HACKATHON PROTOTYPE
          </p>
          <h2>
            The story is simple.
            The evidence is inspectable.
          </h2>
          <p>
            Create a protected reservation,
            return to locally saved session
            flows or inspect the public Arc
            Testnet proof.
          </p>
        </div>

        <div className="finalActionGrid">
          <Link
            className="homeTaskCard homeTaskPrimary"
            href="/create"
          >
            <span className="taskRole">
              PROVIDER FLOW
            </span>
            <h3>
              Create reservation
            </h3>
            <p>
              Commit shared terms and lock
              the first refundable USDC
              amount.
            </p>
            <strong>
              Start prototype
            </strong>
          </Link>

          <Link
            className="homeTaskCard"
            href="/reservations"
          >
            <span className="taskRole">
              RETURNING USER
            </span>
            <h3>
              My reservations
            </h3>
            <p>
              Reopen reservation context
              saved in this browser and read
              the latest Arc status.
            </p>
            <strong>
              Open workspace
            </strong>
          </Link>

          <Link
            className="homeTaskCard"
            href="/proof"
          >
            <span className="taskRole">
              VERIFICATION
            </span>
            <h3>
              Verified proof
            </h3>
            <p>
              Inspect deployed V3 evidence,
              verifier settlement and recovery
              transactions.
            </p>
            <strong>
              Inspect evidence
            </strong>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
