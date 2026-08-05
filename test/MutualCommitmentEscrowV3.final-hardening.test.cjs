const { expect } = require("chai");
const { ethers } = require("hardhat");

async function latest() {
  return Number(
    (await ethers.provider.getBlock("latest")).timestamp,
  );
}

async function expectCustomError(promise, name) {
  let reverted = false;

  try {
    await promise;
  } catch (error) {
    reverted = String(error).includes(name);
  }

  expect(reverted).to.equal(
    true,
    "Expected custom error " + name,
  );
}

describe(
  "MutualCommitmentEscrowV3 final deployment safeguards",
  function () {
    it("rejects a token address without contract code", async function () {
      const [deployer, arbiter] =
        await ethers.getSigners();

      const Escrow = await ethers.getContractFactory(
        "MutualCommitmentEscrowV3",
      );

      await expectCustomError(
        Escrow.deploy(
          deployer.address,
          arbiter.address,
        ),
        "InvalidAddress",
      );
    });

    it("rejects an impossible check-in opening with InvalidSchedule", async function () {
      const [
        deployer,
        provider,
        customer,
        arbiter,
      ] = await ethers.getSigners();

      const MockUSDC =
        await ethers.getContractFactory("MockUSDC");
      const usdc = await MockUSDC.deploy();

      const Escrow = await ethers.getContractFactory(
        "MutualCommitmentEscrowV3",
      );
      const escrow = await Escrow.deploy(
        await usdc.getAddress(),
        arbiter.address,
      );

      const now = await latest();

      await expectCustomError(
        escrow
          .connect(provider)
          .createReservation(
            customer.address,
            ethers.ZeroAddress,
            5_000_000n,
            900,
            now + 3_600,
            900,
            3_600,
            3_600,
            7_200,
            ethers.id(
              "invalid-check-in-opening",
            ),
          ),
        "InvalidSchedule",
      );
    });
  },
);
