import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ─── Prefix for idempotent lookup / cleanup ────────────────────────────────
const PREFIX = "mydeck_";

// ─── Real users (looked up at runtime by name) ─────────────────────────────
const REAL_USERS = [
  { key: "Rafal Wyderka", email: "wyderkarafal@gmail.com" },
  { key: "Konrad Alfaro", email: "alfaro.konrad@gmail.com" },
] as const;
type RealUserKey = (typeof REAL_USERS)[number]["key"];

// ─── 18 seed users ──────────────────────────────────────────────────────────
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
// "REAL" means both Rafal and Konrad are members
const ALL_SLUGS = [...USERS.map((u) => u.slug), ...REAL_USERS.map((u) => u.key)];

const CHANNELS: { slug: string; name: string; description: string; members: (string | RealUserKey)[] }[] = [
  { slug: "general", name: "general", description: "Company-wide announcements and water-cooler chat", members: ALL_SLUGS },
  { slug: "engineering", name: "engineering", description: "Engineering discussions, PRs, incidents", members: ["tom_rivera", "emi_tanaka", "raj_kumar", "lisa_chen", "omar_hassan", "sonia_wolf", "max_liu", "leo_martin", "Rafal Wyderka", "Konrad Alfaro"] },
  { slug: "product", name: "product", description: "Product strategy, roadmap, and feature planning", members: ["ana_garcia", "jake_foster", "nina_ros", "kate_nowak", "lisa_chen", "omar_hassan", "Rafal Wyderka", "Konrad Alfaro"] },
  { slug: "design", name: "design", description: "Design reviews, design system, and UX research", members: ["nina_ros", "lisa_chen", "jake_foster", "ana_garcia", "Konrad Alfaro"] },
  { slug: "sales", name: "sales", description: "Deals, pipeline, and competitive intel", members: ["ben_carter", "kate_nowak", "mei_wong", "dave_kowalski", "Rafal Wyderka"] },
  { slug: "customer-success", name: "customer-success", description: "Customer health, escalations, and onboarding", members: ["mei_wong", "ben_carter", "ana_garcia", "jake_foster", "Konrad Alfaro"] },
  { slug: "marketing", name: "marketing", description: "Campaigns, content, and brand", members: ["dave_kowalski", "kate_nowak", "nina_ros", "ben_carter", "Rafal Wyderka"] },
  { slug: "data", name: "data", description: "Analytics, metrics, and experiments", members: ["priya_sharma", "ana_garcia", "jake_foster", "raj_kumar", "Rafal Wyderka"] },
  { slug: "ops", name: "ops", description: "DevOps, infrastructure, and incidents", members: ["sonia_wolf", "tom_rivera", "raj_kumar", "leo_martin", "Rafal Wyderka", "Konrad Alfaro"] },
  { slug: "security", name: "security", description: "Security reviews, SOC 2, and vulnerability reports", members: ["leo_martin", "sonia_wolf", "tom_rivera", "carla_diaz", "Rafal Wyderka"] },
  { slug: "leadership", name: "leadership", description: "Exec sync — strategy, hiring, fundraising", members: ["kate_nowak", "tom_rivera", "emi_tanaka", "ana_garcia", "ben_carter", "Rafal Wyderka", "Konrad Alfaro"] },
  { slug: "random", name: "random", description: "Memes, pets, and off-topic fun", members: ALL_SLUGS },
];

// ─── Channel messages (10 scenarios + noise) ─────────────────────────────────
// Authors can be a seed user slug OR a RealUser name

interface RawMessage {
  channel: string;
  author: string;
  body: string;
  threadParentIdx?: number;
}

