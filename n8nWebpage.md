# Prompt: Build a Dockerized Gaming News Admin Dashboard

## 1. Project Overview

Build a production-ready Admin Dashboard for managing gaming news articles stored in an existing PostgreSQL database used by n8n.

The application must be developed locally, pushed to Git, pulled onto a private server, configured through environment variables, and deployed using Docker Compose.

**Primary objective:** Display and manage existing records in the `articles` table. The database is the source of truth.

Do not create mock data, seed data, duplicate tables, or a new database schema.

## 2. Technology Stack

- Next.js with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui for UI components
- PostgreSQL using `pg` (node-postgres)
- Docker and Docker Compose
- Zod for validating API inputs where appropriate

Use server-side database access. Never expose database credentials or connect to PostgreSQL directly from the browser.

## 3. Existing Database

The PostgreSQL database already exists and is used by n8n.

The existing `articles` table contains the following columns:

| Column | Purpose |
|---|---|
| `id` | Article identifier |
| `url_hash` | URL deduplication hash |
| `canonical_url` | Canonical article URL |
| `title` | Original article title |
| `content` | Original article content |
| `creator` | Article creator or author |
| `pub_date` | Publication date |
| `fetched_at` | Time the article was fetched |
| `status` | Processing pipeline status |
| `mode` | Processing or source mode |
| `language` | Article language |
| `region` | Source region |
| `raw_url` | Original source URL |
| `ai_title` | AI-generated title |
| `ai_full_summary` | AI-generated full summary |
| `ai_short_summary_2_sentences` | AI-generated two-sentence summary |
| `do_status` | Human review status |

Expected `do_status` values are `undone`, `done`, and `skip`.

Important requirements:

1. Use the existing database and `articles` table.
2. Do not run migrations or create, rename, drop, or alter tables or columns.
3. Do not assume the exact data types, nullability, primary key definition, constraints, or indexes without inspecting the existing schema.
4. Inspect the existing schema when possible. If database access is unavailable during development, implement against the supplied column names and document any assumptions.
5. Existing records must be displayed even if `do_status` is NULL or contains an unexpected value.
6. NULL `do_status` may be displayed as `undone` for presentation purposes, but do not silently update the database. Persist a value only when the user explicitly selects a status.
7. Never fabricate articles or fallback data when a query fails. Display an appropriate error message instead.

## 4. Main Page: `/admin/articles`

Create a clean, responsive dashboard with an article table.

### Table columns

Display the following columns in this order:

1. `id`
2. Title
3. `pub_date`
4. `status`
5. `do_status`
6. Actions or a detail link if needed

For the displayed title, use:

`COALESCE(ai_title, title)`

If both are NULL or empty, display a neutral placeholder.

The title should link to an article detail page.

Format dates consistently using the configured timezone. Handle NULL dates gracefully.

### Human review status controls

Render `do_status` as an interactive control with these three options:

- `undone`
- `done`
- `skip`

A segmented control, dropdown, or compact button group is acceptable.

When the user selects a status:

1. Send a request to the server API.
2. Validate the requested status against the allowed values.
3. Update only the selected article's `do_status`.
4. Return the updated status.
5. Update the UI after a successful response.
6. Show a loading state while saving.
7. Show a success or error notification.
8. Restore the previous UI state if the update fails.

Do not update `status` when changing `do_status`. They represent different workflows.

Do not silently change `do_status` when displaying the table or applying filters.

## 5. Filters and Search

Provide a filter toolbar above the table.

### Required filters

- `status`: dynamically load distinct values from the database.
- `do_status`: `all`, `undone`, `done`, `skip`, and NULL if present.
- `mode`: dynamically load distinct values from the database.
- `language`: dynamically load distinct values from the database.
- `region`: dynamically load distinct values from the database.
- Publication date range: from and to dates.
- Search: search article titles and, where practical, original titles and URLs.

Requirements:

1. Use actual values from the database instead of hardcoded lists for database-driven fields.
2. The three valid human review statuses may be defined as application constants.
3. Include an `All` option for each filter.
4. Handle NULL and empty values appropriately.
5. Combine multiple filters correctly.
6. Apply filters on the server side.
7. Use parameterized SQL queries. Never concatenate user input into SQL.
8. Reset filters to their default state.
9. Reflect filters in URL query parameters where practical so that the view can be bookmarked or refreshed.

## 6. Sorting and Pagination

Implement server-side pagination and sorting.

