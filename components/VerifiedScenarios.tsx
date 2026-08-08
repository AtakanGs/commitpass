const CONTRACT_ADDRESS =
  "0x66592bDB161b2C68ceFB4133Cfa0dB08eD2Ff791";

const CIRCLE_WALLET =
  "0x2f149e3de871759f2aadc5a6185512b36730a37d";

const PROOFS = [
  {
    title: "Verified digital-session settlement",
    result: "Completed · both deposits refunded",
    summary:
      "A controlled Arc Testnet integration run reached the configured participation threshold. Signed attendance was accepted for both participants and the V3 contract returned each 0.1 USDC commitment.",
    funds:
      "Provider: 0.1 USDC returned · Customer: 0.1 USDC returned",
    note:
      "Controlled test evidence only. Synthetic session intervals were used; this is not evidence of a real customer meeting.",
    links: [
      {
        label: "Provider attendance transaction",
        href: "https://testnet.arcscan.app/tx/0x2ff976d6b5d5eba3cc8fd7bdb26bbe7b9a243753051aa8f88e6fab3f89e18536",
      },
      {
        label: "Customer attendance transaction",
        href: "https://testnet.arcscan.app/tx/0x9c133dd5c2a2ef199fb68dc23176fcad74a5bdc975de47c4caa87a144102984d",
      },
      {
        label: "Structured evidence",
        href: "https://github.com/AtakanGs/commitpass/blob/9f37e8a/deployments/arc-testnet-v3-proof-platform-session.json",
      },
    ],
  },
  {
    title: "Permissionless stale-reservation recovery",
    result: "RefundBoth · both deposits refunded",
    summary:
      "No attendance was recorded before the lifecycle deadlines. After the claim window expired, the V3 stale-refund path returned 0.1 USDC to each participant.",
    funds:
      "Provider: 0.1 USDC returned · Customer: 0.1 USDC returned",
    note:
      "The recovery call is permissionless after the configured timeout, removing dependence on either participant to release the locked commitments.",
    links: [
      {
        label: "Refund transaction",
        href: "https://testnet.arcscan.app/tx/0xad1d6dbedbbc663a0fe7fa1d474d3dfa2da99a41f0d75a21a13e90754d6d82de",
      },
      {
        label: "Structured evidence",
        href: "https://github.com/AtakanGs/commitpass/blob/92a4f6c/deployments/arc-testnet-v3-proof-stale-refund.json",
      },
    ],
  },
] as const;

export function VerifiedScenarios() {
  return (
    <section
      className="shell section proofSection"
      id="proof"
    >
      <div className="sectionHead proofSectionHead">
        <p className="eyebrow">PUBLIC V3 EVIDENCE · ARC TESTNET</p>
        <h2>Inspect the settlement, not a screenshot.</h2>
        <p>
          These examples link to public Arc Testnet transactions
          and repository evidence for the final V3 contract.
        </p>
      </div>

      <div className="transactionStatus">
        <strong>Testnet prototype evidence</strong>
        <p>
          No real customer session or production funds are
          represented here. The digital-session example is a
          controlled integration proof using synthetic intervals.
        </p>
      </div>

      <div className="verifiedGrid">
        {PROOFS.map((proof) => (
          <article
            className="verifiedCard card"
            key={proof.title}
          >
            <div className="verifiedIdentity">
              <h3>{proof.title}</h3>
            </div>

            <p className="verifiedSummary">
              {proof.summary}
            </p>

            <div className="verifiedState">
              <div>
                <span>Result</span>
                <strong>{proof.result}</strong>
              </div>
            </div>

            <div className="verifiedSettlement">
              <span>Funds</span>
              <strong>{proof.funds}</strong>
            </div>

            <p className="verifiedSummary">
              {proof.note}
            </p>

            <div className="verifiedActions">
              {proof.links.map((link) => (
                <a
                  className="button secondary full"
                  href={link.href}
                  key={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </article>
        ))}

        <article className="verifiedCard card">
          <div className="verifiedIdentity">
            <h3>Final V3 deployment</h3>
          </div>

          <p className="verifiedSummary">
            The deployed V3 source is verified on Arcscan. The
            Circle developer-controlled test wallet used as the
            customer in the completed proof is also public.
          </p>

          <div className="verifiedState">
            <div>
              <span>Contract</span>
              <strong title={CONTRACT_ADDRESS}>
                0x6659...f791
              </strong>
            </div>
          </div>

          <div className="verifiedSettlement">
            <span>Circle test wallet</span>
            <strong title={CIRCLE_WALLET}>
              0x2f14...a37d
            </strong>
          </div>

          <div className="verifiedActions">
            <a
              className="button secondary full"
              href={
                "https://testnet.arcscan.app/address/" +
                CONTRACT_ADDRESS +
                "?tab=contract"
              }
              target="_blank"
              rel="noreferrer"
            >
              Inspect verified contract
            </a>

            <a
              className="button secondary full"
              href="https://testnet.arcscan.app/tx/0xec1f6ea00711c9917665244c8ab7b0bbf13c5cb1cec96ba90dac9ab0448bef06"
              target="_blank"
              rel="noreferrer"
            >
              Inspect deployment transaction
            </a>

            <a
              className="button secondary full"
              href={
                "https://testnet.arcscan.app/address/" +
                CIRCLE_WALLET
              }
              target="_blank"
              rel="noreferrer"
            >
              Inspect Circle test wallet
            </a>
          </div>
        </article>
      </div>
    </section>
  );
}
