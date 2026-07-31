import Link from "next/link";
import { VERIFIED_SCENARIOS } from "@/lib/verifiedScenarios";

const ARCSCAN_TX = "https://testnet.arcscan.app/tx/";

export function VerifiedScenarios() {
  return (
    <section className="shell section proofSection" id="proof">
      <div className="sectionHead proofSectionHead">
        <div>
          <p className="eyebrow">VERIFIED ON ARC TESTNET</p>
          <h2>
            Do not trust the pitch. Inspect the outcomes.
          </h2>
        </div>

        <p>
          These reservations were completed end to end with
          separate provider and customer wallets. Every
          recorded transaction remains independently
          verifiable.
        </p>
      </div>

      <div className="verifiedGrid">
        {VERIFIED_SCENARIOS.map((scenario) => (
          <article
            className="verifiedCard card"
            key={scenario.reservationId}
          >
            <div className="verifiedTopline">
              <span>{scenario.eyebrow}</span>
              <span className="verifiedBadge">
                Verified
              </span>
            </div>

            <div className="verifiedIdentity">
              <span>
                Reservation #{scenario.reservationId}
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
              <Link
                className="button secondary"
                href={
                  "/reservation?id=" +
                  scenario.reservationId
                }
              >
                Open scenario
              </Link>

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
