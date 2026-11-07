# Security Policy

The security of **Kikar AI** and the privacy of our users' conversations, replicas, and billing data are of paramount importance to us. We appreciate the responsible disclosure of any potential vulnerabilities.

---

## 🛡️ Supported Versions

We actively provide security patches and updates for the following versions:

| Version / Branch | Supported | Notes |
| :--- | :--- | :--- |
| `main` (Production) | :white_check_mark: | Latest release deployed on Vercel & official APK |
| Older releases | :x: | Please test and reproduce on the latest `main` branch |

---

## 🚨 Reporting a Vulnerability

**DO NOT file public GitHub Issues for security vulnerabilities or potential exploits.**

If you discover a security flaw or vulnerability affecting Kikar AI, please report it via private email to:

📧 **`bhavya497sharma@gmail.com`**

### What to include in your report:
To help us triage and remediate the issue quickly, please provide:
1. **Type of Vulnerability**: (e.g., *Authentication bypass, Supabase Row-Level Security policy misconfiguration, Stripe/Razorpay webhook forgery, XSS, rate-limit exhaustion*).
2. **Affected Endpoint / Component**: The specific URL, API route (`/api/chat`, `/api/billing/*`), or database table involved.
3. **Proof of Concept (PoC)**: Clear, minimal step-by-step instructions or cURL commands to reproduce the issue safely without impacting other users.
4. **Estimated Impact**: What an attacker could potentially achieve.

---

## ⏱️ Response & Disclosure Process

- **Acknowledgment**: We aim to acknowledge receipt of your report within **24–48 hours**.
- **Investigation & Patching**: We will investigate the root cause, determine the blast radius, and deploy a fix to the live production server as quickly as possible.
- **Coordination**: We ask that you maintain mutual confidentiality and withhold public disclosure until a patch has been verified and deployed in production.

---

## 🔒 Scope & Out-of-Scope

### In Scope:
- Authentication & session handling (`supabase.auth`).
- Authorization & Row Level Security (RLS) policies for `messages`, `direct_messages`, `conversations`, and `characters`.
- Server-side API routes (`/api/chat`, `/api/generate-image`, `/api/billing/webhook`, `/api/billing/checkout`).
- Secret leakage prevention (e.g., ensuring Service Role keys or Gemini API keys are never exposed on client bundles).

### Out of Scope:
- Denial of Service (DoS / DDoS) attacks against third-party hosting infrastructure (Vercel, Supabase).
- Social engineering, phishing, or physical attacks against employees or users.
- Issues with missing HTTP security headers that do not lead to a demonstrable exploit.
- Spamming public endpoints without showing a security risk.

Thank you for helping keep Kikar AI and our community safe!
