import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DIGITAL_SESSION_POLICY,
  attendanceGraceSeconds,
  evaluateDigitalSession,
  normalizeSessionIntervals,
  overlapDurationSeconds,
  parseSessionPolicy,
  serializeSessionPolicy,
  sessionPolicyFromQuery,
  sessionPolicyQuery,
  validateDigitalSessionPolicy,
} from "../lib/sessionPolicy";

const START = 1_000_000;
const END = START + 30 * 60;

function interval(fromMinute: number, toMinute: number) {
  return {
    joinedAt: START + fromMinute * 60,
    leftAt: START + toMinute * 60,
  };
}

function evaluate(input: {
  provider?: ReturnType<typeof interval>[];
  customer?: ReturnType<typeof interval>[];
  now?: number;
}) {
  return evaluateDigitalSession({
    policy: DEFAULT_DIGITAL_SESSION_POLICY,
    sessionStart: START,
    now: input.now ?? END,
    providerIntervals: input.provider ?? [],
    customerIntervals: input.customer ?? [],
  });
}

test("default policy is valid", () => {
  assert.equal(
    validateDigitalSessionPolicy(DEFAULT_DIGITAL_SESSION_POLICY).valid,
    true,
  );
});

test("completion threshold must be longer than issue window", () => {
  const result = validateDigitalSessionPolicy({
    ...DEFAULT_DIGITAL_SESSION_POLICY,
    issueWindowMinutes: 10,
    completionThresholdMinutes: 10,
  });

  assert.equal(result.valid, false);
});

test("session policy round-trips through compact serialization", () => {
  const encoded = serializeSessionPolicy(DEFAULT_DIGITAL_SESSION_POLICY);
  assert.equal(encoded, "dsv1|30|5|20");
  assert.deepEqual(parseSessionPolicy(encoded), DEFAULT_DIGITAL_SESSION_POLICY);
});

test("invalid compact policy is rejected", () => {
  assert.equal(parseSessionPolicy("dsv1|30|20|10"), undefined);
  assert.equal(parseSessionPolicy("dsv2|30|5|20"), undefined);
  assert.equal(parseSessionPolicy("dsv1|30|5|20|extra"), undefined);
});

test("query policy round-trips", () => {
  const query = sessionPolicyQuery(DEFAULT_DIGITAL_SESSION_POLICY);
  assert.deepEqual(
    sessionPolicyFromQuery(query),
    DEFAULT_DIGITAL_SESSION_POLICY,
  );
});

test("partial query policy is rejected", () => {
  assert.equal(
    sessionPolicyFromQuery({ duration: "30", issue: null, threshold: "20" }),
    undefined,
  );
});

test("attendance grace covers session plus settlement buffer", () => {
  assert.equal(attendanceGraceSeconds(DEFAULT_DIGITAL_SESSION_POLICY), 35 * 60);
});

test("intervals are clipped, sorted, and merged", () => {
  assert.deepEqual(
    normalizeSessionIntervals(
      [
        interval(10, 20),
        interval(-5, 5),
        interval(4, 12),
        interval(30, 35),
      ],
      START,
      END,
    ),
    [interval(0, 20)],
  );
});

test("overlap counts simultaneous presence only", () => {
  const provider = normalizeSessionIntervals(
    [interval(0, 25)],
    START,
    END,
  );
  const customer = normalizeSessionIntervals(
    [interval(10, 30)],
    START,
    END,
  );

  assert.equal(overlapDurationSeconds(provider, customer), 15 * 60);
});

test("future session is not started", () => {
  const result = evaluate({ now: START - 1 });
  assert.equal(result.code, "not-started");
  assert.equal(result.final, false);
});

test("active session never issues a final attestation", () => {
  const result = evaluate({
    now: START + 25 * 60,
    provider: [interval(0, 25)],
    customer: [interval(0, 25)],
  });

  assert.equal(result.code, "in-progress");
  assert.equal(result.attestProvider, false);
  assert.equal(result.attestCustomer, false);
});

test("twenty minutes of verified overlap completes the session", () => {
  const result = evaluate({
    provider: [interval(0, 30)],
    customer: [interval(5, 25)],
  });

  assert.equal(result.code, "completed");
  assert.equal(result.verifiedOverlapSeconds, 20 * 60);
  assert.equal(result.attestProvider, true);
  assert.equal(result.attestCustomer, true);
  assert.equal(result.recommendedContractOutcome, "Completed");
});

test("nineteen minutes of overlap does not complete the session", () => {
  const result = evaluate({
    provider: [interval(0, 30)],
    customer: [interval(5, 24)],
  });

  assert.equal(result.code, "customer-breach");
  assert.equal(result.attestProvider, true);
  assert.equal(result.attestCustomer, false);
});

