# Security Policy

## Supported Versions

Walkscope is actively maintained. Security updates and bug fixes are applied to the active `main` branch:

| Version / Branch | Supported          |
| :---             | :---               |
| `main`           | :white_check_mark: |
| `< 1.0.0`        | :x:                |

---

## Reporting a Vulnerability

The Walkscope maintainers take the security of this project and user privacy very seriously. If you discover a security vulnerability or potential privacy leak, please disclose it responsibly.

### How to Report

- **Email**: Send vulnerability reports directly to [koushikkatkam@gmail.com](mailto:koushikkatkam@gmail.com).
- **Subject**: Please include `[SECURITY] Walkscope Vulnerability Report` in the subject line.
- **Details**: In your report, please include:
  - A description of the issue and potential impact
  - Step-by-step reproduction instructions or a minimal proof of concept
  - Affected components (`core`, `mobile`, or `server`)
  - Any suggested mitigations or patches

### Response Timeline

- **Initial Acknowledgment**: Within 48 hours of receipt.
- **Triage & Assessment**: Within 5 business days, including confirmation of severity and affected versions.
- **Fix & Advisory**: We will work with you to patch the issue promptly and coordinate public disclosure once a fix is landed.

Please **do not** report security vulnerabilities via public GitHub Issues, discussions, or pull requests until they have been coordinated and resolved.

---

## Security Architecture & Defensive Principles

Walkscope incorporates layered defensive mechanisms:

1. **Zero External Telemetry**: The application contains no analytics tracking, advertising trackers, or telemetry beacons.
2. **Local-First SQLite Persistence**: User journey history and preferences remain on-device in SQLite WAL mode. Cloud backup is explicitly disabled (`android:allowBackup="false"`).
3. **Gateway Defenses**:
   - Strict request body caps (`1 MB`) to prevent memory exhaustion DoS.
   - Global RFC 7807 error masking to prevent stack trace or filesystem disclosures (`OWASP API3:2023`).
   - Rate limiting (100 req/min per IP) via `@fastify/rate-limit`.
   - Security headers enforced via `@fastify/helmet` (`nosniff`, `DENY` framing).
4. **Network Isolation**:
   - Cleartext HTTP traffic is strictly blocked on Android except for loopback development (`127.0.0.1`).
   - Docker Compose binds container ports strictly to loopback (`127.0.0.1`), preventing public database exposure.
5. **Continuous Automated Scanning**:
   - Automated secret scanning on every pull request and push via TruffleHog.
   - Frozen dependency lockfile auditing with zero tolerated high/critical CVEs.
