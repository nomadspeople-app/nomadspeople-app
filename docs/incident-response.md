# Incident Response Plan — nomadspeople

**Status:** Active · **Version:** 2026-04-22 · **Owner:** Barak Perez

---

## 0. Purpose

GDPR Article 33 requires the data controller to notify the supervisory authority of a personal-data breach "without undue delay and, where feasible, not later than 72 hours after having become aware of it." This document defines how we detect, triage, contain, notify, and recover from a security incident — so we never miss that deadline.

---

## 1. Incident classification

Not every error is a breach. Use this matrix:

| Severity | Definition | Example |
|---|---|---|
| **SEV-0 — Breach** | Unauthorized access to personal data, OR confidentiality/integrity/availability loss affecting user data. | DB dump leaked, RLS bypass discovered in production, credentials compromised. |
| **SEV-1 — Security issue** | Vulnerability discovered; no confirmed exploitation. | Dependency CVE announced, our API endpoint returning too much data to the right user. |
| **SEV-2 — Service incident** | Downtime or degradation with no personal-data exposure. | Supabase region outage, Vercel deploy failure. |
| **SEV-3 — Bug** | Functional defect with no security or availability impact. | Map pin misplacement, translation missing. |

**Only SEV-0 triggers GDPR notification obligations. SEV-1 is still handled urgently to prevent escalation.**

---

## 2. Detection — how we learn about an incident

Monitoring sources:

1. **Sentry** (Frankfurt) — real-time crash and error stream. If a stack trace contains `RLS violation`, `SQL injection attempt`, or abnormal auth errors, Sentry alerts Barak's email.
2. **Supabase** — automatic email on infrastructure issues (region outage, extended DB unavailability). Also weekly advisor reports flag new RLS issues, exposed tables, etc.
3. **Vercel** — deploy failures and traffic anomalies.
4. **User reports** — someone emails `support@nomadspeople.com` saying "I can see other people's messages" or similar.
5. **External researchers** — security researcher emails us via the contact on the website.

Every one of these five channels routes to Barak's inbox (`nomadspeople1@gmail.com`) with the address `support@nomadspeople.com` forwarding.

---

## 3. Immediate response (first 2 hours)

### 3.1 Triage
- Open a timestamped incident doc: `docs/incidents/YYYY-MM-DD-short-name.md`.
- Record: what we saw, when, what triggered the detection, classification (SEV-0/1/2/3).
- Freeze deploys if SEV-0 or SEV-1 until contained.

### 3.2 Contain
For SEV-0:
- Revoke affected credentials (Supabase service role, API keys).
- Invalidate all active sessions if account compromise suspected: run `UPDATE auth.users SET updated_at = now() WHERE id = X` forces token refresh.
- Block abusive IPs at Supabase (if available) or Cloudflare if deployed.
- If a table was exposed: revoke SELECT privileges to `anon` / `authenticated` on that table temporarily.

### 3.3 Preserve evidence
- Copy relevant Supabase logs to the incident doc (they get purged after 7 days on Pro).
- Copy Sentry events.
- Screenshot any user report.

---

## 4. Notification timeline

### 4.1 Supervisory authority (SEV-0 only)

**Under GDPR Article 33:** within 72 hours of becoming aware, notify the EU data protection authority of the lead member state.

Since nomadspeople does not have a physical EU establishment, the applicable DPA is the one in the country of most-affected users. For our launch geography (Israel-origin app serving EU travelers), the initial contact is:

- **Israel (Privacy Protection Authority):** https://www.gov.il/en/departments/the_privacy_protection_authority
- **For EU users specifically:** Irish DPC (default one-stop-shop for many EU-serving apps): https://www.dataprotection.ie/en/organisations/know-your-obligations/breach-notification

If you cannot notify within 72 hours, still notify as soon as possible and include an explanation of the delay.

### 4.2 Affected users (SEV-0 only)

**Under GDPR Article 34:** if the breach is likely to result in a high risk to the rights and freedoms of individuals, notify them directly.

- Send an email to every affected user (use Resend — set up pre-launch).
- In-app banner for 30 days.
- Public post on nomadspeople.com/status (create the page if needed).

### 4.3 Platform partners

If the breach involves their infrastructure:

- Supabase: file support ticket.
- Apple: notify via App Store Connect if iOS-specific.
- Google Play: notify via Play Console if Android-specific.

---

## 5. User-facing notice template

For SEV-0 breach notice to users:

```
Subject: Important security notice about your nomadspeople account

Dear [Name],

On [Date], we became aware of a security incident affecting nomadspeople.

What happened: [one-paragraph plain-language description]

What was exposed: [specific data categories]

What we did: [containment actions taken]

What you should do: [password change, enable 2FA, etc.]

We deeply regret this incident. We have reported it to the relevant
data protection authority and are improving our systems to prevent
recurrence. For any question, email support@nomadspeople.com.

— The nomadspeople team
```

---

## 6. Post-incident review (SEV-0 and SEV-1)

Within 7 days of the incident:

1. Root-cause analysis — what combination of factors allowed this?
2. Action items — code change, policy change, monitoring addition.
3. Retrospective doc in `docs/incidents/YYYY-MM-DD-short-name-retro.md`.
4. If the incident affected a third-party processor, review whether to continue the relationship or find an alternative.

---

## 7. Contacts

- **Barak Perez** (data controller, primary contact): nomadspeople1@gmail.com
- **Eyal** (Apple Developer account holder, secondary): — TO FILL —
- **Supabase support:** support@supabase.com
- **Apple Developer support:** via App Store Connect
- **Google Play support:** via Play Console

---

## 8. Annual review

This plan is reviewed and updated every 12 months, or sooner if an incident exposes a gap. Record the review date at the top of this file.
