import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
    }
    if (event.extra) {
      for (const key of Object.keys(event.extra)) {
        if (/body|message|email/i.test(key)) {
          event.extra[key] = "[REDACTED]";
        }
      }
    }
    return event;
  },
});
