const { expect } = require("chai");
const { ethers } = require("hardhat");

async function latest() {
  return Number((await ethers.provider.getBlock("latest")).timestamp);
}

async function increaseTo(timestamp) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
  await ethers.provider.send("evm_mine", []);
}

async function increase(seconds) {
  const now = await latest();
  await increaseTo(now + seconds);
}

describe("MutualCommitmentEscrow", function () {
  const PROVIDER_BOND = 5_000_000n;
  const CUSTOMER_BOND = 2_000_000n;
  const COMPENSATION = 2_000_000n;

  async function deployFixture() {
    const [deployer, provider, customer, arbiter, outsider] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const Escrow = await ethers.getContractFactory("MutualCommitmentEscrow");
    const escrow = await Escrow.deploy(await usdc.getAddress(), arbiter.address);

    await usdc.mint(provider.address, 100_000_000n);
    await usdc.mint(customer.address, 100_000_000n);
    await usdc.connect(provider).approve(await escrow.getAddress(), ethers.MaxUint256);
    await usdc.connect(customer).approve(await escrow.getAddress(), ethers.MaxUint256);

    return { deployer, provider, customer, arbiter, outsider, usdc, escrow };
  }

  async function createAndAccept(ctx) {
    const now = await latest();
    const cancellationDeadline = now + 3600;
    const startTime = now + 7200;
    const gracePeriod = 900;
    const disputeWindow = 1800;

    await ctx.escrow.connect(ctx.provider).createReservation(
      ctx.customer.address,
      PROVIDER_BOND,
      CUSTOMER_BOND,
      COMPENSATION,
      startTime,
      cancellationDeadline,
      gracePeriod,
      disputeWindow,
      ethers.id("mentor-session-001")
    );
    await ctx.escrow.connect(ctx.customer).acceptReservation(1);

    return { cancellationDeadline, startTime, gracePeriod, disputeWindow };
  }

  it("locks both commitments when a reservation is accepted", async function () {
    const ctx = await deployFixture();
    await createAndAccept(ctx);

    expect(await ctx.usdc.balanceOf(await ctx.escrow.getAddress())).to.equal(
      PROVIDER_BOND + CUSTOMER_BOND
    );
    const reservation = await ctx.escrow.getReservation(1);
    expect(reservation.status).to.equal(2n);
  });

  it("returns both commitments after mutual attendance confirmation", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);
    await increaseTo(timing.startTime - timing.gracePeriod);

    await ctx.escrow.connect(ctx.provider).confirmAttendance(1);
    await ctx.escrow.connect(ctx.customer).confirmAttendance(1);

    expect(await ctx.usdc.balanceOf(ctx.provider.address)).to.equal(100_000_000n);
    expect(await ctx.usdc.balanceOf(ctx.customer.address)).to.equal(100_000_000n);
  });

  it("refunds both parties on an early cancellation", async function () {
    const ctx = await deployFixture();
    await createAndAccept(ctx);

    await ctx.escrow.connect(ctx.customer).cancelReservation(1);

    expect(await ctx.usdc.balanceOf(ctx.provider.address)).to.equal(100_000_000n);
    expect(await ctx.usdc.balanceOf(ctx.customer.address)).to.equal(100_000_000n);
  });

  it("compensates the provider after an undisputed customer no-show", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);
    await increaseTo(timing.startTime + timing.gracePeriod + 1);

    await ctx.escrow.connect(ctx.provider).openNoShowClaim(1, 2);
    await increase(timing.disputeWindow + 1);
    await ctx.escrow.finalizeUndisputedClaim(1);

    expect(await ctx.usdc.balanceOf(ctx.provider.address)).to.equal(
      100_000_000n + CUSTOMER_BOND
    );
    expect(await ctx.usdc.balanceOf(ctx.customer.address)).to.equal(
      100_000_000n - CUSTOMER_BOND
    );
  });

  it("refunds the customer and pays compensation after a provider no-show", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);
    await increaseTo(timing.startTime + timing.gracePeriod + 1);

    await ctx.escrow.connect(ctx.customer).openNoShowClaim(1, 3);
    await increase(timing.disputeWindow + 1);
    await ctx.escrow.finalizeUndisputedClaim(1);

    expect(await ctx.usdc.balanceOf(ctx.customer.address)).to.equal(
      100_000_000n + COMPENSATION
    );
    expect(await ctx.usdc.balanceOf(ctx.provider.address)).to.equal(
      100_000_000n - COMPENSATION
    );
  });

  it("lets the arbiter resolve a disputed claim", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);
    await increaseTo(timing.startTime + timing.gracePeriod + 1);

    await ctx.escrow.connect(ctx.provider).openNoShowClaim(1, 2);
    await ctx.escrow.connect(ctx.customer).disputeClaim(1);

    await ctx.escrow.connect(ctx.arbiter).resolveDispute(1, 4);

    expect(await ctx.usdc.balanceOf(ctx.provider.address)).to.equal(100_000_000n);
    expect(await ctx.usdc.balanceOf(ctx.customer.address)).to.equal(100_000_000n);
  });


  it("refunds a provider when an invitation expires unaccepted", async function () {
    const ctx = await deployFixture();
    const now = await latest();
    const cancellationDeadline = now + 3600;
    const startTime = now + 7200;

    await ctx.escrow.connect(ctx.provider).createReservation(
      ctx.customer.address,
      PROVIDER_BOND,
      CUSTOMER_BOND,
      COMPENSATION,
      startTime,
      cancellationDeadline,
      900,
      1800,
      ethers.id("unaccepted")
    );

    await increaseTo(cancellationDeadline + 1);
    await ctx.escrow.connect(ctx.outsider).expireUnacceptedReservation(1);
    expect(await ctx.usdc.balanceOf(ctx.provider.address)).to.equal(100_000_000n);
  });

  it("does not allow attendance confirmation before the check-in window", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);
    await increaseTo(timing.startTime - timing.gracePeriod - 10);

    let reverted = false;
    try {
      await ctx.escrow.connect(ctx.provider).confirmAttendance(1);
    } catch (error) {
      reverted = String(error).includes("TooEarly");
    }
    expect(reverted).to.equal(true);
  });

  it("rejects a no-show claim against a party that already confirmed", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);
    await increaseTo(timing.startTime - timing.gracePeriod);
    await ctx.escrow.connect(ctx.provider).confirmAttendance(1);
    await increaseTo(timing.startTime + timing.gracePeriod + 1);

    let reverted = false;
    try {
      await ctx.escrow.connect(ctx.customer).openNoShowClaim(1, 3);
    } catch (error) {
      reverted = String(error).includes("InvalidOutcome");
    }
    expect(reverted).to.equal(true);
  });

  it("rejects duplicate attendance confirmation by the same party", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);
    await increaseTo(timing.startTime - timing.gracePeriod);
    await ctx.escrow.connect(ctx.provider).confirmAttendance(1);

    let reverted = false;
    try {
      await ctx.escrow.connect(ctx.provider).confirmAttendance(1);
    } catch (error) {
      reverted = String(error).includes("InvalidState");
    }
    expect(reverted).to.equal(true);
  });

  it("rejects duplicate settlement", async function () {
    const ctx = await deployFixture();
    await createAndAccept(ctx);
    await ctx.escrow.connect(ctx.customer).cancelReservation(1);

    let reverted = false;
    try {
      await ctx.escrow.connect(ctx.customer).cancelReservation(1);
    } catch (error) {
      reverted = String(error).includes("InvalidState");
    }
    expect(reverted).to.equal(true);
  });
});
