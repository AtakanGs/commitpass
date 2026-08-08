import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  verifyMessage,
  type Address,
  type Hex,
} from "viem";
import {
  privateKeyToAccount,
} from "viem/accounts";

import {
  commitmentEscrowAbi,
} from "@/lib/abis";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_RPC,
  arcTestnet,
} from "@/lib/arc";
import {
  verifyReservationMetadata,
} from "@/lib/metadata";
import {
  overlapDurationSeconds,
  normalizeSessionIntervals,
  sessionPolicyFromQuery,
  type DigitalSessionPolicy,
  type SessionInterval,
} from "@/lib/sessionPolicy";
import {
  presenceAuthorizationMessage,
  type LivePresencePolicyInput,
} from "@/lib/presenceProtocol";

const FINAL_V3_ADDRESS =
  "0x66592bDB161b2C68ceFB4133Cfa0dB08eD2Ff791";

const HEARTBEAT_CONNECTED_SECONDS = 12;
const HEARTBEAT_MAX_GAP_SECONDS = 12;
const TOKEN_MAX_SECONDS = 2 * 60 * 60;
const ATTESTATION_TTL_SECONDS = 300n;

type PresenceSide = {
  lastSeen?: number;
  intervals: SessionInterval[];
};

export type LivePresenceSettlement = {
  providerTransaction?: Hex;
  customerTransaction?: Hex;
  finalOutcome: number;
  status: number;
};

type LivePresenceRoom = {
  reservationId: bigint;
  provider: Address;
  customer: Address;
  attendanceAttestor: Address;
  startTime: number;
  attendanceDeadline: number;
  policy: DigitalSessionPolicy;
  providerPresence: PresenceSide;
  customerPresence: PresenceSide;
  settlement?: LivePresenceSettlement;
  settling?: Promise<LivePresenceSettlement>;
};

type PresenceTokenPayload = {
  version: 1;
  reservationId: string;
  participant: Address;
  expiresAt: number;
};

declare global {
  var __commitPassLivePresenceRooms:
    | Map<string, LivePresenceRoom>
    | undefined;
}

const rooms =
  globalThis.__commitPassLivePresenceRooms ??
  new Map<string, LivePresenceRoom>();

globalThis.__commitPassLivePresenceRooms = rooms;

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(
    process.env.ARC_RPC_URL?.trim() ||
      process.env.NEXT_PUBLIC_ARC_RPC_URL?.trim() ||
      ARC_TESTNET_RPC,
  ),
});

function contractAddress(): Address {
  const configured =
    process.env
      .NEXT_PUBLIC_COMMITPASS_CONTRACT_ADDRESS
      ?.trim();

  return getAddress(
    configured && isAddress(configured)
      ? configured
      : FINAL_V3_ADDRESS,
  );
}

function requiredPrivateKey(
  name: string,
): Hex {
  const value =
    process.env[name]?.trim();

  if (
    !value ||
    !/^0x[0-9a-fA-F]{64}$/.test(value)
  ) {
    throw new Error(
      `${name} is missing or invalid.`,
    );
  }

  return value as Hex;
}

function attestorAccount() {
  return privateKeyToAccount(
    requiredPrivateKey(
      "PLATFORM_ATTESTOR_PRIVATE_KEY",
    ),
  );
}

function relayerAccount() {
  const explicit =
    process.env
      .PRESENCE_RELAYER_PRIVATE_KEY
      ?.trim();

  const fallback =
    process.env
      .DEPLOYER_PRIVATE_KEY
      ?.trim();

  const value = explicit || fallback;

  if (
    !value ||
    !/^0x[0-9a-fA-F]{64}$/.test(value)
  ) {
    throw new Error(
      "PRESENCE_RELAYER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is required for automatic settlement.",
    );
  }

  return privateKeyToAccount(
    value as Hex,
  );
}

