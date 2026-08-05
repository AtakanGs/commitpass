# Platform Attendance Attestations

CommitPass V3 can require a booking platform to cryptographically attest attendance.

## Reservation modes

### Self-attested

`attendanceAttestor` is the zero address.

Each reservation party calls:

```solidity
confirmAttendance(reservationId)
```

### Platform-verified

`attendanceAttestor` is a dedicated platform signer or an ERC-1271-compatible platform wallet.

Direct self-attendance is disabled. A platform or relayer calls:

```solidity
confirmAttendanceWithAttestation(
    reservationId,
    participant,
    validUntil,
    signature
)
```

## EIP-712 payload

Domain:

```text
name: CommitPass
version: 3
chainId: current chain
verifyingContract: deployed V3 contract
```

Type:

```text
AttendanceAttestation(
    uint256 reservationId,
    address participant,
    uint64 validUntil
)
```

The signed data is bound to one participant, one reservation, one network and one contract deployment.

## Platform responsibility

The platform must sign only after its own trusted attendance mechanism succeeds. Examples include:

- an authenticated video-session join record
- an in-venue terminal check-in
- a staff-confirmed service visit
- a ticketing or access-control event

The platform signer must never be exposed to the browser or a public endpoint that signs arbitrary requests.

A production signing service should:

1. authenticate the platform operator or trusted internal event
2. verify the reservation and participant
3. verify that the underlying attendance event occurred
4. enforce a short `validUntil`
5. record an auditable internal event ID
6. rate-limit signing
7. keep the signer in a managed key system or multisig-compatible service

## Failure behavior

If the platform does not sign, direct attendance cannot be used in platform-verified mode.

The party that did not receive an attestation cannot fabricate a no-show claim because a claimant must first have confirmed attendance. After the attendance and claim windows end, anyone may call `refundStaleReservation`, which returns each party's commitment.

## Trust boundary

An EIP-712 signature proves that the configured platform signed the assertion. It does not prove that the platform's source data was honest, accurate or resistant to internal compromise.

CommitPass therefore treats platform selection as a visible reservation term that the customer accepts before locking funds.
