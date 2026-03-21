"use client";

export function CommunicationPrefsStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="p-4 text-center text-xs text-muted-foreground">
      CommunicationPrefsStep placeholder
      <button onClick={onNext} className="ml-2 text-ping-purple">
        Next &rarr;
      </button>
    </div>
  );
}
