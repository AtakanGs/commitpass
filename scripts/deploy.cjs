const hre = require("hardhat");

async function main() {
  const USDC_ADDRESS =
    "0x3600000000000000000000000000000000000000";

  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error(
      "No deployer account is configured.",
    );
  }

  const arbiterValue =
    process.env.ARBITER_ADDRESS;

  if (!arbiterValue) {
    throw new Error(
      "ARBITER_ADDRESS must be configured for the final deployment.",
    );
  }

  const arbiter =
    hre.ethers.getAddress(arbiterValue);

  if (
    arbiter.toLowerCase() ===
    deployer.address.toLowerCase()
  ) {
    throw new Error(
      "Arbiter must differ from deployer.",
    );
  }

  const network =
    await hre.ethers.provider.getNetwork();

  if (network.chainId !== 5042002n) {
    throw new Error(
      "Wrong network. Expected Arc Testnet.",
    );
  }

  console.log("");
  console.log("Deploying CommitPass v2");
  console.log("-----------------------");
  console.log("Chain ID:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("USDC:", USDC_ADDRESS);
  console.log("Arbiter:", arbiter);

  const Escrow =
    await hre.ethers.getContractFactory(
      "MutualCommitmentEscrow",
    );

  const escrow = await Escrow.deploy(
    USDC_ADDRESS,
    arbiter,
  );

  const deploymentTransaction =
    escrow.deploymentTransaction();

  if (!deploymentTransaction) {
    throw new Error(
      "Deployment transaction was not created.",
    );
  }

  console.log(
    "Deployment transaction:",
    deploymentTransaction.hash,
  );

  await escrow.waitForDeployment();

  const contractAddress =
    await escrow.getAddress();

  const deployedUsdc =
    await escrow.usdc();

  const deployedArbiter =
    await escrow.arbiter();

  const nextReservationId =
    await escrow.nextReservationId();

  const code =
    await hre.ethers.provider.getCode(
      contractAddress,
    );

  if (code === "0x") {
    throw new Error(
      "No contract bytecode found after deployment.",
    );
  }

  if (
    deployedUsdc.toLowerCase() !==
    USDC_ADDRESS.toLowerCase()
  ) {
    throw new Error(
      "Deployed USDC address does not match.",
    );
  }

  if (
    deployedArbiter.toLowerCase() !==
    arbiter.toLowerCase()
  ) {
    throw new Error(
      "Deployed arbiter address does not match.",
    );
  }

  if (nextReservationId !== 1n) {
    throw new Error(
      "Unexpected initial reservation ID.",
    );
  }

  console.log("-----------------------");
  console.log(
    "MutualCommitmentEscrow v2:",
    contractAddress,
  );
  console.log("Verified USDC:", deployedUsdc);
  console.log("Verified arbiter:", deployedArbiter);
  console.log(
    "Next reservation ID:",
    nextReservationId.toString(),
  );
  console.log("Contract bytecode: FOUND");
  console.log("Deployment verified.");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
