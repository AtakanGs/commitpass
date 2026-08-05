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
  "MutualCommitmentEscrowV3 platform attendance attestations",
  function () {
    const COMMITMENT = 5_000_000n;
    const INITIAL_BALANCE = 100_000_000n;
    const METADATA_HASH = ethers.id(
      "platform-attestation-reservation",
    );

    async function deployFixture() {
      const [
        deployer,
        provider,
        customer,
        arbiter,
        attestor,
        outsider,
        falseAttestor,
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
        attestor,
        outsider,
        falseAttestor,
        usdc,
        escrow,
      };
    }

    async function createAndAccept(
      ctx,
      attendanceAttestor = ctx.attestor.address,
    ) {
      const now = await latest();
      const timing = {
        cancellationDeadline: now + 3_600,
        startTime: now + 7_200,
        gracePeriod: 900,
        claimWindow: 3_600,
        disputeWindow: 3_600,
        arbiterWindow: 7_200,
      };

      await ctx.escrow
        .connect(ctx.provider)
        .createReservation(
          ctx.customer.address,
          attendanceAttestor,
          COMMITMENT,
          timing.startTime,
          timing.cancellationDeadline,
          timing.gracePeriod,
          timing.claimWindow,
          timing.disputeWindow,
          timing.arbiterWindow,
          METADATA_HASH,
        );

      await ctx.escrow
        .connect(ctx.customer)
        .acceptReservation(1);

      return timing;
    }

    async function signAttendance(
      escrow,
      signer,
      reservationId,
      participant,
      validUntil,
    ) {
      const network =
        await ethers.provider.getNetwork();

      const domain = {
        name: "CommitPass",
        version: "3",
        chainId: network.chainId,
        verifyingContract:
          await escrow.getAddress(),
      };

      const types = {
        AttendanceAttestation: [
          {
            name: "reservationId",
            type: "uint256",
          },
          {
            name: "participant",
            type: "address",
          },
          {
            name: "validUntil",
            type: "uint64",
          },
        ],
      };

      return signer.signTypedData(
        domain,
        types,
        {
          reservationId,
          participant,
          validUntil,
        },
      );
    }

    it("keeps self-attested reservations available when no platform is configured", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(
        ctx,
        ethers.ZeroAddress,
      );

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      await ctx.escrow
        .connect(ctx.provider)
        .confirmAttendance(1);

      const reservation =
        await ctx.escrow.getReservation(1);

      expect(reservation.attendanceAttestor).to.equal(
        ethers.ZeroAddress,
      );
      expect(reservation.providerConfirmed).to.equal(
        true,
      );
    });

    it("blocks direct self-attendance in platform-verified mode", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      await expectCustomError(
        ctx.escrow
          .connect(ctx.provider)
          .confirmAttendance(1),
        "PlatformAttestationRequired",
      );
    });

    it("accepts a valid platform attestation submitted by a relayer", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      const validUntil =
        timing.startTime + timing.gracePeriod;

      const signature = await signAttendance(
        ctx.escrow,
        ctx.attestor,
        1n,
        ctx.provider.address,
        validUntil,
      );

      await ctx.escrow
        .connect(ctx.outsider)
        .confirmAttendanceWithAttestation(
          1,
          ctx.provider.address,
          validUntil,
          signature,
        );

      const reservation =
        await ctx.escrow.getReservation(1);

      expect(reservation.providerConfirmed).to.equal(
        true,
      );
      expect(reservation.customerConfirmed).to.equal(
        false,
      );
    });

    it("settles after valid platform attestations for both parties", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      const validUntil =
        timing.startTime + timing.gracePeriod;

      const providerSignature =
        await signAttendance(
          ctx.escrow,
          ctx.attestor,
          1n,
          ctx.provider.address,
          validUntil,
        );

      const customerSignature =
        await signAttendance(
          ctx.escrow,
          ctx.attestor,
          1n,
          ctx.customer.address,
          validUntil,
        );

      await ctx.escrow
        .connect(ctx.outsider)
        .confirmAttendanceWithAttestation(
          1,
          ctx.provider.address,
          validUntil,
          providerSignature,
        );

      await ctx.escrow
        .connect(ctx.outsider)
        .confirmAttendanceWithAttestation(
          1,
          ctx.customer.address,
          validUntil,
          customerSignature,
        );

      const reservation =
        await ctx.escrow.getReservation(1);

      expect(reservation.status).to.equal(5n);
      expect(reservation.finalOutcome).to.equal(1n);
      expect(
        await ctx.usdc.balanceOf(ctx.provider.address),
      ).to.equal(INITIAL_BALANCE);
      expect(
        await ctx.usdc.balanceOf(ctx.customer.address),
      ).to.equal(INITIAL_BALANCE);
    });

    it("rejects a signature from an unconfigured signer", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      const validUntil =
        timing.startTime + timing.gracePeriod;

      const signature = await signAttendance(
        ctx.escrow,
        ctx.falseAttestor,
        1n,
        ctx.provider.address,
        validUntil,
      );

      await expectCustomError(
        ctx.escrow
          .confirmAttendanceWithAttestation(
            1,
            ctx.provider.address,
            validUntil,
            signature,
          ),
        "InvalidAttestationSignature",
      );
    });

    it("rejects a signature bound to the other participant", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      const validUntil =
        timing.startTime + timing.gracePeriod;

      const customerSignature =
        await signAttendance(
          ctx.escrow,
          ctx.attestor,
          1n,
          ctx.customer.address,
          validUntil,
        );

      await expectCustomError(
        ctx.escrow
          .confirmAttendanceWithAttestation(
            1,
            ctx.provider.address,
            validUntil,
            customerSignature,
          ),
        "InvalidAttestationSignature",
      );
    });

    it("rejects an expired attestation", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await increaseTo(
        timing.startTime - timing.gracePeriod + 10,
      );

      const validUntil =
        timing.startTime - timing.gracePeriod + 5;

      const signature = await signAttendance(
        ctx.escrow,
        ctx.attestor,
        1n,
        ctx.provider.address,
        validUntil,
      );

      await expectCustomError(
        ctx.escrow
          .confirmAttendanceWithAttestation(
            1,
            ctx.provider.address,
            validUntil,
            signature,
          ),
        "AttestationExpired",
      );
    });

    it("rejects a signature replayed for another reservation", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      const now = await latest();

      await ctx.escrow
        .connect(ctx.provider)
        .createReservation(
          ctx.customer.address,
          ctx.attestor.address,
          COMMITMENT,
          timing.startTime,
          now + 3_600,
          timing.gracePeriod,
          timing.claimWindow,
          timing.disputeWindow,
          timing.arbiterWindow,
          ethers.id(
            "platform-attestation-reservation-2",
          ),
        );

      await ctx.escrow
        .connect(ctx.customer)
        .acceptReservation(2);

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      const validUntil =
        timing.startTime + timing.gracePeriod;

      const reservationOneSignature =
        await signAttendance(
          ctx.escrow,
          ctx.attestor,
          1n,
          ctx.provider.address,
          validUntil,
        );

      await expectCustomError(
        ctx.escrow
          .confirmAttendanceWithAttestation(
            2,
            ctx.provider.address,
            validUntil,
            reservationOneSignature,
          ),
        "InvalidAttestationSignature",
      );
    });

    it("rejects a signature replayed on another CommitPass contract", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      const Escrow = await ethers.getContractFactory(
        "MutualCommitmentEscrowV3",
      );
      const secondEscrow = await Escrow.deploy(
        await ctx.usdc.getAddress(),
        ctx.arbiter.address,
      );

      await ctx.usdc
        .connect(ctx.provider)
        .approve(
          await secondEscrow.getAddress(),
          ethers.MaxUint256,
        );
      await ctx.usdc
        .connect(ctx.customer)
        .approve(
          await secondEscrow.getAddress(),
          ethers.MaxUint256,
        );

      await secondEscrow
        .connect(ctx.provider)
        .createReservation(
          ctx.customer.address,
          ctx.attestor.address,
          COMMITMENT,
          timing.startTime,
          timing.cancellationDeadline,
          timing.gracePeriod,
          timing.claimWindow,
          timing.disputeWindow,
          timing.arbiterWindow,
          METADATA_HASH,
        );

      await secondEscrow
        .connect(ctx.customer)
        .acceptReservation(1);

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      const validUntil =
        timing.startTime + timing.gracePeriod;

      const firstContractSignature =
        await signAttendance(
          ctx.escrow,
          ctx.attestor,
          1n,
          ctx.provider.address,
          validUntil,
        );

      await expectCustomError(
        secondEscrow
          .confirmAttendanceWithAttestation(
            1,
            ctx.provider.address,
            validUntil,
            firstContractSignature,
          ),
        "InvalidAttestationSignature",
      );
    });

    it("rejects duplicate use after attendance is already confirmed", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      const validUntil =
        timing.startTime + timing.gracePeriod;

      const signature = await signAttendance(
        ctx.escrow,
        ctx.attestor,
        1n,
        ctx.provider.address,
        validUntil,
      );

      await ctx.escrow
        .confirmAttendanceWithAttestation(
          1,
          ctx.provider.address,
          validUntil,
          signature,
        );

      await expectCustomError(
        ctx.escrow
          .confirmAttendanceWithAttestation(
            1,
            ctx.provider.address,
            validUntil,
            signature,
          ),
        "InvalidState",
      );
    });

    it("refunds both parties if a platform never supplies attestations", async function () {
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
    });

    it("rejects a platform attestor that is also a reservation party or arbiter", async function () {
      const providerConflict = await deployFixture();
      const now = await latest();

      await expectCustomError(
        providerConflict.escrow
          .connect(providerConflict.provider)
          .createReservation(
            providerConflict.customer.address,
            providerConflict.provider.address,
            COMMITMENT,
            now + 7_200,
            now + 3_600,
            900,
            3_600,
            3_600,
            7_200,
            METADATA_HASH,
          ),
        "InvalidAddress",
      );

      const customerConflict = await deployFixture();
      const secondNow = await latest();

      await expectCustomError(
        customerConflict.escrow
          .connect(customerConflict.provider)
          .createReservation(
            customerConflict.customer.address,
            customerConflict.customer.address,
            COMMITMENT,
            secondNow + 7_200,
            secondNow + 3_600,
            900,
            3_600,
            3_600,
            7_200,
            METADATA_HASH,
          ),
        "InvalidAddress",
      );

      const arbiterConflict = await deployFixture();
      const thirdNow = await latest();

      await expectCustomError(
        arbiterConflict.escrow
          .connect(arbiterConflict.provider)
          .createReservation(
            arbiterConflict.customer.address,
            arbiterConflict.arbiter.address,
            COMMITMENT,
            thirdNow + 7_200,
            thirdNow + 3_600,
            900,
            3_600,
            3_600,
            7_200,
            METADATA_HASH,
          ),
        "InvalidAddress",
      );
    });

    it("matches the standard EIP-712 digest", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      const validUntil =
        timing.startTime + timing.gracePeriod;

      const network =
        await ethers.provider.getNetwork();

      const domain = {
        name: "CommitPass",
        version: "3",
        chainId: network.chainId,
        verifyingContract:
          await ctx.escrow.getAddress(),
      };

      const types = {
        AttendanceAttestation: [
          {
            name: "reservationId",
            type: "uint256",
          },
          {
            name: "participant",
            type: "address",
          },
          {
            name: "validUntil",
            type: "uint64",
          },
        ],
      };

      const expected =
        ethers.TypedDataEncoder.hash(
          domain,
          types,
          {
            reservationId: 1n,
            participant:
              ctx.provider.address,
            validUntil,
          },
        );

      expect(
        await ctx.escrow
          .attendanceAttestationDigest(
            1,
            ctx.provider.address,
            validUntil,
          ),
      ).to.equal(expected);
    });

    it("rejects platform attestation calls in self-attested mode", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(
        ctx,
        ethers.ZeroAddress,
      );

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      await expectCustomError(
        ctx.escrow
          .confirmAttendanceWithAttestation(
            1,
            ctx.provider.address,
            timing.startTime
              + timing.gracePeriod,
            "0x",
          ),
        "PlatformAttestationNotEnabled",
      );
    });

    it("rejects a signature created for another chain ID", async function () {
      const ctx = await deployFixture();
      const timing = await createAndAccept(ctx);

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      const validUntil =
        timing.startTime + timing.gracePeriod;

      const domain = {
        name: "CommitPass",
        version: "3",
        chainId: 1n,
        verifyingContract:
          await ctx.escrow.getAddress(),
      };

      const types = {
        AttendanceAttestation: [
          {
            name: "reservationId",
            type: "uint256",
          },
          {
            name: "participant",
            type: "address",
          },
          {
            name: "validUntil",
            type: "uint64",
          },
        ],
      };

      const signature =
        await ctx.attestor.signTypedData(
          domain,
          types,
          {
            reservationId: 1n,
            participant:
              ctx.provider.address,
            validUntil,
          },
        );

      await expectCustomError(
        ctx.escrow
          .confirmAttendanceWithAttestation(
            1,
            ctx.provider.address,
            validUntil,
            signature,
          ),
        "InvalidAttestationSignature",
      );
    });

    it("accepts an ERC-1271 platform wallet attestation", async function () {
      const ctx = await deployFixture();

      const MockAttestor =
        await ethers.getContractFactory(
          "MockERC1271Attestor",
        );
      const contractAttestor =
        await MockAttestor.deploy(
          ctx.attestor.address,
        );

      const timing = await createAndAccept(
        ctx,
        await contractAttestor.getAddress(),
      );

      await increaseTo(
        timing.startTime - timing.gracePeriod,
      );

      const validUntil =
        timing.startTime + timing.gracePeriod;

      const signature = await signAttendance(
        ctx.escrow,
        ctx.attestor,
        1n,
        ctx.provider.address,
        validUntil,
      );

      await ctx.escrow
        .connect(ctx.outsider)
        .confirmAttendanceWithAttestation(
          1,
          ctx.provider.address,
          validUntil,
          signature,
        );

      const reservation =
        await ctx.escrow.getReservation(1);

      expect(reservation.providerConfirmed).to.equal(
        true,
      );
      expect(reservation.attendanceAttestor).to.equal(
        await contractAttestor.getAddress(),
      );
    });
  },
);
