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
  {
    reservationId: 7,
    eyebrow: "PROVIDER NO-SHOW",
    title: "Customer protected",
    status: "Resolved",
    outcome: "Provider no-show",
    summary:
      "The customer confirmed attendance, the provider did not check in and the undisputed claim compensated the customer from the provider bond.",
    settlement: "Provider 3 USDC | Customer 4 USDC",
    verifiedAt: "2 August 2026",
    finalTransaction:
      "0xcafd717d69f7f03531b28b58a22782260557903529a774ae0d53e8adbc9da3ea",
    activities: [
      {
        label: "Reservation created",
        description:
          "The provider locked the 5 USDC performance bond.",
        transactionHash:
          "0xf7a45f6c39e96c7851b6a9ffad0cae93906863d3f6aab13eef274188f9ad175e",
      },
      {
        label: "Customer accepted",
        description:
          "The customer locked the 2 USDC commitment.",
        transactionHash:
          "0xd55ff5e10dd421fac0410bbb00a6a66fa14c21c8ef3a2e9e179798b8345868f1",
      },
      {
        label: "Customer checked in",
        description:
          "The customer confirmed attendance during the valid window.",
        transactionHash:
          "0xde8f715a1eb15217b927fac826fa7ba9d795f27c130786e850092fcaa0b15083",
      },
      {
        label: "Provider no-show claim opened",
        description:
          "The customer claimed that the provider did not attend.",
        transactionHash:
          "0xfadd86cca5f776d55a37632f50cf5f31f5f743a7ae8511c69d8c51247ba8f787",
      },
      {
        label: "Claim finalized",
        description:
          "The customer received 4 USDC and the provider received the remaining 3 USDC.",
        transactionHash:
          "0xcafd717d69f7f03531b28b58a22782260557903529a774ae0d53e8adbc9da3ea",
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
