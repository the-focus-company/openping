export const DOCS_URL = "https://docs.openping.app/";
export const GITHUB_URL = "https://github.com/the-focus-company/openping";

export const QUICKSTART_COMMANDS = `git clone https://github.com/the-focus-company/openping.git
cd openping
pnpm install
pnpm dev`;

export const SPRING = { type: "spring" as const, damping: 22, stiffness: 200 };

export const FEATURES = [
  {
    id: "inbox" as const,
    title: "Priority inbox",
    subtitle: "Know what needs you first",
    description:
      "Every message ranked by urgency and importance. AI triages across all your projects so the critical decisions surface, not the noise.",
    metric: "4x faster triage",
  },
  {
    id: "decisions" as const,
    title: "Decision trails",
    subtitle: "Trace every call to its context",
    description:
      "Every decision linked to its supporting evidence, discussion, and outcomes. No more archaeology through chat history.",
    metric: "Full traceability",
  },
  {
    id: "workspace" as const,
    title: "Orchestrated action",
    subtitle: "From decision to execution",
    description:
      "When a call is made, the right people are notified, tasks are created, and follow-ups are tracked. The gap between deciding and doing disappears.",
    metric: "Zero handoff gaps",
  },
  {
    id: "access" as const,
    title: "Controlled access",
    subtitle: "Client-safe by default",
    description:
      "Guest roles, scoped channels, and SSO let you bring clients and contractors into the conversation without exposing your whole workspace.",
    metric: "Enterprise SSO",
  },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];

export const PAIN_POINTS = [
  {
    stat: "62%",
    label: "of expert time lost to coordination",
    detail: "Chasing context, relaying status, attending alignment meetings",
  },
  {
    stat: "3.2h",
    label: "per day in manual context assembly",
    detail: "Searching Slack, checking tickets, re-reading threads",
  },
  {
    stat: "47%",
    label: "of decisions delayed by missing info",
    detail: "The right person has the answer but nobody knows who",
  },
] as const;

export const BUYER_VALUES = [
  {
    metric: "3x",
    label: "more projects per delivery lead",
    description: "Less coordination overhead means each lead can manage more concurrent work.",
  },
  {
    metric: "60%",
    label: "fewer expert interruptions",
    description: "Context is assembled and routed, not chased. Experts stay in flow.",
  },
  {
    metric: "5x",
    label: "faster decision-to-action",
    description: "Decisions trigger orchestrated follow-ups, not another round of messages.",
  },
  {
    metric: "40%",
    label: "better project margins",
    description: "Less coordination headcount, fewer missed deadlines, tighter delivery.",
  },
] as const;

export const ICP_VERTICALS = [
  { name: "Agencies", pain: "Too many projects, not enough senior bandwidth" },
  { name: "Consultancies", pain: "Experts drowning in status requests across accounts" },
  { name: "Software houses", pain: "Delivery leads buried in cross-project coordination" },
  { name: "Professional services", pain: "Client expectations rising, coordination capacity flat" },
  { name: "Managed services", pain: "Incident routing and escalation eating margin" },
] as const;
