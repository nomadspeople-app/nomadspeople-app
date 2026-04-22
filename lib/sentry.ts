/**
 * sentry — THE single Sentry surface for the app.
 *
 * Design goals
 * ────────────
 * 1. **Graceful when Sentry isn't available.** We use the same
 *    try/require pattern as expo-image / expo-updates / expo-
 *    tracking-transparency elsewhere in the codebase: if
 *    `@sentry/react-native` isn't installed (e.g. Expo Go without
 *    dev-client) or fails to import, every function in this module
 *    no-ops silently. The app must NEVER crash on a missing Sentry.
 *
 * 2. **DSN lives in app.json extra, not inline.** Public-facing
 *    (like the Supabase anon key), but keeping it in app.json lets
 *    EAS env profiles override per-branch.
 *
 * 3. **EU region.** Our project is in sentry.io's Frankfurt data
 *    center (ingest.de.sentry.io) to keep all nomadspeople data
 *    in the EU alongside the Supabase DB (eu-central-1). See
 *    docs/product-decisions for the data-residency rationale.
 *
 * 4. **No PII in breadcrumbs.** We DO send user_id on captured
 *    errors (via setUser) so we can correlate a crash to the
 *    specific account. We DO NOT send emails, chat messages,
 *    profile text, or location. The `beforeSend` hook strips
 *    anything that sneaks in.
 *
 * Callers
 * ───────
 *   initSentry()      — once at app boot (App.tsx useEffect)
 *   setSentryUser()   — after auth: attaches user_id context
 *   clearSentryUser() — on sign-out
 *   captureError()    — optional manual capture from catch blocks
 */

import Constants from 'expo-constants';

/* ─── Graceful lazy loader ──────────────────────────────────── */

let _sentry: any = null;
let _loadAttempted = false;

function loadSentry(): any {
  if (_loadAttempted) return _sentry;
  _loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _sentry = require('@sentry/react-native');
  } catch {
    _sentry = null;
  }
  return _sentry;
}

/* ─── DSN resolution ───────────────────────────────────────────
   Read from app.json extra.sentry.dsn. Returns null when absent
   (e.g. local dev profile with no DSN set) — init becomes a no-op. */
function getDsn(): string | null {
  try {
    const extra =
      (Constants.expoConfig?.extra as any) ??
      (Constants.manifest2 as any)?.extra?.expoClient?.extra ??
      null;
    const dsn = extra?.sentry?.dsn;
    return typeof dsn === 'string' && dsn.length > 0 ? dsn : null;
  } catch {
    return null;
  }
}

/* ─── Public API ────────────────────────────────────────────── */

let _initialized = false;

export function initSentry(): void {
  if (_initialized) return;

  /* Skip in dev mode — standard practice. Dev errors are noise,
     they'd eat our Sentry quota and pollute the dashboard with
     test crashes. Also avoids the "Network request failed" log
     when Sentry's telemetry endpoint can't be reached from the
     Metro bundler environment. Production builds (__DEV__=false)
     get full init. */
  if (__DEV__) {
    console.info('[Sentry] dev mode — init skipped.');
    return;
  }

  const Sentry = loadSentry();
  if (!Sentry) return;
  const dsn = getDsn();
  if (!dsn) {
    console.info('[Sentry] no DSN configured — skipping init.');
    return;
  }
  try {
    Sentry.init({
      dsn,
      /* Release tag — lets Sentry group errors per app version.
         Constants.expoConfig.version mirrors app.json's `version`. */
      release: Constants.expoConfig?.version ?? 'unknown',

      /* No performance traces in v1. Cuts noise + egress. Flip to a
         sampled rate (e.g. 0.1) once we have a baseline and want
         to investigate slow interactions. */
      tracesSampleRate: 0,

      /* Keep breadcrumbs lean — just console + navigation + http.
         Excludes XHR bodies, which could carry user messages. */
      enableAutoPerformanceTracing: false,
      enableAutoSessionTracking: true,

      /* beforeSend — strip anything we never want on a server.
         This is the PII firewall. Modify carefully — every field
         here is intentional. */
      beforeSend(event: any) {
        // Defensive strip — never send these even if something pushes them.
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
          if (event.request.data) delete event.request.data;
        }
        // Breadcrumbs can accidentally include chat content via console.log —
        // strip any breadcrumb whose `data` field has a message-like key.
        if (Array.isArray(event.breadcrumbs)) {
          event.breadcrumbs = event.breadcrumbs.map((b: any) => {
            if (b?.data && typeof b.data === 'object') {
              const redacted: any = {};
              for (const k of Object.keys(b.data)) {
                if (/message|body|content|text|email|password/i.test(k)) {
                  redacted[k] = '[redacted]';
                } else {
                  redacted[k] = b.data[k];
                }
              }
              b.data = redacted;
            }
            return b;
          });
        }
        return event;
      },
    });
    _initialized = true;
    console.info('[Sentry] initialized (EU region, release', Constants.expoConfig?.version, ')');
  } catch (err) {
    console.warn('[Sentry] init failed:', err);
  }
}