function tokenSecret() {
  const configured =
    process.env
      .COMMITPASS_PRESENCE_SESSION_SECRET
      ?.trim();

  const fallback =
    process.env
      .PLATFORM_ATTESTOR_PRIVATE_KEY
      ?.trim();

  if (!configured && !fallback) {
    throw new Error(
      "COMMITPASS_PRESENCE_SESSION_SECRET or PLATFORM_ATTESTOR_PRIVATE_KEY is required.",
    );
  }

  return createHash("sha256")
    .update(
      "commitpass-live-presence:" +
        (configured || fallback),
    )
    .digest();
}

function encodeBase64Url(
  value: string | Buffer,
) {
  return Buffer.from(value)
    .toString("base64url");
}

function issueToken(
  payload: PresenceTokenPayload,
) {
  const body = encodeBase64Url(
    JSON.stringify(payload),
  );
  const signature = createHmac(
    "sha256",
    tokenSecret(),
  )
    .update(body)
    .digest("base64url");

  return body + "." + signature;
}

function readToken(
  token: string,
): PresenceTokenPayload {
  const [body, signature, ...extra] =
    token.split(".");

  if (
    !body ||
    !signature ||
    extra.length > 0
  ) {
    throw new Error(
      "Presence token is invalid.",
    );
  }

  const expected = createHmac(
    "sha256",
    tokenSecret(),
  )
    .update(body)
    .digest();

  let actual: Buffer;

  try {
    actual = Buffer.from(
      signature,
      "base64url",
    );
  } catch {
    throw new Error(
      "Presence token signature is invalid.",
    );
  }

  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    throw new Error(
      "Presence token signature is invalid.",
    );
  }

  let payload:
    | PresenceTokenPayload
    | undefined;

  try {
    payload = JSON.parse(
      Buffer.from(
        body,
        "base64url",
      ).toString("utf8"),
    ) as PresenceTokenPayload;
  } catch {
    throw new Error(
      "Presence token payload is invalid.",
    );
  }

  if (
    payload.version !== 1 ||
    !/^[1-9]\d*$/.test(
      payload.reservationId,
    ) ||
    !isAddress(
      payload.participant,
    ) ||
    !Number.isSafeInteger(
      payload.expiresAt,
    ) ||
    payload.expiresAt <
      Math.floor(Date.now() / 1000)
  ) {
    throw new Error(
      "Presence token has expired or is invalid.",
    );
  }

  return {
    ...payload,
    participant: getAddress(
      payload.participant,
    ),
  };
}

function parseReservationId(
  value: string,
) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(
      "Reservation ID must be a positive integer.",
    );
  }

  return BigInt(value);
}

function parsePolicy(
  input: LivePresencePolicyInput,
) {
  const policy =
    sessionPolicyFromQuery({
      duration: input.duration,
      issue: input.issue,
      threshold: input.threshold,
    });

  if (!policy) {
    throw new Error(
      "A valid digital-session policy is required.",
    );
  }

  return policy;
}

async function readRoomSource(
  reservationId: bigint,
) {
  const [
    reservation,
    attendanceDeadline,
  ] = await Promise.all([
    publicClient.readContract({
      address: contractAddress(),
      abi: commitmentEscrowAbi,
      functionName: "getReservation",
      args: [reservationId],
    }),
    publicClient.readContract({
      address: contractAddress(),
      abi: commitmentEscrowAbi,
      functionName: "attendanceDeadline",
      args: [reservationId],
    }),
  ]);

  return {
    reservation,
    attendanceDeadline:
      Number(attendanceDeadline),
  };
}

function roomKey(
  reservationId: bigint,
) {
  return reservationId.toString();
}

function participantRole(
  room: LivePresenceRoom,
  participant: Address,
) {
  if (
    getAddress(participant) ===
    room.provider
  ) {
    return "provider" as const;
  }

  if (
    getAddress(participant) ===
    room.customer
  ) {
    return "customer" as const;
  }

  throw new Error(
    "The connected wallet is not a participant in this reservation.",
  );
}

