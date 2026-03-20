import { CheckCircle2 } from "lucide-react";

export default function InboxPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <CheckCircle2 className="h-16 w-16 text-[#5C5C5F]" />
      <h2 className="text-lg font-semibold text-foreground">
        You&apos;re all caught up
      </h2>
      <p className="text-sm text-muted-foreground">
        New summaries and action items will appear here
      </p>
    </div>
  );
}
