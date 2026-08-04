const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  registerEntitySecretCiphertext,
} = require("@circle-fin/developer-controlled-wallets");

const envPath = path.join(process.cwd(), ".env.local");

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

function appendEnvValue(filePath, key, value) {
  const current = fs.readFileSync(filePath, "utf8");
  const separator =
    current.length === 0 || current.endsWith("\n") ? "" : "\n";

  fs.appendFileSync(
    filePath,
    separator + key + "=" + value + "\n",
    "utf8",
  );
}

async function main() {
  const env = readEnvFile(envPath);
  const apiKey = env.CIRCLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CIRCLE_API_KEY is missing from .env.local.",
    );
  }

  let entitySecret = env.CIRCLE_ENTITY_SECRET;

  if (!entitySecret) {
    entitySecret = crypto.randomBytes(32).toString("hex");
    appendEnvValue(
      envPath,
      "CIRCLE_ENTITY_SECRET",
      entitySecret,
    );

    console.log(
      "A new entity secret was generated and stored in .env.local.",
    );
  } else {
    console.log(
      "The existing CIRCLE_ENTITY_SECRET in .env.local will be registered.",
    );
  }

  if (!/^[a-fA-F0-9]{64}$/.test(entitySecret)) {
    throw new Error(
      "CIRCLE_ENTITY_SECRET must be a 64-character hexadecimal value.",
    );
  }

  const homeDirectory =
    process.env.USERPROFILE ||
    process.env.HOME ||
    process.cwd();

  const recoveryDirectory = path.join(
    homeDirectory,
    "CommitPass-Circle-Recovery",
  );

  fs.mkdirSync(recoveryDirectory, {
    recursive: true,
  });

  const response = await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: recoveryDirectory,
  });

  if (!response.data?.recoveryFile) {
    throw new Error(
      "Circle did not return a recovery file.",
    );
  }

  console.log("");
  console.log("Circle entity secret registered successfully.");
  console.log(
    "Recovery directory: " + recoveryDirectory,
  );
  console.log(
    "Keep both .env.local and the recovery file private.",
  );
}

main().catch((error) => {
  console.error("");
  console.error("Circle entity secret setup failed:");
  console.error(
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
