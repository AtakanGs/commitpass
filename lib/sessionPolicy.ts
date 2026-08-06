export const SESSION_POLICY_VERSION = 1 as const;

export type SessionInterval = {
  joinedAt: number;
  leftAt: number;
};

export type DigitalSessionPolicy = {
  version: typeof SESSION_POLICY_VERSION;
  kind: "digital-session";
  scheduledMinutes: number;
  issueWindowMinutes: number;
  completionThresholdMinutes: number;
};

export type SessionEvaluationCode =
  | "not-started"
  | "in-progress"
  | "completed"
  | "customer-breach"
  | "provider-breach"
  | "customer-no-show"
  | "provider-no-show"
  | "manual-review";

export type RecommendedContractOutcome =
  | "None"
  | "Completed"
  | "CustomerNoShow"
  | "ProviderNoShow"
  | "RefundBoth";

export type SessionEvaluation = {
  code: SessionEvaluationCode;
  final: boolean;
  providerSeconds: number;
  customerSeconds: number;
  verifiedOverlapSeconds: number;
  completionThresholdSeconds: number;
  issueWindowSeconds: number;
  attestProvider: boolean;
  attestCustomer: boolean;
  recommendedContractOutcome: RecommendedContractOutcome;
  claimEligibleParty?: "provider" | "customer";
  reason: string;
};

export const DEFAULT_DIGITAL_SESSION_POLICY: DigitalSessionPolicy = {
  version: SESSION_POLICY_VERSION,
  kind: "digital-session",
  scheduledMinutes: 30,
  issueWindowMinutes: 5,
  completionThresholdMinutes: 20,
};

const MIN_SESSION_MINUTES = 15;
const MAX_SESSION_MINUTES = 90;
const MIN_ISSUE_WINDOW_MINUTES = 1;
const SETTLEMENT_BUFFER_MINUTES = 5;
const MIN_CONTRACT_GRACE_MINUTES = 5;
const MAX_CONTRACT_GRACE_MINUTES = 120;

function isWholeMinute(value: number) {
  return Number.isInteger(value) && Number.isFinite(value);
}

