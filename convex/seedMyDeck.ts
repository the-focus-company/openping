import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ─── Prefix for idempotent lookup / cleanup ────────────────────────────────
const PREFIX = "mydeck_";

// ─── 18 users ───────────────────────────────────────────────────────────────
const USERS = [
  { slug: "kate_nowak", email: "kate.nowak@mydeck.io", name: "Kate Nowak", title: "CEO & Co-Founder", department: "Executive", bio: "Building the future of deck collaboration. Ex-McKinsey, Stanford MBA.", expertise: ["Strategy", "Fundraising", "GTM"] },
  { slug: "tom_rivera", email: "tom.rivera@mydeck.io", name: "Tom Rivera", title: "CTO & Co-Founder", department: "Engineering", bio: "Distributed systems nerd. Passionate about developer experience.", expertise: ["Rust", "WASM", "Architecture", "Performance"] },
  { slug: "emi_tanaka", email: "emi.tanaka@mydeck.io", name: "Emi Tanaka", title: "VP Engineering", department: "Engineering", bio: "Scaling teams and systems. Prev Stripe infra.", expertise: ["Team building", "Infrastructure", "Go", "AWS"] },
  { slug: "raj_kumar", email: "raj.kumar@mydeck.io", name: "Raj Kumar", title: "Senior Backend Engineer", department: "Engineering", bio: "API design and data pipelines. Loves PostgreSQL.", expertise: ["Go", "PostgreSQL", "gRPC", "Data pipelines"] },
  { slug: "lisa_chen", email: "lisa.chen@mydeck.io", name: "Lisa Chen", title: "Senior Frontend Engineer", department: "Engineering", bio: "React specialist. Obsessed with smooth animations.", expertise: ["React", "TypeScript", "Framer Motion", "Design Systems"] },
  { slug: "omar_hassan", email: "omar.hassan@mydeck.io", name: "Omar Hassan", title: "Full-Stack Engineer", department: "Engineering", bio: "Shipping end-to-end features fast. Prev Vercel.", expertise: ["Next.js", "Convex", "Tailwind", "Figma-to-code"] },
  { slug: "sonia_wolf", email: "sonia.wolf@mydeck.io", name: "Sonia Wolf", title: "DevOps / SRE Lead", department: "Engineering", bio: "Zero-downtime deploys, 99.99% SLA champion.", expertise: ["Kubernetes", "Terraform", "Datadog", "Incident response"] },
  { slug: "max_liu", email: "max.liu@mydeck.io", name: "Max Liu", title: "QA Engineer", department: "Engineering", bio: "Breaking things before users do. Playwright evangelist.", expertise: ["Playwright", "Cypress", "CI/CD", "Load testing"] },
  { slug: "ana_garcia", email: "ana.garcia@mydeck.io", name: "Ana Garcia", title: "Head of Product", department: "Product", bio: "Customer-obsessed PM. Data-informed decisions.", expertise: ["Roadmapping", "Analytics", "User research", "B2B SaaS"] },
  { slug: "jake_foster", email: "jake.foster@mydeck.io", name: "Jake Foster", title: "Product Manager", department: "Product", bio: "Owns collaboration & real-time features. Ex-Notion.", expertise: ["Collaboration tools", "Growth", "A/B testing"] },
  { slug: "nina_ros", email: "nina.ros@mydeck.io", name: "Nina Ros", title: "Lead Product Designer", department: "Design", bio: "Systems thinker. Leading the MyDeck design language.", expertise: ["Design Systems", "Figma", "Prototyping", "Accessibility"] },
  { slug: "ben_carter", email: "ben.carter@mydeck.io", name: "Ben Carter", title: "Head of Sales", department: "Sales", bio: "Closing enterprise deals. Building the outbound engine.", expertise: ["Enterprise sales", "Pipeline", "Salesforce", "Negotiation"] },
  { slug: "mei_wong", email: "mei.wong@mydeck.io", name: "Mei Wong", title: "Customer Success Lead", department: "Customer Success", bio: "Onboarding and retaining our top accounts.", expertise: ["Onboarding", "Retention", "Escalations", "Intercom"] },
  { slug: "dave_kowalski", email: "dave.kowalski@mydeck.io", name: "Dave Kowalski", title: "Head of Marketing", department: "Marketing", bio: "Brand storytelling + demand gen. Ex-HubSpot.", expertise: ["Content marketing", "SEO", "Brand", "PLG"] },
  { slug: "priya_sharma", email: "priya.sharma@mydeck.io", name: "Priya Sharma", title: "Data Scientist", department: "Data", bio: "Turning product data into actionable insights.", expertise: ["Python", "dbt", "SQL", "A/B testing", "Mixpanel"] },
  { slug: "leo_martin", email: "leo.martin@mydeck.io", name: "Leo Martin", title: "Security Engineer", department: "Engineering", bio: "SOC 2, pen testing, and keeping the bad guys out.", expertise: ["SOC 2", "Pen testing", "OWASP", "AWS IAM"] },
  { slug: "carla_diaz", email: "carla.diaz@mydeck.io", name: "Carla Diaz", title: "Legal Counsel", department: "Legal", bio: "Contracts, compliance, and making sure we don't get sued.", expertise: ["SaaS agreements", "GDPR", "DPA", "IP"] },
  { slug: "sam_okafor", email: "sam.okafor@mydeck.io", name: "Sam Okafor", title: "Finance & Ops Manager", department: "Operations", bio: "Runway, budgets, and keeping the lights on.", expertise: ["FP&A", "Runway modeling", "Procurement", "HR ops"] },
] as const;