function presenceFor(
  room: LivePresenceRoom,
  participant: Address,
) {
  const role = participantRole(
    room,
    participant,
  );

  return role === "provider"
    ? room.providerPresence
    : room.customerPresence;
}

function appendHeartbeat(
  side: PresenceSide,
  now: number,
) {
  const previousSeen =
    side.lastSeen;
  const current =
    side.intervals.at(-1);

  if (
    !current ||
    previousSeen === undefined ||
    now - previousSeen >
      HEARTBEAT_MAX_GAP_SECONDS
  ) {
    side.intervals.push({
      joinedAt: now,
      leftAt: now,
    });
  } else {
    current.leftAt =
      Math.max(
        current.leftAt,
        now,
      );
  }

  side.lastSeen = now;
}

function normalizedIntervals(
  room: LivePresenceRoom,
  side: PresenceSide,
) {
  const sessionEnd =
    room.startTime +
    room.policy.scheduledMinutes * 60;

  return normalizeSessionIntervals(
    side.intervals,
    room.startTime,
    sessionEnd,
  );
}

export function roomStatus(
  room: LivePresenceRoom,
) {
  const now =
    Math.floor(Date.now() / 1000);
  const providerIntervals =
    normalizedIntervals(
      room,
      room.providerPresence,
    );
  const customerIntervals =
    normalizedIntervals(
      room,
      room.customerPresence,
    );
  const overlapSeconds =
    overlapDurationSeconds(
      providerIntervals,
      customerIntervals,
    );
  const thresholdSeconds =
    room.policy
      .completionThresholdMinutes *
    60;

  const providerConnected =
    room.providerPresence
      .lastSeen !== undefined &&
    now -
      room.providerPresence.lastSeen <=
      HEARTBEAT_CONNECTED_SECONDS;
  const customerConnected =
    room.customerPresence
      .lastSeen !== undefined &&
    now -
      room.customerPresence.lastSeen <=
      HEARTBEAT_CONNECTED_SECONDS;

  return {
    reservationId:
      room.reservationId.toString(),
    provider: room.provider,
    customer: room.customer,
    startTime: room.startTime,
    policy: room.policy,
    providerConnected,
    customerConnected,
    overlapSeconds,
    thresholdSeconds,
    thresholdReached:
      overlapSeconds >= thresholdSeconds,
    attendanceDeadline:
      room.attendanceDeadline,
    settlement:
      room.settlement,
  };
}

