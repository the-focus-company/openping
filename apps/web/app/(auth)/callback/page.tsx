export default function CallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6366F1] border-t-transparent" />
        <p className="text-sm text-[#8B8B8E]">Signing you in...</p>
      </div>
    </div>
  );
}