// ─── 12 channels ─────────────────────────────────────────────────────────────
const CHANNELS: { slug: string; name: string; description: string; members: string[] }[] = [
  { slug: "general", name: "general", description: "Company-wide announcements and water-cooler chat", members: USERS.map((u) => u.slug) },
  { slug: "engineering", name: "engineering", description: "Engineering discussions, PRs, incidents", members: ["tom_rivera", "emi_tanaka", "raj_kumar", "lisa_chen", "omar_hassan", "sonia_wolf", "max_liu", "leo_martin"] },
  { slug: "product", name: "product", description: "Product strategy, roadmap, and feature planning", members: ["ana_garcia", "jake_foster", "nina_ros", "kate_nowak", "lisa_chen", "omar_hassan"] },
  { slug: "design", name: "design", description: "Design reviews, design system, and UX research", members: ["nina_ros", "lisa_chen", "jake_foster", "ana_garcia"] },
  { slug: "sales", name: "sales", description: "Deals, pipeline, and competitive intel", members: ["ben_carter", "kate_nowak", "mei_wong", "dave_kowalski"] },
  { slug: "customer-success", name: "customer-success", description: "Customer health, escalations, and onboarding", members: ["mei_wong", "ben_carter", "ana_garcia", "jake_foster"] },
  { slug: "marketing", name: "marketing", description: "Campaigns, content, and brand", members: ["dave_kowalski", "kate_nowak", "nina_ros", "ben_carter"] },
  { slug: "data", name: "data", description: "Analytics, metrics, and experiments", members: ["priya_sharma", "ana_garcia", "jake_foster", "raj_kumar"] },
  { slug: "ops", name: "ops", description: "DevOps, infrastructure, and incidents", members: ["sonia_wolf", "tom_rivera", "raj_kumar", "leo_martin"] },
  { slug: "security", name: "security", description: "Security reviews, SOC 2, and vulnerability reports", members: ["leo_martin", "sonia_wolf", "tom_rivera", "carla_diaz"] },
  { slug: "leadership", name: "leadership", description: "Exec sync — strategy, hiring, fundraising", members: ["kate_nowak", "tom_rivera", "emi_tanaka", "ana_garcia", "ben_carter"] },
  { slug: "random", name: "random", description: "Memes, pets, and off-topic fun", members: USERS.map((u) => u.slug) },
];

// ─── Channel messages (10 scenarios + noise) ─────────────────────────────────

interface RawMessage {
  channel: string;
  author: string;
  body: string;
  /** If set, this message is a thread reply to the message at this index in the same channel */
  threadParentIdx?: number;
}

