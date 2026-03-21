"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Inbox, Bot, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ping-onboarding-complete";

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  action: string;
}

const STEPS: Step[] = [
  {
    icon: Zap,
    title: "Welcome to PING",
    description: "Your AI-native workspace is ready. PING keeps you focused on what matters with smart summaries, proactive alerts, and a built-in knowledge bot.",
    action: "Get Started \u2192",
  },
  {
    icon: Inbox,
    title: "Your Smart Inbox",
    description: "PING uses the Eisenhower Matrix to prioritize what matters. Every message is ranked by urgency and importance so you always know what to tackle first.",
    action: "Next \u2192",
  },
  {
    icon: Bot,
    title: "Meet KnowledgeBot",
    description: "Ask @KnowledgeBot anything about your codebase, past conversations, or team decisions. It searches your workspace history to give you answers with citations.",
    action: "Start Using PING",
  },
];

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem(STORAGE_KEY, "true");
      setOpen(false);
    }
  };

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm border-subtle bg-surface-1 text-center">
        <DialogTitle className="sr-only">{current.title}</DialogTitle>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ping-purple/15">
            <Icon className="h-6 w-6 text-ping-purple" />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              {current.title}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {current.description}
            </p>
          </div>

          <Button
            className="mt-2 h-8 bg-ping-purple px-6 text-xs text-white hover:bg-ping-purple-hover"
            onClick={handleNext}
          >
            {current.action}
          </Button>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === step ? "bg-ping-purple" : "bg-white/20"
                )}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