test("provider can claim when customer never establishes attendance", () => {
  const result = evaluate({
    provider: [interval(0, 5)],
    customer: [],
  });

  assert.equal(result.code, "customer-no-show");
  assert.equal(result.claimEligibleParty, "provider");
  assert.equal(result.recommendedContractOutcome, "CustomerNoShow");
});

test("customer can claim when provider never establishes attendance", () => {
  const result = evaluate({
    provider: [],
    customer: [interval(0, 5)],
  });

  assert.equal(result.code, "provider-no-show");
  assert.equal(result.claimEligibleParty, "customer");
  assert.equal(result.recommendedContractOutcome, "ProviderNoShow");
});

test("customer early exit after issue window is a customer breach when provider completes", () => {
  const result = evaluate({
    provider: [interval(0, 30)],
    customer: [interval(0, 12)],
  });

  assert.equal(result.code, "customer-breach");
  assert.equal(result.attestProvider, true);
  assert.equal(result.attestCustomer, false);
});

test("provider early exit after issue window is a provider breach when customer completes", () => {
  const result = evaluate({
    provider: [interval(0, 12)],
    customer: [interval(0, 30)],
  });

  assert.equal(result.code, "provider-breach");
  assert.equal(result.attestProvider, false);
  assert.equal(result.attestCustomer, true);
});

test("separate twenty-minute attendances do not count as completed", () => {
  const result = evaluate({
    provider: [interval(0, 20)],
    customer: [interval(10, 30)],
  });

  assert.equal(result.providerSeconds, 20 * 60);
  assert.equal(result.customerSeconds, 20 * 60);
  assert.equal(result.verifiedOverlapSeconds, 10 * 60);
  assert.equal(result.code, "manual-review");
  assert.equal(result.attestProvider, false);
  assert.equal(result.attestCustomer, false);
});

test("both parties leaving before the issue window requires review", () => {
  const result = evaluate({
    provider: [interval(0, 3)],
    customer: [interval(0, 3)],
  });

  assert.equal(result.code, "manual-review");
  assert.equal(result.recommendedContractOutcome, "RefundBoth");
});

test("reconnections are merged without double counting", () => {
  const result = evaluate({
    provider: [interval(0, 12), interval(10, 25)],
    customer: [interval(0, 25)],
  });

  assert.equal(result.providerSeconds, 25 * 60);
  assert.equal(result.verifiedOverlapSeconds, 25 * 60);
  assert.equal(result.code, "completed");
});

import {
  canonicalizeDigitalSessionReceipt,
  createDigitalSessionReceipt,
} from "../lib/sessionReceipt";

const CONTRACT = "0x66592bdb161b2c68cefb4133cfa0db08ed2ff791";
const PROVIDER = "0x329c253928e0727f31c7ffbdc83b143e55c36841";
const CUSTOMER = "0x2f149e3de871759f2aadc5a6185512b36730a37d";

test("final session receipt canonicalization is deterministic", () => {
  const evaluation = evaluate({
    provider: [interval(0, 30)],
    customer: [interval(0, 25)],
  });

  const receipt = createDigitalSessionReceipt({
    reservationId: 2n,
    chainId: 5_042_002,
    contractAddress: CONTRACT.toUpperCase().replace("0X", "0x"),
    provider: PROVIDER,
    customer: CUSTOMER,
    sessionId: "demo-session-2",
    sessionStart: START,
    generatedAt: END,
    policy: DEFAULT_DIGITAL_SESSION_POLICY,
    providerIntervals: [interval(0, 30)],
    customerIntervals: [interval(0, 25)],
    evaluation,
  });

  const first = canonicalizeDigitalSessionReceipt(receipt);
  const second = canonicalizeDigitalSessionReceipt({ ...receipt });

  assert.equal(first, second);
  assert.match(first, /"policy":"dsv1\|30\|5\|20"/);
  assert.match(first, /"recommendedContractOutcome":"Completed"/);
});

test("non-final session cannot produce an evidence receipt", () => {
  const evaluation = evaluate({ now: START + 10 * 60 });

  assert.throws(
    () =>
      createDigitalSessionReceipt({
        reservationId: "2",
        chainId: 5_042_002,
        contractAddress: CONTRACT,
        provider: PROVIDER,
        customer: CUSTOMER,
        sessionId: "demo-session-2",
        sessionStart: START,
        generatedAt: START + 10 * 60,
        policy: DEFAULT_DIGITAL_SESSION_POLICY,
        providerIntervals: [],
        customerIntervals: [],
        evaluation,
      }),
    /final session evaluation/i,
  );
});
