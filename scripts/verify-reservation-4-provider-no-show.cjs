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

const RESERVATION_ID = 4n;
const TITLE = "Provider no-show proof";
const SALT =
  "0x0ae8fa6ae635a7cdbbb24c2e952728655866866da9fd4c37ca6ef6b0b911f4e2";

const TRANSACTIONS = {
  creation:
    "0x795fa08b4dd1b046485bf254e7a346440ef0f2adb393f550fc16a48c0ae2b507",
  acceptance:
    "0xaef977e2805b6c7d8bbfbebdc2ffd51ab26abb8a433034ecc6f793171010d1c6",
  customerAttendance:
    "0xf791f4aeb72fc791f4ca146985a6b8045937c51ad1ab5530db35e8ac7cdaba42",
  claim:
    "0x58a607abf977745525db8fb8053fac45591b66642f896ca08dd9be9bfa1ded8b",
  final:
    "0x0b50671c05398e30243c7bea89de0954c646ffbe6478106492eded6bf3db69b8",
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
  console.log("CommitPass provider no-show verification");
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
    finalReceipt,
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
      hash: TRANSACTIONS.customerAttendance,
    }),
    client.getTransactionReceipt({
      hash: TRANSACTIONS.claim,
    }),
    client.getTransactionReceipt({
      hash: TRANSACTIONS.final,
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
    "Customer attendance transaction succeeded",
    attendanceReceipt.status === "success",
    TRANSACTIONS.customerAttendance,
  );
  check(
    "Provider no-show claim succeeded",
    claimReceipt.status === "success",
    TRANSACTIONS.claim,
  );
  check(
    "Final settlement transaction succeeded",
    finalReceipt.status === "success",
    TRANSACTIONS.final,
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
    "Final outcome is ProviderNoShow",
    Number(reservation.finalOutcome) === 3,
    String(reservation.finalOutcome),
  );
  check(
    "Provider attendance remains unconfirmed",
    reservation.providerConfirmed === false,
    String(reservation.providerConfirmed),
  );
  check(
    "Customer attendance is confirmed",
    reservation.customerConfirmed === true,
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

  for (const log of finalReceipt.logs) {
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

      if (
        sameAddress(decoded.args.from, CONTRACT)
      ) {
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
    "Customer received 4 USDC",
    customerTransfer === 4_000_000n,
    formatUnits(customerTransfer, 6) + " USDC",
  );
  check(
    "Provider received 3 USDC",
    providerTransfer === 3_000_000n,
    formatUnits(providerTransfer, 6) + " USDC",
  );
  check(
    "Contract USDC balance is zero",
    contractBalance === 0n,
    formatUnits(contractBalance, 6) + " USDC",
  );
  check(
    "Next reservation ID is at least 5",
    nextReservationId >= 5n,
    nextReservationId.toString(),
  );

  const failures = checks.filter(
    (entry) => !entry.condition,
  );

  console.log("");
  console.log(
    failures.length === 0
      ? "VERIFIED: Provider no-show flow is complete."
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