- Default sort: `pub_date DESC NULLS LAST`, then `id DESC` where supported by the actual schema.
- Page size options: 10, 25, 50, and 100.
- Display total matching records.
- Provide previous and next page controls.
- Allow sorting by appropriate table columns.
- Whitelist sortable SQL column names. Never insert arbitrary user-supplied sort expressions into SQL.
- Keep filters and sorting when changing pages.

Do not fetch the entire table into the browser just to paginate it.

## 7. Article Detail Page

Create `/admin/articles/[id]`.

Display all existing article fields where available:

- `id`
- `url_hash`
- `canonical_url`
- `title`
- `content`
- `creator`
- `pub_date`
- `fetched_at`
- `status`
- `mode`
- `language`
- `region`
- `raw_url`
- `ai_title`
- `ai_full_summary`
- `ai_short_summary_2_sentences`
- `do_status`

Use readable formatting for long content and summaries.

Make `canonical_url` and `raw_url` clickable external links with safe link attributes.

Allow the user to change `do_status` using the same API and validation as the main table.

Provide a back button that preserves the previous list's filters and pagination when possible.

Return a proper not-found response when the article does not exist.

## 8. API Requirements

Implement server-side API routes.

### `GET /api/articles`

Support:

- `page`
- `pageSize`
- `search`
- `status`
- `do_status`
- `mode`
- `language`
- `region`
- `dateFrom`
- `dateTo`
- `sortBy`
- `sortOrder`

Return a response containing:

- `items`: article rows
- `page`
- `pageSize`
- `total`
- `totalPages`

Use a separate count query or another correct method to calculate the total number of matching records.

### `GET /api/articles/filters`

Return distinct filter values from the existing database for:

- `status`
- `mode`
- `language`
- `region`

Exclude or handle NULL values appropriately, and ensure the UI can still represent missing values.

### `GET /api/articles/[id]`

Return the existing article record for the requested ID.

### `PATCH /api/articles/[id]`

Update only `do_status`.

Example request:

`{"do_status":"done"}`

Validate the identifier and request body. Reject unsupported statuses. Return the updated record or an appropriate HTTP error.

Do not implement endpoints that create or delete articles unless explicitly requested.

## 9. Database Access and Security

- Create a reusable PostgreSQL connection pool in `lib/db.ts`.
- Use environment variables for database configuration.
- Keep all SQL execution on the server.
- Use parameterized SQL queries for values.
- Whitelist dynamic sort columns and sort directions.
- Handle connection errors and query errors without leaking credentials or SQL secrets.
- Use a dedicated PostgreSQL user for the dashboard in production, with only the required read and update permissions on `articles`.
- Do not use the n8n database owner credentials for the dashboard in production if a restricted account can be created.
- Do not expose the PostgreSQL port publicly.
- Protect `/admin/*` and its APIs with authentication before exposing them publicly. Use a secure session or another appropriate server-side authentication mechanism.
- Protect state-changing requests against CSRF where applicable.
- Never store passwords, tokens, or database credentials in source code.
- Add `.env*` to `.gitignore`, while retaining a safe `.env.example` with placeholder values.

If authentication is not implemented in the first iteration, clearly document that the application is not ready for public exposure. Do not claim that the application is production-secure without implementing and testing its protections.

## 10. Docker Requirements

Create a production Dockerfile for Next.js.

Requirements:

- Use a supported Node.js LTS image.
- Use multi-stage builds where appropriate.
- Install production dependencies correctly.
- Run as a non-root user.
- Expose the Next.js application on port `3000`.
- Use `npm run build` during the image build.
- Start the application with `npm run start`.
- Add `.dockerignore`.
- Do not copy `.env` or other secrets into the image.
- Do not require Node.js to be installed on the production server.
- Ensure the application binds to `0.0.0.0` inside the container.

### Docker Compose integration

The existing server already has a `compose.yaml` containing:

- `traefik`
- `postgres`
- `n8n`
- Named volumes for PostgreSQL, n8n, and Traefik

Add the dashboard as a new service in the existing Compose file. Do not replace or recreate the existing services unnecessarily.

The dashboard must:

- Build from `./dashboard`.
- Connect to the existing PostgreSQL service using hostname `postgres` and port `5432`.
- Use the existing `${DB_NAME}` database unless a separate database name is explicitly configured.
- Use environment variables for all configuration.
- Not publish PostgreSQL's port.
- Be reachable through the existing Docker network.
- Support deployment behind Traefik using environment-configurable hostname and the existing TLS certificate resolver.

