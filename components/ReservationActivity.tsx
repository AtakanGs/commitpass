import {
  getVerifiedScenario,
  type VerifiedActivity,
} from "@/lib/verifiedScenarios";

const ARCSCAN_TX = "https://testnet.arcscan.app/tx/";

type ReservationActivityProps = {
  reservationId: string;
  status: string;
  outcome: string;
  providerConfirmed: boolean;
  customerConfirmed: boolean;
  claimOpened: boolean;
  pendingOutcome: string;
};

function currentStateActivity(
  props: ReservationActivityProps,
): VerifiedActivity[] {
  const activities: VerifiedActivity[] = [
    {
      label: "Reservation exists on Arc",
      description:
        "The contract returned the current state for reservation #" +
        props.reservationId +
        ".",
    },
  ];

  if (props.providerConfirmed) {
    activities.push({
      label: "Provider attendance confirmed",
      description:
        "The provider check-in is recorded in contract state.",
    });
  }

  if (props.customerConfirmed) {
    activities.push({
      label: "Customer attendance confirmed",
      description:
        "The customer check-in is recorded in contract state.",
    });
  }

  if (props.claimOpened) {
    activities.push({
      label: "No-show claim recorded",
      description:
        props.pendingOutcome !== "None"
          ? "Pending outcome: " + props.pendingOutcome + "."
          : "A claim was opened before the final resolution.",
    });
  }

  activities.push({
    label: "Current onchain state",
    description:
      props.outcome !== "None"
        ? props.status + " / " + props.outcome
        : props.status,
  });

  return activities;
}

export function ReservationActivity(
  props: ReservationActivityProps,
) {
  const verified = getVerifiedScenario(
    Number(props.reservationId),
  );

  const activities =
    verified?.activities ??
    currentStateActivity(props);

  return (
    <section className="activityPanel">
      <div className="activityHeader">
        <div>
          <span>Onchain activity</span>
          <strong>
            {verified
              ? "Verified transaction timeline"
              : "Current contract-state timeline"}
          </strong>
        </div>

        <small>
          {verified
            ? "Arcscan linked"
            : "Read from Arc"}
        </small>
      </div>

      <ol className="activityList">
        {activities.map((activity, index) => (
          <li
            className="activityItem"
            key={activity.label + index}
          >
            <span className="activityMarker">
              {String(index + 1).padStart(2, "0")}
            </span>

            <div className="activityCopy">
              <strong>{activity.label}</strong>
              <p>{activity.description}</p>

              {activity.transactionHash ? (
                <a
                  href={
                    ARCSCAN_TX +
                    activity.transactionHash
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="activityNote">
        {verified
          ? "Transaction links are taken from the recorded Arc Testnet evidence."
          : "A verified transaction history will appear here after this scenario is added to the public evidence set."}
      </p>
    </section>
  );
}
