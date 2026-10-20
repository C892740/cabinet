# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use
[GitHub Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository, or email the maintainers. You will get an acknowledgement
within 72 hours and a fix timeline before any disclosure.

## Supported versions

Only the latest release on `main` receives security fixes.

## Hardening notes

- **Passwords**: scrypt (N=2¹⁵, r=8, p=1) with per-user random salts.
- **Sessions**: opaque random tokens; only SHA-256 hashes are stored, so a
  database leak cannot be replayed as a login. Cookies are `HttpOnly`,
  `SameSite=Lax`, `Secure` in production.
- **Admin dashboard**: gated by a key-password (`ADMIN_KEY_HASH`, a scrypt
  digest — the key itself is never stored server-side) and short-lived (8h)
  signed sessions. Unlock attempts are rate-limited per IP.
- **Key vault** (desktop + CLI): AES-256-GCM with an authenticated header and
  scrypt-derived keys; a wrong passphrase or tampered file fails closed.
- **CSRF**: state-changing endpoints verify the request `Origin` and rely on
  `SameSite` cookies.

Dependabot security updates are enabled for this repository; CI runs a
dependency review on every pull request.
