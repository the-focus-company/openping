"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  VolumeX,
  User,
  Trash2,
  Plus,
  MailX,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SenderRulesPanelProps {
  workspaceId: Id<"workspaces">;
  className?: string;
}

type CategoryFilter = "all" | "vip" | "normal" | "muted";

export function SenderRulesPanel({
  workspaceId,
  className,
}: SenderRulesPanelProps) {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [newSender, setNewSender] = useState("");
  const [newCategory, setNewCategory] = useState<"vip" | "normal" | "muted">(
    "vip",
  );
  const [showAddForm, setShowAddForm] = useState(false);

  const rules = useQuery(api.emailSenderRules.listRules, {
    category: filter === "all" ? undefined : filter,
  });
  const unsubscribeSuggestions = useQuery(
    api.emailSenderRules.listUnsubscribeSuggestions,
  );
  const upsertRule = useMutation(api.emailSenderRules.upsertRule);
  const deleteRule = useMutation(api.emailSenderRules.deleteRule);
  const markUnsubscribe = useMutation(
    api.emailSenderRules.markSuggestUnsubscribe,
  );

  const handleAddRule = async () => {
    if (!newSender.trim() || !newSender.includes("@")) return;
    await upsertRule({
      workspaceId,
      senderAddress: newSender.trim(),
      category: newCategory,
    });
    setNewSender("");
    setShowAddForm(false);
  };

  const handleCategoryChange = async (
    ruleId: Id<"emailSenderRules">,
    senderAddress: string,
    category: "vip" | "normal" | "muted",
  ) => {
    await upsertRule({
      workspaceId,
      senderAddress,
      category,
    });
  };

  const handleDelete = async (ruleId: Id<"emailSenderRules">) => {
    await deleteRule({ ruleId });
  };

  const handleDismissUnsubscribe = async (senderAddress: string) => {
    await markUnsubscribe({
      workspaceId,
      senderAddress,
      suggest: false,
    });
  };

  const categoryConfig = {
    vip: {
      icon: Star,
      label: "VIP",
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
    normal: {
      icon: User,
      label: "Normal",
      color: "text-muted-foreground",
      bg: "bg-surface-2",
    },
    muted: {
      icon: VolumeX,
      label: "Muted",
      color: "text-red-400",
      bg: "bg-red-400/10",
    },
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Sender Rules</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Rule
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="flex items-center gap-2 rounded-md border border-subtle bg-surface-1 p-3">
          <Input
            placeholder="sender@example.com"
            value={newSender}
            onChange={(e) => setNewSender(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddRule();
            }}
            className="flex-1"
          />
          <select
            value={newCategory}
            onChange={(e) =>
              setNewCategory(e.target.value as "vip" | "normal" | "muted")
            }
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
          >
            <option value="vip">VIP</option>
            <option value="normal">Normal</option>
            <option value="muted">Muted</option>
          </select>
          <Button size="sm" onClick={handleAddRule}>
            Add
          </Button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(["all", "vip", "normal", "muted"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === cat
                ? "bg-surface-3 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {cat === "all" ? "All" : categoryConfig[cat].label}
          </button>
        ))}
      </div>

      {/* Rules list */}
      <div className="space-y-1">
        {rules?.map((rule) => {
          const config = categoryConfig[rule.category];
          const Icon = config.icon;

          return (
            <div
              key={rule._id}
              className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-surface-2"
            >
              <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
              <span className="flex-1 truncate text-sm text-foreground">
                {rule.senderAddress}
              </span>
              <Badge
                variant="secondary"
                className={cn("text-2xs", config.bg, config.color)}
              >
                {config.label}
              </Badge>

              {/* Category switcher */}
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {(["vip", "normal", "muted"] as const).map((cat) => {
                  if (cat === rule.category) return null;
                  const CatIcon = categoryConfig[cat].icon;
                  return (
                    <button
                      key={cat}
                      onClick={() =>
                        handleCategoryChange(
                          rule._id,
                          rule.senderAddress,
                          cat,
                        )
                      }
                      className={cn(
                        "rounded p-1 text-muted-foreground hover:text-foreground",
                        `hover:${categoryConfig[cat].bg}`,
                      )}
                      title={`Set as ${categoryConfig[cat].label}`}
                    >
                      <CatIcon className="h-3 w-3" />
                    </button>
                  );
                })}
                <button
                  onClick={() => handleDelete(rule._id)}
                  className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  title="Delete rule"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}

        {rules?.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No sender rules configured
          </p>
        )}
      </div>

      {/* Unsubscribe suggestions */}
      {unsubscribeSuggestions && unsubscribeSuggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            Unsubscribe Suggestions
          </h4>
          {unsubscribeSuggestions.map((rule) => (
            <div
              key={rule._id}
              className="flex items-center gap-2 rounded-md border border-subtle bg-surface-1 px-3 py-2"
            >
              <MailX className="h-4 w-4 shrink-0 text-orange-400" />
              <span className="flex-1 truncate text-xs text-foreground">
                {rule.senderAddress}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-2xs"
                onClick={() =>
                  handleCategoryChange(rule._id, rule.senderAddress, "muted")
                }
              >
                Mute
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-2xs text-muted-foreground"
                onClick={() => handleDismissUnsubscribe(rule.senderAddress)}
              >
                Dismiss
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
