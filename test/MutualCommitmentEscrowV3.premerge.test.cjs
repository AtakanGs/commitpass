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
  "MutualCommitmentEscrowV3 pre-merge safeguards",
  function () {
    const COMMITMENT = 5_000_000n;
    const METADATA_HASH = ethers.id(
      "v3-premerge-metadata",
    );

    async function deployFixture() {
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

      await usdc.mint(provider.address, 100_000_000n);
      await usdc.mint(arbiter.address, 100_000_000n);

      await usdc
        .connect(provider)
        .approve(
          await escrow.getAddress(),
          ethers.MaxUint256,
        );
      await usdc
        .connect(arbiter)
        .approve(
          await escrow.getAddress(),
          ethers.MaxUint256,
        );

      return {
        deployer,
        provider,
        customer,
        arbiter,
        usdc,
        escrow,
      };
    }

    async function timing(overrides = {}) {
      const now = await latest();

      return {
        cancellationDeadline: now + 3_600,
        startTime: now + 7_200,
        gracePeriod: 900,
        claimWindow: 3_600,
        disputeWindow: 3_600,
        arbiterWindow: 7_200,
        ...overrides,
      };
    }

    async function create(
      ctx,
      signer,
      customerAddress,
      values,
    ) {
      return ctx.escrow
        .connect(signer)
        .createReservation(
          customerAddress,
          ethers.ZeroAddress,
          COMMITMENT,
          values.startTime,
          values.cancellationDeadline,
          values.gracePeriod,
          values.claimWindow,
          values.disputeWindow,
          values.arbiterWindow,
          METADATA_HASH,
        );
    }

    it("rejects the arbiter as reservation provider", async function () {
      const ctx = await deployFixture();
      const values = await timing();

      await expectCustomError(
        create(
          ctx,
          ctx.arbiter,
          ctx.customer.address,
          values,
        ),
        "InvalidAddress",
      );
    });

    it("rejects the arbiter as reservation customer", async function () {
      const ctx = await deployFixture();
      const values = await timing();

      await expectCustomError(
        create(
          ctx,
          ctx.provider,
          ctx.arbiter.address,
          values,
        ),
        "InvalidAddress",
      );
    });

    it("rejects cancellation and check-in windows that overlap", async function () {
      const ctx = await deployFixture();
      const now = await latest();
      const startTime = now + 7_200;
      const gracePeriod = 3_600;
      const cancellationDeadline =
        startTime - 1_800;

      const values = await timing({
        startTime,
        gracePeriod,
        cancellationDeadline,
      });

      await expectCustomError(
        create(
          ctx,
          ctx.provider,
          ctx.customer.address,
          values,
        ),
        "InvalidSchedule",
      );
    });

    it("accepts an exact fifteen-minute buffer before check-in opens", async function () {
      const ctx = await deployFixture();
      const now = await latest();
      const cancellationDeadline = now + 3_600;
      const gracePeriod = 900;
      const startTime =
        cancellationDeadline + gracePeriod + 900;

      const values = await timing({
        startTime,
        gracePeriod,
        cancellationDeadline,
      });

      await create(
        ctx,
        ctx.provider,
        ctx.customer.address,
        values,
      );

      expect(
        await ctx.escrow.attendanceOpeningTime(1),
      ).to.equal(
        BigInt(startTime - gracePeriod),
      );

      const reservation =
        await ctx.escrow.getReservation(1);

      expect(reservation.status).to.equal(1n);
    });
  },
);
