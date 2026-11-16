## Pull Request Description

### Summary of Changes
<!-- Provide a clear, concise summary of the changes made and the problem they solve. -->

### Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing behavior to change)
- [ ] Documentation update
- [ ] Dependency update / tooling maintenance

---

## Quality Gate Checklist

Please ensure all checkboxes are verified prior to submitting:

- [ ] **Static Type Analysis**: `npm run typecheck` passes with 0 errors across `core`, `mobile`, and `server`.
- [ ] **Code Linting**: `npm run lint` passes with 0 errors and 0 warnings.
- [ ] **Unit & Stress Tests**: `npm test` passes 100% of the offline test suite (242 tests).
- [ ] **Mobile Health**: `cd packages/mobile && npx expo-doctor` passes all 20/20 checks.
- [ ] **Zero Telemetry**: No tracking SDKs, advertising beacons, or unconsented external data transmission added.
- [ ] **Secrets & Privacy**: No API keys, credentials, or personal tokens committed.
- [ ] **Documentation**: Updated `README.md` and related docs if scoring or interface semantics changed.

---

## Related Issues
<!-- Link related issues, e.g. Fixes #123 -->
