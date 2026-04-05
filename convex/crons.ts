import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("generate-channel-summaries", { minutes: 15 }, internal.summaries.generateChannelSummaries);
crons.interval("scan-fact-checks", { minutes: 10 }, internal.proactiveAlerts.scanForFactChecks);
crons.interval("scan-cross-team-sync", { minutes: 15 }, internal.proactiveAlerts.scanCrossTeamSync);
crons.interval("cleanup-typing-indicators", { seconds: 30 }, internal.typing.cleanupExpired);

// Email crons — not yet enabled
// crons.interval("classify-pending-emails", { minutes: 5 }, internal.emailAgent.classifyPendingEmails);
// crons.interval("check-email-reminders", { minutes: 1 }, internal.emailAgent.checkReminders);
// crons.interval("generate-email-summaries", { minutes: 15 }, internal.summaries.generateEmailSummaries);

crons.interval("cleanup-rate-limit-counters", { hours: 1 }, internal.rateLimit.cleanupExpiredWindows);
crons.interval("cleanup-expired-sessions", { hours: 1 }, internal.sessions.cleanupExpired);
crons.interval("cleanup-expired-invitations", { hours: 24 }, internal.invitations.cleanupExpired);
crons.interval("cleanup-orphaned-storage", { hours: 24 }, internal.files.cleanupOrphanedStorage);

export default crons;
