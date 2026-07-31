export type VerifiedActivity = {
  label: string;
  description: string;
  transactionHash?: string;
};

export type VerifiedScenario = {
  reservationId: number;
  eyebrow: string;
  title: string;
  status: string;
  outcome: string;
  summary: string;
  settlement: string;
  verifiedAt: string;
  finalTransaction?: string;
  activities: VerifiedActivity[];
};

export const VERIFIED_SCENARIOS: VerifiedScenario[] = [
  {
    reservationId: 1,
    eyebrow: "EARLY CANCELLATION",
    title: "Both commitments returned",
    status: "Cancelled",
    outcome: "Refund both",
    summary:
      "The customer accepted, both commitments were locked and the reservation was cancelled inside the free-cancellation window.",
    settlement: "Provider 5 USDC | Customer 2 USDC",
    verifiedAt: "21 July 2026",
    activities: [
      {
        label: "Reservation created",
        description:
          "The provider locked a 5 USDC commitment.",
      },
      {
        label: "Customer accepted",
        description:
          "The customer locked a 2 USDC commitment.",
      },
      {
        label: "Cancelled in time",
        description:
          "The contract returned both commitments.",
      },
    ],
  },
  {
    reservationId: 3,
    eyebrow: "MUTUAL ATTENDANCE",
    title: "Both parties showed up",
    status: "Resolved",
    outcome: "Completed",
    summary:
      "Separate provider and customer wallets confirmed attendance during the check-in window and the contract settled automatically.",
    settlement: "Provider 5 USDC | Customer 2 USDC returned",
    verifiedAt: "22 July 2026",
    finalTransaction:
      "0x16d5c328c9216f7fc91f7759112d0a51d22f7659ff15232222c7fe88779cbeed",
    activities: [
      {
        label: "Reservation created",
        description:
          "The provider commitment was locked on Arc.",
        transactionHash:
          "0x6cf0876f9ea16dcf76cdf8e383b7d4949e0a0c58af719c9ab08a025e1c4fc833",
      },
      {
        label: "Customer accepted",
        description:
          "The customer commitment was locked.",
        transactionHash:
          "0x19f673a519f626301e000a816d3bcc8a381685fd0314ff145760adad4699a7f2",
      },
      {
        label: "Customer checked in",
        description:
          "The customer confirmed attendance.",
        transactionHash:
          "0x8cdcfacfc592333e116dd62cb7d31aaaad195b5b85db038d08c08f7c72a8f339",
      },
      {
        label: "Provider checked in",
        description:
          "The second confirmation triggered automatic settlement.",
        transactionHash:
          "0x16d5c328c9216f7fc91f7759112d0a51d22f7659ff15232222c7fe88779cbeed",
      },
    ],
  },
  {
    reservationId: 5,
    eyebrow: "CUSTOMER NO-SHOW",
    title: "Provider compensated",
    status: "Resolved",
    outcome: "Customer no-show",
    summary:
      "The provider opened a customer no-show claim. It was not disputed during the 12-hour window and became final.",
    settlement: "Provider 7 USDC | Customer 0 USDC",
    verifiedAt: "31 July 2026",
    finalTransaction:
      "0x110f399d820e5d672de9a4d28702cae2974c01266382d9b51ab855d74043a882",
    activities: [
      {
        label: "Reservation created",
        description:
          "The provider locked the performance bond.",
        transactionHash:
          "0x1f638b10757e0f36e991deef6719e592b7c500e8eb8c805d0d8433f0976262bc",
      },
      {
        label: "Customer accepted",
        description:
          "Both commitments became active.",
        transactionHash:
          "0x69e40f52074e6314688604774d891ff545aa531eda7514af7ab62cbb2438abc7",
      },
      {
        label: "No-show claim opened",
        description:
          "The provider claimed that the customer did not attend.",
        transactionHash:
          "0xcbab93c5a4b30b090d126436e029fb29d6fc5d0772c3b86084bcdd3cedf6360d",
      },
      {
        label: "Claim finalized",
        description:
          "The undisputed outcome paid 7 USDC to the provider.",
        transactionHash:
          "0x110f399d820e5d672de9a4d28702cae2974c01266382d9b51ab855d74043a882",
      },
    ],
  },
];

export function getVerifiedScenario(
  reservationId: number,
) {
  return VERIFIED_SCENARIOS.find(
    (scenario) =>
      scenario.reservationId === reservationId,
  );
}
