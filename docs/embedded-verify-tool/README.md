# Superset Embedded Dashboard Verify Tool

A standalone HTML verification tool for testing Superset's embedded dashboard flow end-to-end.

## Usage

1. **Serve the tool** from a web server (required for ES modules):
   ```bash
   python -m http.server 8080 --directory docs/embedded-verify-tool
   ```
   Then open `http://localhost:8080/embedded-verify.html`

2. **Configure** your Superset instance URL, credentials, and dashboard ID

3. **Click "Start Verification"** — the tool walks through:
   - Authentication (JWT login)
   - Embed configuration resolution
   - Guest token acquisition
   - Dashboard embedding via `@superset-ui/embedded-sdk`

## Prerequisites

- Superset instance running with `EMBEDDED_SUPERSET` feature flag enabled (default: `True`)
- A dashboard with embedding configured (allowed domains set)
- A user with `can_grant_guest_token` permission (admin role by default)
- CORS configured on Superset to allow requests from the tool's origin:
  ```python
  # superset_config.py
  ENABLE_CORS = True
  CORS_OPTIONS = {
    "origins": ["http://localhost:8080", "https://your-domain.com"],
  }
  ```

## Authentication Modes

| Mode | Description |
|------|-------------|
| **Username/Password** | Enter Superset credentials — the tool handles login, guest token, and embed |
| **Guest Token** | Provide a pre-existing guest token directly — skips login and token acquisition |

## Finding Your Dashboard ID

- Open a dashboard in Superset
- The URL contains: `/superset/dashboard/1/` — `1` is the dashboard ID
- Or use the API: `GET /api/v1/dashboard/` to list dashboards

## Troubleshooting

- **CORS errors**: Serve the tool from the same domain as Superset (e.g., behind nginx), or configure CORS on Superset
- **Mixed content**: If Superset is served over HTTPS, the tool must also be served over HTTPS
- **Guest token expiration**: Default is 5 minutes (`GUEST_TOKEN_JWT_EXP_SECONDS`). The SDK handles automatic refresh.
- **Dashboard not found (404)**: Verify the dashboard ID exists and embedding is enabled
- **403 Forbidden**: Ensure the user has `can_grant_guest_token` permission

## License

Apache License 2.0
