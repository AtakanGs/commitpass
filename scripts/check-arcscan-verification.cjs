const CONTRACT =
  process.env.NEXT_PUBLIC_COMMITPASS_CONTRACT_ADDRESS ||
  "0x8b28Ee06fD5d59d8886474733d7D3B58cDB33A5D";

const ENDPOINT =
  "https://testnet.arcscan.app/api/v2/smart-contracts/" +
  CONTRACT;

async function main() {
  const response = await fetch(ENDPOINT, {
    headers: { accept: "application/json" },
  });

  if (response.status === 404) {
    console.error(
      "Arcscan does not report verified source code for " +
        CONTRACT +
        ".",
    );
    process.exitCode = 2;
    return;
  }

  if (!response.ok) {
    throw new Error(
      "Arcscan request failed with HTTP " +
        response.status +
        ".",
    );
  }

  const result = await response.json();
  const verified = Boolean(
    result.is_fully_verified || result.is_verified,
  );

  console.log("Contract:", CONTRACT);
  console.log(
    "Source verification:",
    verified ? "verified" : "not verified",
  );
  console.log(
    "Contract name:",
    result.name || "not reported",
  );
  console.log(
    "Compiler:",
    result.compiler_version || "not reported",
  );

  if (!verified) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(
    "Arcscan verification check failed:",
    error.message,
  );
  process.exitCode = 1;
});
