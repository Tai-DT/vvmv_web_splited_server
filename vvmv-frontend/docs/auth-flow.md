# Authentication and session handling

## Overview

The app uses **[Better Auth](https://www.better-auth.com/)** on the server (`better-auth/next-js` `toNextJsHandler`) with a React client wrapper (`@/lib/auth-client`: `useSession`, `authClient`). Session state is exposed over HTTP under **`/api/auth/*`** (library-defined paths such as `get-session`, sign-in, sign-out).

---

## `/api/auth` route

**File:** `app/api/auth/[...all]/route.ts`

- Imports **`auth`** from `@/lib/auth` (Better Auth server instance; lives next to other server helpers under `lib/` per project conventions).
- Wraps **`GET`** so that failures on the **session read** path are handled softly:
  - **`isAuthGetSessionPath(pathname)`** (from `@/lib/auth-session`) detects Better Auth’s GET session endpoint (e.g. `/api/auth/get-session` — see `test/auth-session.test.ts`).
  - On that path, if the handler throws, **`logOptionalSessionFailure`** runs and the route returns **`200` with JSON `null`** instead of propagating the error. Unauthenticated clients therefore get “no session” without a hard 500 on transient failures.
- **`POST`** is delegated unchanged to Better Auth (sign-in, callbacks, etc.).

---

## `@/lib/auth-session`

Used alongside `@/lib/auth` for server-side ergonomics:

- **`isAuthGetSessionPath`** — matches the Better Auth get-session URL (used by the route wrapper above).
- **`getOptionalAuthSession`** — tests show this helper calling **`auth.api.getSession`** and returning **`null`** on failure (optional reads for APIs that must not crash). **`logOptionalSessionFailure`** is used when the auth route catches errors on the get-session path.

---

## Server-side authorization on API routes

Typical internal APIs resolve the caller with Better Auth:

```ts
const session = await auth.api.getSession({ headers: request.headers });
if (!session?.user) {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}
```

Example: `app/api/followup/route.ts` (session → role/site/department checks follow).

**Vendor portal** uses a **separate** mechanism: `app/api/external/vendor-portal/login/route.ts` sets a vendor cookie via `@/lib/vendor-portal-auth` (not the Better Auth session). The login page can fall back to this flow after username/password fails against Better Auth.

---

## Client-side session (`@/lib/auth-client`)

- **`useSession()`** — used across `(home)` pages and components for role/site-aware UI.
- **`authClient.signIn.social`** / **`authClient.signIn.username`** — login page (`app/login/page.tsx`): Google OAuth or username/password; success often navigates to **`/settings`**. Failed internal login may try **`/api/external/vendor-portal/login`** and route to **`/vendor-portal`**.

---

## Middleware

There is **no `middleware.ts`** at the `vvmv-frontend` root in this tree. Auth is **not** enforced globally at the edge; behavior is **per-route** (API handlers and client pages).

---

## Protecting `(home)` and internal UI

The **`app/(home)/layout.tsx`** route group provides shell UI only (sidebar, header, query provider). It does **not** check session or redirect.

Protection patterns in practice:

1. **Client pages** — e.g. **`app/(home)/settings/page.tsx`**: `useSession()` + `useEffect` → if not pending and no session, **`router.push("/login")`**; loading spinner while pending; render `null` if unauthenticated.
2. **Other `(home)` pages** — often rely on **`useSession()`** in child components for permissions/display; critical enforcement still belongs on **API** routes (401 without session).
3. **Onboarding** — e.g. **`app/onboarding/select-site/page.tsx`** redirects away when there is no **`session.user`**.
4. **Public marketing** — **`app/(public)/page.tsx`** uses `useSession()` for conditional marketing vs. logged-in hints.

**Summary:** `(home)` is “internal chrome”; **authorization is enforced in route handlers** and **selected pages** that redirect unauthenticated users—not by the `(home)` layout itself.

---

## Split backend (`vvmv-backend`)

The monorepo includes **`vvmv-backend/`** (NestJS). For routes that have been wired for delegation, setting **`BACKEND_URL`** (or legacy **`API_URL`**) on `vvmv-frontend` points Next’s `/api/*` handler at that server; it typically **`fetch`es** the Nest URL and **forwards `Cookie`** so the Better Auth session still applies when the browser hits same-origin `/api/...`. **`/api/auth/*`** stays on Next/Better Auth until there is an explicit unified auth story for Nest. Environment layout, caveats, and the migration plan live in [`split-backend.md`](./split-backend.md) and [`frontend-backend.md`](./frontend-backend.md).

---

## Related paths

| Area | Role |
|------|------|
| `app/login/page.tsx` | Primary login; vendor portal fallback. |
| `app/api/auth/error/page.tsx` | Client redirect toward login with error query. |
| `app/access-denied/page.tsx` | Access denied UX. |
| `app/api/external/vendor-portal/session/route.ts` | Vendor portal session probe (parallel to Better Auth). |
