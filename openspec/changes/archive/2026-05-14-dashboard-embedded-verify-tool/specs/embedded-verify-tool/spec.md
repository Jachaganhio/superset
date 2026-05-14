## ADDED Requirements

### Requirement: Embedded dashboard verification workflow

The tool SHALL provide a complete step-by-step verification workflow for Superset's embedded dashboard flow.

The workflow SHALL consist of three sequential stages:
1. **Authentication** — Obtain a JWT access token from `/api/v1/security/login` (Mode A) or accept a pre-existing guest token directly (Mode B)
2. **Guest Token Acquisition** — Use the access token to request a guest token from `/api/v1/security/guest_token/` with the target dashboard as the resource
3. **Dashboard Embedding** — Call `embedDashboard()` from `@superset-ui/embedded-sdk` with the guest token to render the dashboard iframe

Each stage SHALL show visual pass/fail status and the tool SHALL stop on failure with a clear error message.

#### Scenario: Full verification flow succeeds

- **WHEN** the user enters valid Superset URL, username, and password
- **AND** the dashboard is configured for embedding (has an embedded record with allowed domains)
- **THEN** stage 1 SHALL show "Authentication: PASS"
- **AND** stage 2 SHALL show "Guest Token: PASS" with the token payload visible
- **AND** stage 3 SHALL render the embedded dashboard iframe inside the tool

#### Scenario: Flow stops at authentication failure

- **WHEN** the user enters invalid credentials
- **THEN** stage 1 SHALL show "Authentication: FAIL" with the HTTP error details
- **AND** stages 2 and 3 SHALL remain in "WAITING" state
- **AND** the tool SHALL NOT attempt to call guest token or SDK APIs

#### Scenario: Flow stops at guest token failure

- **WHEN** authentication succeeds but the dashboard ID does not exist or is not embedded
- **THEN** stage 2 SHALL show "Guest Token: FAIL" with the error details (404 or 403)
- **AND** stage 3 SHALL remain in "WAITING" state

### Requirement: Authentication Mode A — password-based login

The tool SHALL support authenticating via `POST /api/v1/security/login` with username and password.

The request body SHALL be `{"username": "...", "password": "...", "refresh": true, "provider": "db"}`.

On success, the tool SHALL store the returned JWT access token for use in the guest token request.

#### Scenario: Login form input

- **WHEN** the user selects "Username/Password" mode
- **THEN** the form SHALL show input fields for: Superset URL, username, password, and dashboard UUID/ID
- **AND** a "Start Verification" button SHALL be present

#### Scenario: Login API call

- **WHEN** the user clicks "Start Verification"
- **THEN** the tool SHALL POST to `{supersetUrl}/api/v1/security/login` with the credentials
- **AND** display progress for the authentication step

### Requirement: Authentication Mode B — direct guest token

The tool SHALL support accepting a pre-existing guest token directly, skipping the login and guest token acquisition steps.

When this mode is selected, the tool SHALL proceed directly to the dashboard embedding step.

#### Scenario: Direct token input

- **WHEN** the user selects "Guest Token" mode
- **THEN** the form SHALL show input fields for: Superset URL, guest token string, and dashboard UUID/ID
- **AND** the "Start Verification" button SHALL proceed directly to the SDK embed step

### Requirement: Guest token acquisition

The tool SHALL call `POST /api/v1/security/guest_token/` with the JWT access token in the `Authorization: Bearer <token>` header.

The request body SHALL include the dashboard resource:
```json
{
  "user": {"username": "embedded_verify"},
  "resources": [{"type": "dashboard", "id": "<dashboard_uuid_or_id>"}],
  "rls_rules": []
}
```

On success, the tool SHALL display the guest token payload (decoded) and pass the token to the SDK.

#### Scenario: Guest token request with auth header

- **WHEN** the authentication step succeeds
- **THEN** the tool SHALL POST to `{supersetUrl}/api/v1/security/guest_token/` with `Authorization: Bearer {accessToken}`
- **AND** include the dashboard resource in the request body

#### Scenario: Guest token received

- **WHEN** the guest token API returns 200 with a JWT string
- **THEN** the tool SHALL decode and display the JWT payload (user, resources, rls_rules, exp, iat)
- **AND** pass the raw JWT string to `embedDashboard()`

### Requirement: SDK dashboard embedding

The tool SHALL use `@superset-ui/embedded-sdk`'s `embedDashboard()` function to render the dashboard.

The embed call SHALL use:
- `id`: The dashboard UUID from the embedded record
- `supersetDomain`: The Superset URL provided by the user
- `mountPoint`: A DOM element created by the tool
- `fetchGuestToken`: A function that returns the acquired guest token
- `dashboardUiConfig`: Optional UI configuration

#### Scenario: Dashboard renders in tool

- **WHEN** the guest token is successfully acquired
- **THEN** the tool SHALL call `embedDashboard()` with the correct parameters
- **AND** render the dashboard iframe inside the tool's mount point area
- **AND** show "Embed: PASS" status

#### Scenario: Dashboard embed failure

- **WHEN** the SDK's `embedDashboard()` throws or the iframe fails to load
- **THEN** the tool SHALL show "Embed: FAIL" with the error details
- **AND** display the error message in the status area

### Requirement: Self-contained single HTML file

The tool SHALL be distributable as a single `.html` file that can be opened directly in a browser or served via any static file server.

All CSS styling SHALL be inline within the HTML file.
All JavaScript logic SHALL be inline within the HTML file.
External dependencies SHALL be loaded from a CDN via `<script type="module">` or `<script>` tags.
The tool SHALL NOT require npm install, bundler, or build step.

#### Scenario: Open directly in browser

- **WHEN** a developer opens `embedded-verify.html` in a modern browser (Chrome, Firefox, Safari, Edge)
- **THEN** the tool SHALL render the configuration form
- **AND** all functionality SHALL be available without any build step

#### Scenario: SDK loaded from CDN

- **WHEN** the tool loads in a browser with internet access
- **THEN** `@superset-ui/embedded-sdk` SHALL be loaded from esm.sh CDN
- **AND** the tool SHALL verify the SDK is loaded before attempting to call `embedDashboard()`
- **AND** show a clear error if the SDK fails to load

### Requirement: User guidance and documentation

The tool SHALL include inline documentation explaining:
- The purpose of the tool (embedded dashboard verification)
- Prerequisites (Superset with embedding enabled, dashboard configured with allowed domains)
- Configuration instructions for CORS and allowed domains
- Troubleshooting tips (CORS errors, 404, 403, token expiration)

#### Scenario: Documentation visible in tool

- **WHEN** the tool loads
- **THEN** a help section SHALL be visible (or collapsible) with setup instructions and troubleshooting guidance
