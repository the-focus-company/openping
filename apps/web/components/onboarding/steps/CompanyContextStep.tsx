"use client";

export function CompanyContextStep({
  onNext,
}: {
  workspaceName: string;
  onNext: () => void;
}) {
  return (
    <div className="p-4 text-center text-xs text-muted-foreground">
      CompanyContextStep placeholder
      <button onClick={onNext} className="ml-2 text-ping-purple">
        Next &rarr;
      </button>
    </div>
  );
}
