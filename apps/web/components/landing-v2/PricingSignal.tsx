"use client";

import { Section, Reveal } from "./primitives";

export function PricingSignal() {
  return (
    <Section className="border-t border-white/[0.04]">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ping-purple">
            Pricing
          </p>
          <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-white sm:text-[2.5rem]">
            Pay for capacity, not seats
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
            Traditional tools charge per seat. That means the more people you
            bring in (clients, contractors, experts), the more you pay. OpenPing
            prices by the value it unlocks: more projects, better margins, fewer
            coordinators.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Self-hosted",
                price: "Free",
                detail: "MIT license. Your infra, your data.",
              },
              {
                label: "Cloud",
                price: "Early access",
                detail: "Hosted by us. Start with one team.",
              },
              {
                label: "Enterprise",
                price: "Custom",
                detail: "SSO, compliance, dedicated support.",
              },
            ].map((tier) => (
              <div
                key={tier.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  {tier.label}
                </p>
                <p className="mt-2 text-[1.5rem] font-bold text-white">
                  {tier.price}
                </p>
                <p className="mt-1.5 text-[12px] text-muted-foreground/60">
                  {tier.detail}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
