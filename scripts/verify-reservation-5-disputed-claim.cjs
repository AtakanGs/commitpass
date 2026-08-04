const fs = require("node:fs");
const path = require("node:path");
const {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  getAddress,
  http,
  keccak256,
  parseAbi,
  stringToHex,
} = require("viem");

const RPC_URL =
  process.env.ARC_RPC_URL ||
  "https://rpc.drpc.testnet.arc.network";

const CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
};

const CONTRACT = getAddress(
  "0x8b28Ee06fD5d59d8886474733d7D3B58cDB33A5D",
);
const USDC = getAddress(
  "0x3600000000000000000000000000000000000000",
);
const PROVIDER = getAddress(
  "0x329c253928e0727f31c7FfbdC83b143E55c36841",
);
const CUSTOMER = getAddress(
  "0x9e0c85CbF38CE6394192F10B3Aff6A4d8dE25E96",
);
const ARBITER = getAddress(
  "0x31B7Be1e0d05BA7866f03a4Dc6244e34D9191e29",
);

const RESERVATION_ID = 5n;
const TITLE = "Disputed claim proof";
const SALT =
  "0xb17be86f112c764dc0081ebd1848c3d520a06781f4c463307cff98d36f62226f";

const TRANSACTIONS = {
  creation:
    "0x621795a6e0e23913dcac65635dcd883b42b7a180d52c3e61ec3b73c2e7e67a80",
  acceptance:
    "0xa33fcaa3d6b3fff174d81060c4c7b160ac115b985d0f74bfe89dd1049d5ad57d",
  providerAttendance:
    "0x06554432a2b6d650f73ff2944d3e6c86af3615ac087a096195bb847dbd254dbb",
  claim:
    "0x45b0c63c1f81f85294a0b8cd2d99d45651d98537850bfc1b9061b0f985946f97",
  dispute:
    "0xa0b8316063984ec1985e12f77d2abcee080a235b6240668622c35ef4c7b73583",
  resolution:
    "0x62d69165128f9ad4e9ff5a114c53b03d7f4098fccf20fe3059a20e6a35622723",
};

const artifactPath = path.join(
  process.cwd(),
  "artifacts",
  "contracts",
  "MutualCommitmentEscrow.sol",
  "MutualCommitmentEscrow.json",
);

if (!fs.existsSync(artifactPath)) {
  throw new Error(
    "Contract artifact was not found. Run this script from the CommitPass repository root after npm run contracts:compile.",
  );
}

const artifact = JSON.parse(
  fs.readFileSync(artifactPath, "utf8"),
);

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const client = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

const checks = [];

function check(label, condition, detail) {
  checks.push({ label, condition, detail });
  console.log(
    `${condition ? "PASS" : "FAIL"}  ${label}` +
      (detail ? ` — ${detail}` : ""),
  );
}

function sameAddress(first, second) {
  return (
    getAddress(first).toLowerCase() ===
    getAddress(second).toLowerCase()
  );
}

