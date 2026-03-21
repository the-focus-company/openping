import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "generate-channel-summaries",
  { minutes: 15 },
  internal.summaries.generateChannelSummaries,
);

crons.interval(
  "scan-fact-checks",
  { minutes: 10 },
  internal.proactiveAlerts.scanForFactChecks,
);

crons.interval(
  "scan-cross-team-sync",
  { minutes: 15 },
  internal.proactiveAlerts.scanCrossTeamSync,
);

crons.interval(
  "email-sync",
  { minutes: 5 },
  internal.emailSync.syncAllAccounts,
);

export default crons;
