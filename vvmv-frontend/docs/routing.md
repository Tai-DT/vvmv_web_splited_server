# API routing (Next ↔ Nest)

This app serves many `/api/*` routes from **Nest** (`vvmv-backend`) when `BACKEND_URL` is set; Next rewrites strip the `/api` prefix when proxying.

## Registry

`lib/backend-registry.ts` lists paths owned by the Nest API. **Do not** register `/api/auth/*` (Better Auth stays in Next) or `/api/external/vendor-portal/*` (HMAC cookies).

Entries marked **Nest (Next fallback: Prisma RPA)** also implement `app/api/.../route.ts`: the handler tries `tryDelegateToStandaloneApi` first, then falls back to Prisma/direct DB when the standalone backend is unavailable.

## Check

```bash
pnpm run check:api-routing
```

Emits **warnings** (exit 0) for paths that appear both in the registry and as a local `route.ts` — that overlap is the intentional fallback pattern, not a misconfiguration.
