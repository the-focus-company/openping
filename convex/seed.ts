import { internalMutation, mutation } from "./_generated/server";
import { requireUser } from "./auth";

export const seedDefaultData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if default workspace already exists
    const existingWorkspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "default"))
      .unique();

    if (existingWorkspace) return;

    // Create a system user for seeding
    const systemUserId = await ctx.db.insert("users", {
      workosUserId: "system",
      email: "system@ping.app",
      name: "System",
      status: "active",
    });

    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Default Workspace",
      slug: "default",
      createdBy: systemUserId,
    });

    // Create workspace membership for system user
    await ctx.db.insert("workspaceMembers", {
      userId: systemUserId,
      workspaceId,
      role: "admin",
      joinedAt: Date.now(),
    });

    // Create default channels
    const generalId = await ctx.db.insert("channels", {
      name: "general",
      description: "Company-wide announcements and discussion",
      workspaceId,
      createdBy: systemUserId,
      isDefault: true,
      isArchived: false,
      type: "public",
    });

    await ctx.db.insert("channels", {
      name: "engineering",
      description: "Engineering team discussions",
      workspaceId,
      createdBy: systemUserId,
      isDefault: true,
      isArchived: false,
      type: "public",
    });

    // Add system user to channels
    await ctx.db.insert("channelMembers", {
      channelId: generalId,
      userId: systemUserId,
    });
  },
});

// ─── Seed mock decisions for the logged-in user ───────────────────────────────

