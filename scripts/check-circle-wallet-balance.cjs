const fs = require("node:fs");
const path = require("node:path");
const {
  initiateDeveloperControlledWalletsClient,
} = require("@circle-fin/developer-controlled-wallets");

const envPath = path.join(process.cwd(), ".env.local");
const deploymentPath = path.join(
  process.cwd(),
  "deployments",
  "circle-arc-testnet.json",
);

const ARC_USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(".env.local was not found.");
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

function readDeployment(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      "deployments/circle-arc-testnet.json was not found.",
    );
  }

  const deployment = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  );

  if (!deployment.walletId || !deployment.address) {
    throw new Error(
      "Circle deployment record is missing walletId or address.",
    );
  }

  return deployment;
}

async function main() {
  const env = readEnvFile(envPath);
  const deployment = readDeployment(deploymentPath);

  if (!env.CIRCLE_API_KEY || !env.CIRCLE_ENTITY_SECRET) {
    throw new Error(
      "Circle credentials are missing from .env.local.",
    );
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: env.CIRCLE_API_KEY,
    entitySecret: env.CIRCLE_ENTITY_SECRET,
  });

  const response = await client.getWalletTokenBalance({
    id: deployment.walletId,
  });

  const balances = response.data?.tokenBalances ?? [];

  console.log("");
  console.log("Circle wallet balance check");
  console.log("---------------------------");
  console.log("Wallet ID:", deployment.walletId);
  console.log("Address:", deployment.address);
  console.log("Network:", deployment.network);

  if (balances.length === 0) {
    console.log("");
    console.log(
      "No token balance is visible yet. Faucet indexing may still be pending.",
    );
    process.exitCode = 2;
    return;
  }

  console.log("");

  for (const balance of balances) {
    const token = balance.token ?? {};
    console.log(
      `${token.symbol ?? "UNKNOWN"}: ${balance.amount ?? "0"}`,
    );
    console.log(
      `  Token address: ${token.tokenAddress ?? "native"}`,
    );
    console.log(`  Token ID: ${token.id ?? "unknown"}`);
  }

  const usdcBalance = balances.find((balance) => {
    const address =
      balance.token?.tokenAddress?.toLowerCase();

    return address === ARC_USDC_ADDRESS.toLowerCase();
  });

  if (!usdcBalance) {
    console.log("");
    console.log(
      "Arc Testnet USDC was not found in the Circle balance response.",
    );
    process.exitCode = 3;
    return;
  }

  const amount = Number(usdcBalance.amount ?? "0");

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "Arc Testnet USDC balance is not greater than zero.",
    );
  }

  const updatedDeployment = {
    ...deployment,
    usdc: {
      tokenId: usdcBalance.token?.id ?? null,
      tokenAddress: ARC_USDC_ADDRESS,
      symbol: usdcBalance.token?.symbol ?? "USDC",
      decimals: usdcBalance.token?.decimals ?? 6,
      lastObservedBalance: usdcBalance.amount,
      checkedAt: new Date().toISOString(),
    },
  };

  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(updatedDeployment, null, 2) + "\n",
    "utf8",
  );

  console.log("");
  console.log("VERIFIED: Circle wallet has Arc Testnet USDC.");
  console.log(
    "The non-secret deployment record was updated with the Circle token ID.",
  );
}

main().catch((error) => {
  console.error("");
  console.error("Circle wallet balance check failed:");

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
