// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MutualCommitmentEscrowV3
/// @notice Symmetric two-sided USDC commitments for scarce reservations and services.
/// @dev Metadata and evidence must be salted offchain before their hashes are submitted.
contract MutualCommitmentEscrowV3 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint128 public constant MIN_COMMITMENT = 100_000; // 0.10 USDC
    uint128 public constant MAX_COMMITMENT = 10_000_000_000; // 10,000 USDC

    uint64 public constant MIN_CANCELLATION_LEAD = 15 minutes;
    uint64 public constant MIN_GRACE_PERIOD = 5 minutes;
    uint64 public constant MAX_GRACE_PERIOD = 2 hours;
    uint64 public constant MIN_CLAIM_WINDOW = 1 hours;
    uint64 public constant MAX_CLAIM_WINDOW = 72 hours;
    uint64 public constant MIN_DISPUTE_WINDOW = 1 hours;
    uint64 public constant MAX_DISPUTE_WINDOW = 72 hours;
    uint64 public constant MIN_ARBITER_WINDOW = 1 hours;
    uint64 public constant MAX_ARBITER_WINDOW = 7 days;

    enum Status {
        None,
        AwaitingCustomer,
        Active,
        ClaimPending,
        Disputed,
        Resolved,
        Cancelled
    }

    enum Outcome {
        None,
        Completed,
        CustomerNoShow,
        ProviderNoShow,
        RefundBoth
    }

    struct Reservation {
        address provider;
        address customer;
        uint128 commitmentAmount;
        uint64 startTime;
        uint64 freeCancellationDeadline;
        uint64 gracePeriod;
        uint64 claimWindow;
        uint64 disputeWindow;
        uint64 arbiterWindow;
        uint64 claimOpenedAt;
        uint64 disputedAt;
        Status status;
        Outcome pendingOutcome;
        Outcome finalOutcome;
        bool providerConfirmed;
        bool customerConfirmed;
        bytes32 metadataHash;
        bytes32 claimEvidenceHash;
        bytes32 disputeEvidenceHash;
    }

    IERC20 public immutable usdc;
    address public immutable arbiter;
    uint256 public nextReservationId = 1;

    mapping(uint256 => Reservation) private reservations;

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidSchedule();
    error InvalidState();
    error TooEarly();
    error TooLate();
    error InvalidOutcome();
    error InvalidEvidence();
    error AttendanceNotConfirmed();

    event ReservationCreated(
        uint256 indexed reservationId,
        address indexed provider,
        address indexed customer,
        uint256 commitmentAmount,
        bytes32 metadataHash
    );
    event ReservationAccepted(uint256 indexed reservationId, address indexed customer);
    event AttendanceConfirmed(uint256 indexed reservationId, address indexed party);
    event ReservationCancelled(uint256 indexed reservationId, address indexed cancelledBy);
    event ReservationExpired(uint256 indexed reservationId);
    event NoShowClaimOpened(
        uint256 indexed reservationId,
        address indexed claimant,
        Outcome outcome,
        bytes32 evidenceHash,
        uint256 disputeDeadline
    );
    event ClaimDisputed(
        uint256 indexed reservationId,
        address indexed disputedBy,
        bytes32 evidenceHash,
        uint256 arbiterDeadline
    );
    event StaleReservationRefunded(uint256 indexed reservationId);
    event ExpiredDisputeRefunded(uint256 indexed reservationId);
    event ReservationResolved(uint256 indexed reservationId, Outcome outcome);

    constructor(address usdcAddress, address arbiterAddress) {
        if (usdcAddress == address(0) || arbiterAddress == address(0)) {
            revert InvalidAddress();
        }

        usdc = IERC20(usdcAddress);
        arbiter = arbiterAddress;
    }

    function createReservation(
        address customer,
        uint128 commitmentAmount,
        uint64 startTime,
        uint64 freeCancellationDeadline,
        uint64 gracePeriod,
        uint64 claimWindow,
        uint64 disputeWindow,
        uint64 arbiterWindow,
        bytes32 metadataHash
    ) external nonReentrant returns (uint256 reservationId) {
        if (customer == address(0) || customer == msg.sender) {
            revert InvalidAddress();
        }

        if (
            commitmentAmount < MIN_COMMITMENT
                || commitmentAmount > MAX_COMMITMENT
        ) {
            revert InvalidAmount();
        }

        if (metadataHash == bytes32(0)) {
            revert InvalidEvidence();
        }

        if (
            uint256(freeCancellationDeadline)
                < block.timestamp + MIN_CANCELLATION_LEAD
                || uint256(startTime)
                    <= uint256(freeCancellationDeadline)
                        + MIN_CANCELLATION_LEAD
                || gracePeriod < MIN_GRACE_PERIOD
                || gracePeriod > MAX_GRACE_PERIOD
                || claimWindow < MIN_CLAIM_WINDOW
                || claimWindow > MAX_CLAIM_WINDOW
                || disputeWindow < MIN_DISPUTE_WINDOW
                || disputeWindow > MAX_DISPUTE_WINDOW
                || arbiterWindow < MIN_ARBITER_WINDOW
                || arbiterWindow > MAX_ARBITER_WINDOW
        ) {
            revert InvalidSchedule();
        }

        reservationId = nextReservationId++;

        reservations[reservationId] = Reservation({
            provider: msg.sender,
            customer: customer,
            commitmentAmount: commitmentAmount,
            startTime: startTime,
            freeCancellationDeadline: freeCancellationDeadline,
            gracePeriod: gracePeriod,
            claimWindow: claimWindow,
            disputeWindow: disputeWindow,
            arbiterWindow: arbiterWindow,
            claimOpenedAt: 0,
            disputedAt: 0,
            status: Status.AwaitingCustomer,
            pendingOutcome: Outcome.None,
            finalOutcome: Outcome.None,
            providerConfirmed: false,
            customerConfirmed: false,
            metadataHash: metadataHash,
            claimEvidenceHash: bytes32(0),
            disputeEvidenceHash: bytes32(0)
        });

        usdc.safeTransferFrom(
            msg.sender,
            address(this),
            commitmentAmount
        );

        emit ReservationCreated(
            reservationId,
            msg.sender,
            customer,
            commitmentAmount,
            metadataHash
        );
    }

    function acceptReservation(uint256 reservationId) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);

        if (msg.sender != reservation.customer) {
            revert Unauthorized();
        }
        if (reservation.status != Status.AwaitingCustomer) {
            revert InvalidState();
        }
        if (block.timestamp > reservation.freeCancellationDeadline) {
            revert TooLate();
        }

        reservation.status = Status.Active;

        usdc.safeTransferFrom(
            msg.sender,
            address(this),
            reservation.commitmentAmount
        );

        emit ReservationAccepted(reservationId, msg.sender);
    }

    function cancelReservation(uint256 reservationId) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);

        if (
            msg.sender != reservation.provider
                && msg.sender != reservation.customer
        ) {
            revert Unauthorized();
        }

        if (
            reservation.status != Status.AwaitingCustomer
                && reservation.status != Status.Active
        ) {
            revert InvalidState();
        }

        if (block.timestamp > reservation.freeCancellationDeadline) {
            revert TooLate();
        }

        if (
            reservation.status == Status.AwaitingCustomer
                && msg.sender != reservation.provider
        ) {
            revert Unauthorized();
        }

        Status previousStatus = reservation.status;
        reservation.status = Status.Cancelled;
        reservation.finalOutcome = Outcome.RefundBoth;

        usdc.safeTransfer(
            reservation.provider,
            reservation.commitmentAmount
        );

        if (previousStatus == Status.Active) {
            usdc.safeTransfer(
                reservation.customer,
                reservation.commitmentAmount
            );
        }

        emit ReservationCancelled(reservationId, msg.sender);
        emit ReservationResolved(reservationId, Outcome.RefundBoth);
    }

    function expireUnacceptedReservation(
        uint256 reservationId
    ) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);

        if (reservation.status != Status.AwaitingCustomer) {
            revert InvalidState();
        }
        if (block.timestamp <= reservation.freeCancellationDeadline) {
            revert TooEarly();
        }

        reservation.status = Status.Cancelled;
        reservation.finalOutcome = Outcome.RefundBoth;

        usdc.safeTransfer(
            reservation.provider,
            reservation.commitmentAmount
        );

        emit ReservationExpired(reservationId);
        emit ReservationResolved(reservationId, Outcome.RefundBoth);
    }

    function confirmAttendance(
        uint256 reservationId
    ) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);

        if (reservation.status != Status.Active) {
            revert InvalidState();
        }

        if (
            block.timestamp + reservation.gracePeriod
                < reservation.startTime
        ) {
            revert TooEarly();
        }

        if (block.timestamp > _attendanceDeadline(reservation)) {
            revert TooLate();
        }

        if (msg.sender == reservation.provider) {
            if (reservation.providerConfirmed) {
                revert InvalidState();
            }
            reservation.providerConfirmed = true;
        } else if (msg.sender == reservation.customer) {
            if (reservation.customerConfirmed) {
                revert InvalidState();
            }
            reservation.customerConfirmed = true;
        } else {
            revert Unauthorized();
        }

        emit AttendanceConfirmed(reservationId, msg.sender);

        if (
            reservation.providerConfirmed
                && reservation.customerConfirmed
        ) {
            _settle(
                reservationId,
                reservation,
                Outcome.Completed
            );
        }
    }

    function openNoShowClaim(
        uint256 reservationId,
        Outcome outcome,
        bytes32 evidenceHash
    ) external {
        Reservation storage reservation = _reservation(reservationId);

        if (reservation.status != Status.Active) {
            revert InvalidState();
        }
        if (evidenceHash == bytes32(0)) {
            revert InvalidEvidence();
        }

        uint256 attendanceEnd = _attendanceDeadline(reservation);

        if (block.timestamp <= attendanceEnd) {
            revert TooEarly();
        }
        if (
            block.timestamp
                > attendanceEnd + reservation.claimWindow
        ) {
            revert TooLate();
        }

        if (outcome == Outcome.CustomerNoShow) {
            if (msg.sender != reservation.provider) {
                revert Unauthorized();
            }
            if (reservation.customerConfirmed) {
                revert InvalidOutcome();
            }
            if (!reservation.providerConfirmed) {
                revert AttendanceNotConfirmed();
            }
        } else if (outcome == Outcome.ProviderNoShow) {
            if (msg.sender != reservation.customer) {
                revert Unauthorized();
            }
            if (reservation.providerConfirmed) {
                revert InvalidOutcome();
            }
            if (!reservation.customerConfirmed) {
                revert AttendanceNotConfirmed();
            }
        } else {
            revert InvalidOutcome();
        }

        reservation.status = Status.ClaimPending;
        reservation.pendingOutcome = outcome;
        reservation.claimOpenedAt = uint64(block.timestamp);
        reservation.claimEvidenceHash = evidenceHash;

        emit NoShowClaimOpened(
            reservationId,
            msg.sender,
            outcome,
            evidenceHash,
            block.timestamp + reservation.disputeWindow
        );
    }

    function disputeClaim(
        uint256 reservationId,
        bytes32 evidenceHash
    ) external {
        Reservation storage reservation = _reservation(reservationId);

        if (reservation.status != Status.ClaimPending) {
            revert InvalidState();
        }
        if (evidenceHash == bytes32(0)) {
            revert InvalidEvidence();
        }
        if (
            block.timestamp
                > uint256(reservation.claimOpenedAt)
                    + reservation.disputeWindow
        ) {
            revert TooLate();
        }

        if (
            reservation.pendingOutcome
                == Outcome.CustomerNoShow
        ) {
            if (msg.sender != reservation.customer) {
                revert Unauthorized();
            }
        } else if (
            reservation.pendingOutcome
                == Outcome.ProviderNoShow
        ) {
            if (msg.sender != reservation.provider) {
                revert Unauthorized();
            }
        } else {
            revert InvalidOutcome();
        }

        reservation.status = Status.Disputed;
        reservation.disputedAt = uint64(block.timestamp);
        reservation.disputeEvidenceHash = evidenceHash;

        emit ClaimDisputed(
            reservationId,
            msg.sender,
            evidenceHash,
            block.timestamp + reservation.arbiterWindow
        );
    }

    function finalizeUndisputedClaim(
        uint256 reservationId
    ) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);

        if (reservation.status != Status.ClaimPending) {
            revert InvalidState();
        }
        if (
            block.timestamp
                <= uint256(reservation.claimOpenedAt)
                    + reservation.disputeWindow
        ) {
            revert TooEarly();
        }

        _settle(
            reservationId,
            reservation,
            reservation.pendingOutcome
        );
    }

    function resolveDispute(
        uint256 reservationId,
        Outcome outcome
    ) external nonReentrant {
        if (msg.sender != arbiter) {
            revert Unauthorized();
        }

        Reservation storage reservation = _reservation(reservationId);

        if (reservation.status != Status.Disputed) {
            revert InvalidState();
        }
        if (
            block.timestamp
                > uint256(reservation.disputedAt)
                    + reservation.arbiterWindow
        ) {
            revert TooLate();
        }
        if (
            outcome != Outcome.Completed
                && outcome != Outcome.CustomerNoShow
                && outcome != Outcome.ProviderNoShow
                && outcome != Outcome.RefundBoth
        ) {
            revert InvalidOutcome();
        }

        _settle(reservationId, reservation, outcome);
    }

    function refundStaleReservation(
        uint256 reservationId
    ) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);

        if (reservation.status != Status.Active) {
            revert InvalidState();
        }
        if (
            block.timestamp
                <= _attendanceDeadline(reservation)
                    + reservation.claimWindow
        ) {
            revert TooEarly();
        }

        _settle(
            reservationId,
            reservation,
            Outcome.RefundBoth
        );

        emit StaleReservationRefunded(reservationId);
    }

    function refundExpiredDispute(
        uint256 reservationId
    ) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);

        if (reservation.status != Status.Disputed) {
            revert InvalidState();
        }
        if (
            block.timestamp
                <= uint256(reservation.disputedAt)
                    + reservation.arbiterWindow
        ) {
            revert TooEarly();
        }

        _settle(
            reservationId,
            reservation,
            Outcome.RefundBoth
        );

        emit ExpiredDisputeRefunded(reservationId);
    }

    function getReservation(
        uint256 reservationId
    ) external view returns (Reservation memory) {
        return _reservation(reservationId);
    }

    function attendanceDeadline(
        uint256 reservationId
    ) external view returns (uint256) {
        return _attendanceDeadline(_reservation(reservationId));
    }

    function claimOpeningDeadline(
        uint256 reservationId
    ) external view returns (uint256) {
        Reservation storage reservation = _reservation(reservationId);

        return
            _attendanceDeadline(reservation)
                + reservation.claimWindow;
    }

    function disputeDeadline(
        uint256 reservationId
    ) external view returns (uint256) {
        Reservation storage reservation = _reservation(reservationId);

        if (reservation.claimOpenedAt == 0) {
            return 0;
        }

        return
            uint256(reservation.claimOpenedAt)
                + reservation.disputeWindow;
    }

    function arbiterDeadline(
        uint256 reservationId
    ) external view returns (uint256) {
        Reservation storage reservation = _reservation(reservationId);

        if (reservation.disputedAt == 0) {
            return 0;
        }

        return
            uint256(reservation.disputedAt)
                + reservation.arbiterWindow;
    }

    function _settle(
        uint256 reservationId,
        Reservation storage reservation,
        Outcome outcome
    ) private {
        reservation.status = Status.Resolved;
        reservation.finalOutcome = outcome;
        reservation.pendingOutcome = Outcome.None;

        uint256 commitmentAmount =
            reservation.commitmentAmount;
        uint256 providerAmount;
        uint256 customerAmount;

        if (
            outcome == Outcome.Completed
                || outcome == Outcome.RefundBoth
        ) {
            providerAmount = commitmentAmount;
            customerAmount = commitmentAmount;
        } else if (outcome == Outcome.CustomerNoShow) {
            providerAmount = commitmentAmount * 2;
        } else if (outcome == Outcome.ProviderNoShow) {
            customerAmount = commitmentAmount * 2;
        } else {
            revert InvalidOutcome();
        }

        if (providerAmount > 0) {
            usdc.safeTransfer(
                reservation.provider,
                providerAmount
            );
        }

        if (customerAmount > 0) {
            usdc.safeTransfer(
                reservation.customer,
                customerAmount
            );
        }

        emit ReservationResolved(reservationId, outcome);
    }

    function _attendanceDeadline(
        Reservation storage reservation
    ) private view returns (uint256) {
        return
            uint256(reservation.startTime)
                + reservation.gracePeriod;
    }

    function _reservation(
        uint256 reservationId
    ) private view returns (Reservation storage reservation) {
        reservation = reservations[reservationId];

        if (reservation.status == Status.None) {
            revert InvalidState();
        }
    }
}
