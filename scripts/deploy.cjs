const hre = require("hardhat");

async function main() {
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
  const [deployer] = await hre.ethers.getSigners();
  const arbiter = process.env.ARBITER_ADDRESS || deployer.address;

  console.log("Deploying CommitPass contracts from:", deployer.address);
  console.log("USDC interface:", USDC_ADDRESS);
  console.log("Arbiter:", arbiter);

  const Escrow = await hre.ethers.getContractFactory("MutualCommitmentEscrow");
  const escrow = await Escrow.deploy(USDC_ADDRESS, arbiter);
  await escrow.waitForDeployment();

  console.log("MutualCommitmentEscrow deployed to:", await escrow.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
