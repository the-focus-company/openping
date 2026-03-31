import { useState } from "react";
import { Pressable, StyleSheet, Text, View, Modal, ScrollView, Image, Linking, ActivityIndicator } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CategoryBadge } from "./CategoryBadge";
import {
  X, Clock, Hash, Zap, Bot, Link2, Users, ExternalLink,
  GitPullRequest, MessageSquare, AlertTriangle, CheckCircle, Loader, XCircle,
  ChevronDown, ChevronRight, UserCheck, UserPlus, History, FileText,
} from "lucide-react-native";

type Action = { label: string; actionKey: string; primary?: boolean; needsComment?: boolean };
type OrgTrace = { userId?: string; name: string; role: string; avatarUrl?: string };
type NextStep = { actionKey: string; label: string; automated: boolean };
type LinkItem = { title: string; url: string; type?: string };

type Item = {
  _id: string;
  type: string;
  category: "do" | "decide" | "delegate" | "skip";
  title: string;
  summary: string;
  context?: string | null;
  pingWillDo?: string | null;
  status: "pending" | "snoozed" | "archived";
  channelName?: string | null;
  orgTrace?: OrgTrace[] | null;
  recommendedActions?: Action[] | null;
  nextSteps?: NextStep[] | null;
  links?: LinkItem[] | null;
  agentExecutionStatus?: string | null;
  agentExecutionResult?: string | null;
  createdAt: number;
  _creationTime: number;
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const categoryLabels: Record<string, string> = {
  do: "Do — Urgent & Important",
  decide: "Decide — Important, Not Urgent",
  delegate: "Delegate — Urgent, Not Important",
  skip: "Skip — Neither Urgent Nor Important",
};

const typeLabels: Record<string, string> = {
  pr_review: "PR Review",
  ticket_triage: "Ticket Triage",
  question_answer: "Question",
  blocked_unblock: "Blocked Task",
  fact_verify: "Fact Check",
  cross_team_ack: "Cross-Team Sync",
  channel_summary: "Channel Summary",
  email_summary: "Email Summary",
  // Legacy types
  unanswered_question: "Unanswered Question",
  pr_review_nudge: "PR Review Nudge",
  incident_route: "Incident Route",
  blocked_task: "Blocked Task",
  fact_check: "Fact Check",
  cross_team_sync: "Cross-Team Sync",
  decision_needed: "Decision Needed",
};

function TypeIcon({ type }: { type: string }) {
  const props = { size: 14, color: "#888" };
  switch (type) {
    case "pr_review":
    case "pr_review_nudge":
      return <GitPullRequest {...props} />;
    case "question_answer":
    case "unanswered_question":
      return <MessageSquare {...props} />;
    case "blocked_unblock":
    case "blocked_task":
    case "incident_route":
      return <AlertTriangle {...props} />;
    default:
      return <Zap {...props} />;
  }
}

function AgentStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pending: { icon: <Clock size={12} color="#f59e0b" />, label: "Pending", color: "#f59e0b" },
    running: { icon: <Loader size={12} color="#0a7ea4" />, label: "Running", color: "#0a7ea4" },
    completed: { icon: <CheckCircle size={12} color="#22c55e" />, label: "Completed", color: "#22c55e" },
    failed: { icon: <XCircle size={12} color="#ef4444" />, label: "Failed", color: "#ef4444" },
  };
  const config = configs[status] ?? configs.pending;
  return (
    <View style={[detailStyles.agentBadge, { borderColor: config.color }]}>
      {config.icon}
      <Text style={[detailStyles.agentBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const ROLE_LABELS: Record<string, string> = {
  author: "wrote", assignee: "assigned", mentioned: "mentioned", to_consult: "consult?",
};

function TaskDetailModal({
  item,
  visible,
  onClose,
  onAct,
  onArchive,
}: {
  item: Item;
  visible: boolean;
  onClose: () => void;
  onAct: (itemId: string, actionKey: string) => void;
  onArchive: (itemId: string) => void;
}) {
  const actions = item.recommendedActions ?? [];
  const orgTrace = item.orgTrace ?? [];
  const nextSteps = item.nextSteps ?? [];
  const links = item.links ?? [];

  const [contextOpen, setContextOpen] = useState(false);
  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);

  // Fetch full context from backend (messages, linked artifacts, related history)
  const context = useQuery(
    api.inboxItems.getContext,
    visible ? { itemId: item._id as Id<"inboxItems"> } : "skip",
  );

  // Group next steps per action (like web)
  const nextStepsByAction = actions.reduce<Record<string, typeof nextSteps>>((acc, a) => {
    acc[a.actionKey] = nextSteps.filter((s) => s.actionKey === a.actionKey);
    return acc;
  }, {});

  const involved = orgTrace.filter((p) => p.role !== "to_consult");
  const toConsult = orgTrace.filter((p) => p.role === "to_consult");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={detailStyles.backdrop}>
        <View style={detailStyles.sheet}>
          {/* Header */}
          <View style={detailStyles.header}>
            <View style={detailStyles.headerLeft}>
              <TypeIcon type={item.type} />
              <Text style={detailStyles.metaText}>{typeLabels[item.type] ?? item.type}</Text>
              {item.channelName && (
                <>
                  <Text style={detailStyles.metaDot}>·</Text>
                  <Text style={detailStyles.metaText}>#{item.channelName}</Text>
                </>
              )}
              <Text style={detailStyles.metaDot}>·</Text>
              <Text style={detailStyles.metaText}>{relativeTime(item.createdAt)}</Text>
            </View>
            <View style={detailStyles.headerRight}>
              <CategoryBadge category={item.category} />
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={20} color="#888" />
              </Pressable>
            </View>
          </View>

          <ScrollView style={detailStyles.body} showsVerticalScrollIndicator={false}>
            {/* 1. Summary — always visible */}
            <Text style={detailStyles.title}>{item.title}</Text>
            <Text style={detailStyles.summary}>{item.summary}</Text>

            {/* Agent status */}
            {item.agentExecutionStatus && (
              <View style={[detailStyles.metaRow, { marginTop: 8 }]}>
                <Bot size={14} color="#888" />
                <AgentStatusBadge status={item.agentExecutionStatus} />
              </View>
            )}

            {/* 2. Context — accordion */}
            <Pressable style={detailStyles.accordion} onPress={() => setContextOpen(!contextOpen)}>
              {contextOpen ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
              <Text style={detailStyles.accordionLabel}>Context</Text>
              {context && (context.relatedMessages.length + (context.sourceIntegrationObject ? 1 : 0) + (context.relatedItems?.length ?? 0)) > 0 && (
                <View style={detailStyles.accordionBadge}>
                  <Text style={detailStyles.accordionBadgeText}>
                    {context.relatedMessages.length + (context.sourceIntegrationObject ? 1 : 0) + (context.relatedItems?.length ?? 0)}
                  </Text>
                </View>
              )}
            </Pressable>
            {contextOpen && (
              <View style={detailStyles.accordionContent}>
                {context === undefined ? (
                  <ActivityIndicator color="#0a7ea4" style={{ paddingVertical: 16 }} />
                ) : (
                  <>
                    {/* Item context text */}
                    {item.context ? (
                      <Text style={detailStyles.contextText}>{item.context}</Text>
                    ) : null}

                    {/* Related messages */}
                    {context.relatedMessages.length > 0 && (
                      <>
                        <View style={detailStyles.contextSubheader}>
                          <MessageSquare size={12} color="#666" />
                          <Text style={detailStyles.contextSubLabel}>Messages ({context.relatedMessages.length})</Text>
                        </View>
                        {context.relatedMessages.slice(0, 8).map((msg: any, i: number) => (
                          <View key={i} style={detailStyles.contextMsg}>
                            <View style={detailStyles.contextMsgHeader}>
                              <Text style={detailStyles.contextMsgAuthor}>{msg.authorName}</Text>
                              <Text style={detailStyles.contextMsgTime}>{relativeTime(msg.createdAt ?? msg._creationTime)}</Text>
                            </View>
                            <Text style={detailStyles.contextMsgBody} numberOfLines={3}>{msg.body}</Text>
                          </View>
                        ))}
                      </>
                    )}

                    {/* Source integration object */}
                    {context.sourceIntegrationObject && (
                      <>
                        <View style={detailStyles.contextSubheader}>
                          <Link2 size={12} color="#666" />
                          <Text style={detailStyles.contextSubLabel}>Linked</Text>
                        </View>
                        <Pressable
                          style={detailStyles.linkedItem}
                          onPress={() => Linking.openURL(context.sourceIntegrationObject!.url)}
                        >
                          <Text style={detailStyles.linkedTitle} numberOfLines={1}>{context.sourceIntegrationObject.title}</Text>
                          <Text style={detailStyles.linkedType}>{context.sourceIntegrationObject.type.replace("_", " ")}</Text>
                        </Pressable>
                      </>
                    )}

                    {/* Related past decisions */}
                    {(context.relatedItems?.length ?? 0) > 0 && (
                      <>
                        <View style={detailStyles.contextSubheader}>
                          <History size={12} color="#666" />
                          <Text style={detailStyles.contextSubLabel}>Related ({context.relatedItems!.length})</Text>
                        </View>
                        {context.relatedItems!.map((d: any, i: number) => (
                          <View key={i} style={detailStyles.contextMsg}>
                            <Text style={detailStyles.contextMsgAuthor}>{d.title}</Text>
                            {d.outcome && <Text style={detailStyles.contextMsgTime}>→ {d.outcome.action}</Text>}
                          </View>
                        ))}
                      </>
                    )}

                    {context.relatedMessages.length === 0 && !context.sourceIntegrationObject && !item.context && (
                      <Text style={detailStyles.emptyAccordion}>No additional context</Text>
                    )}
                  </>
                )}
              </View>
            )}

            {/* 3. What PING will do — next steps grouped per action */}
            {nextSteps.length > 0 && (
              <>
                <Pressable style={detailStyles.accordion} onPress={() => setNextStepsOpen(!nextStepsOpen)}>
                  {nextStepsOpen ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
                  <Text style={detailStyles.accordionLabel}>What PING will do</Text>
                </Pressable>
                {nextStepsOpen && (
                  <View style={detailStyles.accordionContent}>
                    {actions.map((action) => {
                      const steps = nextStepsByAction[action.actionKey] ?? [];
                      if (steps.length === 0) return null;
                      return (
                        <View key={action.actionKey} style={detailStyles.nextStepGroup}>
                          <Text style={detailStyles.nextStepGroupLabel}>If: {action.label}</Text>
                          {steps.map((step, i) => (
                            <View key={i} style={detailStyles.nextStepRow}>
                              <Text style={step.automated ? detailStyles.automatedBadge : detailStyles.manualBadge}>
                                {step.automated ? "auto" : "manual"}
                              </Text>
                              <Text style={detailStyles.nextStepText}>{step.label}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                    {/* PING will do note */}
                    {item.pingWillDo && (
                      <View style={detailStyles.pingWillDoBox}>
                        <View style={detailStyles.pingWillDoHeader}>
                          <Bot size={14} color="#0a7ea4" />
                          <Text style={detailStyles.pingWillDoTitle}>PING will also</Text>
                        </View>
                        <Text style={detailStyles.pingWillDoText}>{item.pingWillDo}</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {/* 4. People — accordion */}
            {orgTrace.length > 0 && (
              <>
                <Pressable style={detailStyles.accordion} onPress={() => setPeopleOpen(!peopleOpen)}>
                  {peopleOpen ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
                  <Text style={detailStyles.accordionLabel}>People</Text>
                  <View style={detailStyles.accordionBadge}>
                    <Text style={detailStyles.accordionBadgeText}>{orgTrace.length}</Text>
                  </View>
                </Pressable>
                {peopleOpen && (
                  <View style={detailStyles.accordionContent}>
                    {involved.length > 0 && (
                      <>
                        <View style={detailStyles.contextSubheader}>
                          <UserCheck size={12} color="#666" />
                          <Text style={detailStyles.contextSubLabel}>In this decision</Text>
                        </View>
                        {involved.map((person, i) => (
                          <View key={i} style={detailStyles.personRow}>
                            {person.avatarUrl ? (
                              <Image source={{ uri: person.avatarUrl }} style={detailStyles.personAvatar} />
                            ) : (
                              <View style={detailStyles.personAvatarFallback}>
                                <Text style={detailStyles.personInitial}>{person.name.charAt(0).toUpperCase()}</Text>
                              </View>
                            )}
                            <Text style={detailStyles.personName}>{person.name}</Text>
                            <Text style={detailStyles.personRole}>{ROLE_LABELS[person.role] ?? person.role}</Text>
                          </View>
                        ))}
                      </>
                    )}
                    {toConsult.length > 0 && (
                      <>
                        <View style={[detailStyles.contextSubheader, { marginTop: 10 }]}>
                          <UserPlus size={12} color="#666" />
                          <Text style={detailStyles.contextSubLabel}>To consult</Text>
                        </View>
                        {toConsult.map((person, i) => (
                          <View key={i} style={detailStyles.personRow}>
                            <View style={detailStyles.personAvatarFallback}>
                              <Text style={detailStyles.personInitial}>{person.name.charAt(0).toUpperCase()}</Text>
                            </View>
                            <Text style={detailStyles.personName}>{person.name}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </>
            )}

            {/* 5. Links */}
            {links.length > 0 && (
              <>
                <Text style={[detailStyles.sectionLabel, { paddingHorizontal: 0, marginTop: 16 }]}>Links</Text>
                {links.map((link, i) => (
                  <Pressable key={i} style={detailStyles.linkRow} onPress={() => Linking.openURL(link.url)}>
                    <Link2 size={14} color="#0a7ea4" />
                    <Text style={detailStyles.linkText} numberOfLines={1}>{link.title}</Text>
                    <ExternalLink size={12} color="#666" />
                  </Pressable>
                ))}
              </>
            )}

            {/* 6. Actions */}
            {actions.length > 0 && (
              <View style={detailStyles.actionsSection}>
                {actions.map((action) => (
                  <Pressable
                    key={action.actionKey}
                    style={[detailStyles.actionBtn, action.primary ? detailStyles.primaryBtn : detailStyles.secondaryBtn]}
                    onPress={() => { onAct(item._id, action.actionKey); onClose(); }}
                  >
                    <Text style={action.primary ? detailStyles.primaryText : detailStyles.secondaryText}>
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Agent result */}
            {item.agentExecutionResult && (
              <View style={[detailStyles.contextText, { marginTop: 8 }]}>
                <Text style={{ color: "#bbb", fontSize: 14 }}>{item.agentExecutionResult}</Text>
              </View>
            )}

            {/* Danger Zone */}
            <View style={detailStyles.dangerZone}>
              <Text style={detailStyles.dangerLabel}>Danger Zone</Text>
              <Pressable
                style={detailStyles.dangerBtn}
                onPress={() => { onArchive(item._id); onClose(); }}
              >
                <Text style={detailStyles.dangerBtnText}>Archive this item</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  metaDot: { color: "rgba(255,255,255,0.25)", fontSize: 12 },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  metaText: { color: "#888", fontSize: 12 },
  sectionLabel: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  summary: { color: "#ccc", fontSize: 14, lineHeight: 21, marginBottom: 12 },

  // Accordion
  accordion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#333",
  },
  accordionLabel: { color: "#888", fontSize: 13, fontWeight: "500" },
  accordionBadge: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  accordionBadgeText: { color: "#888", fontSize: 11 },
  accordionContent: { paddingBottom: 12 },
  emptyAccordion: { color: "#555", fontSize: 13, textAlign: "center", paddingVertical: 12 },

  // Context
  contextText: { color: "#bbb", fontSize: 13, lineHeight: 19, marginBottom: 10, backgroundColor: "#222", borderRadius: 8, padding: 10 },
  contextSubheader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, marginTop: 8 },
  contextSubLabel: { color: "#666", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  contextMsg: { backgroundColor: "#222", borderRadius: 8, padding: 10, marginBottom: 6 },
  contextMsgHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  contextMsgAuthor: { color: "#ccc", fontSize: 12, fontWeight: "600" },
  contextMsgTime: { color: "#666", fontSize: 11 },
  contextMsgBody: { color: "#999", fontSize: 12, lineHeight: 17 },
  linkedItem: { backgroundColor: "#222", borderRadius: 8, padding: 10, marginBottom: 6 },
  linkedTitle: { color: "#ccc", fontSize: 13, fontWeight: "500" },
  linkedType: { color: "#666", fontSize: 11, textTransform: "capitalize", marginTop: 2 },
  pingWillDoBox: {
    backgroundColor: "rgba(10,126,164,0.1)",
    borderLeftWidth: 3,
    borderLeftColor: "#0a7ea4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  pingWillDoHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  pingWillDoTitle: { color: "#0a7ea4", fontSize: 13, fontWeight: "600" },
  pingWillDoText: { color: "#ccc", fontSize: 14, lineHeight: 20 },
  agentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  agentBadgeText: { fontSize: 12, fontWeight: "500" },
  peopleList: { marginBottom: 16, gap: 8 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  personAvatar: { width: 28, height: 28, borderRadius: 14 },
  personAvatarFallback: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: "#333",
    justifyContent: "center", alignItems: "center",
  },
  personInitial: { color: "#fff", fontSize: 12, fontWeight: "600" },
  personName: { color: "#ccc", fontSize: 14, fontWeight: "500" },
  personRole: { color: "#666", fontSize: 12 },
  nextStepGroup: { marginBottom: 12, backgroundColor: "#222", borderRadius: 8, padding: 10 },
  nextStepGroupLabel: { color: "#888", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  nextStepRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  nextStepText: { color: "#ccc", fontSize: 14, flex: 1 },
  automatedBadge: {
    color: "#0a7ea4",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    backgroundColor: "rgba(10,126,164,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  manualBadge: {
    color: "#888",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingVertical: 4 },
  linkText: { color: "#0a7ea4", fontSize: 14, flex: 1 },
  actionsSection: { marginBottom: 16 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, marginBottom: 8 },
  primaryBtn: { backgroundColor: "#0a7ea4" },
  secondaryBtn: { backgroundColor: "#333" },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "600", textAlign: "center" },
  secondaryText: { color: "#ccc", fontSize: 15, textAlign: "center" },
  dangerZone: {
    marginTop: 24,
    marginBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(239,68,68,0.3)",
    paddingTop: 16,
  },
  dangerLabel: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  dangerBtn: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerBtnText: { color: "#ef4444", fontSize: 15, fontWeight: "500" },
});

export function DecisionCard({
  item,
  onAct,
  onArchive,
}: {
  item: Item;
  onAct: (itemId: string, actionKey: string) => void;
  onArchive: (itemId: string) => void;
}) {
  const [detailVisible, setDetailVisible] = useState(false);
  const actions = item.recommendedActions ?? [];
  const orgTrace = item.orgTrace ?? [];

  return (
    <>
      <Pressable onPress={() => setDetailVisible(true)}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <CategoryBadge category={item.category} />
            <TypeIcon type={item.type} />
            {item.channelName ? (
              <Text style={styles.channel}>#{item.channelName}</Text>
            ) : null}
            <View style={{ flex: 1 }} />
            <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
          </View>

          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.summary} numberOfLines={3}>
            {item.summary}
          </Text>

          {/* PING will do preview */}
          {item.pingWillDo ? (
            <View style={styles.pingPreview}>
              <Bot size={12} color="#0a7ea4" />
              <Text style={styles.pingPreviewText} numberOfLines={1}>{item.pingWillDo}</Text>
            </View>
          ) : null}

          {/* People facepile */}
          {orgTrace.length > 0 && (
            <View style={styles.facepile}>
              {orgTrace.slice(0, 4).map((person, i) => (
                person.avatarUrl ? (
                  <Image key={i} source={{ uri: person.avatarUrl }} style={[styles.facepileAvatar, i > 0 && { marginLeft: -6 }]} />
                ) : (
                  <View key={i} style={[styles.facepileFallback, i > 0 && { marginLeft: -6 }]}>
                    <Text style={styles.facepileInitial}>{person.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )
              ))}
              {orgTrace.length > 4 && (
                <Text style={styles.facepileMore}>+{orgTrace.length - 4}</Text>
              )}
            </View>
          )}

          {actions.length > 0 && (
            <View style={styles.actionsRow}>
              {actions.map((action) => (
                <Pressable
                  key={action.actionKey}
                  style={[
                    styles.actionBtn,
                    action.primary ? styles.primaryBtn : styles.secondaryBtn,
                  ]}
                  onPress={() => onAct(item._id, action.actionKey)}
                >
                  <Text
                    style={action.primary ? styles.primaryText : styles.secondaryText}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            style={styles.archiveBtn}
            onPress={() => onArchive(item._id)}
            hitSlop={8}
          >
            <Text style={styles.archiveText}>Archive</Text>
          </Pressable>
        </View>
      </Pressable>

      <TaskDetailModal
        item={item}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onAct={onAct}
        onArchive={onArchive}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  channel: {
    color: "#888",
    fontSize: 13,
  },
  time: {
    color: "#888",
    fontSize: 12,
  },
  title: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 17,
    marginTop: 8,
  },
  summary: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 4,
  },
  pingPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(10,126,164,0.08)",
    borderRadius: 6,
  },
  pingPreviewText: {
    color: "#0a7ea4",
    fontSize: 12,
    flex: 1,
  },
  facepile: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  facepileAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#111",
  },
  facepileFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#111",
  },
  facepileInitial: { color: "#fff", fontSize: 10, fontWeight: "600" },
  facepileMore: { color: "#888", fontSize: 11, marginLeft: 4 },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtn: {
    backgroundColor: "#0a7ea4",
  },
  secondaryBtn: {
    backgroundColor: "#222",
  },
  primaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryText: {
    color: "#ccc",
    fontSize: 14,
  },
  archiveBtn: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  archiveText: {
    color: "#888",
    fontSize: 12,
  },
});
