const fs = require("node:fs");
const path = require("node:path");

const EXPLORER_BASE =
  "https://testnet.arcscan.app";
const CONTRACT_ADDRESS =
  process.env.COMMITPASS_V3_CONTRACT_ADDRESS;

const SOURCE_NAME =
  "contracts/MutualCommitmentEscrowV3.sol";
const CONTRACT_NAME =
  "MutualCommitmentEscrowV3";
const QUALIFIED_NAME =
  SOURCE_NAME + ":" + CONTRACT_NAME;

const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000";
const ARBITER_ADDRESS =
  process.env.ARBITER_ADDRESS;

const ARTIFACT_PATH = path.join(
  process.cwd(),
  "artifacts",
  "contracts",
  "MutualCommitmentEscrowV3.sol",
  "MutualCommitmentEscrowV3.json",
);

function requireEnvironment() {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "COMMITPASS_V3_CONTRACT_ADDRESS is required.",
    );
  }

  if (!ARBITER_ADDRESS) {
    throw new Error(
      "ARBITER_ADDRESS is required.",
    );
  }
}

function normalizeHex(value) {
  return String(value || "")
    .replace(/^0x/i, "")
    .toLowerCase();
}

function encodeAddress(address) {
  const value = normalizeHex(address);

  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(
      "Invalid constructor address: " + address,
    );
  }

  return value.padStart(64, "0");
}

function constructorArguments() {
  return (
    encodeAddress(USDC_ADDRESS)
      + encodeAddress(ARBITER_ADDRESS)
  );
}

function normalizeCompilerVersion(value) {
  const match = String(value || "").match(
    /(\d+\.\d+\.\d+\+commit\.[0-9a-fA-F]+)/,
  );

  if (!match) {
    throw new Error(
      "Could not normalize compiler version: "
        + String(value),
    );
  }

  return "v" + match[1];
}

function getArtifact() {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new Error(
      "V3 artifact not found. Run npm run contracts:compile.",
    );
  }

  return JSON.parse(
    fs.readFileSync(ARTIFACT_PATH, "utf8"),
  );
}

function findMatchingBuildInfo() {
  const directory = path.join(
    process.cwd(),
    "artifacts",
    "build-info",
  );

  if (!fs.existsSync(directory)) {
    throw new Error(
      "artifacts/build-info not found. Compile first.",
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
        modified:
          fs.statSync(location).mtimeMs,
      };
    })
    .sort((a, b) => b.modified - a.modified);

  for (const candidate of candidates) {
    const buildInfo = JSON.parse(
      fs.readFileSync(
        candidate.location,
        "utf8",
      ),
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
      artifactRuntime
        && buildRuntime
        && artifactRuntime !== buildRuntime
    ) {
      continue;
    }

    return {
      buildInfo,
      compilerVersion:
        normalizeCompilerVersion(
          buildInfo.solcLongVersion
            || buildInfo.solcVersion,
        ),
      location: candidate.location,
    };
  }

  throw new Error(
    "No build-info file matches the V3 artifact.",
  );
}

async function parseJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Arcscan returned non-JSON HTTP "
        + response.status
        + ":\n"
        + text.slice(0, 2_000),
    );
  }
}

async function isVerified() {
  const response = await fetch(
    EXPLORER_BASE
      + "/api/v2/smart-contracts/"
      + CONTRACT_ADDRESS,
    {
      headers: {
        accept: "application/json",
      },
    },
  );

  if (response.status === 404) {
    return false;
  }

  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      "Arcscan verification check failed:\n"
        + JSON.stringify(body, null, 2),
    );
  }

  return Boolean(
    body.is_fully_verified
      || body.is_verified,
  );
}

async function getVerificationStatus(guid) {
  const url = new URL(
    EXPLORER_BASE + "/api",
  );

  url.searchParams.set("module", "contract");
  url.searchParams.set(
    "action",
    "checkverifystatus",
  );
  url.searchParams.set("guid", guid);

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });

  return parseJson(response);
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
  form.append(
    "contractaddress",
    CONTRACT_ADDRESS,
  );
  form.append(
    "contractname",
    QUALIFIED_NAME,
  );
  form.append(
    "compilerversion",
    compilerVersion,
  );
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
  console.log(
    "Contract identifier:",
    QUALIFIED_NAME,
  );
  console.log("Compiler:", compilerVersion);
  console.log(
    "Build info:",
    path.relative(
      process.cwd(),
      location,
    ),
  );

  const response = await fetch(
    EXPLORER_BASE + "/api",
    {
      method: "POST",
      body: form,
      headers: {
        accept: "application/json",
      },
    },
  );

  const body = await parseJson(response);

  if (
    !response.ok
      || String(body.status) !== "1"
      || !body.result
  ) {
    throw new Error(
      "Arcscan rejected verification:\n"
        + JSON.stringify(body, null, 2),
    );
  }

  return String(body.result);
}

async function poll(guid) {
  console.log("Verification GUID:", guid);

  for (
    let attempt = 1;
    attempt <= 36;
    attempt += 1
  ) {
    const body =
      await getVerificationStatus(guid);
    const result =
      String(body.result || "");
    const normalized =
      result.toLowerCase();

    console.log(
      "Status " + attempt + "/36:",
      result || JSON.stringify(body),
    );

    if (
      normalized.includes("pending")
        || normalized.includes("queue")
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, 5_000),
      );
      continue;
    }

    if (
      String(body.status) === "1"
        && (
          normalized.includes("pass")
            || normalized.includes("verified")
            || normalized.includes("already")
        )
    ) {
      return;
    }

    throw new Error(
      "Arcscan verification failed:\n"
        + JSON.stringify(body, null, 2),
    );
  }

  throw new Error(
    "Arcscan did not finish within three minutes.",
  );
}

async function main() {
  requireEnvironment();

  if (await isVerified()) {
    console.log(
      "Source verification: already verified",
    );
    return;
  }

  const guid = await submit();
  await poll(guid);

  if (!(await isVerified())) {
    throw new Error(
      "Verification succeeded but is not visible yet.",
    );
  }

  console.log("");
  console.log("Source verification: verified");
  console.log(
    EXPLORER_BASE
      + "/address/"
      + CONTRACT_ADDRESS
      + "?tab=contract",
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "Arcscan V3 verification stopped.",
  );
  console.error(error.message);
  process.exitCode = 1;
});
