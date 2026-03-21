"use client";

export function PersonalContextStep({
  onNext,
}: {
  userName: string;
  role: "admin" | "member";
  onNext: () => void;
}) {
  return (
    <div className="p-4 text-center text-xs text-muted-foreground">
      PersonalContextStep placeholder
      <button onClick={onNext} className="ml-2 text-ping-purple">
        Next &rarr;
      </button>
    </div>
  );
}
