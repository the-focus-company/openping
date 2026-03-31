import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-0 px-6 text-center">
      <p className="font-mono text-7xl font-bold text-foreground/10">404</p>

      <h1 className="mt-4 text-xl font-semibold text-foreground">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-ping-purple px-5 text-sm font-medium text-white transition-colors hover:bg-ping-purple-hover active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-subtle bg-surface-1 px-5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
