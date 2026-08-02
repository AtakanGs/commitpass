import { VERIFIED_SCENARIOS } from "@/lib/verifiedScenarios";

const ARCSCAN_TX = "https://testnet.arcscan.app/tx/";

export function VerifiedScenarios() {
  return (
    <section
      className="shell section proofSection"
      id="proof"
    >
      <div className="sectionHead proofSectionHead">
        <div>
          <p className="eyebrow">
            VERIFIED ON ARC TESTNET
          </p>
          <h2>
            Verified outcomes across hardened v2 and legacy v1.
          </h2>
        </div>

        <p>
          Current hardened v2 evidence is shown alongside
          historical v1 examples. Every reservation is scoped by
          its contract deployment, so repeated reservation IDs
          cannot be mixed.
        </p>
      </div>

      <div className="verifiedGrid">
        {VERIFIED_SCENARIOS.map((scenario, index) => (
          <article
            className="verifiedCard card"
            key={
              scenario.contractAddress +
              "-" +
              scenario.reservationId
            }
          >
            <div className="verifiedTopline">
              <span>
                SCENARIO{" "}
                {String(index + 1).padStart(2, "0")} |{" "}
                {scenario.eyebrow}
              </span>

              <span className="verifiedBadge">
                {scenario.deployment === "v2"
                  ? "Hardened v2"
                  : "Legacy v1"}
              </span>
            </div>

            <div className="verifiedIdentity">
              <span>
                {scenario.deployment.toUpperCase()} reservation #
                {scenario.reservationId}
              </span>
              <h3>{scenario.title}</h3>
            </div>

            <div className="verifiedState">
              <div>
                <span>Status</span>
                <strong>{scenario.status}</strong>
              </div>

              <div>
                <span>Outcome</span>
                <strong>{scenario.outcome}</strong>
              </div>
            </div>

            <p className="verifiedSummary">
              {scenario.summary}
            </p>

            <div className="verifiedSettlement">
              <span>Final settlement</span>
              <strong>{scenario.settlement}</strong>
            </div>

            <div className="verifiedMeta">
              <span>
                {scenario.activities.length} onchain steps
              </span>
              <span>{scenario.verifiedAt}</span>
            </div>

            <div className="verifiedActions">
              <a
                className="button secondary"
                href="https://github.com/AtakanGs/commitpass/blob/main/docs/testnet-evidence.md"
                target="_blank"
                rel="noreferrer"
              >
                Evidence record
              </a>

              {scenario.finalTransaction ? (
                <a
                  className="textLink"
                  href={
                    ARCSCAN_TX +
                    scenario.finalTransaction
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Final transaction
                </a>
              ) : (
                <a
                  className="textLink"
                  href="https://github.com/AtakanGs/commitpass/blob/main/docs/testnet-evidence.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Evidence record
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
