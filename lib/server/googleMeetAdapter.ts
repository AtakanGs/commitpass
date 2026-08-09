import fs from "node:fs";
import path from "node:path";

import {
  OAuth2Client,
  type Credentials,
} from "google-auth-library";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
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
  evaluateDigitalSession,
  sessionPolicyFromQuery,
  type SessionInterval,
} from "@/lib/sessionPolicy";
import type {
  LivePresencePolicyInput,
} from "@/lib/presenceProtocol";

const FINAL_V3_ADDRESS =
  "0x66592bDB161b2C68ceFB4133Cfa0dB08eD2Ff791";

const ATTESTATION_TTL_SECONDS = 300n;

type DesktopCredentialFile = {
  installed?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
};

type ConferenceRecord = {
  name: string;
  space?: string;
  startTime?: string;
  endTime?: string;
};

type ParticipantResource = {
  name: string;
  signedinUser?: {
    user?: string;
    displayName?: string;
  };
  anonymousUser?: {
    displayName?: string;
  };
  phoneUser?: {
    displayName?: string;
  };
};

type ParticipantSessionResource = {
  name?: string;
  startTime?: string;
  endTime?: string;
};

export type GoogleMeetParticipant = {
  key: string;
  userId?: string;
  displayName: string;
  type:
    | "signed-in"
    | "anonymous"
    | "phone"
    | "unknown";
  participantResources: string[];
  sessions: {
    startTime: string;
    endTime?: string;
  }[];
};

export type GoogleMeetEvidence = {
  meetingCode: string;
  conferenceRecord: string;
  space?: string;
  startTime?: string;
  endTime?: string;
  ended: boolean;
  participants: GoogleMeetParticipant[];
};

export type GoogleMeetReservationInput = {
  reservationId: string;
  title: string;
  salt: string;
  policy: LivePresencePolicyInput;
  meetingCode: string;
  providerGoogleUser: string;
  customerGoogleUser: string;
};

function secretPath(fileName: string) {
  return path.join(
    process.cwd(),
    ".secrets",
    fileName,
  );
}

