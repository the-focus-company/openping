import Link from "next/link";
import { Github } from "lucide-react";
import { DOCS_URL, GITHUB_URL } from "./constants";

const linkStyles =
  "text-sm text-neutral-400 hover:text-white transition-colors rounded-md px-3 py-1.5";

export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/[0.06] bg-neutral-950/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/">
          <img
            src="/bw_logotype_onbalck_padding.png"
            alt="PING"
            className="h-7 w-auto"
          />
        </Link>

        <div className="flex items-center">
          <Link
            href="/manifesto"
            className={`hidden sm:inline-flex ${linkStyles}`}
          >
            Manifesto
          </Link>
          <a href={DOCS_URL} className={linkStyles}>
            Docs
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 ${linkStyles}`}
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>

          <span className="mx-2 h-4 w-px bg-white/[0.08]" />

          <Link
            href="/sign-in"
            className="inline-flex h-8 items-center rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
          >
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}
