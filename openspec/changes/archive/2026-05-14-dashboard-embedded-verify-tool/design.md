## Context

Superset's embedded dashboard flow requires three distinct steps before a dashboard renders:

1. **Authentication** — Obtain a JWT access token (typically via `/api/v1/security/login` with username/password, or use an existing session)
2. **Guest Token Acquisition** — POST to `/api/v1/security/guest_token/` with the dashboard resource and optional user context, returning a short-lived JWT guest token
3. **Dashboard Embedding** — Call `embedDashboard()` from `@superset-ui/embedded-sdk` with the guest token, which creates an iframe pointing to `/embedded/{dashboard_uuid}`

Currently there is no standalone tool that walks through these steps with visual feedback. Developers must piece together the flow from documentation, SDK examples, and trial-and-error. The existing `EmbeddedModal` in the frontend is a management UI (for setting allowed domains), not a verification tool.

This tool targets developers integrating Superset into external applications, not end users of Superset itself.

## Goals / Non-Goals

**Goals:**
- Provide a single-page HTML tool that verifies the complete embedded dashboard flow
- Support two authentication modes: (a) username/password → login → guest token, (b) direct guest token input (for users who already have one)
- Show step-by-step progress with clear pass/fail indicators for each stage
- Handle the guest token JWT refresh lifecycle as part of verification
- Surface clear error messages when any step fails (wrong URL, bad credentials, dashboard not embedded, domain not allowed)
- Work as a standalone HTML file — no build step, no bundler, no framework
- Document the purpose and usage clearly within the tool itself

**Non-Goals:**
- Not a production embed solution — this is a verification/diagnostic tool only
- Not a replacement for the `EmbeddedModal` dashboard configuration UI
- Not responsible for configuring embedding on a dashboard (setting allowed domains) — that is done via the Dashboard REST API
- Not a comprehensive test suite — does not test edge cases like RLS rules, guest user permissions, or multi-tab behavior
- Not a library or reusable component — it's a self-contained HTML file

## Decisions

### Decision 1: Standalone HTML file vs. bundler-based app

**Choice**: Single HTML file with embedded JavaScript (loaded via CDN for SDK dependencies), no build step.

**Rationale**:
- Zero setup friction: a developer can open the file directly in a browser or serve it with any static file server
- No npm install, no webpack/vite, no TypeScript compilation needed for verification
- The tool's complexity is bounded — it's a form with 4-5 inputs and a status display, not a large application
- CDN-loaded SDK via esm.sh/unpkg ensures the real `@superset-ui/embedded-sdk` is used

**Alternatives considered**: A small React/TypeScript app under `superset-frontend/` — rejected because it adds build complexity and is not discoverable by developers who don't work on the Superset frontend.

### Decision 2: Auth flow — password-based JWT vs. API key

**Choice**: Support two modes:
- **Mode A (auto)**: Username/password → POST `/api/v1/security/login` → POST `/api/v1/security/guest_token` → SDK
- **Mode B (direct)**: Pre-existing guest token → SDK

**Rationale**:
- Mode A is the most common developer workflow: "I want to verify embedding works on my Superset instance"
- Mode B is useful for debugging existing token setups or scenarios where the developer cannot use password auth
- The `/api/v1/security/login` endpoint is the standard Superset auth mechanism for REST API access

**Alternatives considered**: 
- OAuth/SSO modes — too complex, out of scope for a verification tool
- API key auth — Superset does not natively support API keys in the same way

### Decision 3: SDK loaded via ESM CDN (esm.sh)

**Choice**: Load `@superset-ui/embedded-sdk` via `<script type="module" src="https://esm.sh/@superset-ui/embedded-sdk">` for the SDK functionality, and use native `fetch()` for API calls.

**Rationale**:
- esm.sh provides npm packages as ES modules compatible with modern browsers
- The SDK's `embedDashboard()` function is the primary API being verified
- `fetch()` is available in all modern browsers with no dependencies
- No bundler needed — the tool stays as a single file

**Risk**: CDN availability. If the CDN is down, the tool cannot function. Mitigated by: (a) the tool shows a clear "SDK failed to load" error, (b) developers can download the file and swap to a different CDN or local copy.

### Decision 4: Tool placement — `docs/` directory

**Choice**: Place the tool at `docs/embedded-verify-tool/embedded-verify.html` (within the docs directory).

**Rationale**:
- The tool is documentation-adjacent: it's a developer utility for verifying setup
- Placing it in `superset-frontend/` would imply it's part of the app build, which it is not
- The `docs/` directory already contains developer-focused resources
- A separate `docs/embedded-verify-tool/` directory can also hold a short README

**Alternatives considered**:
- `superset-frontend/embedded-verify.html` — rejected because it may confuse readers into thinking it's part of the frontend build
- `tools/embedded-verify.html` — no `tools/` directory exists currently

### Decision 5: No new backend endpoints

**Choice**: Use only existing API endpoints (`/api/v1/security/login`, `/api/v1/security/guest_token/`, and the SDK's existing mechanism).

**Rationale**:
- No backend changes needed — zero deployment risk
- The tool works against any Superset version that supports embedding (v1.5+)
- Verifies the actual APIs developers will use

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| **CORS errors** — browser blocks cross-origin requests to the Superset API | The tool documents that Superset must have CORS configured, OR the tool must be served from the same origin as Superset (e.g., via `python -m http.server` proxied through nginx). The error message for CORS failures is clear and suggests solutions. |
| **CDN availability for SDK** — `esm.sh` or unpkg may be unreachable | Document fallback: download the SDK locally and use a file:// or local server import. The tool checks SDK load and reports failure clearly. |
| **Guest token expiration** — 5-minute default TTL may expire during debugging | The tool documents the `GUEST_TOKEN_JWT_EXP_SECONDS` config. Token refresh is handled by the SDK automatically. |
| **Mixed content** — HTTPS Superset but HTTP tool page | Tool documents that it must be served via HTTPS if Superset is HTTPS. |
| **File size** — single HTML file may grow large with inline CSS/JS | Acceptable trade-off for zero-dependency simplicity. CSS is minimal. |