function readJsonFile<T>(
  filePath: string,
): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing local Google OAuth file: ${path.basename(filePath)}.`,
    );
  }

  return JSON.parse(
    fs.readFileSync(
      filePath,
      "utf8",
    ),
  ) as T;
}

function googleAuthClient() {
  const credentialFile =
    readJsonFile<DesktopCredentialFile>(
      secretPath(
        "google-meet-credentials.json",
      ),
    );
  const token =
    readJsonFile<Credentials>(
      secretPath(
        "google-meet-token.json",
      ),
    );

  const installed =
    credentialFile.installed;

  if (
    !installed?.client_id ||
    !installed.client_secret
  ) {
    throw new Error(
      "Google Desktop OAuth credentials are invalid.",
    );
  }

  const client =
    new OAuth2Client(
      installed.client_id,
      installed.client_secret,
      installed.redirect_uris?.[0],
    );

  client.setCredentials(token);

  return client;
}

export function normalizeMeetingCode(
  input: string,
) {
  let value =
    input.trim().toLowerCase();

  if (!value) {
    throw new Error(
      "Enter a Google Meet code.",
    );
  }

  try {
    if (value.includes("://")) {
      const url = new URL(value);
      value =
        url.pathname
          .split("/")
          .filter(Boolean)
          .at(-1) || "";
    }
  } catch {
    // Plain meeting-code cleanup below.
  }

  value = value
    .split("?")[0]
    .split("#")[0]
    .trim();

  if (
    !/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(
      value,
    )
  ) {
    throw new Error(
      "Google Meet code must look like abc-defg-hij.",
    );
  }

  return value;
}

async function meetGet<T>(
  resourcePath: string,
  params: Record<
    string,
    string | number | undefined
  > = {},
) {
  const url = new URL(
    "https://meet.googleapis.com/v2/" +
      resourcePath,
  );

  for (const [key, value] of
    Object.entries(params)) {
    if (
      value !== undefined &&
      value !== ""
    ) {
      url.searchParams.set(
        key,
        String(value),
      );
    }
  }

  const client =
    googleAuthClient();

  const response =
    await client.request<T>({
      url: url.toString(),
      method: "GET",
    });

  return response.data;
}

function unixSeconds(
  timestamp: string,
) {
  const milliseconds =
    Date.parse(timestamp);

  if (
    !Number.isFinite(milliseconds)
  ) {
    throw new Error(
      "Google Meet returned an invalid participant timestamp.",
    );
  }

  return Math.floor(
    milliseconds / 1000,
  );
}

export async function
getGoogleMeetEvidence(
  rawMeetingCode: string,
): Promise<GoogleMeetEvidence> {
  const meetingCode =
    normalizeMeetingCode(
      rawMeetingCode,
    );

  const recordsResponse =
    await meetGet<{
      conferenceRecords?: ConferenceRecord[];
    }>(
      "conferenceRecords",
      {
        pageSize: 10,
        filter:
          `space.meeting_code = "${meetingCode}"`,
      },
    );

  const records = [
    ...(
      recordsResponse
        .conferenceRecords || []
    ),
  ].sort(
    (first, second) =>
      Date.parse(
        second.endTime ||
          second.startTime ||
          "1970-01-01",
      ) -
      Date.parse(
        first.endTime ||
          first.startTime ||
          "1970-01-01",
      ),
  );

  const record =
    records[0];

  if (!record) {
    throw new Error(
      "No accessible Google Meet conference record was found for this meeting code.",
    );
  }

  const participantResponse =
    await meetGet<{
      participants?: ParticipantResource[];
    }>(
      `${record.name}/participants`,
      { pageSize: 250 },
    );

  const rawParticipants =
    participantResponse
      .participants || [];

  const grouped =
    new Map<
      string,
      GoogleMeetParticipant
    >();

  for (const participant of
    rawParticipants) {
    const sessionResponse =
      await meetGet<{
        participantSessions?:
          ParticipantSessionResource[];
      }>(
        `${participant.name}/participantSessions`,
        { pageSize: 250 },
      );

    const signedIn =
      participant.signedinUser;

    const type:
      GoogleMeetParticipant["type"] =
      signedIn
        ? "signed-in"
        : participant.anonymousUser
          ? "anonymous"
          : participant.phoneUser
            ? "phone"
            : "unknown";

    const displayName =
      signedIn?.displayName ||
      participant
        .anonymousUser?.displayName ||
      participant
        .phoneUser?.displayName ||
      participant.name;

    const userId =
      signedIn?.user;

    const key =
      userId ||
      participant.name;

    const existing =
      grouped.get(key) || {
        key,
        userId,
        displayName,
        type,
        participantResources: [],
        sessions: [],
      };

    existing.participantResources.push(
      participant.name,
    );

    for (const session of
      sessionResponse
        .participantSessions || []) {
      if (!session.startTime) {
        continue;
      }

      existing.sessions.push({
        startTime:
          session.startTime,
        endTime:
          session.endTime,
      });
    }

    existing.sessions.sort(
      (first, second) =>
        Date.parse(
          first.startTime,
        ) -
        Date.parse(
          second.startTime,
        ),
    );

    grouped.set(
      key,
      existing,
    );
  }

  return {
    meetingCode,
    conferenceRecord:
      record.name,
    space: record.space,
    startTime:
      record.startTime,
    endTime:
      record.endTime,
    ended:
      Boolean(record.endTime),
    participants:
      [...grouped.values()],
  };
}

function contractAddress(): Address {
  const configured =
    process.env
      .NEXT_PUBLIC_COMMITPASS_CONTRACT_ADDRESS
      ?.trim();

  return getAddress(
    configured &&
    isAddress(configured)
      ? configured
      : FINAL_V3_ADDRESS,
  );
}

const publicClient =
  createPublicClient({
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

function requiredPrivateKey(
  name: string,
): Hex {
  const value =
    process.env[name]?.trim();

  if (
    !value ||
    !/^0x[0-9a-fA-F]{64}$/.test(
      value,
    )
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
  const value =
    process.env
      .PRESENCE_RELAYER_PRIVATE_KEY
      ?.trim() ||
    process.env
      .DEPLOYER_PRIVATE_KEY
      ?.trim();

  if (
    !value ||
    !/^0x[0-9a-fA-F]{64}$/.test(
      value,
    )
  ) {
    throw new Error(
      "PRESENCE_RELAYER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is required for Google Meet settlement.",
    );
  }

  return privateKeyToAccount(
    value as Hex,
  );
}

function parseReservationId(
  value: string,
) {
  if (
    !/^[1-9]\d*$/.test(value)
  ) {
    throw new Error(
      "Reservation ID must be a positive integer.",
    );
  }

  return BigInt(value);
}

function intervalsFor(
  participant:
    GoogleMeetParticipant,
) {
  const intervals:
    SessionInterval[] = [];

  for (const session of
    participant.sessions) {
    if (!session.endTime) {
      throw new Error(
        `Google Meet still reports an active session for ${participant.displayName}. End the meeting before final settlement.`,
      );
    }

    intervals.push({
      joinedAt:
        unixSeconds(
          session.startTime,
        ),
      leftAt:
        unixSeconds(
          session.endTime,
        ),
    });
  }

  return intervals;
}

async function reservationContext(
  reservationId: bigint,
) {
  const [
    reservation,
    attendanceDeadline,
  ] = await Promise.all([
    publicClient.readContract({
      address:
        contractAddress(),
      abi:
        commitmentEscrowAbi,
      functionName:
        "getReservation",
      args: [reservationId],
    }),
    publicClient.readContract({
      address:
        contractAddress(),
      abi:
        commitmentEscrowAbi,
      functionName:
        "attendanceDeadline",
      args: [reservationId],
    }),
  ]);

  return {
    reservation,
    attendanceDeadline:
      Number(
        attendanceDeadline,
      ),
  };
}

export async function
evaluateGoogleMeetReservation(
  input:
    GoogleMeetReservationInput,
) {
  const reservationId =
    parseReservationId(
      input.reservationId,
    );
  const policy =
    sessionPolicyFromQuery(
      input.policy,
    );

  if (!policy) {
    throw new Error(
      "A valid committed digital-session policy is required.",
    );
  }

  if (
    !input.providerGoogleUser ||
    !input.customerGoogleUser ||
    input.providerGoogleUser ===
      input.customerGoogleUser
  ) {
    throw new Error(
      "Choose two distinct signed-in Google identities for provider and customer.",
    );
  }

  const [
    evidence,
    {
      reservation,
      attendanceDeadline,
    },
  ] = await Promise.all([
    getGoogleMeetEvidence(
      input.meetingCode,
    ),
    reservationContext(
      reservationId,
    ),
  ]);

  if (!evidence.ended) {
    throw new Error(
      "Google Meet conference record is still active. End the meeting before final evaluation.",
    );
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
      "This reservation is not configured for the CommitPass Google Meet verifier.",
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
      "The reservation metadata does not match the committed invitation terms.",
    );
  }

  const providerEvidence =
    evidence.participants.find(
      (participant) =>
        participant.userId ===
        input.providerGoogleUser,
    );

  const customerEvidence =
    evidence.participants.find(
      (participant) =>
        participant.userId ===
        input.customerGoogleUser,
    );

  if (
    !providerEvidence ||
    !customerEvidence
  ) {
    throw new Error(
      "The selected Google identities are not present in this conference record.",
    );
  }

  if (
    providerEvidence.type !==
      "signed-in" ||
    customerEvidence.type !==
      "signed-in"
  ) {
    throw new Error(
      "Automatic settlement requires signed-in Google Meet identities.",
    );
  }

  const evaluation =
    evaluateDigitalSession({
      policy,
      sessionStart:
        Number(
          reservation.startTime,
        ),
      now:
        Math.floor(
          Date.now() / 1000,
        ),
      providerIntervals:
        intervalsFor(
          providerEvidence,
        ),
      customerIntervals:
        intervalsFor(
          customerEvidence,
        ),
    });

  return {
    evidence,
    mapping: {
      provider: {
        wallet:
          getAddress(
            reservation.provider,
          ),
        googleUser:
          providerEvidence.userId,
        displayName:
          providerEvidence.displayName,
      },
      customer: {
        wallet:
          getAddress(
            reservation.customer,
          ),
        googleUser:
          customerEvidence.userId,
        displayName:
          customerEvidence.displayName,
      },
    },
    reservation: {
      id:
        reservationId.toString(),
      status:
        Number(
          reservation.status,
        ),
      finalOutcome:
        Number(
          reservation
            .finalOutcome,
        ),
      startTime:
        Number(
          reservation.startTime,
        ),
      attendanceDeadline,
    },
    evaluation,
  };
}

async function sendAttendance(
  input: {
    reservationId: bigint;
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
            name:
              "reservationId",
            type: "uint256",
          },
          {
            name:
              "participant",
            type: "address",
          },
          {
            name:
              "validUntil",
            type: "uint64",
          },
        ],
      },
      primaryType:
        "AttendanceAttestation",
      message: {
        reservationId:
          input.reservationId,
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
          input.reservationId,
          input.participant,
          input.validUntil,
          signature,
        ],
      });

  const hash =
    await walletClient
      .writeContract(
        request,
      );

  await publicClient
    .waitForTransactionReceipt({
      hash,
    });

  return hash;
}

export async function
settleGoogleMeetReservation(
  input:
    GoogleMeetReservationInput,
) {
  const evaluated =
    await evaluateGoogleMeetReservation(
      input,
    );

  if (
    !evaluated
      .evaluation.final ||
    evaluated
      .evaluation.code !==
      "completed" ||
    !evaluated
      .evaluation
      .attestProvider ||
    !evaluated
      .evaluation
      .attestCustomer
  ) {
    throw new Error(
      "Google Meet evidence does not satisfy the committed completion threshold. CommitPass will not auto-settle this reservation as Completed.",
    );
  }

  const reservationId =
    parseReservationId(
      input.reservationId,
    );

  const {
    reservation,
    attendanceDeadline,
  } =
    await reservationContext(
      reservationId,
    );

  if (
    Number(
      reservation.status,
    ) !== 2
  ) {
    return {
      ...evaluated,
      settlement: {
        providerTransaction:
          undefined,
        customerTransaction:
          undefined,
        finalOutcome:
          Number(
            reservation
              .finalOutcome,
          ),
        status:
          Number(
            reservation.status,
          ),
      },
    };
  }

  const block =
    await publicClient
      .getBlock({
        blockTag: "latest",
      });

  const chainNow =
    block.timestamp;

  const policy =
    sessionPolicyFromQuery(
      input.policy,
    );

  if (!policy) {
    throw new Error(
      "A valid committed digital-session policy is required.",
    );
  }

  const sessionEnd =
    BigInt(
      Number(
        reservation.startTime,
      ) +
      policy.scheduledMinutes *
        60,
    );

  if (
    chainNow < sessionEnd
  ) {
    throw new Error(
      "Arc Testnet has not reached the committed session end yet.",
    );
  }

  const deadline =
    BigInt(
      attendanceDeadline,
    );

  if (
    chainNow >= deadline
  ) {
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
        reservationId,
        participant:
          getAddress(
            reservation.provider,
          ),
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
        args: [reservationId],
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
        reservationId,
        participant:
          getAddress(
            reservation.customer,
          ),
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
        args: [reservationId],
      });

  return {
    ...evaluated,
    settlement: {
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
    },
  };
}
