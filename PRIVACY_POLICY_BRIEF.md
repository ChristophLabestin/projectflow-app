# ProjectFlow privacy policy drafting brief

This file lists product features, data flows, and policy answers based on the current codebase.
Use it as source input for a formal privacy policy. Fill in the TODOs with your legal entity details.

## Product scope (features and data touchpoints)
- Workspaces and multi project dashboards (user accounts, workspace membership, roles)
- Flow pipelines with AI assisted ideation and approvals (flow content, decisions, activity logs)
- Tasks, issues, milestones, comments, and activity logs (work content, assignees, timestamps)
- Project health scoring and recommendations (derived analytics on project data)
- AI Studio (blueprints, brainstorming, risk analysis) using Google Gemini
- Social Studio (campaigns, posts, approvals, scheduling, assets, presets)
- Marketing suite (paid ads, email campaigns, recipient lists, templates)
- Drag and drop email builder (content blocks and templates)
- Media library for uploads (file storage)
- Mind map for visual planning (idea data)
- Help center and onboarding tours (user preferences and progress)
- Global search with AI answers across workspace content
- Integrations: GitHub issues sync, Facebook/Instagram for social publishing
- Passkey support (WebAuthn credentials via Firebase Functions)
- Optional public site features: newsletter and waitlist signup, blog API, image editing via Vertex AI

## Direct answers to privacy policy questions
1) What personal data is collected?
- Account data: email, display name, profile photo URL, user ID (Firebase Auth).
- Authentication data: hashed credentials (managed by Firebase), OAuth provider IDs, MFA/TOTP status, passkey credential IDs.
- Workspace data: role, group membership, invites, activity actions.
- Content data: projects, tasks, issues, comments, milestones, flows, mind maps, campaigns, posts, reports.
- Social/marketing data: campaign strategy, scheduled posts, asset metadata, recipient emails, ad campaign details.
- Integration data: GitHub access token (if linked), Facebook/Instagram access token, social account IDs.
- AI usage data: token counts, image usage, usage timestamps.
- Preferences: language, date format, theme, onboarding status.
- Technical data: IP address and user agent in server logs (Firebase Hosting/Functions); passkey registration captures user agent, platform, and language.

2) Cookies or tracking technologies?
- Local storage is used for theme, language, date format, and tenant selection.
- Firebase Auth stores session state (typically local storage/IndexedDB, and may use cookies depending on config).
- No explicit analytics or tracking cookies are initialized in the codebase. If analytics are added, update this section.

3) Third party services used
- Google Firebase: Authentication, Firestore database, Storage, Cloud Functions, Hosting.
- Google Gemini API via @google/genai (AI Studio, AI search, AI writing).
- Google Vertex AI (Imagen) for image editing (server side function).
- GitHub REST API for issue sync and repository data.
- Facebook/Instagram Graph API for social account linking and publishing.
- SMTP provider for newsletters/waitlist emails (configured via environment variables).

4) Data controller (legal entity)
- TODO: Provide company legal name and address.
- If acting as a processor for workspace owners, clarify controller/processor roles.

5) Purpose of processing
- Account creation, authentication, and security (login, MFA, passkeys).
- Workspace collaboration and permissions management.
- Project and task management, activity tracking, and reporting.
- AI features (generation, analysis, search, content suggestions).
- Social and marketing campaign planning, approvals, scheduling, and publishing.
- File storage for project and marketing assets.
- Notifications and user communications (in app).
- Optional: newsletter/waitlist operations and blog publishing.

6) Account creation and login methods
- Email/password (Firebase Auth).
- OAuth: Google and GitHub sign in.
- Passkeys (WebAuthn) via Firebase Functions custom token.
- Facebook auth for social account linking.
- MFA/TOTP supported for additional security.

7) Where data is stored
- Firestore database location: eur3 (EU multi region) per `firebase.json`.
- Cloud Functions region: europe-west3.
- Storage bucket region is not declared in repo; confirm in Firebase console.
- AI requests are sent to Google (Gemini/Vertex AI) per configured regions.

8) Who has access to data
- Authorized workspace members based on roles and permissions.
- Workspace owners/admins with elevated access.
- ProjectFlow administrators (if applicable) for support and maintenance.
- Service providers (Firebase/Google, GitHub, Meta) as required to deliver features.

9) Data retention
- No explicit retention policy in code; data remains until user deletes it or workspace is removed.
- AI usage counters reset monthly but historical usage data may remain.
- Passkey credentials remain until user removes them.
- Newsletter/waitlist records are stored until deleted.
- TODO: Define formal retention periods and deletion workflows.

## Feature to data map (privacy policy detail)
- Authentication: email, password hash (Firebase), OAuth provider IDs, passkey credentials.
- Profiles and preferences: display name, photo, language, date format, theme.
- Work management: tasks, issues, milestones, comments, assignments, due dates.
- Flows: ideation content, stages, approvals, AI generated content.
- Social Studio: campaign strategy, KPIs, post content, scheduling, platform metadata.
- Marketing: ad campaigns, email templates, recipient emails, send history metadata.
- Integrations: access tokens and platform IDs for GitHub/Meta.
- Files: uploaded assets stored in Firebase Storage.
- Analytics and health: derived project health scores and risk insights.

## Open items to confirm
- Legal entity name and address (controller).
- Storage bucket region and hosting log retention.
- Whether Firebase Analytics or other trackers are enabled in production.
- Data retention timelines and deletion SLAs.
- Whether AI content is stored or only generated transiently.