export async function authorizePresence(
  input: {
    reservationId: string;
    participant: string;
    expiresAt: number;
    nonce: string;
    signature: Hex;
    title: string;
    salt: string;
    policy: LivePresencePolicyInput;
  },
) {
  const reservationId =
    parseReservationId(
      input.reservationId,
    );

  if (!isAddress(input.participant)) {
    throw new Error(
      "Participant address is invalid.",
    );
  }

  const participant =
    getAddress(input.participant);
  const now =
    Math.floor(Date.now() / 1000);

  if (
    !Number.isSafeInteger(
      input.expiresAt,
    ) ||
    input.expiresAt < now + 30 ||
    input.expiresAt >
      now + TOKEN_MAX_SECONDS
  ) {
    throw new Error(
      "Presence authorization expiry is outside the allowed window.",
    );
  }

  if (
    !input.nonce ||
    input.nonce.length > 128
  ) {
    throw new Error(
      "Presence authorization nonce is invalid.",
    );
  }

  const policy =
    parsePolicy(input.policy);
  const {
    reservation,
    attendanceDeadline,
  } = await readRoomSource(
    reservationId,
  );

  if (
    Number(
      reservation.status,
    ) !== 2
  ) {
    throw new Error(
      "The reservation must be Active before joining the live room.",
    );
  }

  const provider =
    getAddress(
      reservation.provider,
    );
  const customer =
    getAddress(
      reservation.customer,
    );

  if (
    participant !== provider &&
    participant !== customer
  ) {
    throw new Error(
      "The connected wallet is not a reservation participant.",
    );
  }

  const configuredAttestor =
    getAddress(
      reservation
        .attendanceAttestor,
    );
  const signer =
    attestorAccount();

  if (
    configuredAttestor !==
    signer.address
  ) {
    throw new Error(
      "This reservation is not configured for the local CommitPass live-presence signer.",
    );
  }

  if (
    !verifyReservationMetadata(
      input.title,
      reservation.metadataHash,
      input.salt,
      policy,
    )
  ) {
    throw new Error(
      "The live-room terms do not match the committed reservation metadata.",
    );
  }

  const message =
    presenceAuthorizationMessage({
      reservationId:
        reservationId.toString(),
      participant,
      expiresAt:
        input.expiresAt,
      nonce: input.nonce,
    });

  const signatureValid =
    await verifyMessage({
      address: participant,
      message,
      signature:
        input.signature,
    });

  if (!signatureValid) {
    throw new Error(
      "Wallet presence authorization signature is invalid.",
    );
  }

  const key =
    roomKey(reservationId);
  let room =
    rooms.get(key);

  if (!room) {
    room = {
      reservationId,
      provider,
      customer,
      attendanceAttestor:
        configuredAttestor,
      startTime: Number(
        reservation.startTime,
      ),
      attendanceDeadline,
      policy,
      providerPresence: {
        intervals: [],
      },
      customerPresence: {
        intervals: [],
      },
    };

    rooms.set(key, room);
  } else {
    if (
      room.provider !== provider ||
      room.customer !== customer ||
      room.startTime !==
        Number(
          reservation.startTime,
        )
    ) {
      throw new Error(
        "Live room state does not match the current reservation.",
      );
    }
  }

  const token =
    issueToken({
      version: 1,
      reservationId:
        reservationId.toString(),
      participant,
      expiresAt:
        Math.min(
          input.expiresAt,
          now + TOKEN_MAX_SECONDS,
        ),
    });

  return {
    token,
    role:
      participantRole(
        room,
        participant,
      ),
    status:
      roomStatus(room),
  };
}

export function heartbeatPresence(
  token: string,
) {
  const payload =
    readToken(token);
  const room =
    rooms.get(
      payload.reservationId,
    );

  if (!room) {
    throw new Error(
      "Live room state is unavailable. Rejoin the room.",
    );
  }

  const now =
    Math.floor(Date.now() / 1000);

  appendHeartbeat(
    presenceFor(
      room,
      payload.participant,
    ),
    now,
  );

  return roomStatus(room);
}

export function statusForToken(
  token: string,
) {
  const payload =
    readToken(token);
  const room =
    rooms.get(
      payload.reservationId,
    );

  if (!room) {
    throw new Error(
      "Live room state is unavailable. Rejoin the room.",
    );
  }

  participantRole(
    room,
    payload.participant,
  );

  return roomStatus(room);
}

async function sendAttendance(
  input: {
    room: LivePresenceRoom;
    participant: Address;
    validUntil: bigint;
  },
) {
  const signer =
    attestorAccount();
  const relayer =
    relayerAccount();

  const signature =
    await signer.signTypedData({
      domain: {
        name: "CommitPass",
        version: "3",
        chainId:
          ARC_TESTNET_CHAIN_ID,
        verifyingContract:
          contractAddress(),
      },
      types: {
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
      },
      primaryType:
        "AttendanceAttestation",
      message: {
        reservationId:
          input.room.reservationId,
        participant:
          input.participant,
        validUntil:
          input.validUntil,
      },
    });

  const walletClient =
    createWalletClient({
      account: relayer,
      chain: arcTestnet,
      transport: http(
        process.env
          .ARC_RPC_URL
          ?.trim() ||
          process.env
            .NEXT_PUBLIC_ARC_RPC_URL
            ?.trim() ||
          ARC_TESTNET_RPC,
      ),
    });

  const { request } =
    await publicClient
      .simulateContract({
        account: relayer,
        address:
          contractAddress(),
        abi:
          commitmentEscrowAbi,
        functionName:
          "confirmAttendanceWithAttestation",
        args: [
          input.room.reservationId,
          input.participant,
          input.validUntil,
          signature,
        ],
      });

  const transactionHash =
    await walletClient
      .writeContract(request);

  await publicClient
    .waitForTransactionReceipt({
      hash: transactionHash,
    });

  return transactionHash;
}

