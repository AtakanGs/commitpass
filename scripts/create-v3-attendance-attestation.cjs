const fs = require("node:fs");
const path = require("node:path");
const {
  Wallet,
  getAddress,
  isAddress,
  verifyTypedData,
} = require("ethers");

function loadEnvFile(filename = ".env") {
  const location = path.join(process.cwd(), filename);

  if (!fs.existsSync(location)) {
    return;
  }

  for (
    const rawLine of fs
      .readFileSync(location, "utf8")
      .split(/\r?\n/)
  ) {
    const line = rawLine.trim();

    if (
      !line
        || line.startsWith("#")
        || !line.includes("=")
    ) {
      continue;
    }

    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireValue(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(name + " is required.");
  }

  return value;
}

function parseUint(name, value, max) {
  if (!/^\d+$/.test(value)) {
    throw new Error(name + " must be an unsigned integer.");
  }

  const parsed = BigInt(value);

  if (parsed > max) {
    throw new Error(name + " exceeds its Solidity type.");
  }

  return parsed;
}

async function main() {
  loadEnvFile();

  const privateKey =
    requireValue("PLATFORM_ATTESTOR_PRIVATE_KEY");
  const contractAddress =
    requireValue("COMMITPASS_V3_CONTRACT_ADDRESS");
  const participant =
    requireValue("ATTESTATION_PARTICIPANT");
  const reservationId = parseUint(
    "ATTESTATION_RESERVATION_ID",
    requireValue("ATTESTATION_RESERVATION_ID"),
    (1n << 256n) - 1n,
  );
  const validUntil = parseUint(
    "ATTESTATION_VALID_UNTIL",
    requireValue("ATTESTATION_VALID_UNTIL"),
    (1n << 64n) - 1n,
  );

  if (
    !/^0x[0-9a-fA-F]{64}$/.test(privateKey)
  ) {
    throw new Error(
      "PLATFORM_ATTESTOR_PRIVATE_KEY must be a 32-byte hex private key.",
    );
  }

  if (!isAddress(contractAddress)) {
    throw new Error(
      "COMMITPASS_V3_CONTRACT_ADDRESS is invalid.",
    );
  }

  if (!isAddress(participant)) {
    throw new Error(
      "ATTESTATION_PARTICIPANT is invalid.",
    );
  }

  const now = BigInt(
    Math.floor(Date.now() / 1000),
  );

  if (validUntil <= now) {
    throw new Error(
      "ATTESTATION_VALID_UNTIL must be in the future.",
    );
  }

  const wallet = new Wallet(privateKey);

  const domain = {
    name: "CommitPass",
    version: "3",
    chainId: 5042002n,
    verifyingContract:
      getAddress(contractAddress),
  };

  const types = {
    AttendanceAttestation: [
      {
        name: "reservationId",
        type: "uint256",
      },
      {
        name: "participant",
        type: "address",
      },
      {
        name: "validUntil",
        type: "uint64",
      },
    ],
  };

  const value = {
    reservationId,
    participant: getAddress(participant),
    validUntil,
  };

  const signature =
    await wallet.signTypedData(
      domain,
      types,
      value,
    );

  const recovered = verifyTypedData(
    domain,
    types,
    value,
    signature,
  );

  if (
    recovered.toLowerCase()
      !== wallet.address.toLowerCase()
  ) {
    throw new Error(
      "Local signature verification failed.",
    );
  }

  const output = {
    network: "arc-testnet",
    chainId: domain.chainId.toString(),
    contractAddress:
      domain.verifyingContract,
    attestor: wallet.address,
    reservationId:
      reservationId.toString(),
    participant: value.participant,
    validUntil: validUntil.toString(),
    signature,
  };

  console.log(
    JSON.stringify(output, null, 2),
  );
}

main().catch((error) => {
  console.error(
    "Attendance attestation creation failed:",
    error.message,
  );
  process.exitCode = 1;
});
