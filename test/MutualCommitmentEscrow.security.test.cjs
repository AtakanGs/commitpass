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

describe("MutualCommitmentEscrow security boundaries", function () {
  const PROVIDER_BOND = 5_000_000n;
  const CUSTOMER_BOND = 2_000_000n;
  const COMPENSATION = 2_000_000n;
  const INITIAL_BALANCE = 100_000_000n;

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
      "MutualCommitmentEscrow",
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

  async function createReservation(ctx) {
    const now = await latest();
    const cancellationDeadline = now + 3_600;
    const startTime = now + 7_200;
    const gracePeriod = 900;
    const disputeWindow = 1_800;

    await ctx.escrow
      .connect(ctx.provider)
      .createReservation(
        ctx.customer.address,
        PROVIDER_BOND,
        CUSTOMER_BOND,
        COMPENSATION,
        startTime,
        cancellationDeadline,
        gracePeriod,
        disputeWindow,
        ethers.id("security-boundary-test"),
      );

    return {
      cancellationDeadline,
      startTime,
      gracePeriod,
      disputeWindow,
    };
  }

  async function createAndAccept(ctx) {
    const timing = await createReservation(ctx);
    await ctx.escrow
      .connect(ctx.customer)
      .acceptReservation(1);
    return timing;
  }

  async function openCustomerNoShowClaim(ctx, id = 1) {
    const reservation =
      await ctx.escrow.getReservation(id);
    const startTime = Number(reservation.startTime);
    const gracePeriod = Number(reservation.gracePeriod);

    await increaseTo(startTime - gracePeriod);
    await ctx.escrow
      .connect(ctx.provider)
      .confirmAttendance(id);

    await increaseTo(startTime + gracePeriod + 1);
    await ctx.escrow
      .connect(ctx.provider)
      .openNoShowClaim(id, 2);
  }

  it("allows only the arbiter to emergency-refund active funds", async function () {
    const ctx = await deployFixture();
    await createAndAccept(ctx);

    await expectCustomError(
      ctx.escrow
        .connect(ctx.outsider)
        .emergencyRefund(1),
      "Unauthorized",
    );

    await ctx.escrow
      .connect(ctx.arbiter)
      .emergencyRefund(1);

    const reservation =
      await ctx.escrow.getReservation(1);

    expect(reservation.status).to.equal(5n);
    expect(reservation.finalOutcome).to.equal(4n);
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
  });

  for (const outcome of [1n, 2n, 3n, 4n]) {
    it(
      "lets the arbiter resolve a dispute with outcome " +
        outcome.toString(),
      async function () {
        const ctx = await deployFixture();
        await createAndAccept(ctx);
        await openCustomerNoShowClaim(ctx);

        await ctx.escrow
          .connect(ctx.customer)
          .disputeClaim(1);

        await ctx.escrow
          .connect(ctx.arbiter)
          .resolveDispute(1, outcome);

        const reservation =
          await ctx.escrow.getReservation(1);

        expect(reservation.status).to.equal(5n);
        expect(reservation.finalOutcome).to.equal(outcome);
        expect(
          await ctx.usdc.balanceOf(
            await ctx.escrow.getAddress(),
          ),
        ).to.equal(0n);

        const expectedProvider =
          outcome === 2n
            ? INITIAL_BALANCE + CUSTOMER_BOND
            : outcome === 3n
              ? INITIAL_BALANCE - COMPENSATION
              : INITIAL_BALANCE;

        const expectedCustomer =
          outcome === 2n
            ? INITIAL_BALANCE - CUSTOMER_BOND
            : outcome === 3n
              ? INITIAL_BALANCE + COMPENSATION
              : INITIAL_BALANCE;

        expect(
          await ctx.usdc.balanceOf(ctx.provider.address),
        ).to.equal(expectedProvider);
        expect(
          await ctx.usdc.balanceOf(ctx.customer.address),
        ).to.equal(expectedCustomer);
      },
    );
  }

  it("accepts check-ins at both exact window boundaries", async function () {
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

  it("rejects a check-in one second after the window closes", async function () {
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

  it("accepts a customer exactly at the deadline and rejects one second later", async function () {
    const first = await deployFixture();
    const firstTiming = await createReservation(first);

    await setNextTransactionTimestamp(
      firstTiming.cancellationDeadline,
    );
    await first.escrow
      .connect(first.customer)
      .acceptReservation(1);

    expect(
      (await first.escrow.getReservation(1)).status,
    ).to.equal(2n);

    const second = await deployFixture();
    const secondTiming = await createReservation(second);

    await setNextTransactionTimestamp(
      secondTiming.cancellationDeadline + 1,
    );

    await expectCustomError(
      second.escrow
        .connect(second.customer)
        .acceptReservation(1),
      "TooLate",
    );
  });

  it("allows a dispute at the exact deadline and rejects it after the deadline", async function () {
    const first = await deployFixture();
    await createAndAccept(first);
    await openCustomerNoShowClaim(first);

    const firstDeadline =
      await first.escrow.claimDeadline(1);
    await setNextTransactionTimestamp(
      Number(firstDeadline),
    );

    await first.escrow
      .connect(first.customer)
      .disputeClaim(1);

    expect(
      (await first.escrow.getReservation(1)).status,
    ).to.equal(4n);

    const second = await deployFixture();
    await createAndAccept(second);
    await openCustomerNoShowClaim(second);

    const secondDeadline =
      await second.escrow.claimDeadline(1);
    await setNextTransactionTimestamp(
      Number(secondDeadline) + 1,
    );

    await expectCustomError(
      second.escrow
        .connect(second.customer)
        .disputeClaim(1),
      "TooLate",
    );
  });

  it("keeps multiple reservations and balances isolated", async function () {
    const ctx = await deployFixture();

    await createReservation(ctx);
    await ctx.escrow
      .connect(ctx.customer)
      .acceptReservation(1);

    const secondTiming = await createReservation(ctx);
    await ctx.escrow
      .connect(ctx.customer)
      .acceptReservation(2);

    expect(
      await ctx.usdc.balanceOf(
        await ctx.escrow.getAddress(),
      ),
    ).to.equal(
      2n * (PROVIDER_BOND + CUSTOMER_BOND),
    );

    await ctx.escrow
      .connect(ctx.customer)
      .cancelReservation(1);

    expect(
      (await ctx.escrow.getReservation(1)).status,
    ).to.equal(6n);
    expect(
      (await ctx.escrow.getReservation(2)).status,
    ).to.equal(2n);
    expect(
      await ctx.usdc.balanceOf(
        await ctx.escrow.getAddress(),
      ),
    ).to.equal(PROVIDER_BOND + CUSTOMER_BOND);

    await increaseTo(
      secondTiming.startTime -
        secondTiming.gracePeriod,
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

  it("rejects unauthorized attendance and dispute actions", async function () {
    const ctx = await deployFixture();
    const timing = await createAndAccept(ctx);

    await increaseTo(
      timing.startTime - timing.gracePeriod,
    );

    await expectCustomError(
      ctx.escrow
        .connect(ctx.outsider)
        .confirmAttendance(1),
      "Unauthorized",
    );

    await ctx.escrow
      .connect(ctx.provider)
      .confirmAttendance(1);

    await increaseTo(
      timing.startTime + timing.gracePeriod + 1,
    );
    await ctx.escrow
      .connect(ctx.provider)
      .openNoShowClaim(1, 2);

    await expectCustomError(
      ctx.escrow
        .connect(ctx.outsider)
        .disputeClaim(1),
      "Unauthorized",
    );
  });

  it("rejects emergency refunds after final settlement", async function () {
    const ctx = await deployFixture();
    await createAndAccept(ctx);

    await ctx.escrow
      .connect(ctx.customer)
      .cancelReservation(1);

    await expectCustomError(
      ctx.escrow
        .connect(ctx.arbiter)
        .emergencyRefund(1),
      "InvalidState",
    );

    expect(
      await ctx.usdc.balanceOf(
        await ctx.escrow.getAddress(),
      ),
    ).to.equal(0n);
  });
});
