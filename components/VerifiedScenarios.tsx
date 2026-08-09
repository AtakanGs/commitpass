const CONTRACT_ADDRESS =
  "0x66592bDB161b2C68ceFB4133Cfa0dB08eD2Ff791";

const CIRCLE_WALLET =
  "0x2f149e3de871759f2aadc5a6185512b36730a37d";

const EXPERIMENT_BASE =
  "https://github.com/AtakanGs/commitpass/blob/experiment/live-presence-adapter/";

const PROOFS = [
  {
    title:
      "Live wallet-authenticated verifier settlement",
    result:
      "Completed · both deposits refunded",
    summary:
      "Reservation #5 used two wallet-authorized browser participants. Server-timestamped simultaneous presence reached 10:35 against a 10:00 threshold, then the verifier relayed signed attendance to V3.",
    funds:
      "Provider: 0.1 USDC returned · Customer: 0.1 USDC returned",
    note:
      "Live browser-presence proof, not production meeting-integrity evidence and not a claim of Google Meet or Zoom attendance.",
    links: [
      {
        label:
          "Provider attendance transaction",
        href:
          "https://testnet.arcscan.app/tx/0xc4cb2832096dbe79321f5cfaa292980930d1f37c2e4b4cd9a7934f8b7e33db4c",
      },
      {
        label:
          "Customer attendance transaction",
        href:
          "https://testnet.arcscan.app/tx/0xa2b181e740d8abc69d8b5bfc0d0e94b567bf138b643b21e0619e1460b18be640",
      },
      {
        label:
          "Structured onchain proof",
        href:
          EXPERIMENT_BASE +
          "deployments/arc-testnet-v3-proof-live-browser-session.json",
      },
    ],
  },
  {
    title:
      "Real Google Meet REST evidence ingestion",
    result:
      "2 signed-in participants · 02:10 overlap",
    summary:
      "A completed Google Meet call was read through the Meet REST API. CommitPass retrieved the two signed-in participant records and their real join/leave session intervals.",
    funds:
      "Evidence-only capture · no Arc funds moved by this specific Meet record",
    note:
      "The public proof removes names, Google user IDs and the meeting code. Wallet-to-Google identity binding is still manual, so no end-to-end Google Meet → Arc settlement is claimed for this record.",
    links: [
      {
        label:
          "Privacy-preserving Meet evidence",
        href:
          EXPERIMENT_BASE +
          "deployments/google-meet-real-evidence-2026-08-09.json",
      },
      {
        label:
          "Inspect Google Meet adapter",
        href:
          EXPERIMENT_BASE +
          "lib/server/googleMeetAdapter.ts",
      },
    ],
  },
  {
    title:
      "Controlled policy-to-attestation settlement",
    result:
      "Completed · both deposits refunded",
    summary:
      "Reservation #2 used a controlled digital-session receipt. Valid EIP-712 attendance was submitted for both participants and V3 settled the reservation as Completed.",
    funds:
      "Provider: 0.1 USDC returned · Customer: 0.1 USDC returned",
    note:
      "Deterministic integration evidence only. Synthetic session intervals were used; this is not evidence of a real human meeting.",
    links: [
      {
        label:
          "Provider attendance transaction",
        href:
          "https://testnet.arcscan.app/tx/0x2ff976d6b5d5eba3cc8fd7bdb26bbe7b9a243753051aa8f88e6fab3f89e18536",
      },
      {
        label:
          "Customer attendance transaction",
        href:
          "https://testnet.arcscan.app/tx/0x9c133dd5c2a2ef199fb68dc23176fcad74a5bdc975de47c4caa87a144102984d",
      },
      {
        label:
          "Structured controlled proof",
        href:
          EXPERIMENT_BASE +
          "deployments/arc-testnet-v3-proof-platform-session.json",
      },
    ],
  },
  {
    title:
      "Permissionless stale-reservation recovery",
    result:
      "RefundBoth · both deposits refunded",
    summary:
      "No attendance was recorded before the lifecycle deadlines. After the claim window expired, V3 returned 0.1 USDC to each participant through the permissionless stale-refund path.",
    funds:
      "Provider: 0.1 USDC returned · Customer: 0.1 USDC returned",
    note:
      "The recovery call is permissionless after the configured timeout, removing dependence on either participant to release locked commitments.",
    links: [
      {
        label:
          "Refund transaction",
        href:
          "https://testnet.arcscan.app/tx/0xad1d6dbedbbc663a0fe7fa1d474d3dfa2da99a41f0d75a21a13e90754d6d82de",
      },
      {
        label:
          "Structured evidence",
        href:
          EXPERIMENT_BASE +
          "deployments/arc-testnet-v3-proof-stale-refund.json",
      },
    ],
  },
] as const;

export function
VerifiedScenarios() {
  return (
    <section
      className="shell section proofSection"
      id="proof"
    >
      <div className="sectionHead proofSectionHead">
        <p className="eyebrow">
          PROTOCOL + VERIFIER EVIDENCE
        </p>
        <h2>
          Inspect the evidence boundary,
          not a marketing claim.
        </h2>
        <p>
          Public Arc Testnet transactions
          are separated from real offchain
          integration evidence so each claim
          can be evaluated on its own.
        </p>
      </div>

      <div className="transactionStatus">
        <strong>
          Testnet hackathon prototype
        </strong>
        <p>
          No production funds or production
          meeting-integrity guarantees are
          represented here. The Google Meet
          capture proves real API ingestion;
          it is not presented as an
          end-to-end Meet-to-Arc settlement.
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
                <strong>
                  {proof.result}
                </strong>
              </div>
            </div>

            <div className="verifiedSettlement">
              <span>Funds</span>
              <strong>
                {proof.funds}
              </strong>
            </div>

            <p className="verifiedSummary">
              {proof.note}
            </p>

            <div className="verifiedActions">
              {proof.links.map(
                (link) => (
                  <a
                    className="button secondary full"
                    href={link.href}
                    key={link.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                ),
              )}
            </div>
          </article>
        ))}

        <article className="verifiedCard card">
          <div className="verifiedIdentity">
            <h3>
              Final V3 deployment
            </h3>
          </div>

          <p className="verifiedSummary">
            The deployed V3 source is
            verified on Arcscan. The Circle
            developer-controlled test wallet
            used in the controlled completed
            proof is also public.
          </p>

          <div className="verifiedState">
            <div>
              <span>Contract</span>
              <strong
                title={
                  CONTRACT_ADDRESS
                }
              >
                0x6659...f791
              </strong>
            </div>
          </div>

          <div className="verifiedSettlement">
            <span>
              Circle test wallet
            </span>
            <strong
              title={CIRCLE_WALLET}
            >
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
