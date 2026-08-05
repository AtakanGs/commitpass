export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const commitmentEscrowAbi = [
  { type: "error", name: "Unauthorized", inputs: [] },
  { type: "error", name: "InvalidAddress", inputs: [] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvalidSchedule", inputs: [] },
  { type: "error", name: "InvalidState", inputs: [] },
  { type: "error", name: "TooEarly", inputs: [] },
  { type: "error", name: "TooLate", inputs: [] },
  { type: "error", name: "InvalidOutcome", inputs: [] },
  { type: "error", name: "InvalidEvidence", inputs: [] },
  {
    type: "error",
    name: "AttendanceNotConfirmed",
    inputs: [],
  },
  {
    type: "error",
    name: "PlatformAttestationRequired",
    inputs: [],
  },
  {
    type: "error",
    name: "PlatformAttestationNotEnabled",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidAttestationSignature",
    inputs: [],
  },
  {
    type: "error",
    name: "AttestationExpired",
    inputs: [],
  },
  {
    type: "event",
    name: "ReservationCreated",
    inputs: [
      {
        name: "reservationId",
        type: "uint256",
        indexed: true,
      },
      {
        name: "provider",
        type: "address",
        indexed: true,
      },
      {
        name: "customer",
        type: "address",
        indexed: true,
      },
      {
        name: "attendanceAttestor",
        type: "address",
        indexed: false,
      },
      {
        name: "commitmentAmount",
        type: "uint256",
        indexed: false,
      },
      {
        name: "metadataHash",
        type: "bytes32",
        indexed: false,
      },
    ],
  },
  {
    type: "function",
    name: "createReservation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "customer", type: "address" },
      { name: "attendanceAttestor", type: "address" },
      { name: "commitmentAmount", type: "uint128" },
      { name: "startTime", type: "uint64" },
      {
        name: "freeCancellationDeadline",
        type: "uint64",
      },
      { name: "gracePeriod", type: "uint64" },
      { name: "claimWindow", type: "uint64" },
      { name: "disputeWindow", type: "uint64" },
      { name: "arbiterWindow", type: "uint64" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [
      { name: "reservationId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "acceptReservation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelReservation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "expireUnacceptedReservation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmAttendance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmAttendanceWithAttestation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
      { name: "participant", type: "address" },
      { name: "validUntil", type: "uint64" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "openNoShowClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
      { name: "outcome", type: "uint8" },
      { name: "evidenceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "disputeClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
      { name: "evidenceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "finalizeUndisputedClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refundStaleReservation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refundExpiredDispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveDispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "uint256" },
      { name: "outcome", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "arbiter",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "", type: "address" },
    ],
  },
  {
    type: "function",
    name: "getReservation",
    stateMutability: "view",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "provider", type: "address" },
          { name: "customer", type: "address" },
          {
            name: "attendanceAttestor",
            type: "address",
          },
          {
            name: "commitmentAmount",
            type: "uint128",
          },
          { name: "startTime", type: "uint64" },
          {
            name: "freeCancellationDeadline",
            type: "uint64",
          },
          { name: "gracePeriod", type: "uint64" },
          { name: "claimWindow", type: "uint64" },
          {
            name: "disputeWindow",
            type: "uint64",
          },
          {
            name: "arbiterWindow",
            type: "uint64",
          },
          {
            name: "claimOpenedAt",
            type: "uint64",
          },
          { name: "disputedAt", type: "uint64" },
          { name: "status", type: "uint8" },
          {
            name: "pendingOutcome",
            type: "uint8",
          },
          { name: "finalOutcome", type: "uint8" },
          {
            name: "providerConfirmed",
            type: "bool",
          },
          {
            name: "customerConfirmed",
            type: "bool",
          },
          { name: "metadataHash", type: "bytes32" },
          {
            name: "claimEvidenceHash",
            type: "bytes32",
          },
          {
            name: "disputeEvidenceHash",
            type: "bytes32",
          },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "attendanceOpeningTime",
    stateMutability: "view",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [
      { name: "", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "attendanceDeadline",
    stateMutability: "view",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [
      { name: "", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "claimOpeningDeadline",
    stateMutability: "view",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [
      { name: "", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "disputeDeadline",
    stateMutability: "view",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [
      { name: "", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "arbiterDeadline",
    stateMutability: "view",
    inputs: [
      { name: "reservationId", type: "uint256" },
    ],
    outputs: [
      { name: "", type: "uint256" },
    ],
  },
] as const;
