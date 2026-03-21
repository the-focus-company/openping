/**
 * Linear history ingestion: transforms issues, comments, labels,
 * and cycles into Graphiti episodes for the knowledge graph.
 */

import { startBulkIngest } from "./bulk-ingest.js";
import { registerEntity } from "./entity-mapping.js";
import type {
  BulkIngestItem,
  LinearComment,
  LinearHistoryRequest,
  LinearIssue,
} from "./types.js";

/**
 * Ingest Linear history into the knowledge graph.
 * Returns a bulk job ID for progress tracking.
 */
export function ingestLinearHistory(request: LinearHistoryRequest): string {
  const items: BulkIngestItem[] = [];
  const groupId = request.group_id ?? "linear";

  if (request.issues) {
    for (const issue of request.issues) {
      items.push(issueToItem(issue));
      registerLinearPerson(issue.assignee_name, issue.assignee_email);
      registerLinearPerson(issue.creator_name, issue.creator_email);
    }
  }

  if (request.comments) {
    for (const comment of request.comments) {
      items.push(commentToItem(comment));
      registerLinearPerson(comment.author_name, comment.author_email);
    }
  }

  items.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return startBulkIngest({ items, group_id: groupId });
}

function issueToItem(issue: LinearIssue): BulkIngestItem {
  const labels = issue.labels?.length ? ` [${issue.labels.join(", ")}]` : "";
  const cycle = issue.cycle ? ` (Cycle: ${issue.cycle})` : "";
  const assignee = issue.assignee_name
    ? ` assigned to ${issue.assignee_name}`
    : "";
  const description = issue.description
    ? `\n\n${issue.description.slice(0, 500)}`
    : "";
  const priorityLabel = formatPriority(issue.priority);

  return {
    content:
      `${issue.identifier}: ${issue.title} (${issue.state}, ${priorityLabel})${assignee}${labels}${cycle}${description}`,
    role_type: "user",
    role: issue.creator_name ?? "Unknown",
    timestamp: issue.created_at,
    source_description: `linear:issue:${issue.team}`,
    uuid: `linear-issue-${issue.id}`,
    name: `${issue.creator_name ?? "Someone"} created ${issue.identifier} in ${issue.team}`,
  };
}

function commentToItem(comment: LinearComment): BulkIngestItem {
  return {
    content: `Comment on ${comment.issue_identifier}: ${comment.body}`,
    role_type: "user",
    role: comment.author_name,
    timestamp: comment.created_at,
    source_description: `linear:comment:${comment.issue_identifier}`,
    uuid: `linear-comment-${comment.id}`,
    name: `${comment.author_name} commented on ${comment.issue_identifier}`,
  };
}

function formatPriority(priority: number): string {
  switch (priority) {
    case 0:
      return "No priority";
    case 1:
      return "Urgent";
    case 2:
      return "High";
    case 3:
      return "Medium";
    case 4:
      return "Low";
    default:
      return `Priority ${priority}`;
  }
}

function registerLinearPerson(name?: string, email?: string): void {
  if (!name) return;
  registerEntity({
    name,
    emails: email ? [email] : [],
    source: "linear",
  });
}