Use the following configuration conceptually, adapting it to the actual existing Compose file:

- `DASHBOARD_SUBDOMAIN`
- `DOMAIN_NAME`
- `DATABASE_URL` or separate database connection variables
- `GENERIC_TIMEZONE`

Do not hardcode the actual production domain.

If the user chooses a dedicated port instead of Traefik, support an optional configurable host port. Do not expose it by default if Traefik is used.

Important: URL-encode database credentials if building a connection string containing special characters. Prefer separate connection settings or a robust URL-construction method so passwords containing special characters do not break the connection.

Do not change the existing PostgreSQL volume, database credentials, or n8n database configuration.

## 11. Environment Configuration

Provide `.env.example` with placeholder values only.

Include all variables needed for:

- Existing PostgreSQL connection
- Dashboard PostgreSQL connection
- Dashboard hostname
- Domain name
- Timezone
- Authentication secrets, if applicable

The production `.env` must remain on the server and must not be committed to Git.

Document exactly which environment variables must be added or modified on the server.

If database permissions require a one-time setup, provide explicit SQL commands separately. Do not automatically change database privileges during application startup.

## 12. Deployment Workflow

Provide copy-ready commands and documentation for this workflow:

### Local development

1. Install dependencies.
2. Configure local environment variables.
3. Run the app locally.
4. Test database connectivity.
5. Test filters, pagination, article details, and status updates.
6. Build the production Docker image.
7. Push the source code to Git.

### Server deployment

1. Pull the latest source code.
2. Update the server-side `.env`.
3. Build and start only the dashboard service where possible:

`docker compose up -d --build dashboard`

4. Check status:

`docker compose ps`

5. Check logs:

`docker compose logs -f dashboard`

6. Verify the website, database queries, filters, pagination, and status updates.

Do not instruct the user to delete Docker volumes or reset PostgreSQL data.

## 13. UI Design

Build a clean, modern admin interface suitable for monitoring gaming news.

- Responsive layout for desktop and mobile.
- Clear typography and spacing.
- Compact filter toolbar.
- Readable data table.
- Status badges for `status`.
- Clearly distinguish processing status from human review status.
- Loading skeletons or loading indicators.
- Empty state when there are no matching records.
- Error state when database access fails.
- Confirmation or notification when changing review status.
- Avoid unnecessary animations and decorative UI.
- Do not add charts or statistics unless they can be derived from real database data and provide meaningful value.

## 14. Implementation Rules

- Generate a complete, runnable project, not just illustrative snippets.
- Do not hardcode sample articles, filter values, production domains, database credentials, or article counts.
- Derive records and database-driven filter values from the existing database.
- Do not create a new PostgreSQL instance or database for the dashboard.
- Do not create or alter the `articles` schema.
- Do not change n8n's processing workflow or its existing data.
- Do not silently swallow errors.
- Keep database logic separate from UI components.
- Use TypeScript types for database records and API responses.
- Validate all inputs on the server.
- Include a README with setup, environment variables, Docker deployment, security, and troubleshooting instructions.

## 15. Acceptance Criteria

The project is complete only when:

1. It runs locally.
2. It builds successfully as a Docker image.
3. It connects to the existing PostgreSQL database.
4. It displays actual records from `articles`.
5. The main table displays `id`, effective title, `pub_date`, `status`, and `do_status`.
6. Filters use actual database values.
7. Search, sorting, and pagination work on the server.
8. Article detail pages show existing record fields.
9. Updating `do_status` changes only that field and persists to PostgreSQL.
10. NULL and unexpected values do not cause the page to crash.
11. The existing n8n and PostgreSQL configuration remains intact.
12. The application can be deployed on a server by pulling the source, configuring environment variables, and running Docker Compose.
13. No secrets are committed to Git or embedded in the Docker image.
14. Authentication and access protection are implemented before public production use.

Start by generating the complete project structure and implementation files. Explain any assumptions about the existing PostgreSQL schema. Do not stop at a plan or provide pseudocode when executable code is expected.

## 16. News Freshness Indicator

Add a news freshness indicator to the articles table to show how recently each article was published relative to the current time.

### Requirements

- Add a `Freshness` column to the articles table.
- Calculate freshness dynamically using `pub_date` and the current time.
- Do not store the freshness value in PostgreSQL.
- Do not hardcode the current date or time.
- Use the actual current time at runtime, with the configured timezone for display.
- Handle missing or invalid `pub_date` values gracefully.

