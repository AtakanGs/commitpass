const { expect } = require("chai");
const { ethers } = require("hardhat");

async function latest() {
  return Number(
    (await ethers.provider.getBlock("latest")).timestamp,
  );
}

async function increaseTo(timestamp) {
  await ethers.provider.send(
    "evm_setNextBlockTimestamp",
    [timestamp],
  );
  await ethers.provider.send("evm_mine", []);
}

async function increase(seconds) {
  await increaseTo((await latest()) + seconds);
}

describe("MutualCommitmentEscrowV3", function () {
  const COMMITMENT = 5_000_000n;
  const INITIAL_BALANCE = 100_000_000n;
  const GRACE_PERIOD = 900;
  const CLAIM_WINDOW = 3_600;
  const DISPUTE_WINDOW = 3_600;
  const ARBITER_WINDOW = 7_200;

  const METADATA_HASH = ethers.id(
    "v3-metadata-with-offchain-salt",
  );
  const CLAIM_EVIDENCE = ethers.id(
    "v3-claim-evidence-with-offchain-salt",
  );
  const DISPUTE_EVIDENCE = ethers.id(
    "v3-dispute-evidence-with-offchain-salt",
  );

  async function deployFixture() {
    const [
      deployer,
      provider,
      customer,
      arbiter,
      outsider,
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

    await usdc.mint(provider.address, INITIAL_BALANCE);
    await usdc.mint(customer.address, INITIAL_BALANCE);

    await usdc
      .connect(provider)
      .approve(await escrow.getAddress(), ethers.MaxUint256);
    await usdc
      .connect(customer)
      .approve(await escrow.getAddress(), ethers.MaxUint256);

    return {
      deployer,
      provider,
      customer,
      arbiter,
      outsider,
      usdc,
      escrow,
    };
  }

  async function createReservation(ctx, overrides = {}) {
    const now = await latest();
    const timing = {
      cancellationDeadline: now + 3_600,
      startTime: now + 7_200,
      gracePeriod: GRACE_PERIOD,
      claimWindow: CLAIM_WINDOW,
      disputeWindow: DISPUTE_WINDOW,
      arbiterWindow: ARBITER_WINDOW,
      ...overrides,
    };

    await ctx.escrow
      .connect(ctx.provider)
      .createReservation(
        ctx.customer.address,
        overrides.attendanceAttestor ?? ethers.ZeroAddress,
        overrides.commitmentAmount ?? COMMITMENT,
        timing.startTime,
        timing.cancellationDeadline,
        timing.gracePeriod,
        timing.claimWindow,
        timing.disputeWindow,
        timing.arbiterWindow,
        overrides.metadataHash ?? METADATA_HASH,
      );

    return timing;
  }

  async function createAndAccept(ctx, overrides = {}) {
    const timing = await createReservation(ctx, overrides);
    await ctx.escrow
      .connect(ctx.customer)
      .acceptReservation(1);
    return timing;
  }

  async function openCustomerNoShowClaim(ctx) {
    const reservation =
      await ctx.escrow.getReservation(1);
    const startTime = Number(reservation.startTime);
    const gracePeriod = Number(reservation.gracePeriod);

    await increaseTo(startTime - gracePeriod);
    await ctx.escrow
      .connect(ctx.provider)
      .confirmAttendance(1);

    await increaseTo(startTime + gracePeriod + 1);
    await ctx.escrow
      .connect(ctx.provider)
      .openNoShowClaim(
        1,
        2,
        CLAIM_EVIDENCE,
      );
  }

  it("locks the same commitment from both parties", async function () {
    const ctx = await deployFixture();
    await createAndAccept(ctx);

    expect(
      await ctx.usdc.balanceOf(
        await ctx.escrow.getAddress(),
      ),
    ).to.equal(COMMITMENT * 2n);

    const reservation =
      await ctx.escrow.getReservation(1);

    expect(reservation.commitmentAmount).to.equal(COMMITMENT);
    expect(reservation.status).to.equal(2n);
  });

  it("returns both commitments after mutual attendance", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);

    await increaseTo(
      timing.startTime - timing.gracePeriod,
    );

    await ctx.escrow
      .connect(ctx.provider)
      .confirmAttendance(1);
    await ctx.escrow
      .connect(ctx.customer)
      .confirmAttendance(1);

    expect(
      await ctx.usdc.balanceOf(ctx.provider.address),
    ).to.equal(INITIAL_BALANCE);
    expect(
      await ctx.usdc.balanceOf(ctx.customer.address),
    ).to.equal(INITIAL_BALANCE);
    expect(
      await ctx.usdc.balanceOf(
        await ctx.escrow.getAddress(),
      ),
    ).to.equal(0n);

    const reservation =
      await ctx.escrow.getReservation(1);

    expect(reservation.status).to.equal(5n);
    expect(reservation.finalOutcome).to.equal(1n);
  });

  it("refunds both commitments on an early cancellation", async function () {
    const ctx = await deployFixture();
    await createAndAccept(ctx);

    await ctx.escrow
      .connect(ctx.customer)
      .cancelReservation(1);

    expect(
      await ctx.usdc.balanceOf(ctx.provider.address),
    ).to.equal(INITIAL_BALANCE);
    expect(
      await ctx.usdc.balanceOf(ctx.customer.address),
    ).to.equal(INITIAL_BALANCE);
  });

  it("returns the provider commitment after an invitation expires", async function () {
    const ctx = await deployFixture();
    const timing = await createReservation(ctx);

    await increaseTo(timing.cancellationDeadline + 1);
    await ctx.escrow
      .connect(ctx.outsider)
      .expireUnacceptedReservation(1);

    expect(
      await ctx.usdc.balanceOf(ctx.provider.address),
    ).to.equal(INITIAL_BALANCE);
    expect(
      await ctx.usdc.balanceOf(
        await ctx.escrow.getAddress(),
      ),
    ).to.equal(0n);
  });

  it("awards both commitments to the provider after an undisputed customer no-show", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);

    await increaseTo(
      timing.startTime - timing.gracePeriod,
    );
    await ctx.escrow
      .connect(ctx.provider)
      .confirmAttendance(1);

    await increaseTo(
      timing.startTime + timing.gracePeriod + 1,
    );
    await ctx.escrow
      .connect(ctx.provider)
      .openNoShowClaim(
        1,
        2,
        CLAIM_EVIDENCE,
      );

    await increase(timing.disputeWindow + 1);
    await ctx.escrow
      .connect(ctx.outsider)
      .finalizeUndisputedClaim(1);

    expect(
      await ctx.usdc.balanceOf(ctx.provider.address),
    ).to.equal(INITIAL_BALANCE + COMMITMENT);
    expect(
      await ctx.usdc.balanceOf(ctx.customer.address),
    ).to.equal(INITIAL_BALANCE - COMMITMENT);
  });

  it("awards both commitments to the customer after an undisputed provider no-show", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);

    await increaseTo(
      timing.startTime - timing.gracePeriod,
    );
    await ctx.escrow
      .connect(ctx.customer)
      .confirmAttendance(1);

    await increaseTo(
      timing.startTime + timing.gracePeriod + 1,
    );
    await ctx.escrow
      .connect(ctx.customer)
      .openNoShowClaim(
        1,
        3,
        CLAIM_EVIDENCE,
      );

    await increase(timing.disputeWindow + 1);
    await ctx.escrow
      .connect(ctx.outsider)
      .finalizeUndisputedClaim(1);

    expect(
      await ctx.usdc.balanceOf(ctx.customer.address),
    ).to.equal(INITIAL_BALANCE + COMMITMENT);
    expect(
      await ctx.usdc.balanceOf(ctx.provider.address),
    ).to.equal(INITIAL_BALANCE - COMMITMENT);
  });

  it("stores immutable claim and dispute evidence hashes", async function () {
    const ctx = await deployFixture();
    await createAndAccept(ctx);
    await openCustomerNoShowClaim(ctx);

    let reservation =
      await ctx.escrow.getReservation(1);

    expect(reservation.claimEvidenceHash).to.equal(
      CLAIM_EVIDENCE,
    );

    await ctx.escrow
      .connect(ctx.customer)
      .disputeClaim(
        1,
        DISPUTE_EVIDENCE,
      );

    reservation =
      await ctx.escrow.getReservation(1);

    expect(reservation.disputeEvidenceHash).to.equal(
      DISPUTE_EVIDENCE,
    );
    expect(reservation.status).to.equal(4n);
  });

  it("lets the arbiter resolve a disputed claim before the deadline", async function () {
    const ctx = await deployFixture();
    await createAndAccept(ctx);
    await openCustomerNoShowClaim(ctx);

    await ctx.escrow
      .connect(ctx.customer)
      .disputeClaim(
        1,
        DISPUTE_EVIDENCE,
      );

    await ctx.escrow
      .connect(ctx.arbiter)
      .resolveDispute(1, 4);

    expect(
      await ctx.usdc.balanceOf(ctx.provider.address),
    ).to.equal(INITIAL_BALANCE);
    expect(
      await ctx.usdc.balanceOf(ctx.customer.address),
    ).to.equal(INITIAL_BALANCE);
  });

  it("refunds an active reservation after the claim window expires", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);

    await increaseTo(
      timing.startTime
        + timing.gracePeriod
        + timing.claimWindow
        + 1,
    );

    await ctx.escrow
      .connect(ctx.outsider)
      .refundStaleReservation(1);

    expect(
      await ctx.usdc.balanceOf(ctx.provider.address),
    ).to.equal(INITIAL_BALANCE);
    expect(
      await ctx.usdc.balanceOf(ctx.customer.address),
    ).to.equal(INITIAL_BALANCE);

    const reservation =
      await ctx.escrow.getReservation(1);

    expect(reservation.status).to.equal(5n);
    expect(reservation.finalOutcome).to.equal(4n);
  });

  it("refunds both parties when an arbiter deadline expires", async function () {
    const ctx = await deployFixture();
    await createAndAccept(ctx);
    await openCustomerNoShowClaim(ctx);

    await ctx.escrow
      .connect(ctx.customer)
      .disputeClaim(
        1,
        DISPUTE_EVIDENCE,
      );

    const deadline =
      await ctx.escrow.arbiterDeadline(1);

    await increaseTo(Number(deadline) + 1);

    await ctx.escrow
      .connect(ctx.outsider)
      .refundExpiredDispute(1);

    expect(
      await ctx.usdc.balanceOf(ctx.provider.address),
    ).to.equal(INITIAL_BALANCE);
    expect(
      await ctx.usdc.balanceOf(ctx.customer.address),
    ).to.equal(INITIAL_BALANCE);
  });

  it("exposes deterministic lifecycle deadlines", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);

    expect(
      await ctx.escrow.attendanceDeadline(1),
    ).to.equal(
      BigInt(timing.startTime + timing.gracePeriod),
    );

    expect(
      await ctx.escrow.claimOpeningDeadline(1),
    ).to.equal(
      BigInt(
        timing.startTime
          + timing.gracePeriod
          + timing.claimWindow,
      ),
    );

    expect(
      await ctx.escrow.disputeDeadline(1),
    ).to.equal(0n);
    expect(
      await ctx.escrow.arbiterDeadline(1),
    ).to.equal(0n);
  });
});