const MESSAGES: RawMessage[] = [
  // ── Scenario 1: Production incident (ops + engineering) ─────────────────
  { channel: "ops", author: "sonia_wolf", body: "🔴 P1 INCIDENT: API latency spike — p99 jumped from 120ms to 2.4s across all regions. Datadog alert triggered 3 minutes ago. Investigating." },
  { channel: "ops", author: "raj_kumar", body: "Correlating with a bad deploy at 14:02 UTC. The connection pool patch (PR #312) might be leaking connections under load." },
  { channel: "ops", author: "sonia_wolf", body: "Confirmed — active connections went from 50 to 480 in 10 minutes. Rolling back to the previous image now." },
  { channel: "ops", author: "tom_rivera", body: "Rollback complete. p99 back to 130ms. Let's do a proper postmortem tomorrow 10am. @raj_kumar can you prepare the timeline?" },
  { channel: "ops", author: "Rafal Wyderka", body: "Good catch on the rollback. @sonia_wolf can we add a circuit breaker for connection pool growth? We shouldn't need manual intervention for this class of issues." },
  { channel: "ops", author: "raj_kumar", body: "Root cause: the new pool config didn't set max idle timeout. Connections were never released under sustained traffic. Fix in PR #321." },
  { channel: "engineering", author: "tom_rivera", body: "FYI — we just rolled back PR #312 (connection pool patch). It caused a P1 latency spike in prod. Postmortem tomorrow at 10am. All backend folks should attend." },
  { channel: "engineering", author: "Konrad Alfaro", body: "I'll join the postmortem. We should also review our pre-deploy checklist — connection pool configs should have integration test coverage before hitting prod." },

  // ── Scenario 2: Feature launch coordination (product + engineering + design)
  { channel: "product", author: "ana_garcia", body: "Real-time cursors launch plan: we're targeting Thursday. Design is finalized, backend is code-complete, frontend needs 2 more days. @jake_foster status on the feature flag?" },
  { channel: "product", author: "jake_foster", body: "Feature flag is live in staging. I tested with 5 concurrent users — smooth. Planning a 10% rollout Thursday, 50% Friday, 100% Monday." },
  { channel: "product", author: "nina_ros", body: "Design sign-off is done. One note: the cursor label truncates at 12 chars. Can we bump to 20? It cuts off most last names." },
  { channel: "product", author: "Rafal Wyderka", body: "Love the gradual rollout plan. @ana_garcia let's make sure we have Datadog dashboards ready for cursor WebSocket connections before Thursday. Don't want another P1 surprise." },
  { channel: "product", author: "lisa_chen", body: "Easy fix — I'll push the label bump today. Also adding a tooltip on hover for the full name. PR incoming." },
  { channel: "product", author: "Konrad Alfaro", body: "The tooltip is a nice touch. @nina_ros have we tested cursor colors for accessibility? Need to make sure they pass WCAG contrast on both light and dark themes." },
  { channel: "engineering", author: "lisa_chen", body: "PR #318: Cursor label max-width bump + hover tooltip. Small change, needs a quick review. @omar_hassan mind taking a look?" },
  { channel: "engineering", author: "omar_hassan", body: "Approved. Clean diff. Merged to main." },

  // ── Scenario 3: Enterprise deal escalation (sales + customer-success) ───
  { channel: "sales", author: "ben_carter", body: "Acme Industries just moved to final evaluation. $240K ACV, 500 seats. They want SSO + SCIM by launch. @kate_nowak @Rafal Wyderka this could be our biggest deal this quarter." },
  { channel: "sales", author: "kate_nowak", body: "This is huge. SSO is shipping next week. SCIM is Q2 — can we give them a timeline commitment?" },
  { channel: "sales", author: "Rafal Wyderka", body: "We can commit to SCIM by end of April. I've talked to Tom — the backend plumbing is 70% done. @ben_carter tell them April 30th with a contractual guarantee." },
  { channel: "sales", author: "ben_carter", body: "Perfect. They're comparing us against Miro and Pitch. That commitment should close it. Sending the updated proposal now." },
  { channel: "customer-success", author: "mei_wong", body: "Heads up: Acme Industries is in final eval. If they sign, they'll need white-glove onboarding for 500 users. I'll need 2 weeks lead time minimum." },
  { channel: "customer-success", author: "Konrad Alfaro", body: "I can help with the Acme onboarding plan. @mei_wong let's sync tomorrow — I have some ideas for a scalable onboarding flow that we can templatize for future enterprise customers." },
  { channel: "customer-success", author: "ben_carter", body: "Great, looping you both in. Hoping to close by end of next week." },

  // ── Scenario 4: Design system v2 debate (design + product) ──────────────
  { channel: "design", author: "nina_ros", body: "Design system v2 proposal: moving from fixed spacing scale (4/8/12/16) to a fluid scale using clamp(). This will make responsive layouts much easier but it's a breaking change for existing components." },
  { channel: "design", author: "lisa_chen", body: "As the person who'll implement this — I'm cautiously supportive. The migration path is the hard part. Can we do it incrementally or is it all-or-nothing?" },
  { channel: "design", author: "Konrad Alfaro", body: "Incremental is the way. @nina_ros what if we create a compatibility layer — new fluid tokens map to the closest fixed value during transition? That way nothing breaks visually while we migrate." },
  { channel: "design", author: "nina_ros", body: "Love that approach. I'll prototype the compatibility layer in Figma this week. We can A/B test the visual difference — if nobody notices, we go fluid-only." },
  { channel: "design", author: "jake_foster", body: "Product perspective: I'd rather we ship the cursor feature first and do DS v2 in Q2. Two big changes at once = risk." },

  // ── Scenario 5: Data pipeline issue (data) ─────────────────────────────
  { channel: "data", author: "priya_sharma", body: "Our Mixpanel event volume dropped 40% since Tuesday. Either we broke tracking or users stopped using the product. Checking the pipeline now." },
  { channel: "data", author: "priya_sharma", body: "Found it — the event batching change in PR #305 silently drops events when the batch exceeds 100 items. Production batches are averaging 180 items. @raj_kumar this is your PR." },
  { channel: "data", author: "raj_kumar", body: "Damn, the batch limit was supposed to be 1000. I see the typo — `maxBatch: 100` instead of `1000`. Fixing now." },
  { channel: "data", author: "Rafal Wyderka", body: "This is the second data issue this month. @priya_sharma after the fix, can you add a pipeline health monitor that alerts if event volume drops >20% day-over-day? We can't afford blind spots." },
  { channel: "data", author: "priya_sharma", body: "Great idea. I'll set up the anomaly detection alert in Datadog. Also backfilling from raw logs — should recover 94% of missing events." },

  // ── Scenario 6: Security review (security) ─────────────────────────────
  { channel: "security", author: "leo_martin", body: "SOC 2 Type II audit prep: we have 3 findings from the readiness assessment. (1) No MFA enforcement on staging, (2) S3 bucket logging not enabled on 2 buckets, (3) Rotation policy for API keys not documented." },
  { channel: "security", author: "sonia_wolf", body: "I can fix (1) and (2) today. Both are terraform changes. (3) needs input from @carla_diaz on the policy doc." },
  { channel: "security", author: "Rafal Wyderka", body: "SOC 2 is a blocker for the Acme deal. @leo_martin what's our timeline to close all 3 findings? Can we get it done before the audit window opens?" },
  { channel: "security", author: "leo_martin", body: "@Rafal Wyderka (1) and (2) will be done today. (3) depends on legal — @carla_diaz can you prioritize the rotation policy doc?" },
  { channel: "security", author: "carla_diaz", body: "I'll draft the key rotation policy by EOD Wednesday. 90 days for production secrets, 180 for non-sensitive." },
  { channel: "security", author: "tom_rivera", body: "Sounds right. The auditor cares that we have a policy and follow it. Let's not over-rotate (pun intended)." },

  // ── Scenario 7: Marketing launch prep (marketing) ──────────────────────
  { channel: "marketing", author: "dave_kowalski", body: "Product Hunt launch is set for April 8th. We need: (1) 60-second demo video, (2) landing page update, (3) Twitter thread + LinkedIn post. @nina_ros can you own the video?" },
  { channel: "marketing", author: "nina_ros", body: "On it. I'll have a storyboard by Friday and final video by April 3rd. What features should I highlight?" },
  { channel: "marketing", author: "dave_kowalski", body: "Focus on real-time cursors (our differentiator), the AI layout engine, and the Figma import. Those three got the most reactions in user interviews." },
  { channel: "marketing", author: "Rafal Wyderka", body: "Let's coordinate with the Acme deal. If they sign before April 8th, we can use them as a logo on the launch page. @ben_carter @dave_kowalski make sure the timing works." },
  { channel: "marketing", author: "kate_nowak", body: "Agreed. Also — @Rafal Wyderka should we announce the Series A on launch day too? Double impact." },

  // ── Scenario 8: Leadership strategy (leadership) ───────────────────────
  { channel: "leadership", author: "kate_nowak", body: "Series A update: we have 3 term sheets. Benchmark at $25M / $100M pre, Sequoia at $20M / $80M pre, and a16z at $22M / $90M pre. Board meeting Thursday to decide." },
  { channel: "leadership", author: "Rafal Wyderka", body: "I've had follow-up calls with all three. Benchmark partner knows our space best — she introduced us to 4 enterprise prospects already. a16z has the brand but their partner is spread across 12 portfolio companies." },
  { channel: "leadership", author: "tom_rivera", body: "Benchmark gives us the most runway. And Rafal's point about the partner's focus is key — we need someone who'll actually pick up the phone." },
  { channel: "leadership", author: "Konrad Alfaro", body: "From a product perspective, Benchmark's portfolio has 3 companies in adjacent spaces — great for partnership/integration opportunities. I'd vote Benchmark." },
  { channel: "leadership", author: "kate_nowak", body: "Benchmark: 20% dilution. a16z: 19.6%. Sequoia: 20%. Very similar. Sounds like we're leaning Benchmark. Let's lock it in Thursday." },
  { channel: "leadership", author: "emi_tanaka", body: "From an eng hiring perspective, both help. But Benchmark's network in our space is stronger. +1 for Benchmark." },
  { channel: "leadership", author: "ana_garcia", body: "Whatever we choose, we need to close before PH launch on April 8th. A funded announcement + launch day = much bigger splash." },

  // ── Scenario 9: Hiring pipeline (leadership + general) ─────────────────
  { channel: "leadership", author: "emi_tanaka", body: "Eng hiring update: 3 offers out. Senior backend (ex-Datadog) accepted, starting April 14th. Senior frontend candidate counter-offered — needs $15K more. Junior infra candidate still deciding." },
  { channel: "leadership", author: "Rafal Wyderka", body: "Match the frontend counter. We've been looking for 8 weeks — losing this candidate means another 2 months. @emi_tanaka send the updated offer today." },
  { channel: "leadership", author: "Konrad Alfaro", body: "Agreed on matching. Also — the junior infra candidate asked about our tech stack during the interview. I'll send them a write-up of our architecture to help them decide." },
  { channel: "general", author: "emi_tanaka", body: "Excited to share: we have a new Senior Backend Engineer joining April 14th! More details soon. Welcome pack volunteers? 🎉" },
  { channel: "general", author: "Konrad Alfaro", body: "Welcome! I'll set up a 1:1 for their first week to walk through the architecture. @sonia_wolf can you handle account provisioning?" },
  { channel: "general", author: "mei_wong", body: "I'll handle the welcome pack!" },
  { channel: "general", author: "sonia_wolf", body: "Already on it — I have a new-hire automation script that provisions everything. Just need their email by April 7th." },

  // ── Scenario 10: Customer bug report (customer-success + engineering) ───
  { channel: "customer-success", author: "mei_wong", body: "Urgent: Globex Corp (ARR $36K) reports that shared decks show stale content after editing. They're presenting to their board tomorrow using a shared deck. This is a P1 for them." },
  { channel: "customer-success", author: "Konrad Alfaro", body: "I've seen this pattern before — likely the WebSocket reconnection logic. @omar_hassan can you check? Globex is a key account, we need this fixed today." },
  { channel: "customer-success", author: "jake_foster", body: "Good call Konrad. We thought we fixed the CDN cache invalidation last sprint but this sounds like a different root cause." },
  { channel: "engineering", author: "omar_hassan", body: "Investigated the Globex stale content bug. CDN cache is fine — Konrad was right, it's the WebSocket reconnection logic. After a network blip, the client doesn't re-fetch the latest version. Fix PR incoming." },
  { channel: "engineering", author: "omar_hassan", body: "PR #320: WebSocket reconnect + version re-sync. Added exponential backoff and a version check on reconnect. Tests passing." },
  { channel: "engineering", author: "Rafal Wyderka", body: "Reviewed PR #320 — the approach is solid. @max_liu can you run the full QA suite on staging before we ship? Simulate at least 50 network drops." },
  { channel: "engineering", author: "max_liu", body: "QA'd PR #320 on staging. Simulated network drops 50 times — content synced correctly every time. Looks good to ship." },
  { channel: "customer-success", author: "mei_wong", body: "Update: Globex confirms the fix works on their end. Crisis averted. Thanks @Konrad Alfaro and team! 🙏" },

  // ── Noise: everyday chatter ────────────────────────────────────────────
  { channel: "random", author: "omar_hassan", body: "Anyone else's VS Code suddenly using 8GB of RAM? I think TypeScript is mining crypto in the background." },
  { channel: "random", author: "Konrad Alfaro", body: "Try switching to Cursor — same VS Code base but somehow uses less memory. Also the AI autocomplete is actually useful." },
  { channel: "random", author: "lisa_chen", body: "It's the Tailwind IntelliSense plugin. Disable it and RAM drops by half. Re-enable it because you can't live without autocomplete. Repeat." },
  { channel: "random", author: "max_liu", body: "Hot take: tabs > spaces. I will die on this hill." },
  { channel: "random", author: "Rafal Wyderka", body: "Counterpoint: nobody has ever been fired for using spaces. Many have been judged for using tabs. 😄" },
  { channel: "random", author: "raj_kumar", body: "Counterpoint: your git diffs look terrible with tabs. Spaces or nothing." },
  { channel: "random", author: "dave_kowalski", body: "Non-engineer here: what's a tab?" },

  { channel: "general", author: "sam_okafor", body: "Reminder: expense reports for March are due by April 5th. Please use the new Ramp template — the old one breaks our automation." },
  { channel: "general", author: "carla_diaz", body: "NDA template has been updated for 2024. It's in the shared Legal folder on Drive. Please use the new version for all new vendor conversations." },
  { channel: "general", author: "dave_kowalski", body: "Team offsite is confirmed for April 18-19 in Brooklyn. Booking link in your email. Please RSVP by Friday." },
  { channel: "general", author: "Rafal Wyderka", body: "Proud of this team. We shipped 3 major features this month, closed our biggest deal pipeline, and handled a P1 like pros. Let's keep this energy into Q2. 💪" },

  { channel: "engineering", author: "emi_tanaka", body: "Reminder: tech debt Friday this week. Bring your top 3 pain points. We have budget for 2 sprints of cleanup work in Q2." },
  { channel: "engineering", author: "Rafal Wyderka", body: "My top pain point: observability. We need structured logging across all services. The P1 this week showed us how hard debugging is without it. @sonia_wolf let's discuss." },
  { channel: "engineering", author: "raj_kumar", body: "My top pain point: the migration system. We're running raw SQL strings inline. Can we please adopt something like golang-migrate or Atlas?" },
  { channel: "engineering", author: "Konrad Alfaro", body: "+1 on migrations. Also: our WebSocket layer needs proper connection lifecycle management. The Globex bug was a symptom of a deeper architectural issue." },
  { channel: "engineering", author: "lisa_chen", body: "Frontend pain point: our component library has 4 different Button components across 3 folders. DS v2 can't come soon enough." },
  { channel: "engineering", author: "sonia_wolf", body: "Infra pain point: our CI pipeline takes 22 minutes. I can get it under 8 minutes with better caching and parallel test stages." },

  { channel: "product", author: "ana_garcia", body: "Q2 roadmap priorities: (1) Real-time cursors GA, (2) Figma import v2, (3) Template marketplace MVP. We'll do a deep dive in Thursday's product review." },
  { channel: "product", author: "Konrad Alfaro", body: "Can we also discuss versioning? I've had 3 customer requests this week for 'undo to 2 hours ago'. Branching/versioning could be a big differentiator vs Miro." },
  { channel: "product", author: "jake_foster", body: "+1 on versioning. @Konrad Alfaro I have a rough spec — want to co-author the PRD this week?" },

  { channel: "data", author: "priya_sharma", body: "Weekly metrics: DAU up 12%, 7-day retention flat at 34%, activation rate (first deck created within 24h) at 41%. Activation is our bottleneck." },
  { channel: "data", author: "Rafal Wyderka", body: "41% activation is too low. @priya_sharma can you break this down by acquisition channel? I suspect the webinar signups have much lower intent than organic." },

  { channel: "sales", author: "ben_carter", body: "Pipeline update: $1.2M in qualified pipeline, $380K in committed. Two new enterprise leads from the webinar last week. Following up Monday." },
  { channel: "sales", author: "Rafal Wyderka", body: "Solid pipeline. @ben_carter let's review the top 5 deals together on Monday — I want to understand the blockers on the $380K committed." },

  // ── Threaded replies ───────────────────────────────────────────────────
  // Scenario 1 thread on the incident (index 0)
  { channel: "ops", author: "leo_martin", body: "Should we add a connection pool gauge to the Datadog dashboard? We'd have caught this earlier.", threadParentIdx: 0 },
  { channel: "ops", author: "sonia_wolf", body: "Good idea. I'll add connection count, idle connections, and wait time metrics to the SRE board today.", threadParentIdx: 0 },
  { channel: "ops", author: "Konrad Alfaro", body: "Also consider adding a runbook link to the Datadog alert. When someone gets paged at 2am, they shouldn't need to figure out the rollback procedure from scratch.", threadParentIdx: 0 },

  // Scenario 2 thread on the launch plan (index 8)
  { channel: "product", author: "ana_garcia", body: "Update: frontend is done a day early. Moving launch to Wednesday. @jake_foster can we flip the flag in staging today?", threadParentIdx: 8 },
  { channel: "product", author: "jake_foster", body: "Flag flipped. Staging is live with cursors. QA window is open until tomorrow EOD.", threadParentIdx: 8 },
  { channel: "product", author: "Rafal Wyderka", body: "Nice work moving it up. Make sure @max_liu does a load test with 50+ concurrent cursors. Enterprise customers will push that limit.", threadParentIdx: 8 },

  // Scenario 5 thread on the data pipeline issue (index 29)
  { channel: "data", author: "raj_kumar", body: "Fix deployed. Batch limit is now 1000. Verified in staging with 500-item batches — all events flowing.", threadParentIdx: 29 },
  { channel: "data", author: "priya_sharma", body: "Backfill complete. We recovered 94% of the missing events. The remaining 6% were in a corrupted log segment. Good enough.", threadParentIdx: 29 },

  // Scenario 7 thread on PH launch (index 42)
  { channel: "marketing", author: "nina_ros", body: "Storyboard ready. 3 scenes: (1) blank canvas → AI layout, (2) cursor collaboration, (3) Figma import one-click. Sending for review.", threadParentIdx: 42 },
  { channel: "marketing", author: "Rafal Wyderka", body: "Add a 4th scene showing multiplayer editing with 10+ cursors — that's the 'wow' moment. Miro can't do that smoothly.", threadParentIdx: 42 },
  { channel: "marketing", author: "dave_kowalski", body: "Love both ideas. Let's go with 4 scenes. @nina_ros can you extend the storyboard?", threadParentIdx: 42 },

  // Random thread on tabs vs spaces (index 76)
  { channel: "random", author: "omar_hassan", body: "I switched to tabs last month and my code immediately became 10x more readable. Correlation = causation.", threadParentIdx: 76 },
  { channel: "random", author: "lisa_chen", body: "Your code became more readable because you started using Prettier, not because of tabs. Source: I reviewed your PRs.", threadParentIdx: 76 },
];