### Suggested display rules

Use human-readable labels such as:

- Just now
- 5 minutes ago
- 2 hours ago
- 1 day ago
- 3 days ago
- 2 weeks ago

Also show the exact publication date and time in a tooltip or secondary text.

Use appropriate visual indicators to make recent and older news easy to distinguish. For example:

- Very recent: within 1 hour
- Recent: within 24 hours
- Older: more than 24 hours
- Unknown: missing or invalid publication date

These thresholds must be configurable in one place rather than duplicated throughout the UI.

### Important behavior

- Recalculate the displayed relative time periodically while the page remains open, without requiring a manual refresh.
- Ensure the calculation uses the current time, not `fetched_at`.
- Display the distinction between publication time (`pub_date`) and ingestion time (`fetched_at`) where useful.
- Handle future publication dates explicitly, for example by displaying `Scheduled` or `In the future`.
- Use the server-side database query for filtering and sorting by actual `pub_date`; do not attempt to sort articles by their rendered relative-time labels.

## 17. Local Mock Data vs Production Database

The application must support two separate data sources:

1. **Local development:** use mock articles so the UI can be developed and tested without connecting to the production PostgreSQL database.
2. **Production server:** use the real PostgreSQL database already used by n8n. Never use mock data in production.

### Environment configuration

Use an explicit environment variable such as:

`DATA_SOURCE=mock`

for local development, and:

`DATA_SOURCE=postgres`

for production.

Add these settings to `.env.example` with safe placeholder values. Provide separate local and production environment examples if needed.

### Local development requirements

- The local environment may use a mock data provider.
- Include realistic mock records covering different `status`, `do_status`, `mode`, `language`, `region`, and publication dates.
- Include records with NULL values where appropriate.
- Include recent, old, future-dated, and missing publication dates to test the freshness indicator.
- Mock data must be isolated in a dedicated module, such as `lib/data/mock-articles.ts`.
- The mock provider must implement the same interface as the PostgreSQL provider so the UI and API do not need separate implementations.
- All filters, search, sorting, pagination, article detail pages, and status updates must work in mock mode.
- Changes made in mock mode only affect the in-memory or local mock data. They must never connect to or modify the production database.

### Production requirements

- Configure the server-side production environment with `DATA_SOURCE=postgres`.
- Use the real `DATABASE_URL` and the existing PostgreSQL service at `postgres:5432`.
- Read existing records from the existing `articles` table.
- Update `do_status` in the real database when the user changes it.
- Never fall back to mock data if PostgreSQL is unavailable, a query fails, or the connection string is missing.
- If production database access fails, display a clear error and log the failure safely. Do not display fabricated records.
- Validate the selected data source on the server. Reject unsupported values.
- Do not expose `DATA_SOURCE`, database credentials, or internal connection details unnecessarily to the browser.

### Fail-safe configuration

- Use `DATA_SOURCE=mock` only for local development.
- Use `DATA_SOURCE=postgres` for production.
- The Docker production image must default to PostgreSQL mode, or fail startup if the data source is not explicitly configured.
- Add a production safety check so that `NODE_ENV=production` and `DATA_SOURCE=mock` cannot run together.
- Do not copy local `.env` files or mock-specific secrets into the production image.
- Do not include mock records in the production PostgreSQL database.
- Keep all mock data in code or dedicated local fixtures, never in the production database.

### Architecture

Create a shared data access interface, for example:

- `lib/data/article-provider.ts`
- `lib/data/mock-article-provider.ts`
- `lib/data/postgres-article-provider.ts`

Select the provider on the server using the validated environment configuration.

The API routes, filtering logic, and UI should use the provider interface rather than importing mock data or querying PostgreSQL directly from components.

### Acceptance criteria

1. The dashboard runs locally without a PostgreSQL connection when configured for mock mode.
2. All table interactions and filters work with mock data.
3. The freshness indicator works with both mock and real article records.
4. Production Docker deployment uses the real PostgreSQL database.
5. Production never silently falls back to mock data.
6. Changing `do_status` in production persists to the existing database.
7. Changing `do_status` in mock mode does not affect any external database.
8. Deploying the application does not require changing source code; only the appropriate environment configuration is needed.
9. The existing n8n services, PostgreSQL volume, and database schema remain unchanged.