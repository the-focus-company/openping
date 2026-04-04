"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Check, Send } from "lucide-react";

interface InviteRow {
  email: string;
  role: "member" | "admin" | "guest";
  sent: boolean;
  error?: string;
}

function createEmptyRow(): InviteRow {
  return { email: "", role: "member", sent: false };
}

interface InviteTeamStepProps {
  workspaceId: Id<"workspaces">;
  onNext: () => void;
}

export function InviteTeamStep({ workspaceId, onNext }: InviteTeamStepProps) {
  const [rows, setRows] = useState<InviteRow[]>([createEmptyRow()]);
  const [sending, setSending] = useState(false);

  const sendInvitation = useMutation(api.invitations.send);

  const allSent = rows.length > 0 && rows.every((r) => r.sent);
  const hasUnsent = rows.some((r) => r.email.trim() && !r.sent);

  function updateRow(index: number, updates: Partial<InviteRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...updates } : row))
    );
  }

  function removeRow(index: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [createEmptyRow()] : next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  async function handleSendInvites() {
    setSending(true);
    const updated = [...rows];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (!row.email.trim() || row.sent) continue;

      try {
        await sendInvitation({ workspaceId, email: row.email.trim(), role: row.role });
        updated[i] = { ...row, sent: true, error: undefined };
      } catch (err) {
        updated[i] = {
          ...row,
          sent: false,
          error: err instanceof Error ? err.message : "Failed to send",
        };
      }
    }

    setRows(updated);
    setSending(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Invite your team
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Add teammates by email. You can always invite more later.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={row.email}
                onChange={(e) => updateRow(index, { email: e.target.value })}
                placeholder="teammate@company.com"
                className="flex-1 border-subtle bg-surface-2"
                disabled={row.sent}
              />
              <select
                value={row.role}
                onChange={(e) =>
                  updateRow(index, {
                    role: e.target.value as "member" | "admin" | "guest",
                  })
                }
                disabled={row.sent}
                className="h-9 rounded-md border border-subtle bg-surface-2 px-2 text-xs text-foreground"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="guest">Guest</option>
              </select>
              {row.sent ? (
                <div className="flex h-9 w-9 items-center justify-center">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {row.error && (
              <p className="text-xs text-red-400">{row.error}</p>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another
        </button>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={onNext}
          disabled={sending}
        >
          Skip
        </Button>
        {allSent ? (
          <Button
            size="sm"
            className="bg-ping-purple px-6 text-xs text-white hover:bg-ping-purple/90"
            onClick={onNext}
          >
            Finish setup
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-ping-purple px-6 text-xs text-white hover:bg-ping-purple/90"
            onClick={handleSendInvites}
            disabled={sending || !hasUnsent}
          >
            {sending ? (
              "Sending\u2026"
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send invites
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
