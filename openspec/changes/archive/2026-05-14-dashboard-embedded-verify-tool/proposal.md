## Why

Developers integrating Superset dashboards into external applications often struggle with the embedded authentication flow. The `@superset-ui/embedded-sdk` provides the `embedDashboard()` function, but there's no standalone tool to quickly verify that (1) a guest token can be obtained, (2) the dashboard API is accessible, and (3) the full embed lifecycle works end-to-end. This change provides a simple CLI-like HTML verification tool that developers can use to test their Superset embedded setup before building full integrations.

## What Changes

- **New**: A standalone HTML/JS verification tool (`embedded-verify.html`) that exercises the complete embedded dashboard flow
- **New**: Built-in guest token acquisition from `/api/v1/security/guest_token/` before calling the embedded SDK
- **New**: Step-by-step visual progress feedback showing each stage of the flow (token acquisition, API validation, dashboard loading)
- **New**: Configuration form for Superset base URL, credentials, dashboard ID/UUID, and allowed domains
- **New**: Support for both JWT password-based auth and existing guest token flows

## Capabilities

### New Capabilities
- `embedded-verify-tool`: A standalone HTML verification tool that tests the full Superset embedded dashboard flow — from authentication to dashboard rendering — using `@superset-ui/embedded-sdk`

### Modified Capabilities

*(None — no existing capabilities are having their requirements changed)*

## Impact

- **New file**: `superset-frontend/embedded-verify.html` — a self-contained HTML tool (or alternatively under `docs/` as a developer utility)
- **Dependency**: Uses `@superset-ui/embedded-sdk` from npm (loaded via CDN for standalone use)
- **No changes** to existing backend APIs, models, or frontend application code
- **No changes** to the SDK itself — this is a consumer of the SDK
- Developers gain a reproducible verification workflow for embedded dashboard setup