export const seedDecisions = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Find workspace membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!membership) throw new Error("No workspace found for user");

    const workspaceId = membership.workspaceId;

    // Get or create channels we'll reference
    const channelMap: Record<string, import("./_generated/dataModel").Id<"channels">> = {};

    const channelNames = ["engineering", "product", "general", "support", "ops", "data"];
    for (const name of channelNames) {
      const existing = await ctx.db
        .query("channels")
        .filter((q) =>
          q.and(q.eq(q.field("workspaceId"), workspaceId), q.eq(q.field("name"), name)),
        )
        .first();
      if (existing) {
        channelMap[name] = existing._id;
      } else {
        channelMap[name] = await ctx.db.insert("channels", {
          name,
          workspaceId,
          createdBy: user._id,
          isDefault: false,
          isArchived: false,
        });
      }
    }

    // ── Step A: Create mock users (idempotent — check by workosUserId) ──────────

    const mockUserData = [
      {
        workosId: "mock_sarah_kim",
        email: "sarah.kim@acme.co",
        name: "Sarah Kim",
        title: "Senior Frontend Engineer",
        department: "Engineering",
        bio: "Building fast, accessible UIs. 5 years here. Previously at Figma.",
        expertise: ["React", "TypeScript", "Design Systems", "Accessibility"],
      },
      {
        workosId: "mock_alex_chen",
        email: "alex.chen@acme.co",
        name: "Alex Chen",
        title: "Backend Tech Lead",
        department: "Engineering",
        bio: "Distributed systems and API design. Obsessed with correctness and observability.",
        expertise: ["Go", "PostgreSQL", "Kafka", "API Design"],
      },
      {
        workosId: "mock_david_park",
        email: "david.park@acme.co",
        name: "David Park",
        title: "QA Engineer",
        department: "Engineering",
        bio: "Breaking things so users don't have to. Automation-first.",
        expertise: ["Playwright", "Test automation", "CI/CD", "Performance"],
      },
      {
        workosId: "mock_marcus_lee",
        email: "marcus.lee@acme.co",
        name: "Marcus Lee",
        title: "Customer Success Manager",
        department: "Customer Success",
        bio: "Bridging product and customer outcomes. Managing our top 20 enterprise accounts.",
        expertise: ["Enterprise accounts", "Onboarding", "Escalations", "Salesforce"],
      },
      {
        workosId: "mock_priya_patel",
        email: "priya.patel@acme.co",
        name: "Priya Patel",
        title: "Head of Sales",
        department: "Sales",
        bio: "Closing deals and building the pipeline. Focused on mid-market expansion.",
        expertise: ["Enterprise sales", "Contract negotiation", "Revenue ops"],
      },
      {
        workosId: "mock_jordan_park",
        email: "jordan.park@acme.co",
        name: "Jordan Park",
        title: "Senior Product Manager",
        department: "Product",
        bio: "Obsessed with user problems. Ships fast, iterates faster. Owns the design system roadmap.",
        expertise: ["Roadmapping", "User research", "Growth", "B2B SaaS"],
      },
      {
        workosId: "mock_mia_torres",
        email: "mia.torres@acme.co",
        name: "Mia Torres",
        title: "Product Designer",
        department: "Design",
        bio: "Systems thinker with a taste for simplicity. Leading the ds-v2 initiative.",
        expertise: ["Design systems", "Figma", "Prototyping", "User testing"],
      },
      {
        workosId: "mock_chris_wang",
        email: "chris.wang@acme.co",
        name: "Chris Wang",
        title: "DevOps Engineer",
        department: "Engineering",
        bio: "Keeping the lights on and the deploys fast. Zero-downtime is non-negotiable.",
        expertise: ["Kubernetes", "Terraform", "AWS", "Observability"],
      },
      {
        workosId: "mock_dana_ross",
        email: "dana.ross@acme.co",
        name: "Dana Ross",
        title: "Data Scientist",
        department: "Data",
        bio: "Turning noise into signal. Leading the metrics standardization project.",
        expertise: ["Python", "dbt", "Analytics", "A/B testing"],
      },
      {
        workosId: "mock_taylor_wong",
        email: "taylor.wong@acme.co",
        name: "Taylor Wong",
        title: "Legal Counsel",
        department: "Legal",
        bio: "Protecting the company while enabling the business to move fast.",
        expertise: ["Data privacy", "Contract review", "GDPR", "SaaS agreements"],
      },
    ];

    const userIdByName: Record<string, import("./_generated/dataModel").Id<"users">> = {};

    for (const u of mockUserData) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_workos_id", (q) => q.eq("workosUserId", u.workosId))
        .unique();

      let uid: import("./_generated/dataModel").Id<"users">;
      if (existing) {
        uid = existing._id;
      } else {
        uid = await ctx.db.insert("users", {
          workosUserId: u.workosId,
          email: u.email,
          name: u.name,
          status: "active" as const,
          title: u.title,
          department: u.department,
          bio: u.bio,
          expertise: u.expertise,
          onboardingStatus: "completed" as const,
        });

        // Add to workspace as member (check if already exists)
        const existingMembership = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_user_workspace", (q) =>
            q.eq("userId", uid).eq("workspaceId", workspaceId),
          )
          .unique();
        if (!existingMembership) {
          await ctx.db.insert("workspaceMembers", {
            userId: uid,
            workspaceId,
            role: "member" as const,
            joinedAt: Date.now(),
          });
        }
      }
      userIdByName[u.name] = uid;
    }

    // ── Step B: Insert mock messages into channels ──────────────────────────────

    type ChannelMessage = { channelKey: string; authorName: string; body: string };
    const channelMessages: ChannelMessage[] = [
      // #engineering
      {
        channelKey: "engineering",
        authorName: "Alex Chen",
        body: "PR #847 is ready for final review. Refactored JWT middleware to use RS256 consistently across all services. CI green on 3 consecutive runs. Just need 1 more approval to unblock the staging deploy.",
      },
      {
        channelKey: "engineering",
        authorName: "Sarah Kim",
        body: "Went through the diff — token refresh logic looks solid. The edge case on concurrent refresh requests is handled well. @david.park QA is queued?",
      },
      {
        channelKey: "engineering",
        authorName: "David Park",
        body: "Yes, staging pipeline is queued. We have a 2-hour QA window starting now. Approval needed ASAP or we lose the slot.",
      },
      {
        channelKey: "engineering",
        authorName: "Alex Chen",
        body: "Also dropping v1/users endpoint on Friday per the deprecation plan. Mobile team should be aware — they still have v1 calls in their client.",
      },
      {
        channelKey: "engineering",
        authorName: "Sarah Kim",
        body: "Mobile lead said they need at least 3 more weeks. The endpoint is causing incidents though. This needs a decision.",
      },
      // #support
      {
        channelKey: "support",
        authorName: "Marcus Lee",
        body: "Escalation from Acme Corp — they're getting 429s on /v2/events. Their enterprise contract specifies 1,000 req/min but our system has them limited to 200.",
      },
      {
        channelKey: "support",
        authorName: "Priya Patel",
        body: "Confirmed — Acme is on the Enterprise tier. The 200/min limit was a config error from the migration 3 weeks ago. We're in breach of their SLA.",
      },
      {
        channelKey: "support",
        authorName: "Marcus Lee",
        body: "Their batch reporting job runs at 6pm today. If we don't fix by then, they'll have a failed run and they'll escalate to exec level.",
      },
      // #product
      {
        channelKey: "product",
        authorName: "Jordan Park",
        body: "ds-v2 planning time. We have 34 open tickets. I need to lock Q2 vs Q3 scope this week — design, frontend, and mobile are all waiting on this decision.",
      },
      {
        channelKey: "product",
        authorName: "Mia Torres",
        body: "I've been through all 34. My recommendation: top 15 are foundational (token system, typography, spacing). The remaining 19 are component-level and can slip. See the tracker: https://docs.google.com/spreadsheets/d/1BXkQn9cZfake-ds-v2-tracker",
      },
      {
        channelKey: "product",
        authorName: "Jordan Park",
        body: "Makes sense. The token system alone unlocks the component work anyway. I'm leaning toward top 15 in Q2.",
      },
      // #ops
      {
        channelKey: "ops",
        authorName: "Chris Wang",
        body: "Stripe integration is code-complete and tested. We're blocked on legal signing off on the data processing addendum. DPA has been in legal review for 6 days.",
      },
      {
        channelKey: "ops",
        authorName: "Dana Ross",
        body: "The launch was on the roadmap for Monday. If we don't get a decision today, we'll miss the window.",
      },
      {
        channelKey: "ops",
        authorName: "Chris Wang",
        body: "Options: escalate legal, launch without saved cards feature, or push the date. All three have trade-offs.",
      },
      // #data
      {
        channelKey: "data",
        authorName: "Dana Ross",
        body: "Found a discrepancy in the board deck. The activation rate is listed as 68% but the dashboard shows 61%. The difference is definition: 'account created' vs 'first message sent'.",
      },
      {
        channelKey: "data",
        authorName: "Priya Patel",
        body: "Board deck goes out Thursday. We need to pick one definition and stick with it. The 61% number is more meaningful but less flattering.",
      },
      {
        channelKey: "data",
        authorName: "Dana Ross",
        body: "Agreed. 'First message sent' actually measures activation. 'Account created' is just signup. But this needs exec sign-off on the definition before I update the deck.",
      },
      // #general
      {
        channelKey: "general",
        authorName: "Marcus Lee",
        body: "Office move survey is still at 12/40 responses. Deadline is tomorrow EOD. We need either more responses or to extend.",
      },
      {
        channelKey: "general",
        authorName: "Mia Torres",
        body: "Also reminder: all-hands slide deck needs exec review by EOD Thursday. Still waiting on 3 sections.",
      },
    ];

    for (const msg of channelMessages) {
      const cid = channelMap[msg.channelKey];
      const uid = userIdByName[msg.authorName];
      if (!cid || !uid) continue;

      // Ensure user is channel member
      const existingMember = await ctx.db
        .query("channelMembers")
        .filter((q) =>
          q.and(q.eq(q.field("channelId"), cid), q.eq(q.field("userId"), uid)),
        )
        .first();
      if (!existingMember) {
        await ctx.db.insert("channelMembers", { channelId: cid, userId: uid });
      }

      await ctx.db.insert("messages", {
        channelId: cid,
        authorId: uid,
        body: msg.body,
        type: "user" as const,
        isEdited: false,
      });
    }

    // ── Step C: Build mock decisions with userIds in orgTrace ──────────────────

    const now = Date.now();

    const mockDecisions: Parameters<typeof ctx.db.insert<"decisions">>[1][] = [
      // 0: PR review — Q1 urgent-important
      {
        userId: user._id,
        workspaceId,
        type: "pr_review",
        title: "Should we approve PR #847 to unblock the staging deploy?",
        summary: "PR #847 refactors the JWT middleware. Staging is blocked until it merges — QA window closes in 2 hours. CI is green, 1 approval still needed.",
        eisenhowerQuadrant: "urgent-important",
        status: "pending",
        channelId: channelMap["engineering"],
        orgTrace: [
          { name: "Sarah Kim", role: "author", userId: userIdByName["Sarah Kim"] },
          { name: "Alex Chen", role: "assignee", userId: userIdByName["Alex Chen"] },
          { name: "David Park", role: "mentioned", userId: userIdByName["David Park"] },
          { name: "Taylor Wong", role: "to_consult", userId: userIdByName["Taylor Wong"] },
        ],
        recommendedActions: [
          { label: "Approve & merge", actionKey: "approve", primary: true },
          { label: "Request changes", actionKey: "request_changes", needsComment: true },
          { label: "Skip — not my call", actionKey: "snooze" },
        ],
        nextSteps: [
          { actionKey: "approve", label: "Post approval comment on PR #847", automated: true },
          { actionKey: "approve", label: "Notify QA team in #engineering", automated: true },
          { actionKey: "approve", label: "Trigger staging deploy pipeline", automated: true },
          { actionKey: "request_changes", label: "Post your feedback as PR review comment", automated: true },
          { actionKey: "request_changes", label: "Notify Sarah Kim with context", automated: true },
          { actionKey: "snooze", label: "Remind you again in 1 hour", automated: true },
        ],
        links: [
          { title: "Auth Middleware RFC", url: "https://docs.google.com/document/d/1BXkQn9cZfake-auth-rfc/edit", type: "doc" as const },
          { title: "JWT Best Practices (watch first)", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", type: "video" as const },
        ],
        createdAt: now - 12 * 60 * 1000,
      },
      // 1: Rate limit — Q1 urgent-important
      {
        userId: user._id,
        workspaceId,
        type: "question_answer",
        title: "Should we raise Acme Corp's API rate limit above their contract?",
        summary: "Acme is hitting 429s. Their contract allows 1,000 req/min but the limiter is set to 200. Marcus escalated — their batch job runs at end of business today.",
        eisenhowerQuadrant: "urgent-important",
        status: "pending",
        channelId: channelMap["support"],
        orgTrace: [
          { name: "Marcus Lee", role: "author", userId: userIdByName["Marcus Lee"] },
          { name: "Priya Patel", role: "mentioned", userId: userIdByName["Priya Patel"] },
          { name: "Jamie Sato", role: "to_consult" },
        ],
        recommendedActions: [
          { label: "Raise to 1,000 req/min now", actionKey: "raise_limit", primary: true },
          { label: "Keep limit, ask sales to renegotiate", actionKey: "escalate_sales" },
          { label: "Escalate to account manager", actionKey: "escalate_am", needsComment: true },
        ],
        nextSteps: [
          { actionKey: "raise_limit", label: "Update Acme Corp rate limit to 1,000/min", automated: true },
          { actionKey: "raise_limit", label: "Send confirmation to Marcus Lee", automated: true },
          { actionKey: "raise_limit", label: "Log override in audit trail", automated: true },
          { actionKey: "escalate_sales", label: "Draft email to Priya Patel flagging contract gap", automated: true },
          { actionKey: "escalate_am", label: "Create follow-up task for account manager", automated: false },
        ],
        links: [
          { title: "Acme Corp Enterprise Contract", url: "https://docs.google.com/document/d/1BXkQn9cZfake-acme-contract/edit", type: "doc" as const },
        ],
        createdAt: now - 28 * 60 * 1000,
      },
      // 2: Ticket triage — Q2 important
      {
        userId: user._id,
        workspaceId,
        type: "ticket_triage",
        title: "Which ds-v2 Linear tickets belong in Q2 scope?",
        summary: "34 tickets tagged 'ds-v2' are open. Jordan needs the scope locked this week — it affects roadmap planning for product, frontend, and design. Q3 starts in 5 weeks.",
        eisenhowerQuadrant: "important",
        status: "pending",
        channelId: channelMap["product"],
        orgTrace: [
          { name: "Jordan Park", role: "assignee", userId: userIdByName["Jordan Park"] },
          { name: "Mia Torres", role: "mentioned", userId: userIdByName["Mia Torres"] },
          { name: "Ryan Cho", role: "to_consult" },
        ],
        recommendedActions: [
          { label: "All 34 tickets in Q2", actionKey: "all_in" },
          { label: "Top 15 by priority only", actionKey: "top_15", primary: true },
          { label: "Defer all to Q3", actionKey: "defer_all" },
        ],
        nextSteps: [
          { actionKey: "all_in", label: "Add all 34 tickets to Q2 milestone in Linear", automated: true },
          { actionKey: "all_in", label: "Notify Jordan Park and Mia Torres", automated: true },
          { actionKey: "top_15", label: "Add top 15 priority tickets to Q2 milestone", automated: true },
          { actionKey: "top_15", label: "Move remaining 19 to Q3 backlog", automated: true },
          { actionKey: "top_15", label: "Post summary in #product", automated: true },
          { actionKey: "defer_all", label: "Move all ds-v2 tickets to Q3 milestone", automated: true },
          { actionKey: "defer_all", label: "Notify stakeholders of deferral", automated: true },
        ],
        links: [
          { title: "ds-v2 Ticket Tracker", url: "https://docs.google.com/spreadsheets/d/1BXkQn9cZfake-ds-v2-tracker/edit", type: "sheet" as const },
          { title: "Design System v2 Vision (must watch)", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", type: "video" as const },
        ],
        createdAt: now - 2 * 60 * 60 * 1000,
      },
      // 3: Stripe blocked — Q2 important
      {
        userId: user._id,
        workspaceId,
        type: "blocked_unblock",
        title: "How do we unblock the Stripe payment launch?",
        summary: "Integration is code-complete. Legal has had the DPA for 6 days with no response. Launch is on the roadmap for next Monday. Options involve scope trade-offs.",
        eisenhowerQuadrant: "important",
        status: "pending",
        channelId: channelMap["ops"],
        orgTrace: [
          { name: "Chris Wang", role: "author", userId: userIdByName["Chris Wang"] },
          { name: "Dana Ross", role: "mentioned", userId: userIdByName["Dana Ross"] },
          { name: "Taylor Wong", role: "to_consult", userId: userIdByName["Taylor Wong"] },
        ],
        recommendedActions: [
          { label: "Escalate legal — SLA breach", actionKey: "escalate_legal", primary: true },
          { label: "Launch without saved cards", actionKey: "launch_scoped" },
          { label: "Delay launch 1 week", actionKey: "delay_launch", needsComment: true },
        ],
        nextSteps: [
          { actionKey: "escalate_legal", label: "Send escalation email to legal with SLA breach notice", automated: true },
          { actionKey: "escalate_legal", label: "Set reminder to follow up in 4 hours", automated: true },
          { actionKey: "launch_scoped", label: "Update launch scope in #ops", automated: true },
          { actionKey: "launch_scoped", label: "Notify Chris Wang to remove saved cards feature", automated: false },
          { actionKey: "delay_launch", label: "Update roadmap item to next Monday + 1 week", automated: true },
          { actionKey: "delay_launch", label: "Notify stakeholders of delay with reasoning", automated: true },
        ],
        links: [
          { title: "DPA Review Notes", url: "https://docs.google.com/document/d/1BXkQn9cZfake-dpa-review/edit", type: "doc" as const },
        ],
        createdAt: now - 4 * 60 * 60 * 1000,
      },
      // 4: API deprecation — Q3 urgent
      {
        userId: user._id,
        workspaceId,
        type: "cross_team_ack",
        title: "Should we hold the /v1/users deprecation for mobile?",
        summary: "Backend is dropping v1/users on Friday. Mobile needs 3 more weeks. Backend says the old endpoint is causing incidents in production. One team's timeline has to move.",
        eisenhowerQuadrant: "urgent",
        status: "pending",
        channelId: channelMap["engineering"],
        orgTrace: [
          { name: "Alex Chen", role: "author", userId: userIdByName["Alex Chen"] },
          { name: "Sarah Kim", role: "mentioned", userId: userIdByName["Sarah Kim"] },
          { name: "Jordan Park", role: "mentioned", userId: userIdByName["Jordan Park"] },
          { name: "Mobile Lead", role: "to_consult" },
        ],
        recommendedActions: [
          { label: "Keep Friday deadline", actionKey: "keep_deadline", needsComment: true },
          { label: "Extend 3 weeks for mobile", actionKey: "extend", primary: true },
          { label: "Immediate deprecation, add fallback stub", actionKey: "deprecate_now" },
        ],
        nextSteps: [
          { actionKey: "keep_deadline", label: "Confirm Friday deprecation in #engineering", automated: true },
          { actionKey: "keep_deadline", label: "Add fallback error response for v1 callers", automated: false },
          { actionKey: "extend", label: "Update deprecation date to 3 weeks out", automated: true },
          { actionKey: "extend", label: "Notify backend team of extension", automated: true },
          { actionKey: "extend", label: "Create migration guide task in Linear", automated: true },
          { actionKey: "deprecate_now", label: "Deploy v1 stub with 410 Gone response", automated: false },
          { actionKey: "deprecate_now", label: "Alert all teams of immediate change", automated: true },
        ],
        links: [
          { title: "API Deprecation Policy", url: "https://docs.google.com/document/d/1BXkQn9cZfake-deprecation-policy/edit", type: "doc" as const },
          { title: "v1 Migration Guide PR", url: "https://github.com/acme/api/pull/847", type: "pr" as const },
        ],
        createdAt: now - 45 * 60 * 1000,
      },
      // 5: Fact verify — Q4 fyi
      {
        userId: user._id,
        workspaceId,
        type: "fact_verify",
        title: "Which activation metric goes in the board deck?",
        summary: "The board deck says 68% activation but the dashboard shows 61%. One uses 'account created', the other 'first message sent'. The deck goes out Thursday.",
        eisenhowerQuadrant: "fyi",
        status: "pending",
        channelId: channelMap["data"],
        orgTrace: [
          { name: "Dana Ross", role: "author", userId: userIdByName["Dana Ross"] },
          { name: "Priya Patel", role: "mentioned", userId: userIdByName["Priya Patel"] },
          { name: "Board Deck Author", role: "to_consult" },
        ],
        recommendedActions: [
          { label: "Use account created — 68%", actionKey: "use_68" },
          { label: "Use first message — 61%", actionKey: "use_61", primary: true },
          { label: "Define a new standard metric", actionKey: "define_new", needsComment: true },
        ],
        nextSteps: [
          { actionKey: "use_68", label: "Update board deck metric to 68% (account created)", automated: false },
          { actionKey: "use_68", label: "Add footnote explaining definition", automated: false },
          { actionKey: "use_61", label: "Update board deck metric to 61% (first message sent)", automated: false },
          { actionKey: "use_61", label: "Add footnote explaining definition", automated: false },
          { actionKey: "define_new", label: "Create Linear ticket: define activation standard", automated: true },
          { actionKey: "define_new", label: "Notify data team to align on definition", automated: true },
        ],
        links: [
          { title: "Activation Metrics Analysis", url: "https://docs.google.com/spreadsheets/d/1BXkQn9cZfake-metrics/edit", type: "sheet" as const },
        ],
        createdAt: now - 6 * 60 * 60 * 1000,
      },
      // 6: Channel summary — Q4 fyi
      {
        userId: user._id,
        workspaceId,
        type: "channel_summary",
        title: "How do we handle the low office move survey response?",
        summary: "12 of 40 responses collected. Deadline is tomorrow. Also: all-hands slide deck needs exec review by EOD Thursday. Two things to address.",
        eisenhowerQuadrant: "fyi",
        status: "pending",
        channelId: channelMap["general"],
        orgTrace: [
          { name: "Marcus Lee", role: "author", userId: userIdByName["Marcus Lee"] },
          { name: "Mia Torres", role: "author", userId: userIdByName["Mia Torres"] },
          { name: "Office Manager", role: "to_consult" },
        ],
        recommendedActions: [
          { label: "Send reminder to team now", actionKey: "send_reminder", primary: true },
          { label: "Extend deadline 48 hours", actionKey: "extend_deadline" },
          { label: "Close survey with current data", actionKey: "close_survey" },
        ],
        nextSteps: [
          { actionKey: "send_reminder", label: "Post reminder message in #general", automated: true },
          { actionKey: "send_reminder", label: "Send DM to non-responders", automated: true },
          { actionKey: "extend_deadline", label: "Update survey deadline to +48 hours", automated: true },
          { actionKey: "extend_deadline", label: "Post updated deadline in #general", automated: true },
          { actionKey: "close_survey", label: "Mark survey as closed with current 12 responses", automated: true },
          { actionKey: "close_survey", label: "Generate response summary report", automated: true },
        ],
        links: [
          { title: "All-Hands Slide Deck Draft", url: "https://docs.google.com/presentation/d/1BXkQn9cZfake-allhands/edit", type: "doc" as const },
        ],
        createdAt: now - 8 * 60 * 60 * 1000,
      },
    ];

    // ── Step D: Insert decisions and cross-reference ────────────────────────────

    const decisionIds: import("./_generated/dataModel").Id<"decisions">[] = [];
    for (const d of mockDecisions) {
      const id = await ctx.db.insert("decisions", d);
      decisionIds.push(id);
    }

    // Cross-reference related decisions:
    // PR review (0) ↔ API deprecation (4) — both #engineering
    // Rate limit (1) ↔ Ticket triage (2) — both customer/priority
    // Stripe (3) ↔ Office survey (6) — both operational blocks
    await ctx.db.patch(decisionIds[0]!, { relatedDecisionIds: [decisionIds[4]!] });
    await ctx.db.patch(decisionIds[4]!, { relatedDecisionIds: [decisionIds[0]!] });
    await ctx.db.patch(decisionIds[1]!, { relatedDecisionIds: [decisionIds[2]!] });
    await ctx.db.patch(decisionIds[2]!, { relatedDecisionIds: [decisionIds[1]!] });
    await ctx.db.patch(decisionIds[3]!, { relatedDecisionIds: [decisionIds[6]!] });
    await ctx.db.patch(decisionIds[6]!, { relatedDecisionIds: [decisionIds[3]!] });

    return { inserted: decisionIds.length };
  },
});

export const clearSeedDecisions = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const pending = await ctx.db
      .query("decisions")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", "pending"))
      .collect();

    const snoozed = await ctx.db
      .query("decisions")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", "snoozed"))
      .collect();

    let deleted = 0;
    for (const d of [...pending, ...snoozed]) {
      await ctx.db.delete(d._id);
      deleted++;
    }

    return { deleted };
  },
});
