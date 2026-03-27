import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — PING",
  description:
    "Learn how PING collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface-0 text-foreground">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-ping-purple/80 font-mono text-[10px] font-bold text-white">
              P
            </div>
            <span className="text-sm font-semibold text-white">PING</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: March 2026
        </p>

        <div className="mt-12 space-y-10 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Information We Collect
            </h2>
            <p>
              We collect information you provide directly when you create an
              account, set up a workspace, or use our services. This includes
              your name, email address, profile information, and the content of
              messages you send through PING. We also collect usage data such as
              log data, device information, and interaction patterns to improve
              our service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              How We Use Your Information
            </h2>
            <p>
              We use the information we collect to provide, maintain, and
              improve PING, including powering AI features such as inbox
              prioritization, message summarization, and proactive alerts. We
              may also use your information to communicate with you about
              service updates, respond to support requests, and ensure the
              security of our platform.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Data Storage and Security
            </h2>
            <p>
              Your data is stored on secure, encrypted servers. We implement
              industry-standard security measures including encryption in
              transit and at rest, access controls, and regular security audits
              to protect your information from unauthorized access, alteration,
              or destruction.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Third-Party Services
            </h2>
            <p>
              PING integrates with third-party services such as GitHub, Linear,
              and OpenAI to provide its features. When you connect these
              services, we may share limited information necessary to enable the
              integration. Each third-party service is governed by its own
              privacy policy, and we encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Your Rights
            </h2>
            <p>
              You have the right to access, correct, or delete your personal
              data at any time. You may also request a copy of the data we hold
              about you or ask us to restrict processing. To exercise any of
              these rights, please contact us using the information below.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy or our data
              practices, please contact us at{" "}
              <a
                href="mailto:privacy@ping.com"
                className="text-ping-purple hover:underline"
              >
                privacy@ping.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
