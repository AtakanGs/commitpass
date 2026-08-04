const fs = require("node:fs");
const path = require("node:path");
const {
  initiateDeveloperControlledWalletsClient,
} = require("@circle-fin/developer-controlled-wallets");

const envPath = path.join(process.cwd(), ".env.local");
const outputPath = path.join(
  process.cwd(),
  "deployments",
  "circle-arc-testnet.json",
);

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      ".env.local was not found. Run this script from the CommitPass repository root.",
    );
  }

  const values = {};

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function assertCredentials(env) {
  if (!env.CIRCLE_API_KEY) {
    throw new Error("CIRCLE_API_KEY is missing from .env.local.");
  }

  if (!env.CIRCLE_ENTITY_SECRET) {
    throw new Error("CIRCLE_ENTITY_SECRET is missing from .env.local.");
  }

  if (!/^TEST_API_KEY:[^:\s]+:[^:\s]+$/.test(env.CIRCLE_API_KEY)) {
    throw new Error(
      "CIRCLE_API_KEY is not a complete Circle testnet API key.",
    );
  }

  if (!/^[a-fA-F0-9]{64}$/.test(env.CIRCLE_ENTITY_SECRET)) {
    throw new Error(
      "CIRCLE_ENTITY_SECRET must be a 64-character hexadecimal value.",
    );
  }
}

function refuseDuplicateCreation() {
  if (!fs.existsSync(outputPath)) {
    return;
  }

  const existing = JSON.parse(fs.readFileSync(outputPath, "utf8"));

  if (existing.walletId && existing.address) {
    console.log("A Circle wallet record already exists:");
    console.log("Wallet set ID:", existing.walletSetId);
    console.log("Wallet ID:", existing.walletId);
    console.log("Address:", existing.address);
    console.log("");
    console.log(
      "No new wallet was created. Delete the deployment record only if duplicate creation is intentional.",
    );
    process.exit(0);
  }
}

async function main() {
  const env = readEnvFile(envPath);
  assertCredentials(env);
  refuseDuplicateCreation();

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: env.CIRCLE_API_KEY,
    entitySecret: env.CIRCLE_ENTITY_SECRET,
  });

  console.log("Creating CommitPass wallet set...");

  const walletSetResponse = await client.createWalletSet({
    name: "CommitPass Arc Testnet",
  });

  const walletSet = walletSetResponse.data?.walletSet;

  if (!walletSet?.id) {
    throw new Error("Circle did not return a wallet set ID.");
  }

  console.log("Creating one EOA wallet on ARC-TESTNET...");

  const walletResponse = await client.createWallets({
    blockchains: ["ARC-TESTNET"],
    count: 1,
    walletSetId: walletSet.id,
    accountType: "EOA",
  });

  const wallet = walletResponse.data?.wallets?.[0];

  if (!wallet?.id || !wallet?.address) {
    throw new Error("Circle did not return a wallet ID and address.");
  }

  const deploymentRecord = {
    product: "Circle Developer-Controlled Wallets",
    network: "ARC-TESTNET",
    accountType: "EOA",
    walletSetId: walletSet.id,
    walletId: wallet.id,
    address: wallet.address,
    state: wallet.state ?? null,
    createdAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true,
  });

  fs.writeFileSync(
    outputPath,
    JSON.stringify(deploymentRecord, null, 2) + "\n",
    "utf8",
  );

  console.log("");
  console.log("Circle wallet created successfully.");
  console.log("Wallet set ID:", walletSet.id);
  console.log("Wallet ID:", wallet.id);
  console.log("Address:", wallet.address);
  console.log("State:", wallet.state ?? "unknown");
  console.log("");
  console.log(
    "Non-secret deployment record written to deployments/circle-arc-testnet.json",
  );
}

main().catch((error) => {
  console.error("");
  console.error("Circle wallet creation failed:");

  const details =
    error?.response?.data ??
    error?.cause?.response?.data ??
    error?.message ??
    error;

  console.error(
    typeof details === "string"
      ? details
      : JSON.stringify(details, null, 2),
  );

  process.exitCode = 1;
});
