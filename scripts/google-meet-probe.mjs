import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { authenticate } from "@google-cloud/local-auth";

const SCOPES = [
  "https://www.googleapis.com/auth/meetings.space.readonly",
];

const SECRET_DIR = path.join(
  process.cwd(),
  ".secrets",
);

const CREDENTIALS_PATH = path.join(
  SECRET_DIR,
  "google-meet-credentials.json",
);

const TOKEN_PATH = path.join(
  SECRET_DIR,
  "google-meet-token.json",
);

function normalizeMeetingCode(input = "") {
  let value = input.trim().toLowerCase();

  if (!value) {
    return "";
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
    // Fall through to plain-text cleanup.
  }

  value = value
    .split("?")[0]
    .split("#")[0]
    .trim();

  if (
    value &&
    !/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(
      value,
    )
  ) {
    throw new Error(
      "Meeting code must look like abc-defg-hij.",
    );
  }

  return value;
}

async function meetGet(
  authClient,
  resourcePath,
  params = {},
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

  const response =
    await authClient.request({
      url: url.toString(),
      method: "GET",
    });

  return response.data;
}

async function main() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      "Missing .secrets/google-meet-credentials.json",
    );
  }

  const meetingCode =
    normalizeMeetingCode(
      process.argv[2] || "",
    );

  const authClient =
    await authenticate({
      scopes: SCOPES,
      keyfilePath:
        CREDENTIALS_PATH,
    });

  fs.mkdirSync(
    SECRET_DIR,
    { recursive: true },
  );

  fs.writeFileSync(
    TOKEN_PATH,
    JSON.stringify(
      authClient.credentials,
      null,
      2,
    ),
    "utf8",
  );

  const recordParams = {
    pageSize: 10,
  };

  if (meetingCode) {
    recordParams.filter =
      `space.meeting_code = "${meetingCode}"`;
  }

  const recordsResponse =
    await meetGet(
      authClient,
      "conferenceRecords",
      recordParams,
    );

  const records =
    recordsResponse
      .conferenceRecords || [];

  records.sort(
    (first, second) =>
      Date.parse(
        second.endTime ||
          second.startTime ||
          0,
      ) -
      Date.parse(
        first.endTime ||
          first.startTime ||
          0,
      ),
  );

  if (records.length === 0) {
    console.log("");
    console.log(
      "Google Meet OAuth succeeded.",
    );
    console.log(
      meetingCode
        ? `No accessible conference record found for meeting code ${meetingCode}.`
        : "No accessible conference records were returned for this account.",
    );
    process.exit(0);
  }

  console.log("");
  console.log(
    `Google Meet OAuth succeeded. Found ${records.length} accessible conference record(s).`,
  );

  for (const record of
    records.slice(0, 5)) {
    const participantsResponse =
      await meetGet(
        authClient,
        `${record.name}/participants`,
        { pageSize: 250 },
      );

    const participants =
      participantsResponse
        .participants || [];

    console.log("");
    console.log(
      `Conference: ${record.name}`,
    );
    console.log(
      `Space: ${record.space}`,
    );
    console.log(
      `Start: ${record.startTime || "-"}`,
    );
    console.log(
      `End: ${record.endTime || "ACTIVE"}`,
    );
    console.log(
      `Participants: ${participants.length}`,
    );

    for (const participant of
      participants) {
      const sessionsResponse =
        await meetGet(
          authClient,
          `${participant.name}/participantSessions`,
          { pageSize: 250 },
        );

      const sessions =
        sessionsResponse
          .participantSessions || [];

      const signedIn =
        participant.signedinUser;
      const identity =
        signedIn?.displayName ||
        participant
          .anonymousUser?.displayName ||
        participant
          .phoneUser?.displayName ||
        participant.name;

      const identityType =
        signedIn
          ? "signed-in"
          : participant.anonymousUser
            ? "anonymous"
            : participant.phoneUser
              ? "phone"
              : "unknown";

      console.log(
        `- ${identity} [${identityType}] sessions=${sessions.length}`,
      );

      if (signedIn?.user) {
        console.log(
          `  Google user: ${signedIn.user}`,
        );
      }

      for (const session of sessions) {
        console.log(
          `  ${session.startTime || "-"} -> ${session.endTime || "ACTIVE"}`,
        );
      }
    }
  }
}

main().catch((caught) => {
  const message =
    caught instanceof Error
      ? caught.message
      : String(caught);

  console.error(
    "Google Meet probe failed: " +
      message,
  );
  process.exitCode = 1;
});
