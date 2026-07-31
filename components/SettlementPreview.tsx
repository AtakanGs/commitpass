import { formatUnits, parseUnits } from "viem";

type Amount = bigint | string;

type SettlementPreviewProps = {
  providerCommitment: Amount;
  customerCommitment: Amount;
  providerCompensation: Amount;
};

function toUnits(value: Amount) {
  if (typeof value === "bigint") {
    return value;
  }

  try {
    return value.trim() ? parseUnits(value, 6) : 0n;
  } catch {
    return 0n;
  }
}

function display(value: bigint) {
  return formatUnits(value < 0n ? 0n : value, 6) + " USDC";
}

export function SettlementPreview({
  providerCommitment,
  customerCommitment,
  providerCompensation,
}: SettlementPreviewProps) {
  const providerBond = toUnits(providerCommitment);
  const customerBond = toUnits(customerCommitment);
  const compensation = toUnits(providerCompensation);

  const providerAfterNoShow =
    providerBond > compensation
      ? providerBond - compensation
      : 0n;

  const outcomes = [
    {
      label: "Both attend",
      description: "Both refundable commitments return.",
      provider: providerBond,
      customer: customerBond,
    },
    {
      label: "Customer no-show",
      description: "The provider receives both commitments.",
      provider: providerBond + customerBond,
      customer: 0n,
    },
    {
      label: "Provider no-show",
      description:
        "The customer is refunded and compensated from the provider bond.",
      provider: providerAfterNoShow,
      customer: customerBond + compensation,
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
          <strong>Know every outcome before funds are locked.</strong>
        </div>
        <small>Programmed onchain</small>
      </div>

      <div className="settlementGrid">
        {outcomes.map((outcome) => (
          <article className="settlementCard" key={outcome.label}>
            <h4>{outcome.label}</h4>
            <p>{outcome.description}</p>

            <div>
              <span>Provider receives</span>
              <strong>{display(outcome.provider)}</strong>
            </div>

            <div>
              <span>Customer receives</span>
              <strong>{display(outcome.customer)}</strong>
            </div>
          </article>
        ))}
      </div>

      <p className="settlementFootnote">
        Early cancellation returns each funded commitment to its
        original owner.
      </p>
    </section>
  );
}
