# Contributing to Walkscope

Thank you for your interest in contributing to **Walkscope**! Walkscope is an open-source, privacy-first pedestrian walking context companion built on transparent open geospatial data.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to [koushikkatkam@gmail.com](mailto:koushikkatkam@gmail.com).

---

## Monorepo Architecture

Walkscope is structured as an npm workspaces monorepo:

- **`packages/core`**: Pure domain logic, astronomical daylight calculations, Overpass API client, route scoring algorithm, and the Route Context Intelligence engine. Zero UI dependencies.
- **`packages/mobile`**: React Native (0.88.1) and Expo SDK 58 application utilizing MapLibre Native for offline/online raster cartography, live HUD guidance, and on-device SQLite storage.
- **`packages/server`**: Fastify 5 geospatial gateway backend providing rate limiting, request deduplication, multi-tier caching (L1 in-memory + L2 Redis), and upstream open data proxying.

---

## Development Prerequisites

- **Node.js**: `22.x LTS` (or compatible Node 20+)
- **npm**: `10.x` or higher
- **Docker & Docker Compose** (optional, for running Redis and PostGIS locally)
- **Android SDK 34+** / Expo Dev Client (for mobile application development)

---

## Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/KatkamKoushik/Walkscope.git
   cd Walkscope
   ```

2. **Install all workspace dependencies deterministically:**
   ```bash
   npm ci
   ```

3. **Verify the baseline build and test battery:**
   ```bash
   npm run typecheck
   npm run lint
   npm test
   cd packages/mobile && npx expo-doctor
   ```

---

## Development Workflow & Quality Gates

Walkscope enforces a zero-tolerance policy for broken tests, type errors, lint warnings, dependency vulnerabilities, and secret leaks. Before submitting a pull request, ensure all local verification checks pass:

### 1. Static Type Checking
```bash
npm run typecheck
```
Must pass across `core`, `mobile`, and `server` with 0 errors.

### 2. Code Linting
```bash
npm run lint
```
Must pass ESLint across all workspaces with 0 warnings and 0 errors.

### 3. Unit, Stress & Golden Corridor Tests
```bash
npm test
```
Executes the complete offline test battery (242 tests across 36 suites), covering:
- NOAA astronomical twilight calculations
- OSM opening_hours and overnight arrival evaluations
- Along-route feature projection and venue gap analysis
- Deterministic golden corridor fixtures (Bengaluru MG Road & London Westminster)
- SQLite zero-telemetry local storage and SQL injection hardening
- Fastify gateway 100-burst concurrency and request deduplication stress tests

### 4. Mobile Ecosystem Health
```bash
cd packages/mobile && npx expo-doctor
```
Must verify 20/20 checks with zero dependency mismatches.

---

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature or scoring capability
- `fix:` A bug fix or kinematic filter adjustment
- `docs:` Documentation updates or architectural explanations
- `test:` Adding or updating unit, fuzz, or stress tests
- `refactor:` Code refactoring without behavioral changes
- `build:` Build system, dependency, or CI/CD updates
- `perf:` Performance or memory optimization

*Example:*
```git
feat(scoring): decouple information coverage from ambient solar illumination
fix(navigation): prevent gps subscription re-attachment on maneuver step advance
```

---

## Privacy & Ethical Guidelines

- **Zero Telemetry**: Never introduce third-party analytics SDKs, advertising trackers, or telemetry beacons.
- **No Hardcoded Credentials**: Never commit API keys, database passwords, or auth tokens. Use `.env` with `.env.example` templates.
- **Explainable Metrics**: Never frame route evaluations as subjective "safety scores". Always measure verifiable data density and explicitly disclose missing or unverified information.

---

## Pull Request Process

1. Create a feature or bugfix branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
2. Commit your changes following Conventional Commits.
3. Verify that all 4 quality gates pass locally (`typecheck`, `lint`, `test`, `expo-doctor`).
4. Push your branch to GitHub and open a Pull Request against `main`.
5. Ensure all 8 GitHub Actions CI jobs turn green.
