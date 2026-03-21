export function GridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />
      {/* Top gradient glow */}
      <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-ping-purple/[0.07] blur-[120px]" />
      {/* Amber accent glow */}
      <div className="absolute -top-20 right-0 h-[400px] w-[500px] rounded-full bg-amber-500/[0.03] blur-[100px]" />
    </div>
  );
}