const MESSAGES: RawMessage[] = [
  // ── Scenario 1: Production incident (ops + engineering) ─────────────────
  { channel: "ops", author: "sonia_wolf", body: "🔴 P1 INCIDENT: API latency spike — p99 jumped from 120ms to 2.4s across all regions. Datadog alert triggered 3 minutes ago. Investigating." },
  { channel: "ops", author: "raj_kumar", body: "Correlating with a bad deploy at 14:02 UTC. The connection pool patch (PR #312) might be leaking connections under load." },
  { channel: "ops", author: "sonia_wolf", body: "Confirmed — active connections went from 50 to 480 in 10 minutes. Rolling back to the previous image now." },
  { channel: "ops", author: "tom_rivera", body: "Rollback complete. p99 back to 130ms. Let's do a proper postmortem tomorrow 10am. @raj_kumar can you prepare the timeline?" },
  { channel: "ops", author: "raj_kumar", body: "Will do. Root cause: the new pool config didn't set max idle timeout. Connections were never released under sustained traffic." },
  { channel: "engineering", author: "tom_rivera", body: "FYI — we just rolled back PR #312 (connection pool patch). It caused a P1 latency spike in prod. Postmortem tomorrow at 10am. All backend folks should attend." },

  // ── Scenario 2: Feature launch coordination (product + engineering + design)
  { channel: "product", author: "ana_garcia", body: "Real-time cursors launch plan: we're targeting Thursday. Design is finalized, backend is code-complete, frontend needs 2 more days. @jake_foster status on the feature flag?" },
  { channel: "product", author: "jake_foster", body: "Feature flag is live in staging. I tested with 5 concurrent users — smooth. Planning a 10% rollout Thursday, 50% Friday, 100% Monday." },
  { channel: "product", author: "nina_ros", body: "Design sign-off is done. One note: the cursor label truncates at 12 chars. Can we bump to 20? It cuts off most last names." },
  { channel: "product", author: "lisa_chen", body: "Easy fix — I'll push that today. Also adding a tooltip on hover for the full name. PR incoming." },
  { channel: "engineering", author: "lisa_chen", body: "PR #318: Cursor label max-width bump + hover tooltip. Small change, needs a quick review. @omar_hassan mind taking a look?" },
  { channel: "engineering", author: "omar_hassan", body: "Approved. Clean diff. Merged to main." },

  // ── Scenario 3: Enterprise deal escalation (sales + customer-success) ───
  { channel: "sales", author: "ben_carter", body: "Acme Industries just moved to final evaluation. $240K ACV, 500 seats. They want SSO + SCIM by launch. @kate_nowak this could be our biggest deal this quarter." },
  { channel: "sales", author: "kate_nowak", body: "This is huge. SSO is shipping next week. SCIM is Q2 — can we give them a timeline commitment?" },
  { channel: "sales", author: "ben_carter", body: "They're comparing us against Miro and Pitch. If we commit to SCIM by end of April, they'll sign. Without it, they go with Miro." },
  { channel: "customer-success", author: "mei_wong", body: "Heads up: Acme Industries is in final eval. If they sign, they'll need white-glove onboarding for 500 users. I'll need 2 weeks lead time minimum." },
  { channel: "customer-success", author: "ben_carter", body: "Noted. I'll keep you in the loop on the timeline. Hoping to close by end of next week." },

  // ── Scenario 4: Design system v2 debate (design + product) ──────────────
  { channel: "design", author: "nina_ros", body: "Design system v2 proposal: moving from fixed spacing scale (4/8/12/16) to a fluid scale using clamp(). This will make responsive layouts much easier but it's a breaking change for existing components." },
  { channel: "design", author: "lisa_chen", body: "As the person who'll implement this — I'm cautiously supportive. The migration path is the hard part. Can we do it incrementally or is it all-or-nothing?" },
  { channel: "design", author: "nina_ros", body: "Incremental works. We can add the fluid tokens alongside the fixed ones, migrate component-by-component, then deprecate fixed tokens in v2.1." },
  { channel: "design", author: "jake_foster", body: "Product perspective: I'd rather we ship the cursor feature first and do DS v2 in Q2. Two big changes at once = risk." },

  // ── Scenario 5: Data pipeline issue (data) ─────────────────────────────
  { channel: "data", author: "priya_sharma", body: "Our Mixpanel event volume dropped 40% since Tuesday. Either we broke tracking or users stopped using the product. Checking the pipeline now." },
  { channel: "data", author: "priya_sharma", body: "Found it — the event batching change in PR #305 silently drops events when the batch exceeds 100 items. Production batches are averaging 180 items. @raj_kumar this is your PR." },
  { channel: "data", author: "raj_kumar", body: "Damn, the batch limit was supposed to be 1000. I see the typo — `maxBatch: 100` instead of `1000`. Fixing now." },
  { channel: "data", author: "priya_sharma", body: "We're missing 3 days of event data. I can backfill from raw logs but it'll take ~6 hours. Starting the job now." },

  // ── Scenario 6: Security review (security) ─────────────────────────────
  { channel: "security", author: "leo_martin", body: "SOC 2 Type II audit prep: we have 3 findings from the readiness assessment. (1) No MFA enforcement on staging, (2) S3 bucket logging not enabled on 2 buckets, (3) Rotation policy for API keys not documented." },
  { channel: "security", author: "sonia_wolf", body: "I can fix (1) and (2) today. Both are terraform changes. (3) needs input from @carla_diaz on the policy doc." },
  { channel: "security", author: "carla_diaz", body: "I'll draft the key rotation policy by EOD Wednesday. Need input on what the actual rotation cadence should be — 90 days? 180?" },
  { channel: "security", author: "tom_rivera", body: "90 days for production secrets, 180 for non-sensitive. Let's not over-rotate (pun intended). The auditor cares that we have a policy and follow it." },

  // ── Scenario 7: Marketing launch prep (marketing) ──────────────────────
  { channel: "marketing", author: "dave_kowalski", body: "Product Hunt launch is set for April 8th. We need: (1) 60-second demo video, (2) landing page update, (3) Twitter thread + LinkedIn post. @nina_ros can you own the video?" },
  { channel: "marketing", author: "nina_ros", body: "On it. I'll have a storyboard by Friday and final video by April 3rd. What features should I highlight?" },
  { channel: "marketing", author: "dave_kowalski", body: "Focus on real-time cursors (our differentiator), the AI layout engine, and the Figma import. Those three got the most reactions in user interviews." },
  { channel: "marketing", author: "kate_nowak", body: "Let's coordinate with the Acme deal. If they sign before April 8th, we can use them as a logo on the launch page. @ben_carter thoughts?" },

  // ── Scenario 8: Leadership strategy (leadership) ───────────────────────
  { channel: "leadership", author: "kate_nowak", body: "Series A update: we have 3 term sheets. Benchmark at $25M / $100M pre, Sequoia at $20M / $80M pre, and a16z at $22M / $90M pre. Board meeting Thursday to decide." },
  { channel: "leadership", author: "tom_rivera", body: "Benchmark gives us the most runway. But a16z's platform team could accelerate our enterprise motion. What does the cap table look like for each?" },
  { channel: "leadership", author: "kate_nowak", body: "Benchmark: 20% dilution. a16z: 19.6%. Sequoia: 20%. Very similar. The real difference is the partner — I've worked with the Benchmark partner before." },
  { channel: "leadership", author: "emi_tanaka", body: "From an eng hiring perspective, a16z's brand helps a lot with senior candidates. But the Benchmark partner's network in our space is stronger. Tough call." },
  { channel: "leadership", author: "ana_garcia", body: "Whatever we choose, we need to close before PH launch on April 8th. A funded announcement + launch day = much bigger splash." },

  // ── Scenario 9: Hiring pipeline (leadership + general) ─────────────────
  { channel: "leadership", author: "emi_tanaka", body: "Eng hiring update: 3 offers out. Senior backend (ex-Datadog) accepted, starting April 14th. Senior frontend candidate counter-offered — needs $15K more. Junior infra candidate still deciding." },
  { channel: "leadership", author: "tom_rivera", body: "Match the frontend counter. We've been looking for 8 weeks — losing this candidate means another 2 months of searching." },
  { channel: "general", author: "emi_tanaka", body: "Excited to share: we have a new Senior Backend Engineer joining April 14th! More details soon. Welcome pack volunteers? 🎉" },
  { channel: "general", author: "mei_wong", body: "I'll handle the welcome pack! Can someone set up their accounts before day one? @sonia_wolf" },
  { channel: "general", author: "sonia_wolf", body: "Already on it — I have a new-hire automation script that provisions everything. Just need their email by April 7th." },

  // ── Scenario 10: Customer bug report (customer-success + engineering) ───
  { channel: "customer-success", author: "mei_wong", body: "Urgent: Globex Corp (ARR $36K) reports that shared decks show stale content after editing. They're presenting to their board tomorrow using a shared deck. This is a P1 for them." },
  { channel: "customer-success", author: "jake_foster", body: "Sounds like the CDN cache invalidation issue we thought we fixed last sprint. @omar_hassan can you check?" },
  { channel: "engineering", author: "omar_hassan", body: "Investigated the Globex stale content bug. CDN cache is fine — the issue is our WebSocket reconnection logic. After a network blip, the client doesn't re-fetch the latest version. Fix PR incoming." },
  { channel: "engineering", author: "omar_hassan", body: "PR #320: WebSocket reconnect + version re-sync. Added exponential backoff and a version check on reconnect. Tests passing." },
  { channel: "engineering", author: "max_liu", body: "QA'd PR #320 on staging. Simulated network drops 50 times — content synced correctly every time. Looks good to ship." },
  { channel: "customer-success", author: "mei_wong", body: "Update: Globex confirms the fix works on their end. Crisis averted. Thanks team! 🙏" },

  // ── Noise: everyday chatter ────────────────────────────────────────────
  { channel: "random", author: "omar_hassan", body: "Anyone else's VS Code suddenly using 8GB of RAM? I think TypeScript is mining crypto in the background." },
  { channel: "random", author: "lisa_chen", body: "It's the Tailwind IntelliSense plugin. Disable it and RAM drops by half. Re-enable it because you can't live without autocomplete. Repeat." },
  { channel: "random", author: "max_liu", body: "Hot take: tabs > spaces. I will die on this hill." },
  { channel: "random", author: "raj_kumar", body: "Counterpoint: your git diffs look terrible with tabs. Spaces or nothing." },
  { channel: "random", author: "dave_kowalski", body: "Non-engineer here: what's a tab?" },

  { channel: "general", author: "sam_okafor", body: "Reminder: expense reports for March are due by April 5th. Please use the new Ramp template — the old one breaks our automation." },
  { channel: "general", author: "carla_diaz", body: "NDA template has been updated for 2024. It's in the shared Legal folder on Drive. Please use the new version for all new vendor conversations." },
  { channel: "general", author: "dave_kowalski", body: "Team offsite is confirmed for April 18-19 in Brooklyn. Booking link in your email. Please RSVP by Friday." },
  { channel: "general", author: "kate_nowak", body: "Proud of this team. We shipped 3 major features this month, closed our biggest deal ever, and nobody burned out. Let's keep this energy into Q2. 💪" },

  { channel: "engineering", author: "emi_tanaka", body: "Reminder: tech debt Friday this week. Bring your top 3 pain points. We have budget for 2 sprints of cleanup work in Q2." },
  { channel: "engineering", author: "raj_kumar", body: "My top pain point: the migration system. We're running raw SQL strings inline. Can we please adopt something like golang-migrate or Atlas?" },
  { channel: "engineering", author: "lisa_chen", body: "Frontend pain point: our component library has 4 different Button components across 3 folders. DS v2 can't come soon enough." },
  { channel: "engineering", author: "sonia_wolf", body: "Infra pain point: our CI pipeline takes 22 minutes. I can get it under 8 minutes with better caching and parallel test stages." },

  { channel: "product", author: "ana_garcia", body: "Q2 roadmap priorities: (1) Real-time cursors GA, (2) Figma import v2, (3) Template marketplace MVP. We'll do a deep dive in Thursday's product review." },
  { channel: "product", author: "jake_foster", body: "Can we also discuss versioning? I've had 3 customer requests this week for 'undo to 2 hours ago'. Branching/versioning could be a big differentiator." },

  { channel: "data", author: "priya_sharma", body: "Weekly metrics: DAU up 12%, 7-day retention flat at 34%, activation rate (first deck created within 24h) at 41%. Activation is our bottleneck." },

  { channel: "sales", author: "ben_carter", body: "Pipeline update: $1.2M in qualified pipeline, $380K in committed. Two new enterprise leads from the webinar last week. Following up Monday." },

  // ── Threaded replies ───────────────────────────────────────────────────
  // These reference parent messages by their index in this array
  // Scenario 1 thread on the incident message (index 0)
  { channel: "ops", author: "leo_martin", body: "Should we add a connection pool gauge to the Datadog dashboard? We'd have caught this earlier.", threadParentIdx: 0 },
  { channel: "ops", author: "sonia_wolf", body: "Good idea. I'll add connection count, idle connections, and wait time metrics to the SRE board today.", threadParentIdx: 0 },

  // Scenario 2 thread on the launch plan (index 6)
  { channel: "product", author: "ana_garcia", body: "Update: frontend is done a day early. Moving launch to Wednesday. @jake_foster can we flip the flag in staging today?", threadParentIdx: 6 },
  { channel: "product", author: "jake_foster", body: "Flag flipped. Staging is live with cursors. QA window is open until tomorrow EOD.", threadParentIdx: 6 },

  // Scenario 5 thread on the data pipeline issue (index 21)
  { channel: "data", author: "raj_kumar", body: "Fix deployed. Batch limit is now 1000. Verified in staging with 500-item batches — all events flowing.", threadParentIdx: 21 },
  { channel: "data", author: "priya_sharma", body: "Backfill complete. We recovered 94% of the missing events. The remaining 6% were in a corrupted log segment. Good enough.", threadParentIdx: 21 },

  // Scenario 7 thread on PH launch (index 30)
  { channel: "marketing", author: "nina_ros", body: "Storyboard ready. 3 scenes: (1) blank canvas → AI layout, (2) cursor collaboration, (3) Figma import one-click. Sending for review.", threadParentIdx: 30 },
  { channel: "marketing", author: "dave_kowalski", body: "Love it. Can we add a 4th scene showing the template marketplace? Even though it's MVP, it looks impressive.", threadParentIdx: 30 },

  // Random thread on tabs vs spaces (index 54)
  { channel: "random", author: "omar_hassan", body: "I switched to tabs last month and my code immediately became 10x more readable. Correlation = causation.", threadParentIdx: 54 },
  { channel: "random", author: "lisa_chen", body: "Your code became more readable because you started using Prettier, not because of tabs. Source: I reviewed your PRs.", threadParentIdx: 54 },
];

