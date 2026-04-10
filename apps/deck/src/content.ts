/**
 * All deck copy in one place.
 * Edit text here instead of digging through PitchDeck.tsx.
 */

export const content = {
  /* ── Navigation ── */
  nav: ["Cover", "Founders", "Problem", "Cost", "Solution", "How", "vs. Slack", "Business Model", "Market", "GTM", "Connect"],

  /* ══ SLIDE 0 - COVER ══ */
  cover: {
    headlineWhite: "Coordination is the",
    headlineAccent: "revenue killer nobody tracks.",
    subtitle:
      "OpenPing removes overhead so delivery teams handle more projects with less pressure, close decisions faster, and grow business without adding operations headcount.",
  },

  /* ══ SLIDE 1 - FOUNDERS ══ */
  founders: {
    heading: "We lived the problem.",
    headingAccent: "Now we're building the models to fix it.",
    people: [
      {
        initials: "RW",
        name: "Rafal Wyderka",
        role: "CEO / Product",
        bio: "Product leader obsessed with removing coordination overhead from expert work.",
        photo: "/photos/rafal.jpg",
        color: "from-indigo-500 to-violet-500",
        logoKeys: ["remitly", "mars", "kpmg"],
        highlights: [
          "Lived the problem: coordination collapsed across 5 time zones at Remitly",
          "Shipped AI-first products from zero (ppmlx, tview.work)",
          "10+ years leading product & delivery at KPMG, MARS, Remitly",
        ],
      },
      {
        initials: "KA",
        name: "Konrad Alfaro",
        role: "CTO / Engineering",
        bio: "Infrastructure engineer who builds systems that scale to millions of users.",
        photo: "/photos/konrad.jpg",
        color: "from-emerald-500 to-sky-500",
        logoKeys: ["printify", "8lines"],
        highlights: [
          "Scaled infra at Printify (millions of merchants)",
          "Founded 8lines: AI-driven agency shipping real systems",
          "Deep expertise in distributed systems, real-time data, and ML pipelines",
        ],
      },
    ],
    footer:
      "Serial entrepreneurs. Both from Lodz, Poland. We don't just use AI tools - we build entire products with AI as a co-creator.",
    footerAccent:
      "OpenPing is built the way software will be built: small team, AI-native from day one, shipping 10x faster than legacy approaches.",
  },

  /* ══ SLIDE 2 - COORDINATION PROBLEM ══ */
  coordProblem: {
    tag: "The Coordination Problem",
    heading: "Coordination is a tax on growth.",
    body: "Knowledge workers spend more time moving information than executing decisions. Every tool adds a channel. Every channel adds overhead. The bottleneck is always a person.",
  },

  /* ══ SLIDE 3 - COORDINATION TAX ══ */
  coordinationTax: {
    tag: "The Coordination Tax",
    heading: "The real cost isn't ops headcount.",
    headingAccent: "It's the revenue that can't be reached.",
    individual: {
      label: "The Individual — Lost Upside",
      stats: [
        { value: "<1x", description: "Reported ROI on AI tools at org level" },
        { value: "33%", description: "Revenue lost to missing delivery capacity" },
      ],
      surveyLabel: "Last time had capacity for new initiatives:",
      survey: [
        { label: "Last week", pct: 8 },
        { label: "Last month", pct: 18 },
        { label: "Last quarter", pct: 45 },
        { label: "Last year+", pct: 29 },
      ],
    },
    organization: {
      label: "The Organization — Growing Cost",
      stats: [
        { value: "1 : 4", description: "Coordination-to-maker ratio at scale" },
        { value: "25%", description: "Increased rotation from coordination burnout" },
      ],
      waterfallLabel: "Where team capacity goes:",
      waterfall: [
        { label: "Total capacity", value: 100, top: 0 },
        { label: "Missing context", value: 40, top: 0 },
        { label: "Delayed follow-ups\n& approvals", value: 20, top: 40 },
        { label: "Context switching", value: 10, top: 60 },
        { label: "Value delivered", value: 30, top: 70 },
      ],
    },
    timelineLabel: "Typical project lifecycle",
    timeline: [
      { label: "Searching for context", w: "22%", type: "waste" as const },
      { label: "Work", w: "10%", type: "work" as const },
      { label: "Waiting for approval", w: "18%", type: "waste" as const },
      { label: "Work", w: "8%", type: "work" as const },
      { label: "Sync meeting", w: "14%", type: "waste" as const },
      { label: "Work", w: "9%", type: "work" as const },
      { label: "Status relay", w: "9%", type: "waste" as const },
      { label: "End Value", w: "10%", type: "end" as const },
    ],
  },

  /* ══ SLIDE 4 - WHAT OPENPING DOES ══ */
  whatWeDo: {
    tag: "What OpenPing Does",
    heading: "From noise to decisions and results.",
    headingAccent: "Fully automated.",
    steps: [
      { title: "Listens", desc: "Connects to all communication - in real-time." },
      { title: "Understands", desc: "Classifies signals with actor and confidence." },
      { title: "Routes", desc: "No thread pollution, no group pings." },
      { title: "Surfaces", desc: "Escalates only what needs human judgment." },
      { title: "Acts", desc: "Acts autonomously." },
    ],
  },

  /* ══ SLIDE 5 - THE MOAT ══ */
  moat: {
    tag: "The Moat",
    heading: "Every decision makes the system",
    headingAccent: "harder to replace.",
    body: "Open-source interface gets adoption. Proprietary intelligence layers get built with every customer's data. The moat compounds — it can't be forked.",
    foundation: {
      label: "Unforkable Data Moat",
      columns: [
        {
          title: "Proprietary Decision Graph",
          points: [
            "Every decision, commitment, and outcome mapped in a temporal graph unique to each org",
            "More data = better predictions. Competitors start from zero",
          ],
        },
        {
          title: "Proactive Signal Layer",
          points: [
            "Captures intent, blockers, and commitments before they're formally stated",
            "Per-org classifiers fine-tune continuously. This data doesn't exist anywhere else",
          ],
        },
      ],
    },
    layers: [
      { title: "Closed-Loop Learning", points: ["Every human decision feeds training data", "System improves with usage", "Outcomes validate predictions automatically"], badge: "RESEARCH" },
      { title: "Real-Time Context Engine", points: ["All inputs embedded under 80ms", "Hybrid retrieval, per-org namespace", "Streaming incremental - no batch reprocessing"], badge: "BUILT" },
      { title: "Open Data Model", points: ["Open schema, full export, no lock-in", "Customers own data - trust drives adoption", "Air-gapped deployments supported"], badge: "BUILT" },
      { title: "Offline-First Mobile", points: ["Native app with on-device inference via ppmlx", "Personal temporal context graphs", "CRDT sync for intermittent connectivity"], badge: "BUILDING" },
    ],
  },

  /* ══ SLIDE 6 - VS SLACK ══ */
  vsSlack: {
    tag: "Why Not Slack + AI?",
    heading: "Slack is a copilot.",
    headingAccent: "OpenPing is the autopilot.",
    body: "Copilots help individuals go faster. Autopilots close decisions, route context, and follow through without human overhead.",
    bodyAccent: "No product owns the coordination control plane.",
    bodyEnd: "That's the gap.",
    slack: {
      label: "Copilot",
      name: "Slack + AI",
      rows: [
        { dim: "Core unit", val: "Message" },
        { dim: "AI role", val: "Reactive feature" },
        { dim: "Follow-through", val: "Manual" },
        { dim: "Success metric", val: "Summarized" },
      ],
    },
    openping: {
      label: "Autopilot",
      name: "OpenPing",
      rows: [
        { dim: "Core unit", val: "Decision" },
        { dim: "AI role", val: "Proactive orchestrator" },
        { dim: "Follow-through", val: "Autonomous" },
        { dim: "Success metric", val: "Decisions closed" },
      ],
    },
  },

  /* ══ SLIDE 7 - BUSINESS MODEL ══ */
  businessModel: {
    tag: "Business Model",
    heading: "Three revenue engines.",
    headingAccent: "Open core. Success-based. Proprietary data.",
    body: "We don't sell seats. We capture value at every layer - from free adoption to outcomes customers pay to keep.",
    tiers: [
      {
        tier: "Open Core",
        label: "Adoption engine",
        features: [
          "Open-source workspace interface",
          "Community-driven adoption, zero CAC",
          "Users own their data",
        ],
        trigger: "Conversion trigger: teams hit coordination limits",
      },
      {
        tier: "Success-Based",
        label: "Revenue engine",
        features: [
          "Priced on outcomes",
          "Decisions tracked to resolution",
          "Pay because it works, not because of a lock-in",
          "Compared against headcount, not software",
        ],
        trigger: null,
        highlight: true,
      },
      {
        tier: "Proprietary Data",
        label: "Moat engine",
        features: [
          "Every conversation builds the org context graph",
          "Classifiers improve with usage",
          "Data compounds into an unforkable moat",
          "Differential Privacy deep model training",
        ],
        trigger: null,
      },
    ],
    bottomCards: [
      {
        title: "Services are the new software",
        body: "AI lets us deliver outcomes directly — not tools for professionals to use. OpenPing replaces coordination labor, not just coordination software.",
      },
      {
        title: "Path to software margins",
        body: "Start with high-touch onboarding (services revenue). As the model learns each org, automation increases and margins converge to 70%+ at scale.",
      },
    ],
  },

  /* ══ SLIDE 8 - MARKET ══ */
  market: {
    tag: "Market",
    heading: "Not a SaaS seat.",
    headingAccent: "A coordination FTE — or lost revenue.",
    saasPrice: "$12/mo",
    coordPrice: "$180k+/yr",
    us: {
      label: "United States",
      tiers: [
        { label: "Beachhead", value: "$1.2B", sub: "~50k agencies, SW houses, consultancies" },
        { label: "5-Year SAM", value: "$12-15B", sub: "Expanding to all professional services" },
        { label: "Platform TAM", value: "$100B+", sub: "Full coordination headcount budget" },
      ],
      bottomStats: [
        { value: "$12M", sub: "ARR at 1% beachhead" },
        { value: "$60M", sub: "ARR at 5% penetration" },
      ],
    },
    eu: {
      label: "European Union",
      tiers: [
        { label: "Beachhead", value: "$0.8B", sub: "~35k agencies across DE, NL, Nordics, UK, PL" },
        { label: "5-Year SAM", value: "$8-10B", sub: "Professional services, compliance-driven orgs" },
        { label: "Platform TAM", value: "$70B+", sub: "EU coordination + data sovereignty premium" },
      ],
      footer: "Self-hosted open-source model removes data sovereignty objections. GDPR-first architecture is a competitive advantage vs US-only vendors.",
    },
    icp: [
      { label: "ICP", line: "Founder / COO / Head of Delivery", sub: "50-300 people" },
      { label: "Beachhead", line: "~85k agencies globally", sub: "US + EU combined" },
      { label: "ACV", line: "$24k - $150k", sub: "vs headcount, not SaaS" },
      { label: "Verticals", line: "Agencies · SW houses", sub: "Consultancies · Managed svc" },
    ],
  },

  /* ══ SLIDE 9 - GTM ══ */
  gtm: {
    tag: "Planned GTM Motion",
    heading: "Earn trust with 5 teams.",
    headingAccent: "Then let results compound.",
    phases: [
      {
        n: "01",
        title: "Design Partners (now)",
        body: "Deploying hands-on with 3-5 agencies. Sitting alongside delivery leads, iterating weekly. Proving coordination saves senior time measurably.",
        status: "Active",
      },
      {
        n: "02",
        title: "Open-source + community (Q3 2026)",
        body: "Open-source workspace drives developer adoption. Self-hosted free tier creates awareness. Teams hit the coordination ceiling and convert to paid.",
        status: "Next",
      },
      {
        n: "03",
        title: "Founder-led sales (Q4 2026)",
        body: "Design partner results become case studies. Direct outreach to Heads of Delivery and COOs at 50-300 person agencies. Founders close every deal.",
        status: "Planned",
      },
      {
        n: "04",
        title: "Channel partnerships (2027)",
        body: "Consultancy networks and implementation partners become distribution. Every deployment generates referral signal from adjacent firms.",
        status: "Planned",
      },
    ],
  },

  /* ══ SLIDE 10 - CONTACT ══ */
  contact: {
    heading: "A new decision layer is forming.",
    headingAccent: "OpenPing is the foundation.",
    body: "The product that controls context and coordination data for professional services will be infrastructure for how expert work gets delivered at scale.",
    email: "rafal@openping.app",
    stats: [
      { label: "Founded", value: "2026" },
      { label: "Stage", value: "Pre-seed" },
    ],
  },
} as const;