// ─── DM conversations ────────────────────────────────────────────────────────

interface RawDM {
  kind: "1to1" | "group";
  name?: string;
  participants: string[];
  messages: { author: string; body: string }[];
}

const DM_CONVERSATIONS: RawDM[] = [
  // 1:1 — Rafal ↔ Kate (Series A strategy)
  {
    kind: "1to1",
    participants: ["Rafal Wyderka", "kate_nowak"],
    messages: [
      { author: "Rafal Wyderka", body: "Kate, I've been thinking about the Benchmark vs a16z decision. Benchmark's partner Sarah called me yesterday — she's already introduced us to Acme's CTO for a design partnership. That kind of proactive help matters." },
      { author: "kate_nowak", body: "That's a strong signal. a16z has the brand but their partner hasn't made a single intro in 3 weeks. Actions > promises." },
      { author: "Rafal Wyderka", body: "Exactly. Also — Benchmark's terms give us an extra $5M runway at our current burn. That's 6 more months before we need to think about Series B." },
      { author: "kate_nowak", body: "Good point. Let's go in with Benchmark as our pick on Thursday. I'll prep the board deck tonight." },
      { author: "Rafal Wyderka", body: "I'll review it tomorrow morning. Let's also prep talking points for why we passed on a16z — the board will ask." },
    ],
  },
  // 1:1 — Rafal ↔ Konrad (architecture discussion)
  {
    kind: "1to1",
    participants: ["Rafal Wyderka", "Konrad Alfaro"],
    messages: [
      { author: "Rafal Wyderka", body: "Hey, the P1 today got me thinking. Our WebSocket layer is getting fragile. Cursors, presence, typing indicators — it's all multiplexed on one connection with no proper lifecycle management." },
      { author: "Konrad Alfaro", body: "Been thinking the same thing. We need a connection manager that handles reconnection, state reconciliation, and graceful degradation. Right now each feature does its own thing." },
      { author: "Rafal Wyderka", body: "Can you draft an RFC? I think this is Q2 priority. If we're launching real-time cursors for enterprise, the foundation needs to be solid." },
      { author: "Konrad Alfaro", body: "Already started. I'll have a draft by Friday. Key question: do we build our own or adopt something like Socket.io's manager pattern?" },
      { author: "Rafal Wyderka", body: "Build our own — Socket.io adds too much overhead and we need fine control over the reconnection protocol. But let's borrow the good ideas from their architecture." },
      { author: "Konrad Alfaro", body: "Agreed. I'll benchmark our current reconnection behavior and propose the new lifecycle model. Want to co-review with Tom before sharing wider?" },
      { author: "Rafal Wyderka", body: "Yes. Let's do Rafal + Konrad + Tom review first, then share with the broader eng team at tech debt Friday." },
    ],
  },
  // 1:1 — Konrad ↔ Nina (design system + product collaboration)
  {
    kind: "1to1",
    participants: ["Konrad Alfaro", "nina_ros"],
    messages: [
      { author: "Konrad Alfaro", body: "Nina, I love the DS v2 proposal. The compatibility layer idea — I think we can implement it as a build-time transform so there's zero runtime cost." },
      { author: "nina_ros", body: "That's brilliant. So designers work in fluid tokens, the build system maps them to fixed for legacy components, and new components use fluid natively?" },
      { author: "Konrad Alfaro", body: "Exactly. I'll prototype the build plugin this week. If it works, the migration becomes nearly invisible to end users." },
      { author: "nina_ros", body: "This would make the whole DS v2 migration so much smoother. Want to pair on Thursday? Lisa's also free that afternoon." },
      { author: "Konrad Alfaro", body: "Perfect. Thursday 2pm — you, me, and Lisa. Let's make DS v2 happen." },
    ],
  },
  // 1:1 — Konrad ↔ Omar (WebSocket debugging)
  {
    kind: "1to1",
    participants: ["Konrad Alfaro", "omar_hassan"],
    messages: [
      { author: "Konrad Alfaro", body: "Omar, nice fix on the Globex bug. I've been looking at the broader WebSocket reconnection issue and I think we need a more systematic solution. Mind if I send you my RFC draft?" },
      { author: "omar_hassan", body: "Please! The current reconnection logic is a band-aid. I added the version check but there are at least 3 other race conditions I noticed while debugging." },
      { author: "Konrad Alfaro", body: "I cataloged those too: (1) concurrent tab reconnections stepping on each other, (2) offline edits conflicting with server state, (3) presence going stale after reconnect. All related." },
      { author: "omar_hassan", body: "We should fix all of these before cursors GA. If 500 Acme users hit these edge cases simultaneously, it'll be ugly." },
      { author: "Konrad Alfaro", body: "Exactly. I'm proposing a unified connection manager in the RFC. Want to co-author the implementation plan?" },
    ],
  },
  // Group DM — incident coordination (Rafal + Konrad both in war room)
  {
    kind: "group",
    name: "P1 Incident War Room",
    participants: ["Rafal Wyderka", "Konrad Alfaro", "sonia_wolf", "raj_kumar", "tom_rivera"],
    messages: [
      { author: "sonia_wolf", body: "Incident war room is open. Timeline so far: 14:02 deploy, 14:05 latency spike, 14:08 Datadog alert, 14:12 rollback initiated, 14:15 rollback complete." },
      { author: "raj_kumar", body: "I've identified the root cause. The connection pool patch set `maxIdleTime: 0` which means connections never expire. Under sustained load, the pool grows unbounded." },
      { author: "Rafal Wyderka", body: "How did this pass code review? The pool config change had no integration test. We need a policy: any infrastructure config change requires a load test before merge." },
      { author: "tom_rivera", body: "Agreed. I'll add it to the contributing guidelines today." },
      { author: "Konrad Alfaro", body: "I checked the blast radius. No customer data affected — purely latency, no errors or data loss. Globex and Acme accounts are on the healthy node. We dodged a bullet." },
      { author: "sonia_wolf", body: "Postmortem doc created. I'll fill in the timeline and action items tonight." },
      { author: "raj_kumar", body: "Fix PR: PR #321 — adds maxIdleTime: 30s and maxPoolSize: 100. Also added a CI check that fails if pool config doesn't set both values." },
      { author: "Rafal Wyderka", body: "Good. @sonia_wolf let's also add a Datadog monitor for connection count > 200. And @Konrad Alfaro — add the runbook link to the alert config." },
      { author: "Konrad Alfaro", body: "On it. Runbook will cover: identify → rollback → verify → communicate → postmortem. Should be reusable for any deploy-related incident." },
    ],
  },
  // 1:1 — Rafal ↔ Ben (deal strategy)
  {
    kind: "1to1",
    participants: ["Rafal Wyderka", "ben_carter"],
    messages: [
      { author: "ben_carter", body: "Rafal, Acme's procurement team sent the redline. They want a 90-day out clause and EU-only data residency. Standard is 12 months and multi-region." },
      { author: "Rafal Wyderka", body: "90-day out is a non-starter. Offer 180-day minimum with 60-day notice. On EU residency — we have EU regions but need to verify CDN edge caching. Let me check with Tom." },
      { author: "ben_carter", body: "Got it. Their champion internally is the VP of Product — she loves us. I'll ask her to push back on the 90-day clause." },
      { author: "Rafal Wyderka", body: "Good strategy. Also loop in Carla on the redline — I don't want surprises on the DPA side. SOC 2 findings need to be closed too before they do their security review." },
      { author: "ben_carter", body: "Already talked to Carla. She flagged the data residency clause too. This deal has a lot of moving parts but the ARR makes it worth it." },
      { author: "Rafal Wyderka", body: "Absolutely worth it. $240K ACV + the logo for PH launch day. Let's close this." },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// seedMyDeckDemo
// ═══════════════════════════════════════════════════════════════════════════════

export const seedMyDeckDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    // ── Find the first real workspace ─────────────────────────────────────
    const allWorkspaces = await ctx.db.query("workspaces").collect();
    const workspace = allWorkspaces.find((w) => !w.slug.startsWith("mydeck"));
    if (!workspace) throw new Error("No workspace found — sign in to the app first to create one");

    const workspaceId = workspace._id;

    // ── Resolve real users by email ──────────────────────────────────────
    const realUserMap: Record<string, Id<"users">> = {};
    for (const ru of REAL_USERS) {
      const found = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", ru.email))
        .first();
      if (!found) throw new Error(`Real user "${ru.key}" (${ru.email}) not found in the database. They must sign in first.`);
      realUserMap[ru.key] = found._id;
    }

    // ── Create seed users (idempotent) ────────────────────────────────────
    const userMap: Record<string, Id<"users">> = { ...realUserMap };

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

      // Add members (resolve both slug and real name)
      const cid = channelMap[ch.slug]!;
      for (const memberKey of ch.members) {
        const uid = userMap[memberKey];
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
    // First pass: non-thread messages
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

      await ctx.scheduler.runAfter(0, internal.ingest.processMessage, {
        messageId: msgId,
      });
    }

    // Second pass: thread replies with denormalization
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

      await ctx.scheduler.runAfter(0, internal.ingest.processMessage, {
        messageId: replyId,
        threadId: parentMsgId,
      });
    }

    // ── Create DM conversations ──────────────────────────────────────────
    for (const dm of DM_CONVERSATIONS) {
      const creatorKey = dm.participants[0]!;
      const creator = userMap[creatorKey]!;

      const convId = await ctx.db.insert("directConversations", {
        workspaceId,
        kind: dm.kind,
        name: dm.name,
        createdBy: creator,
        isArchived: false,
      });

      for (const key of dm.participants) {
        const uid = userMap[key];
        if (!uid) continue;
        await ctx.db.insert("directConversationMembers", {
          conversationId: convId,
          userId: uid,
          isAgent: false,
        });
      }

      for (const dmMsg of dm.messages) {
        const authorId = userMap[dmMsg.author]!;
        const dmId = await ctx.db.insert("directMessages", {
          conversationId: convId,
          authorId,
          body: dmMsg.body,
          type: "user",
          isEdited: false,
        });

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

    // Delete DM conversations created by mydeck users
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