// ─── DM conversations ────────────────────────────────────────────────────────

interface RawDM {
  kind: "1to1" | "group";
  name?: string;
  participants: string[];
  messages: { author: string; body: string }[];
}

const DM_CONVERSATIONS: RawDM[] = [
  // 1:1 — CTO ↔ VP Eng (hiring budget)
  {
    kind: "1to1",
    participants: ["tom_rivera", "emi_tanaka"],
    messages: [
      { author: "tom_rivera", body: "Did you see the frontend counter-offer? $15K above our band. What do you think?" },
      { author: "emi_tanaka", body: "We should match it. The candidate is strong and the market is brutal right now. Reposting the role would cost us more than $15K in recruiter fees alone." },
      { author: "tom_rivera", body: "Agreed. I'll approve the bump. Can you send the updated offer today?" },
      { author: "emi_tanaka", body: "Sending now. Also — the junior infra candidate asked for remote-first. Our policy says hybrid. Should we make an exception?" },
      { author: "tom_rivera", body: "For infra roles, remote makes sense. They'll be in PagerDuty rotations anyway. Let's offer remote with quarterly onsites." },
    ],
  },
  // 1:1 — CEO ↔ Head of Sales (Acme deal)
  {
    kind: "1to1",
    participants: ["kate_nowak", "ben_carter"],
    messages: [
      { author: "ben_carter", body: "Acme's procurement team sent the redline. They want a 90-day out clause. Standard is 12 months." },
      { author: "kate_nowak", body: "That's a non-starter. We can offer 180-day minimum with a 60-day notice period. Compromise position." },
      { author: "ben_carter", body: "I'll push back. Their champion internally is the VP of Product — she loves us. I'll ask her to advocate." },
      { author: "kate_nowak", body: "Good. Also loop in Carla on the redline. I don't want any surprises on the legal side." },
      { author: "ben_carter", body: "Already did. Carla flagged the data residency clause too — they want EU-only storage. We need to check if our infra supports that." },
      { author: "kate_nowak", body: "Ask Tom. We have EU regions but I'm not sure about the CDN edge caching. This might delay the deal." },
    ],
  },
  // 1:1 — Designer ↔ Frontend Engineer (DS v2)
  {
    kind: "1to1",
    participants: ["nina_ros", "lisa_chen"],
    messages: [
      { author: "nina_ros", body: "Hey, I've been thinking about the DS v2 migration. Want to pair on a proof-of-concept this week? I think we can migrate the Button component in a day." },
      { author: "lisa_chen", body: "I'd love that. Thursday afternoon works for me. Should we use the new fluid tokens from the start or keep fixed as a fallback?" },
      { author: "nina_ros", body: "Both. I'll set up dual token exports so we can A/B test the visual difference. If nobody notices, we go fluid-only." },
      { author: "lisa_chen", body: "Smart. I'll prep the Button component with the token abstraction layer so swapping is just a config change." },
    ],
  },
  // 1:1 — Data Scientist ↔ Product Manager (metrics)
  {
    kind: "1to1",
    participants: ["priya_sharma", "jake_foster"],
    messages: [
      { author: "priya_sharma", body: "Jake, the activation rate is concerning. 41% of users never create a deck in their first session. I think our onboarding flow is the bottleneck." },
      { author: "jake_foster", body: "I've suspected that. The current flow is 7 steps before they see a blank canvas. Can you pull the drop-off data by step?" },
      { author: "priya_sharma", body: "Already done. Biggest drop is step 4 (workspace setup) — 28% abandon there. It asks for team size, industry, and use case. That's a lot of friction for 'I just want to try this'." },
      { author: "jake_foster", body: "Let's kill step 4 and make it optional in settings. I'll write the spec today. Can you set up the A/B test?" },
      { author: "priya_sharma", body: "Will do. I'll have the experiment running by Monday. We should see significance within a week given our signup volume." },
    ],
  },
  // Group DM — incident coordination
  {
    kind: "group",
    name: "P1 Incident War Room",
    participants: ["sonia_wolf", "raj_kumar", "tom_rivera", "leo_martin"],
    messages: [
      { author: "sonia_wolf", body: "Incident war room is open. Timeline so far: 14:02 deploy, 14:05 latency spike, 14:08 Datadog alert, 14:12 rollback initiated, 14:15 rollback complete." },
      { author: "raj_kumar", body: "I've identified the root cause. The connection pool patch set `maxIdleTime: 0` which means connections never expire. Under sustained load, the pool grows unbounded." },
      { author: "tom_rivera", body: "How did this pass code review? We need to add a pool size assertion to our integration tests." },
      { author: "leo_martin", body: "I checked the blast radius. No customer data was affected. The issue was purely latency — no errors, no data loss. Customer-facing status page was never triggered." },
      { author: "sonia_wolf", body: "Postmortem doc created: https://docs.google.com/document/d/mydeck-postmortem-312. I'll fill in the timeline and action items tonight." },
      { author: "raj_kumar", body: "Fix PR: PR #321 — adds maxIdleTime: 30s and maxPoolSize: 100. Also added a CI check that fails if pool config doesn't set both values." },
      { author: "tom_rivera", body: "Good. Let's also add a Datadog monitor for connection count > 200. We should never hit that in normal operation." },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// seedMyDeckDemo
// ═══════════════════════════════════════════════════════════════════════════════

export const seedMyDeckDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    // ── Find the first real (non-seed) workspace ──────────────────────────
    const allWorkspaces = await ctx.db.query("workspaces").collect();
    const workspace = allWorkspaces.find((w) => !w.slug.startsWith("mydeck"));
    if (!workspace) throw new Error("No workspace found — sign in to the app first to create one");

    const workspaceId = workspace._id;

    // ── Create users (idempotent) ─────────────────────────────────────────
    const userMap: Record<string, Id<"users">> = {};

    for (const u of USERS) {
      const wosId = PREFIX + u.slug;
      const existing = await ctx.db
        .query("users")
        .withIndex("by_workos_id", (q) => q.eq("workosUserId", wosId))
        .unique();

      if (existing) {
        userMap[u.slug] = existing._id;
      } else {
        const uid = await ctx.db.insert("users", {
          workosUserId: wosId,
          email: u.email,
          name: u.name,
          status: "active",
          title: u.title,
          department: u.department,
          bio: u.bio,
          expertise: [...u.expertise],
          onboardingStatus: "completed",
        });
        userMap[u.slug] = uid;

        // Add to workspace
        const existingMember = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_user_workspace", (q) =>
            q.eq("userId", uid).eq("workspaceId", workspaceId),
          )
          .unique();
        if (!existingMember) {
          await ctx.db.insert("workspaceMembers", {
            userId: uid,
            workspaceId,
            role: u.slug === "kate_nowak" ? "admin" : "member",
            joinedAt: Date.now(),
          });
        }
      }
    }

    // ── Create channels (idempotent) ──────────────────────────────────────
    const channelMap: Record<string, Id<"channels">> = {};

    for (const ch of CHANNELS) {
      const existing = await ctx.db
        .query("channels")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspaceId", workspaceId).eq("name", ch.name),
        )
        .unique();

      if (existing) {
        channelMap[ch.slug] = existing._id;
      } else {
        const creator = userMap["kate_nowak"]!;
        const cid = await ctx.db.insert("channels", {
          name: ch.name,
          description: ch.description,
          workspaceId,
          createdBy: creator,
          isDefault: ch.slug === "general",
          isArchived: false,
          type: "public",
        });
        channelMap[ch.slug] = cid;
      }

      // Add members
      const cid = channelMap[ch.slug]!;
      for (const memberSlug of ch.members) {
        const uid = userMap[memberSlug];
        if (!uid) continue;
        const existingMember = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) =>
            q.eq("channelId", cid).eq("userId", uid),
          )
          .unique();
        if (!existingMember) {
          await ctx.db.insert("channelMembers", {
            channelId: cid,
            userId: uid,
          });
        }
      }
    }

    // ── Insert channel messages + threads ─────────────────────────────────
    const now = Date.now();
    const baseTime = now - 24 * 60 * 60 * 1000; // start 24h ago
    const msgInterval = 8 * 60 * 1000; // ~8 min between messages

    // First pass: insert all non-thread messages to get their IDs
    const messageIds: (Id<"messages"> | null)[] = [];

    for (let i = 0; i < MESSAGES.length; i++) {
      const msg = MESSAGES[i]!;
      const cid = channelMap[msg.channel];
      const uid = userMap[msg.author];
      if (!cid || !uid) {
        messageIds.push(null);
        continue;
      }

      if (msg.threadParentIdx !== undefined) {
        // Thread replies handled in second pass
        messageIds.push(null);
        continue;
      }

      const msgId = await ctx.db.insert("messages", {
        channelId: cid,
        authorId: uid,
        body: msg.body,
        type: "user",
        isEdited: false,
      });
      messageIds.push(msgId);

      // Schedule ingest
      await ctx.scheduler.runAfter(0, internal.ingest.processMessage, {
        messageId: msgId,
      });
    }

    // Second pass: insert thread replies with denormalization
    for (let i = 0; i < MESSAGES.length; i++) {
      const msg = MESSAGES[i]!;
      if (msg.threadParentIdx === undefined) continue;

      const cid = channelMap[msg.channel];
      const uid = userMap[msg.author];
      const parentMsgId = messageIds[msg.threadParentIdx];
      if (!cid || !uid || !parentMsgId) continue;

      const replyId = await ctx.db.insert("messages", {
        channelId: cid,
        authorId: uid,
        body: msg.body,
        type: "user",
        isEdited: false,
        threadId: parentMsgId,
      });
      messageIds[i] = replyId;

      // Update parent thread denormalization
      const parent = await ctx.db.get(parentMsgId);
      if (parent) {
        const existingParticipants = parent.threadParticipantIds ?? [];
        const newParticipants = existingParticipants.includes(uid)
          ? existingParticipants
          : [...existingParticipants, uid].slice(0, 20);

        await ctx.db.patch(parentMsgId, {
          threadReplyCount: (parent.threadReplyCount ?? 0) + 1,
          threadLastReplyAt: Date.now(),
          threadLastReplyAuthorId: uid,
          threadParticipantIds: newParticipants,
        });
      }

      // Schedule ingest
      await ctx.scheduler.runAfter(0, internal.ingest.processMessage, {
        messageId: replyId,
        threadId: parentMsgId,
      });
    }

    // ── Create DM conversations ──────────────────────────────────────────
    for (const dm of DM_CONVERSATIONS) {
      const creatorSlug = dm.participants[0]!;
      const creator = userMap[creatorSlug]!;

      const convId = await ctx.db.insert("directConversations", {
        workspaceId,
        kind: dm.kind,
        name: dm.name,
        createdBy: creator,
        isArchived: false,
      });

      // Add members
      for (const slug of dm.participants) {
        const uid = userMap[slug];
        if (!uid) continue;
        await ctx.db.insert("directConversationMembers", {
          conversationId: convId,
          userId: uid,
          isAgent: false,
        });
      }

      // Insert DM messages
      for (const dmMsg of dm.messages) {
        const authorId = userMap[dmMsg.author]!;
        const dmId = await ctx.db.insert("directMessages", {
          conversationId: convId,
          authorId,
          body: dmMsg.body,
          type: "user",
          isEdited: false,
        });

        // Schedule ingest
        await ctx.scheduler.runAfter(0, internal.ingest.processDirectMessage, {
          messageId: dmId,
        });
      }
    }

    return {
      users: Object.keys(userMap).length,
      channels: Object.keys(channelMap).length,
      messages: messageIds.filter(Boolean).length,
      dmConversations: DM_CONVERSATIONS.length,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// clearMyDeckDemo
// ═══════════════════════════════════════════════════════════════════════════════

export const clearMyDeckDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allWorkspaces = await ctx.db.query("workspaces").collect();
    const workspace = allWorkspaces.find((w) => !w.slug.startsWith("mydeck"));
    if (!workspace) throw new Error("No workspace found");

    const workspaceId = workspace._id;
    const stats: Record<string, number> = {};

    // Find all mydeck_ users (by workosUserId prefix)
    const allUsers = await ctx.db.query("users").collect();
    const mydeckUsers = allUsers.filter((u) =>
      u.workosUserId.startsWith(PREFIX),
    );
    const mydeckUserIds = mydeckUsers.map((u) => u._id);

    // Find channels created by mydeck users in this workspace
    const allChannels = await ctx.db
      .query("channels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const mydeckChannels = allChannels.filter((c) =>
      mydeckUserIds.includes(c.createdBy),
    );
    const mydeckChannelIds = mydeckChannels.map((c) => c._id);

    // Delete messages in mydeck channels
    stats.messages = 0;
    for (const channelId of mydeckChannelIds) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", channelId))
        .collect();
      for (const m of msgs) {
        await ctx.db.delete(m._id);
        stats.messages++;
      }
    }

    // Delete channel members
    stats.channelMembers = 0;
    for (const channelId of mydeckChannelIds) {
      const members = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel", (q) => q.eq("channelId", channelId))
        .collect();
      for (const m of members) {
        await ctx.db.delete(m._id);
        stats.channelMembers++;
      }
    }

    // Delete channels
    stats.channels = 0;
    for (const ch of mydeckChannels) {
      await ctx.db.delete(ch._id);
      stats.channels++;
    }

    // Delete DM conversations and messages created by mydeck users
    const dmConvs = await ctx.db
      .query("directConversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    stats.directMessages = 0;
    stats.directConversationMembers = 0;
    stats.directConversations = 0;

    for (const conv of dmConvs) {
      if (!mydeckUserIds.includes(conv.createdBy)) continue;

      const dmMsgs = await ctx.db
        .query("directMessages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conv._id),
        )
        .collect();
      for (const m of dmMsgs) {
        await ctx.db.delete(m._id);
        stats.directMessages++;
      }

      const dmMembers = await ctx.db
        .query("directConversationMembers")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conv._id),
        )
        .collect();
      for (const m of dmMembers) {
        await ctx.db.delete(m._id);
        stats.directConversationMembers++;
      }

      await ctx.db.delete(conv._id);
      stats.directConversations++;
    }

    // Delete workspace members for mydeck users
    stats.workspaceMembers = 0;
    for (const uid of mydeckUserIds) {
      const memberships = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .collect();
      for (const m of memberships) {
        await ctx.db.delete(m._id);
        stats.workspaceMembers++;
      }
    }

    // Delete mydeck users
    stats.users = 0;
    for (const u of mydeckUsers) {
      await ctx.db.delete(u._id);
      stats.users++;
    }

    return stats;
  },
});
