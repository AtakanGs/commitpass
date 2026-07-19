// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MutualCommitmentEscrow
/// @notice Two-sided refundable commitments for scarce reservations and services.
/// @dev No personal data should be stored in metadataHash. Use a salted offchain reference.
contract MutualCommitmentEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

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
        uint128 providerCommitment;
        uint128 customerCommitment;
        uint128 providerCompensation;
        uint64 startTime;
        uint64 freeCancellationDeadline;
        uint64 gracePeriod;
        uint64 disputeWindow;
        uint64 claimOpenedAt;
        Status status;
        Outcome pendingOutcome;
        Outcome finalOutcome;
        bool providerConfirmed;
        bool customerConfirmed;
        bytes32 metadataHash;
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

    event ReservationCreated(
        uint256 indexed reservationId,
        address indexed provider,
        address indexed customer,
        uint256 providerCommitment,
        uint256 customerCommitment,
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
        uint256 disputeDeadline
    );
    event ClaimDisputed(uint256 indexed reservationId, address indexed disputedBy);
    event ReservationResolved(uint256 indexed reservationId, Outcome outcome);

    constructor(address usdcAddress, address arbiterAddress) {
        if (usdcAddress == address(0) || arbiterAddress == address(0)) revert InvalidAddress();
        usdc = IERC20(usdcAddress);
        arbiter = arbiterAddress;
    }

    function createReservation(
        address customer,
        uint128 providerCommitment,
        uint128 customerCommitment,
        uint128 providerCompensation,
        uint64 startTime,
        uint64 freeCancellationDeadline,
        uint64 gracePeriod,
        uint64 disputeWindow,
        bytes32 metadataHash
    ) external nonReentrant returns (uint256 reservationId) {
        if (customer == address(0) || customer == msg.sender) revert InvalidAddress();
        if (
            providerCommitment == 0 || customerCommitment == 0
                || providerCompensation > providerCommitment
        ) revert InvalidAmount();
        if (
            freeCancellationDeadline <= block.timestamp || startTime <= freeCancellationDeadline
                || gracePeriod == 0 || disputeWindow == 0
        ) revert InvalidSchedule();

        reservationId = nextReservationId++;
        reservations[reservationId] = Reservation({
            provider: msg.sender,
            customer: customer,
            providerCommitment: providerCommitment,
            customerCommitment: customerCommitment,
            providerCompensation: providerCompensation,
            startTime: startTime,
            freeCancellationDeadline: freeCancellationDeadline,
            gracePeriod: gracePeriod,
            disputeWindow: disputeWindow,
            claimOpenedAt: 0,
            status: Status.AwaitingCustomer,
            pendingOutcome: Outcome.None,
            finalOutcome: Outcome.None,
            providerConfirmed: false,
            customerConfirmed: false,
            metadataHash: metadataHash
        });

        usdc.safeTransferFrom(msg.sender, address(this), providerCommitment);
        emit ReservationCreated(
            reservationId,
            msg.sender,
            customer,
            providerCommitment,
            customerCommitment,
            metadataHash
        );
    }

    function acceptReservation(uint256 reservationId) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);
        if (msg.sender != reservation.customer) revert Unauthorized();
        if (reservation.status != Status.AwaitingCustomer) revert InvalidState();
        if (block.timestamp > reservation.freeCancellationDeadline) revert TooLate();

        reservation.status = Status.Active;
        usdc.safeTransferFrom(msg.sender, address(this), reservation.customerCommitment);
        emit ReservationAccepted(reservationId, msg.sender);
    }

    function cancelReservation(uint256 reservationId) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);
        if (msg.sender != reservation.provider && msg.sender != reservation.customer) {
            revert Unauthorized();
        }
        if (
            reservation.status != Status.AwaitingCustomer && reservation.status != Status.Active
        ) revert InvalidState();
        if (block.timestamp > reservation.freeCancellationDeadline) revert TooLate();
        if (reservation.status == Status.AwaitingCustomer && msg.sender != reservation.provider) {
            revert Unauthorized();
        }

        Status previousStatus = reservation.status;
        reservation.status = Status.Cancelled;
        reservation.finalOutcome = Outcome.RefundBoth;

        usdc.safeTransfer(reservation.provider, reservation.providerCommitment);
        if (previousStatus == Status.Active) {
            usdc.safeTransfer(reservation.customer, reservation.customerCommitment);
        }

        emit ReservationCancelled(reservationId, msg.sender);
        emit ReservationResolved(reservationId, Outcome.RefundBoth);
    }

    function expireUnacceptedReservation(uint256 reservationId) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);
        if (reservation.status != Status.AwaitingCustomer) revert InvalidState();
        if (block.timestamp <= reservation.freeCancellationDeadline) revert TooEarly();

        reservation.status = Status.Cancelled;
        reservation.finalOutcome = Outcome.RefundBoth;
        usdc.safeTransfer(reservation.provider, reservation.providerCommitment);

        emit ReservationExpired(reservationId);
        emit ReservationResolved(reservationId, Outcome.RefundBoth);
    }

    function confirmAttendance(uint256 reservationId) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);
        if (reservation.status != Status.Active) revert InvalidState();
        if (block.timestamp + reservation.gracePeriod < reservation.startTime) revert TooEarly();
        if (block.timestamp > uint256(reservation.startTime) + reservation.gracePeriod) {
            revert TooLate();
        }

        if (msg.sender == reservation.provider) {
            if (reservation.providerConfirmed) revert InvalidState();
            reservation.providerConfirmed = true;
        } else if (msg.sender == reservation.customer) {
            if (reservation.customerConfirmed) revert InvalidState();
            reservation.customerConfirmed = true;
        } else {
            revert Unauthorized();
        }

        emit AttendanceConfirmed(reservationId, msg.sender);

        if (reservation.providerConfirmed && reservation.customerConfirmed) {
            _settle(reservationId, reservation, Outcome.Completed);
        }
    }

    function openNoShowClaim(uint256 reservationId, Outcome outcome) external {
        Reservation storage reservation = _reservation(reservationId);
        if (reservation.status != Status.Active) revert InvalidState();
        if (block.timestamp <= uint256(reservation.startTime) + reservation.gracePeriod) {
            revert TooEarly();
        }

        if (outcome == Outcome.CustomerNoShow) {
            if (msg.sender != reservation.provider) revert Unauthorized();
            if (reservation.customerConfirmed) revert InvalidOutcome();
        } else if (outcome == Outcome.ProviderNoShow) {
            if (msg.sender != reservation.customer) revert Unauthorized();
            if (reservation.providerConfirmed) revert InvalidOutcome();
        } else {
            revert InvalidOutcome();
        }

        reservation.status = Status.ClaimPending;
        reservation.pendingOutcome = outcome;
        reservation.claimOpenedAt = uint64(block.timestamp);

        emit NoShowClaimOpened(
            reservationId,
            msg.sender,
            outcome,
            block.timestamp + reservation.disputeWindow
        );
    }

    function disputeClaim(uint256 reservationId) external {
        Reservation storage reservation = _reservation(reservationId);
        if (reservation.status != Status.ClaimPending) revert InvalidState();
        if (block.timestamp > uint256(reservation.claimOpenedAt) + reservation.disputeWindow) {
            revert TooLate();
        }

        if (reservation.pendingOutcome == Outcome.CustomerNoShow) {
            if (msg.sender != reservation.customer) revert Unauthorized();
        } else if (reservation.pendingOutcome == Outcome.ProviderNoShow) {
            if (msg.sender != reservation.provider) revert Unauthorized();
        } else {
            revert InvalidOutcome();
        }

        reservation.status = Status.Disputed;
        emit ClaimDisputed(reservationId, msg.sender);
    }

    function finalizeUndisputedClaim(uint256 reservationId) external nonReentrant {
        Reservation storage reservation = _reservation(reservationId);
        if (reservation.status != Status.ClaimPending) revert InvalidState();
        if (block.timestamp <= uint256(reservation.claimOpenedAt) + reservation.disputeWindow) {
            revert TooEarly();
        }
        _settle(reservationId, reservation, reservation.pendingOutcome);
    }

    function resolveDispute(uint256 reservationId, Outcome outcome) external nonReentrant {
        if (msg.sender != arbiter) revert Unauthorized();
        Reservation storage reservation = _reservation(reservationId);
        if (reservation.status != Status.Disputed) revert InvalidState();
        if (
            outcome != Outcome.Completed && outcome != Outcome.CustomerNoShow
                && outcome != Outcome.ProviderNoShow && outcome != Outcome.RefundBoth
        ) revert InvalidOutcome();
        _settle(reservationId, reservation, outcome);
    }

    function emergencyRefund(uint256 reservationId) external nonReentrant {
        if (msg.sender != arbiter) revert Unauthorized();
        Reservation storage reservation = _reservation(reservationId);
        if (
            reservation.status != Status.Active && reservation.status != Status.ClaimPending
                && reservation.status != Status.Disputed
        ) revert InvalidState();
        _settle(reservationId, reservation, Outcome.RefundBoth);
    }

    function getReservation(uint256 reservationId) external view returns (Reservation memory) {
        return _reservation(reservationId);
    }

    function claimDeadline(uint256 reservationId) external view returns (uint256) {
        Reservation storage reservation = _reservation(reservationId);
        if (reservation.claimOpenedAt == 0) return 0;
        return uint256(reservation.claimOpenedAt) + reservation.disputeWindow;
    }

    function _settle(
        uint256 reservationId,
        Reservation storage reservation,
        Outcome outcome
    ) private {
        reservation.status = Status.Resolved;
        reservation.finalOutcome = outcome;
        reservation.pendingOutcome = Outcome.None;

        uint256 providerAmount;
        uint256 customerAmount;

        if (outcome == Outcome.Completed || outcome == Outcome.RefundBoth) {
            providerAmount = reservation.providerCommitment;
            customerAmount = reservation.customerCommitment;
        } else if (outcome == Outcome.CustomerNoShow) {
            providerAmount = uint256(reservation.providerCommitment)
                + uint256(reservation.customerCommitment);
        } else if (outcome == Outcome.ProviderNoShow) {
            customerAmount = uint256(reservation.customerCommitment)
                + uint256(reservation.providerCompensation);
            providerAmount = uint256(reservation.providerCommitment)
                - uint256(reservation.providerCompensation);
        } else {
            revert InvalidOutcome();
        }

        if (providerAmount > 0) usdc.safeTransfer(reservation.provider, providerAmount);
        if (customerAmount > 0) usdc.safeTransfer(reservation.customer, customerAmount);

        emit ReservationResolved(reservationId, outcome);
    }

    function _reservation(uint256 reservationId)
        private
        view
        returns (Reservation storage reservation)
    {
        reservation = reservations[reservationId];
        if (reservation.status == Status.None) revert InvalidState();
    }
}
