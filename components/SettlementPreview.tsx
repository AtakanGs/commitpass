import {
  formatUnits,
  parseUnits,
} from "viem";

type Amount = bigint | string;

type SettlementPreviewProps = {
  commitmentAmount: Amount;
};

function toUnits(value: Amount) {
  if (typeof value === "bigint") {
    return value;
  }

  try {
    return value.trim()
      ? parseUnits(value, 6)
      : 0n;
  } catch {
    return 0n;
  }
}

function display(value: bigint) {
  return (
    formatUnits(
      value < 0n ? 0n : value,
      6,
    ) + " USDC"
  );
}

export function SettlementPreview({
  commitmentAmount,
}: SettlementPreviewProps) {
  const commitment =
    toUnits(commitmentAmount);

  const outcomes = [
    {
      label: "Both attend",
      description:
        "Each party receives its own commitment back.",
      provider: commitment,
      customer: commitment,
    },
    {
      label: "Customer no-show",
      description:
        "The provider receives both equal commitments.",
      provider: commitment * 2n,
      customer: 0n,
    },
    {
      label: "Provider no-show",
      description:
        "The customer receives both equal commitments.",
      provider: 0n,
      customer: commitment * 2n,
    },
  ];

  return (
    <section
      className="settlementPreview"
      aria-label="Settlement preview"
    >
      <div className="settlementHeader">
        <div>
          <span>Settlement preview</span>
          <strong>
            Symmetric outcomes before funds
            are locked.
          </strong>
        </div>
        <small>Programmed onchain</small>
      </div>

      <div className="settlementGrid">
        {outcomes.map((outcome) => (
          <article
            className="settlementCard"
            key={outcome.label}
          >
            <h4>{outcome.label}</h4>
            <p>{outcome.description}</p>

            <div>
              <span>Provider receives</span>
              <strong>
                {display(outcome.provider)}
              </strong>
            </div>

            <div>
              <span>Customer receives</span>
              <strong>
                {display(outcome.customer)}
              </strong>
            </div>
          </article>
        ))}
      </div>

      <p className="settlementFootnote">
        Early cancellation, stale-reservation
        refund and expired-dispute refund return
        each funded commitment to its original
        owner.
      </p>
    </section>
  );
}
