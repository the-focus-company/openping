import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "generate-inbox-summaries",
  { minutes: 15 },
  internal.summaries.generateChannelSummaries,
);

crons.interval(
  "scan-unanswered-questions",
  { minutes: 10 },
  internal.proactive.scanUnansweredQuestions,
);

crons.interval(
  "scan-pr-review-nudges",
  { minutes: 15 },
  internal.proactive.scanPRReviewNudges,
);

crons.interval(
  "scan-blocked-tasks",
  { minutes: 30 },
  internal.proactive.scanBlockedTasks,
);

crons.interval(
  "expire-stale-alerts",
  { minutes: 60 },
  internal.proactive.expireStaleAlerts,
);

crons.interval(
  "cleanup-expired-typing",
  { minutes: 1 },
  internal.typing.cleanupExpired,
);

crons.interval(
  "decay-presence",
  { minutes: 2 },
  internal.presence.decayPresence,
);

export default crons;
