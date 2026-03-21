"use client";

export function ChannelSelectionStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="p-4 text-center text-xs text-muted-foreground">
      ChannelSelectionStep placeholder
      <button onClick={onNext} className="ml-2 text-ping-purple">
        Next &rarr;
      </button>
    </div>
  );
}