async function settleRoom(
  room: LivePresenceRoom,
) {
  if (room.settlement) {
    return room.settlement;
  }

  const status =
    roomStatus(room);

  if (!status.thresholdReached) {
    throw new Error(
      "The verified simultaneous-presence threshold has not been reached.",
    );
  }

  const {
    reservation,
    attendanceDeadline,
  } = await readRoomSource(
    room.reservationId,
  );

  if (
    Number(
      reservation.status,
    ) !== 2
  ) {
    return {
      finalOutcome:
        Number(
          reservation
            .finalOutcome,
        ),
      status:
        Number(
          reservation.status,
        ),
    };
  }

  const signer =
    attestorAccount();

  if (
    getAddress(
      reservation
        .attendanceAttestor,
    ) !== signer.address
  ) {
    throw new Error(
      "The reservation attestor does not match the live-presence signer.",
    );
  }

  const block =
    await publicClient.getBlock({
      blockTag: "latest",
    });
  const chainNow =
    block.timestamp;
  const deadline =
    BigInt(
      attendanceDeadline,
    );

  if (chainNow >= deadline) {
    throw new Error(
      "The onchain attendance window has closed.",
    );
  }

  const validUntil =
    chainNow +
      ATTESTATION_TTL_SECONDS <
    deadline
      ? chainNow +
        ATTESTATION_TTL_SECONDS
      : deadline;

  if (
    validUntil <=
    chainNow + 30n
  ) {
    throw new Error(
      "Too little attendance validity remains to settle safely.",
    );
  }

  let providerTransaction:
    | Hex
    | undefined;
  let customerTransaction:
    | Hex
    | undefined;

  if (
    !reservation
      .providerConfirmed
  ) {
    providerTransaction =
      await sendAttendance({
        room,
        participant:
          room.provider,
        validUntil,
      });
  }

  const afterProvider =
    await publicClient
      .readContract({
        address:
          contractAddress(),
        abi:
          commitmentEscrowAbi,
        functionName:
          "getReservation",
        args: [
          room.reservationId,
        ],
      });

  if (
    Number(
      afterProvider.status,
    ) === 2 &&
    !afterProvider
      .customerConfirmed
  ) {
    customerTransaction =
      await sendAttendance({
        room,
        participant:
          room.customer,
        validUntil,
      });
  }

  const finalReservation =
    await publicClient
      .readContract({
        address:
          contractAddress(),
        abi:
          commitmentEscrowAbi,
        functionName:
          "getReservation",
        args: [
          room.reservationId,
        ],
      });

  const result = {
    providerTransaction,
    customerTransaction,
    finalOutcome:
      Number(
        finalReservation
          .finalOutcome,
      ),
    status:
      Number(
        finalReservation.status,
      ),
  };

  room.settlement = result;

  return result;
}

export async function settleForToken(
  token: string,
) {
  const payload =
    readToken(token);
  const room =
    rooms.get(
      payload.reservationId,
    );

  if (!room) {
    throw new Error(
      "Live room state is unavailable. Rejoin the room.",
    );
  }

  const role =
    participantRole(
      room,
      payload.participant,
    );

  if (role !== "provider") {
    throw new Error(
      "The provider browser is the automatic settlement coordinator in this prototype.",
    );
  }

  if (!room.settling) {
    room.settling =
      settleRoom(room)
        .finally(() => {
          room.settling =
            undefined;
        });
  }

  return room.settling;
}
