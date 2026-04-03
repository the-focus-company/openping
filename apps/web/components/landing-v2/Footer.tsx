import Link from "next/link";
import { DOCS_URL, GITHUB_URL } from "./constants";

const linkStyles = "text-xs text-neutral-500 hover:text-white transition-colors";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-neutral-950">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-3">
          <img
            src="/bw_logotype_onbalck_padding.png"
            alt="PING"
            className="h-4 opacity-40"
          />
          <span className="text-xs text-neutral-500">
            © 2026 · MIT License
          </span>
        </div>

        <div className="flex gap-5">
          <Link href="/manifesto" className={linkStyles}>
            Manifesto
          </Link>
          <a href={DOCS_URL} className={linkStyles}>
            Docs
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={linkStyles}
          >
            GitHub
          </a>
          <Link href="/privacy" className={linkStyles}>
            Privacy
          </Link>
          <Link href="/terms" className={linkStyles}>
            Terms
          </Link>
          <Link href="/sign-in" className={linkStyles}>
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
