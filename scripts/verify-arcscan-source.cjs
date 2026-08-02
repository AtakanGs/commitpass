const fs = require("node:fs");
const path = require("node:path");

const EXPLORER_BASE = "https://testnet.arcscan.app";
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_COMMITPASS_CONTRACT_ADDRESS ||
  "0x8b28Ee06fD5d59d8886474733d7D3B58cDB33A5D";

const SOURCE_NAME =
  "contracts/MutualCommitmentEscrow.sol";
const CONTRACT_NAME = "MutualCommitmentEscrow";
const QUALIFIED_NAME =
  SOURCE_NAME + ":" + CONTRACT_NAME;

const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000";
const ARBITER_ADDRESS =
  "0x31B7Be1e0d05BA7866f03a4Dc6244e34D9191e29";

const ARTIFACT_PATH = path.join(
  process.cwd(),
  "artifacts",
  "contracts",
  "MutualCommitmentEscrow.sol",
  "MutualCommitmentEscrow.json",
);

function normalizeHex(value) {
  return String(value || "")
    .replace(/^0x/i, "")
    .toLowerCase();
}

function encodeAddress(address) {
  const value = normalizeHex(address);

  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error("Invalid constructor address: " + address);
  }

  return value.padStart(64, "0");
}

function constructorArguments() {
  return (
    encodeAddress(USDC_ADDRESS) +
    encodeAddress(ARBITER_ADDRESS)
  );
}

function normalizeCompilerVersion(value) {
  const match = String(value || "").match(
    /(\d+\.\d+\.\d+\+commit\.[0-9a-fA-F]+)/,
  );

  if (!match) {
    throw new Error(
      "Could not normalize Solidity compiler version: " +
        String(value),
    );
  }

  return "v" + match[1];
}

function getArtifact() {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new Error(
      "Contract artifact was not found. Run npm run contracts:compile first.",
    );
  }

  return JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
}

function findMatchingBuildInfo() {
  const directory = path.join(
    process.cwd(),
    "artifacts",
    "build-info",
  );

  if (!fs.existsSync(directory)) {
    throw new Error(
      "artifacts/build-info was not found. Run npm run contracts:compile first.",
    );
  }

  const artifact = getArtifact();
  const artifactRuntime = normalizeHex(
    artifact.deployedBytecode,
  );

  const candidates = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const location = path.join(directory, name);
      return {
        location,
        modified: fs.statSync(location).mtimeMs,
      };
    })
    .sort((a, b) => b.modified - a.modified);

  for (const candidate of candidates) {
    const buildInfo = JSON.parse(
      fs.readFileSync(candidate.location, "utf8"),
    );

    const contract =
      buildInfo.output?.contracts?.[SOURCE_NAME]?.[
        CONTRACT_NAME
      ];

    if (!contract) {
      continue;
    }

    const buildRuntime = normalizeHex(
      contract.evm?.deployedBytecode?.object,
    );

    if (
      artifactRuntime &&
      buildRuntime &&
      artifactRuntime !== buildRuntime
    ) {
      continue;
    }

    const compilerVersion = normalizeCompilerVersion(
      buildInfo.solcLongVersion ||
        buildInfo.solcVersion,
    );

    return {
      buildInfo,
      compilerVersion,
      location: candidate.location,
    };
  }

  throw new Error(
    "No build-info file matches the current contract artifact.",
  );
}

async function parseJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Arcscan returned a non-JSON response (HTTP " +
        response.status +
        "):\n" +
        text.slice(0, 2_000),
    );
  }
}

async function getVerificationStatus(guid) {
  const url = new URL(EXPLORER_BASE + "/api");
  url.searchParams.set("module", "contract");
  url.searchParams.set(
    "action",
    "checkverifystatus",
  );
  url.searchParams.set("guid", guid);

  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });

  return parseJson(response);
}

async function isVerified() {
  const response = await fetch(
    EXPLORER_BASE +
      "/api/v2/smart-contracts/" +
      CONTRACT_ADDRESS,
    {
      headers: { accept: "application/json" },
    },
  );

  if (response.status === 404) {
    return false;
  }

  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      "Arcscan verification check failed with HTTP " +
        response.status +
        ":\n" +
        JSON.stringify(body, null, 2),
    );
  }

  return Boolean(
    body.is_fully_verified || body.is_verified,
  );
}

async function submit() {
  const {
    buildInfo,
    compilerVersion,
    location,
  } = findMatchingBuildInfo();

  const form = new FormData();
  form.append("module", "contract");
  form.append("action", "verifysourcecode");
  form.append(
    "codeformat",
    "solidity-standard-json-input",
  );
  form.append("contractaddress", CONTRACT_ADDRESS);
  form.append("contractname", QUALIFIED_NAME);
  form.append("compilerversion", compilerVersion);
  form.append(
    "sourceCode",
    JSON.stringify(buildInfo.input),
  );
  form.append(
    "constructorArguments",
    constructorArguments(),
  );
  form.append(
    "autodetectConstructorArguments",
    "false",
  );
  form.append("licenseType", "3");

  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("Contract identifier:", QUALIFIED_NAME);
  console.log("Compiler:", compilerVersion);
  console.log(
    "Build info:",
    path.relative(process.cwd(), location),
  );
  console.log(
    "Constructor arguments:",
    constructorArguments(),
  );
  console.log(
    "Submitting through the Arcscan verification API...",
  );

  const response = await fetch(
    EXPLORER_BASE + "/api",
    {
      method: "POST",
      body: form,
      headers: { accept: "application/json" },
    },
  );

  const body = await parseJson(response);

  if (
    !response.ok ||
    String(body.status) !== "1" ||
    !body.result
  ) {
    throw new Error(
      "Arcscan rejected the verification submission:\n" +
        JSON.stringify(body, null, 2),
    );
  }

  return String(body.result);
}

async function poll(guid) {
  console.log("Verification GUID:", guid);

  for (let attempt = 1; attempt <= 36; attempt += 1) {
    const body = await getVerificationStatus(guid);
    const result = String(body.result || "");
    const normalized = result.toLowerCase();

    console.log(
      "Status " + attempt + "/36:",
      result || JSON.stringify(body),
    );

    if (
      normalized.includes("pending") ||
      normalized.includes("queue")
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, 5_000),
      );
      continue;
    }

    if (
      String(body.status) === "1" &&
      (
        normalized.includes("pass") ||
        normalized.includes("verified") ||
        normalized.includes("already")
      )
    ) {
      return;
    }

    throw new Error(
      "Arcscan verification failed:\n" +
        JSON.stringify(body, null, 2),
    );
  }

  throw new Error(
    "Arcscan did not finish verification within three minutes.",
  );
}

async function main() {
  if (await isVerified()) {
    console.log("Contract:", CONTRACT_ADDRESS);
    console.log(
      "Source verification: already verified",
    );
    return;
  }

  const guid = await submit();
  await poll(guid);

  if (!(await isVerified())) {
    throw new Error(
      "Arcscan reported success, but the verified contract record is not visible yet.",
    );
  }

  console.log("");
  console.log("Source verification: verified");
  console.log(
    EXPLORER_BASE +
      "/address/" +
      CONTRACT_ADDRESS +
      "?tab=contract",
  );
}

main().catch((error) => {
  console.error("");
  console.error("Arcscan verification stopped.");
  console.error(error.message);
  process.exitCode = 1;
});
