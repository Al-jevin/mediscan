# Public Deployment and Integration Plan

This plan is for the later transition from local-only development to a publicly reachable MediScan deployment. Keep the current localhost configuration unchanged until this work begins.

## 1. Audit the integration

- Confirm every frontend feature uses the intended backend route:
  - Registration and existing-account detection
  - Email verification and resend-code flow
  - Login, logout, and session expiry
  - Profile creation, listing, editing, and deletion
  - OCR image upload and result mapping
  - Vault list, create, update, and delete
- Remove accidental mock behavior from live API paths.
- Verify loading, validation, authentication, and server-error states.
- Test the complete flows against a configured backend and database.

## 2. Separate deployment configuration

- Keep local values in local `.env` files.
- Add or update example environment files containing placeholders only.
- Configure the frontend API URL through `EXPO_PUBLIC_API_URL`.
- Configure the backend host, port, database URL, CORS origins, and feature flags through environment variables.
- Never commit database, SMTP, JWT, or other credentials.

## 3. Prepare the backend

- Bind the deployed server to `0.0.0.0` only in the deployment command or service configuration.
- Keep local development bound to `127.0.0.1`.
- Use HTTPS through a reverse proxy or managed platform.
- Restrict CORS to the actual deployed frontend origins.
- Disable the local CRUD workbench in production.
- Configure production database migrations/schema and backups.
- Verify Brevo sender authentication, delivery logs, rate limits, and secret rotation.

## 4. Prepare the frontend

- Point the production build to the deployed HTTPS API.
- Confirm no localhost URL is bundled into the production build.
- Test web, Android, and iOS API connectivity as applicable.
- Verify token storage, logout behavior, expired sessions, and API error messages.
- Confirm image upload limits and OCR failure handling.

## 5. Security and operations

- Use strong production secrets and rotate any credentials previously exposed during development.
- Apply firewall, platform access, database access, and rate-limit controls.
- Add structured logging without recording passwords, tokens, verification codes, or SMTP credentials.
- Monitor API health, email delivery, database errors, OCR failures, and server resources.
- Define a rollback procedure and document where deployment logs are inspected.

## 6. Final acceptance checks

- Run backend tests and frontend typecheck/lint.
- Test signup through vault deletion against the deployed services.
- Verify existing-account detection and empty profiles for new accounts.
- Verify CORS, HTTPS, authentication, email delivery, and database ownership boundaries.
- Update `README.md` with the final deployment commands and public URLs.