export function validateDigitalSessionPolicy(
  policy: DigitalSessionPolicy,
) {
  const errors: string[] = [];

  if (policy.version !== SESSION_POLICY_VERSION) {
    errors.push("Unsupported session policy version.");
  }

  if (policy.kind !== "digital-session") {
    errors.push("Unsupported session policy kind.");
  }

  if (
    !isWholeMinute(policy.scheduledMinutes) ||
    policy.scheduledMinutes < MIN_SESSION_MINUTES ||
    policy.scheduledMinutes > MAX_SESSION_MINUTES
  ) {
    errors.push(
      `Scheduled duration must be a whole number between ${MIN_SESSION_MINUTES} and ${MAX_SESSION_MINUTES} minutes.`,
    );
  }

  if (
    !isWholeMinute(policy.issueWindowMinutes) ||
    policy.issueWindowMinutes < MIN_ISSUE_WINDOW_MINUTES ||
    policy.issueWindowMinutes >= policy.scheduledMinutes
  ) {
    errors.push(
      "Issue window must be a positive whole number shorter than the session.",
    );
  }

  if (
    !isWholeMinute(policy.completionThresholdMinutes) ||
    policy.completionThresholdMinutes <= policy.issueWindowMinutes ||
    policy.completionThresholdMinutes > policy.scheduledMinutes
  ) {
    errors.push(
      "Completion threshold must be longer than the issue window and no longer than the session.",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  } as const;
}

export function serializeSessionPolicy(
  policy: DigitalSessionPolicy,
) {
  const validation = validateDigitalSessionPolicy(policy);

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  return [
    "dsv1",
    policy.scheduledMinutes,
    policy.issueWindowMinutes,
    policy.completionThresholdMinutes,
  ].join("|");
}

export function parseSessionPolicy(
  value: string | undefined,
): DigitalSessionPolicy | undefined {
  if (!value) {
    return undefined;
  }

  const [prefix, scheduled, issue, completion, ...extra] =
    value.split("|");

  if (prefix !== "dsv1" || extra.length > 0) {
    return undefined;
  }

  const policy: DigitalSessionPolicy = {
    version: SESSION_POLICY_VERSION,
    kind: "digital-session",
    scheduledMinutes: Number(scheduled),
    issueWindowMinutes: Number(issue),
    completionThresholdMinutes: Number(completion),
  };

  return validateDigitalSessionPolicy(policy).valid
    ? policy
    : undefined;
}

export function sessionPolicyFromQuery(input: {
  duration?: string | null;
  issue?: string | null;
  threshold?: string | null;
}) {
  if (!input.duration && !input.issue && !input.threshold) {
    return undefined;
  }

  const policy: DigitalSessionPolicy = {
    version: SESSION_POLICY_VERSION,
    kind: "digital-session",
    scheduledMinutes: Number(input.duration),
    issueWindowMinutes: Number(input.issue),
    completionThresholdMinutes: Number(input.threshold),
  };

  return validateDigitalSessionPolicy(policy).valid
    ? policy
    : undefined;
}

export function sessionPolicyQuery(
  policy: DigitalSessionPolicy,
) {
  const validation = validateDigitalSessionPolicy(policy);

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  return {
    duration: String(policy.scheduledMinutes),
    issue: String(policy.issueWindowMinutes),
    threshold: String(policy.completionThresholdMinutes),
  } as const;
}

export function attendanceGraceSeconds(
  policy: DigitalSessionPolicy,
) {
  const validation = validateDigitalSessionPolicy(policy);

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const graceMinutes = Math.min(
    MAX_CONTRACT_GRACE_MINUTES,
    Math.max(
      MIN_CONTRACT_GRACE_MINUTES,
      policy.scheduledMinutes + SETTLEMENT_BUFFER_MINUTES,
    ),
  );

  return graceMinutes * 60;
}

function clampInterval(
  interval: SessionInterval,
  sessionStart: number,
  sessionEnd: number,
): SessionInterval | undefined {
  if (
    !Number.isFinite(interval.joinedAt) ||
    !Number.isFinite(interval.leftAt)
  ) {
    return undefined;
  }

  const joinedAt = Math.max(
    sessionStart,
    Math.floor(interval.joinedAt),
  );
  const leftAt = Math.min(
    sessionEnd,
    Math.floor(interval.leftAt),
  );

  if (leftAt <= joinedAt) {
    return undefined;
  }

  return { joinedAt, leftAt };
}

export function normalizeSessionIntervals(
  intervals: readonly SessionInterval[],
  sessionStart: number,
  sessionEnd: number,
) {
  if (
    !Number.isFinite(sessionStart) ||
    !Number.isFinite(sessionEnd) ||
    sessionEnd <= sessionStart
  ) {
    throw new Error("Invalid session bounds.");
  }

  const normalized = intervals
    .map((interval) =>
      clampInterval(interval, sessionStart, sessionEnd),
    )
    .filter(
      (interval): interval is SessionInterval =>
        Boolean(interval),
    )
    .sort((first, second) => first.joinedAt - second.joinedAt);

  const merged: SessionInterval[] = [];

  for (const interval of normalized) {
    const previous = merged.at(-1);

    if (!previous || interval.joinedAt > previous.leftAt) {
      merged.push({ ...interval });
      continue;
    }

    previous.leftAt = Math.max(previous.leftAt, interval.leftAt);
  }

  return merged;
}

export function intervalDurationSeconds(
  intervals: readonly SessionInterval[],
) {
  return intervals.reduce(
    (total, interval) =>
      total + Math.max(0, interval.leftAt - interval.joinedAt),
    0,
  );
}

export function overlapDurationSeconds(
  first: readonly SessionInterval[],
  second: readonly SessionInterval[],
) {
  let firstIndex = 0;
  let secondIndex = 0;
  let overlap = 0;

  while (firstIndex < first.length && secondIndex < second.length) {
    const firstInterval = first[firstIndex];
    const secondInterval = second[secondIndex];

    const overlapStart = Math.max(
      firstInterval.joinedAt,
      secondInterval.joinedAt,
    );
    const overlapEnd = Math.min(
      firstInterval.leftAt,
      secondInterval.leftAt,
    );

    if (overlapEnd > overlapStart) {
      overlap += overlapEnd - overlapStart;
    }

    if (firstInterval.leftAt <= secondInterval.leftAt) {
      firstIndex += 1;
    } else {
      secondIndex += 1;
    }
  }

  return overlap;
}

export function evaluateDigitalSession(input: {
  policy: DigitalSessionPolicy;
  sessionStart: number;
  now: number;
  providerIntervals: readonly SessionInterval[];
  customerIntervals: readonly SessionInterval[];
}): SessionEvaluation {
  const validation = validateDigitalSessionPolicy(input.policy);

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const sessionStart = Math.floor(input.sessionStart);
  const sessionEnd =
    sessionStart + input.policy.scheduledMinutes * 60;
  const now = Math.floor(input.now);

  const providerIntervals = normalizeSessionIntervals(
    input.providerIntervals,
    sessionStart,
    sessionEnd,
  );
  const customerIntervals = normalizeSessionIntervals(
    input.customerIntervals,
    sessionStart,
    sessionEnd,
  );

  const providerSeconds = intervalDurationSeconds(providerIntervals);
  const customerSeconds = intervalDurationSeconds(customerIntervals);
  const verifiedOverlapSeconds = overlapDurationSeconds(
    providerIntervals,
    customerIntervals,
  );
  const completionThresholdSeconds =
    input.policy.completionThresholdMinutes * 60;
  const issueWindowSeconds = input.policy.issueWindowMinutes * 60;

  const base = {
    providerSeconds,
    customerSeconds,
    verifiedOverlapSeconds,
    completionThresholdSeconds,
    issueWindowSeconds,
  };

  if (now < sessionStart) {
    return {
      ...base,
      code: "not-started",
      final: false,
      attestProvider: false,
      attestCustomer: false,
      recommendedContractOutcome: "None",
      reason: "The scheduled digital session has not started.",
    };
  }

  if (now < sessionEnd) {
    return {
      ...base,
      code: "in-progress",
      final: false,
      attestProvider: false,
      attestCustomer: false,
      recommendedContractOutcome: "None",
      reason:
        "The session is still in progress. No final attendance attestation should be issued yet.",
    };
  }

  if (verifiedOverlapSeconds >= completionThresholdSeconds) {
    return {
      ...base,
      code: "completed",
      final: true,
      attestProvider: true,
      attestCustomer: true,
      recommendedContractOutcome: "Completed",
      reason:
        "Both parties shared the authenticated session for at least the agreed completion threshold.",
    };
  }

  if (
    providerSeconds >= completionThresholdSeconds &&
    customerSeconds < completionThresholdSeconds
  ) {
    return {
      ...base,
      code: "customer-breach",
      final: true,
      attestProvider: true,
      attestCustomer: false,
      recommendedContractOutcome: "CustomerNoShow",
      claimEligibleParty: "provider",
      reason:
        "The provider satisfied the completion threshold while the customer did not.",
    };
  }

  if (
    customerSeconds >= completionThresholdSeconds &&
    providerSeconds < completionThresholdSeconds
  ) {
    return {
      ...base,
      code: "provider-breach",
      final: true,
      attestProvider: false,
      attestCustomer: true,
      recommendedContractOutcome: "ProviderNoShow",
      claimEligibleParty: "customer",
      reason:
        "The customer satisfied the completion threshold while the provider did not.",
    };
  }

  if (
    providerSeconds >= issueWindowSeconds &&
    customerSeconds < issueWindowSeconds
  ) {
    return {
      ...base,
      code: "customer-no-show",
      final: true,
      attestProvider: true,
      attestCustomer: false,
      recommendedContractOutcome: "CustomerNoShow",
      claimEligibleParty: "provider",
      reason:
        "The provider waited through the issue window while the customer did not establish meaningful attendance.",
    };
  }

  if (
    customerSeconds >= issueWindowSeconds &&
    providerSeconds < issueWindowSeconds
  ) {
    return {
      ...base,
      code: "provider-no-show",
      final: true,
      attestProvider: false,
      attestCustomer: true,
      recommendedContractOutcome: "ProviderNoShow",
      claimEligibleParty: "customer",
      reason:
        "The customer waited through the issue window while the provider did not establish meaningful attendance.",
    };
  }

  return {
    ...base,
    code: "manual-review",
    final: true,
    attestProvider: false,
    attestCustomer: false,
    recommendedContractOutcome: "RefundBoth",
    reason:
      "The available session record does not support an automatic one-sided outcome. Refund both or send the case to review.",
  };
}
