import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — PING",
  description: "Terms and conditions for using the PING platform.",
};

export default function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: March 2026
        </p>

        <div className="mt-12 space-y-10 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Acceptance of Terms
            </h2>
            <p>
              By accessing or using PING, you agree to be bound by these Terms
              of Service. If you do not agree to these terms, you may not use
              the service. We reserve the right to update these terms at any
              time, and continued use of PING constitutes acceptance of any
              changes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Use of Service
            </h2>
            <p>
              PING provides an AI-native workspace communication platform. You
              may use the service for lawful purposes in accordance with these
              terms. You are responsible for maintaining the confidentiality of
              your account credentials and for all activities that occur under
              your account.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              User Accounts
            </h2>
            <p>
              To use PING, you must create an account and provide accurate,
              complete information. You must be at least 18 years old to create
              an account. You are responsible for keeping your account
              information up to date and for safeguarding your login
              credentials.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Acceptable Use
            </h2>
            <p>
              You agree not to use PING to transmit harmful, unlawful, or
              objectionable content, attempt to gain unauthorized access to
              other accounts or systems, interfere with the proper functioning
              of the service, or violate any applicable laws or regulations.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Intellectual Property
            </h2>
            <p>
              PING and its original content, features, and functionality are
              owned by Ping and are protected by applicable intellectual
              property laws. You retain ownership of the content you create and
              share through PING, but grant us a license to host and display
              that content as necessary to operate the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by law, PING and its operators
              shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the
              service. Our total liability for any claim arising from these
              terms shall not exceed the amount you paid us in the twelve months
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Changes to Terms
            </h2>
            <p>
              We may revise these Terms of Service from time to time. When we
              make material changes, we will notify you through the service or
              by other means. Your continued use of PING after such changes
              constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Contact
            </h2>
            <p>
              If you have any questions about these Terms of Service, please
              contact us at{" "}
              <a
                href="mailto:legal@ping.com"
                className="text-ping-purple hover:underline"
              >
                legal@ping.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
