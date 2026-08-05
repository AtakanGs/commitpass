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

async function setNextTransactionTimestamp(timestamp) {
  await ethers.provider.send(
    "evm_setNextBlockTimestamp",
    [timestamp],
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
  "MutualCommitmentEscrowV3 security and liveness boundaries",
  function () {
    const COMMITMENT = 5_000_000n;
    const INITIAL_BALANCE = 100_000_000n;
    const GRACE_PERIOD = 900;
    const CLAIM_WINDOW = 3_600;
    const DISPUTE_WINDOW = 3_600;
    const ARBITER_WINDOW = 7_200;
    const METADATA_HASH = ethers.id("v3-secure-metadata");
    const CLAIM_EVIDENCE = ethers.id("v3-claim-evidence");
    const DISPUTE_EVIDENCE = ethers.id(
      "v3-dispute-evidence",
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

      await usdc.mint(
        provider.address,
        INITIAL_BALANCE,
      );
      await usdc.mint(
        customer.address,
        INITIAL_BALANCE,
      );

      await usdc
        .connect(provider)
        .approve(
          await escrow.getAddress(),
          ethers.MaxUint256,
        );
      await usdc
        .connect(customer)
        .approve(
          await escrow.getAddress(),
          ethers.MaxUint256,
        );

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

    async function validTiming(overrides = {}) {
      const now = await latest();

      return {
        cancellationDeadline: now + 3_600,
        startTime: now + 7_200,
        gracePeriod: GRACE_PERIOD,
        claimWindow: CLAIM_WINDOW,
        disputeWindow: DISPUTE_WINDOW,
        arbiterWindow: ARBITER_WINDOW,
        ...overrides,
      };
    }

    async function createReservation(
      ctx,
      overrides = {},
    ) {
      const timing = await validTiming(overrides);

      await ctx.escrow
        .connect(ctx.provider)
        .createReservation(
          overrides.customer ?? ctx.customer.address,
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

    async function createAndAccept(
      ctx,
      overrides = {},
    ) {
      const timing = await createReservation(
        ctx,
        overrides,
      );
      await ctx.escrow
        .connect(ctx.customer)
        .acceptReservation(1);
      return timing;
    }

    async function openCustomerNoShowClaim(ctx) {
      const reservation =
        await ctx.escrow.getReservation(1);
      const startTime = Number(reservation.startTime);
      const gracePeriod =
        Number(reservation.gracePeriod);

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

    it("rejects commitments below and above protocol limits", async function () {
      const below = await deployFixture();
      const belowTiming = await validTiming();

      await expectCustomError(
        below.escrow
          .connect(below.provider)
          .createReservation(
            below.customer.address,
            99_999,
            belowTiming.startTime,
            belowTiming.cancellationDeadline,
            belowTiming.gracePeriod,
            belowTiming.claimWindow,
            belowTiming.disputeWindow,
            belowTiming.arbiterWindow,
            METADATA_HASH,
          ),
        "InvalidAmount",
      );

      const above = await deployFixture();
      const aboveTiming = await validTiming();

      await expectCustomError(
        above.escrow
          .connect(above.provider)
          .createReservation(
            above.customer.address,
            10_000_000_001n,
            aboveTiming.startTime,
            aboveTiming.cancellationDeadline,
            aboveTiming.gracePeriod,
            aboveTiming.claimWindow,
            aboveTiming.disputeWindow,
            aboveTiming.arbiterWindow,
            METADATA_HASH,
          ),
        "InvalidAmount",
      );
    });

    it("rejects an empty metadata hash", async function () {
      const ctx = await deployFixture();

      await expectCustomError(
        createReservation(ctx, {
          metadataHash: ethers.ZeroHash,
        }),
        "InvalidEvidence",
      );
    });

    it("rejects unsafe grace-period bounds", async function () {
      const below = await deployFixture();

      await expectCustomError(
        createReservation(below, {
          gracePeriod: 299,
        }),
        "InvalidSchedule",
      );

      const above = await deployFixture();

      await expectCustomError(
        createReservation(above, {
          gracePeriod: 7_201,
        }),
        "InvalidSchedule",
      );
    });

    it("rejects unsafe claim-window bounds", async function () {
      const below = await deployFixture();

      await expectCustomError(
        createReservation(below, {
          claimWindow: 3_599,
        }),
        "InvalidSchedule",
      );

      const above = await deployFixture();

      await expectCustomError(
        createReservation(above, {
          claimWindow: 259_201,
        }),
        "InvalidSchedule",
      );
    });

    it("rejects unsafe dispute-window bounds", async function () {
      const below = await deployFixture();

      await expectCustomError(
        createReservation(below, {
          disputeWindow: 3_599,
        }),
        "InvalidSchedule",
      );

      const above = await deployFixture();

      await expectCustomError(
        createReservation(above, {
          disputeWindow: 259_201,
        }),
        "InvalidSchedule",
      );
    });

    it("rejects unsafe arbiter-window bounds", async function () {
      const below = await deployFixture();

      await expectCustomError(
        createReservation(below, {
          arbiterWindow: 3_599,
        }),
        "InvalidSchedule",
      );

      const above = await deployFixture();

      await expectCustomError(
        createReservation(above, {
          arbiterWindow: 604_801,
        }),
        "InvalidSchedule",
      );
    });

    it("rejects cancellation deadlines and starts that are too close", async function () {
      const first = await deployFixture();
      const now = await latest();

      await expectCustomError(
        createReservation(first, {
          cancellationDeadline: now + 899,
          startTime: now + 7_200,
        }),
        "InvalidSchedule",
      );

      const second = await deployFixture();
      const secondNow = await latest();

      await expectCustomError(
        createReservation(second, {
          cancellationDeadline: secondNow + 3_600,
          startTime: secondNow + 4_500,
        }),
        "InvalidSchedule",
      );
    });

    it("allows only the invited customer to accept", async function () {
      const ctx = await deployFixture();
      await createReservation(ctx);

      await expectCustomError(
        ctx.escrow
          .connect(ctx.outsider)
          .acceptReservation(1),
        "Unauthorized",
      );
    });

    it("accepts check-ins at both exact boundaries", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await setNextTransactionTimestamp(
        timing.startTime - timing.gracePeriod,
      );
      await ctx.escrow
        .connect(ctx.provider)
        .confirmAttendance(1);

      await setNextTransactionTimestamp(
        timing.startTime + timing.gracePeriod,
      );
      await ctx.escrow
        .connect(ctx.customer)
        .confirmAttendance(1);

      const reservation =
        await ctx.escrow.getReservation(1);

      expect(reservation.status).to.equal(5n);
      expect(reservation.finalOutcome).to.equal(1n);
    });

    it("rejects attendance one second after the window", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await increaseTo(
        timing.startTime + timing.gracePeriod + 1,
      );

      await expectCustomError(
        ctx.escrow
          .connect(ctx.provider)
          .confirmAttendance(1),
        "TooLate",
      );
    });

    it("requires the claimant's attendance and a nonzero evidence hash", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await increaseTo(
        timing.startTime + timing.gracePeriod + 1,
      );

      await expectCustomError(
        ctx.escrow
          .connect(ctx.provider)
          .openNoShowClaim(
            1,
            2,
            CLAIM_EVIDENCE,
          ),
        "AttendanceNotConfirmed",
      );

      const second = await deployFixture();
      const secondTiming = await createAndAccept(
        second,
      );

      await increaseTo(
        secondTiming.startTime
          - secondTiming.gracePeriod,
      );
      await second.escrow
        .connect(second.provider)
        .confirmAttendance(1);

      await increaseTo(
        secondTiming.startTime
          + secondTiming.gracePeriod
          + 1,
      );

      await expectCustomError(
        second.escrow
          .connect(second.provider)
          .openNoShowClaim(
            1,
            2,
            ethers.ZeroHash,
          ),
        "InvalidEvidence",
      );
    });

    it("allows a claim at the exact claim deadline and rejects it after", async function () {
      const first = await deployFixture();
      const firstTiming = await createAndAccept(first);

      await increaseTo(
        firstTiming.startTime
          - firstTiming.gracePeriod,
      );
      await first.escrow
        .connect(first.provider)
        .confirmAttendance(1);

      const firstDeadline =
        await first.escrow.claimOpeningDeadline(1);

      await setNextTransactionTimestamp(
        Number(firstDeadline),
      );
      await first.escrow
        .connect(first.provider)
        .openNoShowClaim(
          1,
          2,
          CLAIM_EVIDENCE,
        );

      const second = await deployFixture();
      const secondTiming = await createAndAccept(
        second,
      );

      await increaseTo(
        secondTiming.startTime
          - secondTiming.gracePeriod,
      );
      await second.escrow
        .connect(second.provider)
        .confirmAttendance(1);

      const secondDeadline =
        await second.escrow.claimOpeningDeadline(1);

      await setNextTransactionTimestamp(
        Number(secondDeadline) + 1,
      );

      await expectCustomError(
        second.escrow
          .connect(second.provider)
          .openNoShowClaim(
            1,
            2,
            CLAIM_EVIDENCE,
          ),
        "TooLate",
      );
    });

    it("allows only the accused party to dispute with evidence", async function () {
      const ctx = await deployFixture();
      await createAndAccept(ctx);
      await openCustomerNoShowClaim(ctx);

      await expectCustomError(
        ctx.escrow
          .connect(ctx.outsider)
          .disputeClaim(
            1,
            DISPUTE_EVIDENCE,
          ),
        "Unauthorized",
      );

      await expectCustomError(
        ctx.escrow
          .connect(ctx.customer)
          .disputeClaim(
            1,
            ethers.ZeroHash,
          ),
        "InvalidEvidence",
      );
    });

    it("allows a dispute at the exact deadline and rejects it after", async function () {
      const first = await deployFixture();
      await createAndAccept(first);
      await openCustomerNoShowClaim(first);

      const firstDeadline =
        await first.escrow.disputeDeadline(1);

      await setNextTransactionTimestamp(
        Number(firstDeadline),
      );
      await first.escrow
        .connect(first.customer)
        .disputeClaim(
          1,
          DISPUTE_EVIDENCE,
        );

      const second = await deployFixture();
      await createAndAccept(second);
      await openCustomerNoShowClaim(second);

      const secondDeadline =
        await second.escrow.disputeDeadline(1);

      await setNextTransactionTimestamp(
        Number(secondDeadline) + 1,
      );

      await expectCustomError(
        second.escrow
          .connect(second.customer)
          .disputeClaim(
            1,
            DISPUTE_EVIDENCE,
          ),
        "TooLate",
      );
    });

    it("allows only the arbiter to resolve a dispute", async function () {
      const ctx = await deployFixture();
      await createAndAccept(ctx);
      await openCustomerNoShowClaim(ctx);

      await ctx.escrow
        .connect(ctx.customer)
        .disputeClaim(
          1,
          DISPUTE_EVIDENCE,
        );

      await expectCustomError(
        ctx.escrow
          .connect(ctx.outsider)
          .resolveDispute(1, 4),
        "Unauthorized",
      );
    });

    it("blocks arbiter resolution after its deadline", async function () {
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

      await expectCustomError(
        ctx.escrow
          .connect(ctx.arbiter)
          .resolveDispute(1, 4),
        "TooLate",
      );
    });

    it("prevents early stale and expired-dispute refunds", async function () {
      const stale = await deployFixture();
      await createAndAccept(stale);

      await expectCustomError(
        stale.escrow.refundStaleReservation(1),
        "TooEarly",
      );

      const disputed = await deployFixture();
      await createAndAccept(disputed);
      await openCustomerNoShowClaim(disputed);

      await disputed.escrow
        .connect(disputed.customer)
        .disputeClaim(
          1,
          DISPUTE_EVIDENCE,
        );

      await expectCustomError(
        disputed.escrow.refundExpiredDispute(1),
        "TooEarly",
      );
    });

    it("keeps multiple reservations and balances isolated", async function () {
      const ctx = await deployFixture();

      await createReservation(ctx);
      await ctx.escrow
        .connect(ctx.customer)
        .acceptReservation(1);

      const secondTiming =
        await createReservation(ctx);
      await ctx.escrow
        .connect(ctx.customer)
        .acceptReservation(2);

      expect(
        await ctx.usdc.balanceOf(
          await ctx.escrow.getAddress(),
        ),
      ).to.equal(COMMITMENT * 4n);

      await ctx.escrow
        .connect(ctx.customer)
        .cancelReservation(1);

      expect(
        await ctx.usdc.balanceOf(
          await ctx.escrow.getAddress(),
        ),
      ).to.equal(COMMITMENT * 2n);

      await increaseTo(
        secondTiming.startTime
          - secondTiming.gracePeriod,
      );
      await ctx.escrow
        .connect(ctx.provider)
        .confirmAttendance(2);
      await ctx.escrow
        .connect(ctx.customer)
        .confirmAttendance(2);

      expect(
        await ctx.usdc.balanceOf(
          await ctx.escrow.getAddress(),
        ),
      ).to.equal(0n);
      expect(
        await ctx.usdc.balanceOf(ctx.provider.address),
      ).to.equal(INITIAL_BALANCE);
      expect(
        await ctx.usdc.balanceOf(ctx.customer.address),
      ).to.equal(INITIAL_BALANCE);
    });

    it("rejects duplicate settlement after a terminal outcome", async function () {
      const ctx = await deployFixture();
      await createAndAccept(ctx);

      await ctx.escrow
        .connect(ctx.customer)
        .cancelReservation(1);

      await expectCustomError(
        ctx.escrow
          .connect(ctx.customer)
          .cancelReservation(1),
        "InvalidState",
      );

      await expectCustomError(
        ctx.escrow.refundStaleReservation(1),
        "InvalidState",
      );
    });
  },
);