async function main() {
  console.log("CommitPass disputed claim verification");
  console.log("Reservation:", RESERVATION_ID.toString());
  console.log("Contract:", CONTRACT);
  console.log("");

  const [
    reservation,
    nextReservationId,
    contractBalance,
    creationReceipt,
    acceptanceReceipt,
    attendanceReceipt,
    claimReceipt,
    disputeReceipt,
    resolutionReceipt,
  ] = await Promise.all([
    client.readContract({
      address: CONTRACT,
      abi: artifact.abi,
      functionName: "getReservation",
      args: [RESERVATION_ID],
    }),
    client.readContract({
      address: CONTRACT,
      abi: artifact.abi,
      functionName: "nextReservationId",
    }),
    client.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [CONTRACT],
    }),
    client.getTransactionReceipt({
      hash: TRANSACTIONS.creation,
    }),
    client.getTransactionReceipt({
      hash: TRANSACTIONS.acceptance,
    }),
    client.getTransactionReceipt({
      hash: TRANSACTIONS.providerAttendance,
    }),
    client.getTransactionReceipt({
      hash: TRANSACTIONS.claim,
    }),
    client.getTransactionReceipt({
      hash: TRANSACTIONS.dispute,
    }),
    client.getTransactionReceipt({
      hash: TRANSACTIONS.resolution,
    }),
  ]);

  check(
    "Creation transaction succeeded",
    creationReceipt.status === "success",
    TRANSACTIONS.creation,
  );
  check(
    "Acceptance transaction succeeded",
    acceptanceReceipt.status === "success",
    TRANSACTIONS.acceptance,
  );
  check(
    "Provider attendance transaction succeeded",
    attendanceReceipt.status === "success",
    TRANSACTIONS.providerAttendance,
  );
  check(
    "Customer no-show claim succeeded",
    claimReceipt.status === "success",
    TRANSACTIONS.claim,
  );
  check(
    "Customer dispute transaction succeeded",
    disputeReceipt.status === "success",
    TRANSACTIONS.dispute,
  );
  check(
    "Arbiter resolution transaction succeeded",
    resolutionReceipt.status === "success",
    TRANSACTIONS.resolution,
  );

  check(
    "Creation transaction came from the provider",
    sameAddress(creationReceipt.from, PROVIDER),
    creationReceipt.from,
  );
  check(
    "Acceptance transaction came from the customer",
    sameAddress(acceptanceReceipt.from, CUSTOMER),
    acceptanceReceipt.from,
  );
  check(
    "Attendance transaction came from the provider",
    sameAddress(attendanceReceipt.from, PROVIDER),
    attendanceReceipt.from,
  );
  check(
    "Claim transaction came from the provider",
    sameAddress(claimReceipt.from, PROVIDER),
    claimReceipt.from,
  );
  check(
    "Dispute transaction came from the customer",
    sameAddress(disputeReceipt.from, CUSTOMER),
    disputeReceipt.from,
  );
  check(
    "Resolution transaction came from the arbiter",
    sameAddress(resolutionReceipt.from, ARBITER),
    resolutionReceipt.from,
  );

  check(
    "Provider address matches",
    sameAddress(reservation.provider, PROVIDER),
    reservation.provider,
  );
  check(
    "Customer address matches",
    sameAddress(reservation.customer, CUSTOMER),
    reservation.customer,
  );
  check(
    "Reservation status is Resolved",
    Number(reservation.status) === 5,
    String(reservation.status),
  );
  check(
    "Final outcome is RefundBoth",
    Number(reservation.finalOutcome) === 4,
    String(reservation.finalOutcome),
  );
  check(
    "Pending outcome was cleared",
    Number(reservation.pendingOutcome) === 0,
    String(reservation.pendingOutcome),
  );
  check(
    "Provider attendance is confirmed",
    reservation.providerConfirmed === true,
    String(reservation.providerConfirmed),
  );
  check(
    "Customer attendance remains unconfirmed",
    reservation.customerConfirmed === false,
    String(reservation.customerConfirmed),
  );

  const expectedMetadataHash = keccak256(
    stringToHex(
      SALT.toLowerCase() + ":" + TITLE.trim(),
    ),
  );

  check(
    "Salted metadata hash matches",
    reservation.metadataHash.toLowerCase() ===
      expectedMetadataHash.toLowerCase(),
    reservation.metadataHash,
  );

  const transfers = [];

  for (const log of resolutionReceipt.logs) {
    if (!sameAddress(log.address, USDC)) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        eventName: "Transfer",
        data: log.data,
        topics: log.topics,
      });

      if (sameAddress(decoded.args.from, CONTRACT)) {
        transfers.push({
          to: getAddress(decoded.args.to),
          value: decoded.args.value,
        });
      }
    } catch {
      // Ignore unrelated USDC logs.
    }
  }

  const providerTransfer = transfers
    .filter((entry) =>
      sameAddress(entry.to, PROVIDER),
    )
    .reduce((sum, entry) => sum + entry.value, 0n);

  const customerTransfer = transfers
    .filter((entry) =>
      sameAddress(entry.to, CUSTOMER),
    )
    .reduce((sum, entry) => sum + entry.value, 0n);

  check(
    "Provider received 5 USDC",
    providerTransfer === 5_000_000n,
    formatUnits(providerTransfer, 6) + " USDC",
  );
  check(
    "Customer received 2 USDC",
    customerTransfer === 2_000_000n,
    formatUnits(customerTransfer, 6) + " USDC",
  );
  check(
    "Contract USDC balance is zero",
    contractBalance === 0n,
    formatUnits(contractBalance, 6) + " USDC",
  );
  check(
    "Next reservation ID is at least 6",
    nextReservationId >= 6n,
    nextReservationId.toString(),
  );

  const failures = checks.filter(
    (entry) => !entry.condition,
  );

  console.log("");
  console.log(
    failures.length === 0
      ? "VERIFIED: Disputed claim and arbiter resolution flow is complete."
      : `FAILED: ${failures.length} verification check(s) did not pass.`,
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("");
  console.error("Verification failed:");
  console.error(error);
  process.exitCode = 1;
});
