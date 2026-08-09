import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { authenticate } from "@google-cloud/local-auth";

const SCOPES = [
  "https://www.googleapis.com/auth/meetings.space.readonly",
];

const CREDENTIALS_PATH = path.join(
  process.cwd(),
  ".secrets",
  "google-meet-credentials.json",
);

if (!fs.existsSync(CREDENTIALS_PATH)) {
  throw new Error(
    "Missing .secrets/google-meet-credentials.json",
  );
}

const meetingCode = (process.argv[2] || "")
  .trim()
  .toLowerCase();

const authClient = await authenticate({
  scopes: SCOPES,
  keyfilePath: CREDENTIALS_PATH,
});

async function meetGet(resourcePath, params = {}) {
  const url = new URL(
    "https://meet.googleapis.com/v2/" + resourcePath,
  );

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await authClient.request({
    url: url.toString(),
    method: "GET",
  });

  return response.data;
}

const recordParams = {
  pageSize: 10,
};

if (meetingCode) {
  recordParams.filter =
    `space.meeting_code = "${meetingCode}"`;
}

const recordsResponse = await meetGet(
  "conferenceRecords",
  recordParams,
);

const records =
  recordsResponse.conferenceRecords || [];

if (records.length === 0) {
  console.log("");
  console.log("Google Meet OAuth succeeded.");
  console.log(
    meetingCode
      ? `No accessible conference record found for meeting code ${meetingCode}.`
      : "No accessible conference records were returned for this account.",
  );
  console.log(
    "Create or join a Meet with this Google account, end the call, then run the probe again.",
  );
  process.exit(0);
}

console.log("");
console.log(
  `Google Meet OAuth succeeded. Found ${records.length} accessible conference record(s).`,
);

for (const record of records.slice(0, 5)) {
  const participantsResponse = await meetGet(
    `${record.name}/participants`,
    { pageSize: 250 },
  );

  const participants =
    participantsResponse.participants || [];

  console.log("");
  console.log(`Conference: ${record.name}`);
  console.log(`Space: ${record.space}`);
  console.log(`Start: ${record.startTime || "-"}`);
  console.log(`End: ${record.endTime || "ACTIVE"}`);
  console.log(`Participants: ${participants.length}`);

  for (const participant of participants) {
    const sessionsResponse = await meetGet(
      `${participant.name}/participantSessions`,
      { pageSize: 250 },
    );

    const sessions =
      sessionsResponse.participantSessions || [];

    const identity =
      participant.signedinUser?.displayName ||
      participant.anonymousUser?.displayName ||
      participant.phoneUser?.displayName ||
      participant.name;

    const identityType =
      participant.signedinUser
        ? "signed-in"
        : participant.anonymousUser
          ? "anonymous"
          : participant.phoneUser
            ? "phone"
            : "unknown";

    console.log(
      `  - ${identity} [${identityType}] sessions=${sessions.length}`,
    );

    for (const session of sessions) {
      console.log(
        `      ${session.startTime || "-"} -> ${session.endTime || "ACTIVE"}`,
      );
    }
  }
}
