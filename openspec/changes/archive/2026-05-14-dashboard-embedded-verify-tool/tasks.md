## 1. Scaffold tool directory

- [x] 1.1 Create `docs/embedded-verify-tool/` directory
- [x] 1.2 Create `docs/embedded-verify-tool/README.md` with tool overview and usage instructions

## 2. Build HTML page structure and styling

- [x] 2.1 Create `docs/embedded-verify-tool/embedded-verify.html` with the basic HTML5 document structure
- [x] 2.2 Add inline CSS for the configuration form, status panel, and mount point area
- [x] 2.3 Add responsive layout that works on desktop and mobile
- [x] 2.4 Implement mode toggle between "Username/Password" (Mode A) and "Guest Token" (Mode B)
- [x] 2.5 Build the configuration form with inputs: Superset URL, auth fields (conditional), dashboard UUID/ID
- [x] 2.6 Add "Start Verification" button with loading state

## 3. Implement SDK loading from CDN

- [x] 3.1 Add `<script type="module">` tag importing `@superset-ui/embedded-sdk` from esm.sh
- [x] 3.2 Add SDK load verification with fallback error display
- [x] 3.3 Display clear error if CDN is unreachable

## 4. Implement three-stage progress UI

- [x] 4.1 Create status display area with four stages: Authentication, Embed Configuration, Guest Token, Embed
- [x] 4.2 Each stage shows state: WAITING (gray), IN PROGRESS (animated), PASS (green), FAIL (red)
- [x] 4.3 Implement sequential flow: each stage waits for the previous to pass
- [x] 4.4 Add error detail section per failed stage

## 5. Implement Mode A — password-based authentication flow

- [x] 5.1 Implement `POST {supersetUrl}/api/v1/security/login` with username/password/refresh/provider
- [x] 5.2 Handle successful response: store JWT access token, update stage to PASS
- [x] 5.3 Handle error responses: 401 (bad credentials), 403, network errors, update stage to FAIL
- [x] 5.4 Handle CORS errors with a clear explanation and suggested fix

## 6. Implement guest token acquisition

- [x] 6.1 Implement `POST {supersetUrl}/api/v1/security/guest_token/` with `Authorization: Bearer <token>` header
- [x] 6.2 Build request body with dashboard resource and user context
- [x] 6.3 Handle successful response: decode JWT payload, display it, store raw token
- [x] 6.4 Handle error responses: 404 (dashboard not found), 403 (not authorized), update stage to FAIL

## 7. Implement Mode B — direct guest token

- [x] 7.1 Skip authentication and guest token stages when Mode B is selected
- [x] 7.2 Accept raw guest token string as input
- [x] 7.3 Decode and display the guest token JWT payload for verification
- [x] 7.4 Proceed directly to the SDK embed stage

## 8. Implement SDK dashboard embedding

- [x] 8.1 Create a mount point DOM element for the embedded dashboard
- [x] 8.2 Call `embedDashboard()` with the correct parameters (id, supersetDomain, mountPoint, fetchGuestToken, dashboardUiConfig)
- [x] 8.3 Handle successful embed: show "Embed: PASS", display the rendered iframe
- [x] 8.4 Handle SDK errors: show "Embed: FAIL" with error details

## 9. Add inline documentation and troubleshooting

- [x] 9.1 Add collapsible "Help & Troubleshooting" section at the top of the tool
- [x] 9.2 Document prerequisites (embedding enabled, dashboard configured with allowed domains)
- [x] 9.3 Document CORS configuration requirements
- [x] 9.4 Document mixed content and HTTPS requirements
- [x] 9.5 Document guest token expiration and `GUEST_TOKEN_JWT_EXP_SECONDS` configuration
- [x] 9.6 Document how to check if a dashboard has embedding configured

## 10. Test and verify the tool

- [ ] 10.1 Manually test against a local Superset instance with embedding enabled
- [ ] 10.2 Verify Mode A flow (login → guest token → embed) end-to-end
- [ ] 10.3 Verify Mode B flow (direct guest token → embed)
- [ ] 10.4 Verify error states: bad credentials, wrong dashboard ID, CORS misconfiguration
- [ ] 10.5 Verify the tool works when served via `python -m http.server` (same-origin mode)
- [ ] 10.6 Verify the tool works when opened as a local file (with CORS-proxied Superset)
