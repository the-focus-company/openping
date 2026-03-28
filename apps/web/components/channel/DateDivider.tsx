export function formatDateDivider(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) return "Today";
  if (msgDay.getTime() === yesterday.getTime()) return "Yesterday";

  const opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };
  if (msgDay.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
}

export function DateDivider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center px-4 py-3">
      <div className="flex-1 border-t border-subtle" />
      <span className="mx-3 shrink-0 rounded-full border border-subtle bg-surface-2 px-3 py-0.5 text-2xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 border-t border-subtle" />
    </div>
  );
}
