import { VERIFIED_SCENARIOS } from "@/lib/verifiedScenarios";

const EVIDENCE_URL =
  "https://github.com/AtakanGs/commitpass/blob/main/docs/testnet-evidence.md";

const PUBLIC_SCENARIOS = [
  {
    reservationId: 1,
    title: "Cancelled in time",
    result: "Both refunded",
    summary:
      "The customer cancelled before the deadline, so both deposits were returned.",
    funds: "Provider: 5 USDC · Customer: 2 USDC",
    evidence:
      EVIDENCE_URL +
      "#verified-v2-flow-1-early-cancellation",
  },
  {
    reservationId: 2,
    title: "Both showed up",
    result: "Both refunded",
    summary:
      "Both parties confirmed attendance, so both deposits were returned automatically.",
    funds: "Provider: 5 USDC · Customer: 2 USDC",
    evidence:
      EVIDENCE_URL +
      "#verified-v2-flow-2-mutual-attendance",
  },
  {
    reservationId: 3,
    title: "Customer did not show",
    result: "Provider compensated",
    summary:
      "The provider checked in, the customer did not, and the provider was compensated.",
    funds: "Provider: 7 USDC · Customer: 0 USDC",
    evidence:
      EVIDENCE_URL +
      "#verified-v2-flow-3-hardened-customer-no-show",
  },
  {
    reservationId: 4,
    title: "Provider did not show",
    result: "Customer compensated",
    summary:
      "The customer checked in, the provider did not, and the customer was compensated.",
    funds: "Provider: 3 USDC · Customer: 4 USDC",
    evidence:
      EVIDENCE_URL +
      "#verified-v2-flow-4-provider-no-show",
  },
] as const;

const CURRENT_IDS = new Set(
  VERIFIED_SCENARIOS.filter(
    (scenario) => scenario.deployment === "v2",
  ).map((scenario) => scenario.reservationId),
);

export function VerifiedScenarios() {
  const scenarios = PUBLIC_SCENARIOS.filter(
    (scenario) => CURRENT_IDS.has(scenario.reservationId),
  );

  return (
    <section
      className="shell section proofSection"
      id="proof"
    >
      <div className="sectionHead proofSectionHead">
        <p className="eyebrow">TESTED ON ARC TESTNET</p>
        <h2>See what happens to the funds.</h2>
        <p>
          Each example shows the final payout after a
          cancellation, completed visit, or no-show.
        </p>
      </div>

      <div className="verifiedGrid">
        {scenarios.map((scenario) => (
          <article
            className="verifiedCard card"
            key={scenario.reservationId}
          >
            <div className="verifiedIdentity">
              <h3>{scenario.title}</h3>
            </div>

            <p className="verifiedSummary">
              {scenario.summary}
            </p>

            <div className="verifiedState">
              <div>
                <span>Result</span>
                <strong>{scenario.result}</strong>
              </div>
            </div>

            <div className="verifiedSettlement">
              <span>Funds</span>
              <strong>{scenario.funds}</strong>
            </div>

            <div className="verifiedActions">
              <a
                className="button secondary full"
                href={scenario.evidence}
                target="_blank"
                rel="noreferrer"
              >
                View proof
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
