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
            Four legacy outcomes. Publicly verifiable.
          </h2>
        </div>

        <p>
          These scenarios were completed on the original v1
          deployment. The live application now targets the
          hardened v2 contract, and new v2 evidence will replace
          these historical examples.
        </p>
      </div>

      <div className="verifiedGrid">
        {VERIFIED_SCENARIOS.map((scenario, index) => (
          <article
            className="verifiedCard card"
            key={scenario.reservationId}
          >
            <div className="verifiedTopline">
              <span>
                SCENARIO{" "}
                {String(index + 1).padStart(2, "0")} |{" "}
                {scenario.eyebrow}
              </span>

              <span className="verifiedBadge">
                Legacy v1
              </span>
            </div>

            <div className="verifiedIdentity">
              <span>
                Onchain reservation #
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
