/**
 * GitHub history ingestion: transforms commits, PRs, issues, and review
 * comments into Graphiti episodes for the knowledge graph.
 */

import { startBulkIngest } from "./bulk-ingest.js";
import { registerEntity } from "./entity-mapping.js";
import type {
  BulkIngestItem,
  GitHubCommit,
  GitHubHistoryRequest,
  GitHubIssue,
  GitHubPR,
  GitHubReviewComment,
} from "./types.js";

/**
 * Ingest GitHub history into the knowledge graph.
 * Returns a bulk job ID for progress tracking.
 */
export function ingestGitHubHistory(request: GitHubHistoryRequest): string {
  const items: BulkIngestItem[] = [];
  const groupId = request.group_id ?? "github";

  if (request.commits) {
    for (const commit of request.commits) {
      items.push(commitToItem(commit));
      registerGitHubPerson(commit.author_name, commit.author_email);
    }
  }

  if (request.pull_requests) {
    for (const pr of request.pull_requests) {
      items.push(prToItem(pr));
      registerGitHubPerson(pr.author, pr.author_email);
    }
  }

  if (request.issues) {
    for (const issue of request.issues) {
      items.push(issueToItem(issue));
      registerGitHubPerson(issue.author, issue.author_email);
    }
  }

  if (request.review_comments) {
    for (const comment of request.review_comments) {
      items.push(reviewCommentToItem(comment));
      registerGitHubPerson(comment.author, comment.author_email);
    }
  }

  items.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return startBulkIngest({ items, group_id: groupId });
}

function commitToItem(commit: GitHubCommit): BulkIngestItem {
  return {
    content: `Git commit ${commit.sha.slice(0, 8)}: ${commit.message}`,
    role_type: "user",
    role: commit.author_name,
    timestamp: commit.timestamp,
    source_description: `github:commit:${commit.repo}`,
    uuid: `github-commit-${commit.sha}`,
    name: `${commit.author_name} committed to ${commit.repo}`,
  };
}

function prToItem(pr: GitHubPR): BulkIngestItem {
  const labels = pr.labels?.length ? ` [${pr.labels.join(", ")}]` : "";
  const status = pr.merged_at
    ? "merged"
    : pr.closed_at
      ? "closed"
      : pr.state;
  const body = pr.body ? `\n\n${pr.body.slice(0, 500)}` : "";

  return {
    content: `PR #${pr.number}: ${pr.title} (${status})${labels}${body}`,
    role_type: "user",
    role: pr.author,
    timestamp: pr.created_at,
    source_description: `github:pr:${pr.repo}`,
    uuid: `github-pr-${pr.repo}-${pr.number}`,
    name: `${pr.author} opened PR #${pr.number} in ${pr.repo}`,
  };
}

function issueToItem(issue: GitHubIssue): BulkIngestItem {
  const labels = issue.labels?.length ? ` [${issue.labels.join(", ")}]` : "";
  const body = issue.body ? `\n\n${issue.body.slice(0, 500)}` : "";

  return {
    content: `Issue #${issue.number}: ${issue.title} (${issue.state})${labels}${body}`,
    role_type: "user",
    role: issue.author,
    timestamp: issue.created_at,
    source_description: `github:issue:${issue.repo}`,
    uuid: `github-issue-${issue.repo}-${issue.number}`,
    name: `${issue.author} opened issue #${issue.number} in ${issue.repo}`,
  };
}

function reviewCommentToItem(comment: GitHubReviewComment): BulkIngestItem {
  const fileRef = comment.path ? ` on ${comment.path}` : "";

  return {
    content: `Review comment on PR #${comment.pr_number}${fileRef}: ${comment.body}`,
    role_type: "user",
    role: comment.author,
    timestamp: comment.created_at,
    source_description: `github:review:${comment.repo}`,
    uuid: `github-review-${comment.id}`,
    name: `${comment.author} reviewed PR #${comment.pr_number} in ${comment.repo}`,
  };
}

function registerGitHubPerson(name: string, email?: string): void {
  registerEntity({
    name,
    emails: email ? [email] : [],
    source: "github",
  });
}