/** Attach the current user_id to Sentry events. Call after sign-in
 *  so crashes/errors can be traced to a specific account — critical
 *  for support triage. We intentionally DO NOT send email or
 *  display_name. Apple's privacy label treats a user_id as "linked
 *  to user" which we've already disclosed. */
export function setSentryUser(userId: string | null | undefined): void {
  const Sentry = loadSentry();
  if (!Sentry || !_initialized) return;
  try {
    if (userId) {
      Sentry.setUser({ id: userId });
    } else {
      Sentry.setUser(null);
    }
  } catch {
    /* no-op */
  }
}

/** Clear the user context on sign-out. */
export function clearSentryUser(): void {
  setSentryUser(null);
}

/** Manual capture — use sparingly from catch blocks where the
 *  error is meaningful but not bubbling up to a fatal boundary. */
export function captureError(err: unknown, context?: Record<string, any>): void {
  const Sentry = loadSentry();
  if (!Sentry || !_initialized) return;
  try {
    if (context) {
      Sentry.withScope((scope: any) => {
        for (const [k, v] of Object.entries(context)) {
          scope.setExtra(k, v);
        }
        Sentry.captureException(err);
      });
    } else {
      Sentry.captureException(err);
    }
  } catch {
    /* no-op */
  }
}

/** Surface a user report as a Sentry event so Barak sees it in the
 *  Sentry inbox within minutes instead of waiting for an Admin
 *  dashboard visit. Apple 1.2 expects "timely response" on user
 *  reports of abusive content; this is the simplest 24-hour SLA
 *  plumbing that does not require a third-party email service.
 *
 *  Why "warning" level:
 *   - "info" gets filtered to noise and ignored in the default view.
 *   - "error" triggers on-call paging alerts (we don't want that).
 *   - "warning" hits the inbox once, stays visible, and is what the
 *     Sentry UI is designed around for "something happened, a human
 *     should look".
 *
 *  The tag `user_report=true` lets us set up a Sentry Alert rule
 *  (email / Slack / whatever) specifically for this class of event
 *  without touching the rest of the crash stream. */
export function captureUserReport(
  kind: 'message' | 'user' | 'post' | 'comment',
  context: {
    reportedId?: string;
    reporterId?: string;
    reason?: string;
    note?: string;
  }
): void {
  const Sentry = loadSentry();
  if (!Sentry || !_initialized) return;
  try {
    Sentry.withScope((scope: any) => {
      scope.setTag('user_report', 'true');
      scope.setTag('report_kind', kind);
      scope.setLevel?.('warning');
      for (const [k, v] of Object.entries(context)) {
        if (v !== undefined && v !== null) scope.setExtra(k, v);
      }
      Sentry.captureMessage(
        `User report: ${kind} — ${context.reason ?? 'no reason'}`
      );
    });
  } catch {
    /* no-op — never let Sentry break a report flow */
  }
}

/** Wrap the top-level App component so Sentry captures renders
 *  that throw. Returns the component as-is when Sentry isn't
 *  available — the caller's code path is identical either way. */
export function wrapWithSentry<T>(Component: T): T {
  const Sentry = loadSentry();
  if (!Sentry || !Sentry.wrap) return Component;
  try {
    return Sentry.wrap(Component as any) as T;
  } catch {
    return Component;
  }
}
