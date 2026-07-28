# CRM v4 E2E harness

The default suite is deliberately read-only. It covers the public auth shell,
dual-theme rendering, responsive viewports, reduced motion and the pure staging
guard. Mutable journeys remain absent until a separate Supabase project has an
audited schema baseline, staging-only Auth users and deterministic fixtures.

Before any mutable test or seed, run:

```bash
pnpm test:e2e:guard
```

The command fails unless the configured Supabase origin matches the exact
staging project ref, differs from production, `VERCEL_ENV` is non-production,
mutations are explicitly enabled and a staging-only database marker is found
through a read-only query.

Visual baselines are generated intentionally and reviewed in Git. Never update
snapshots merely to make an unexplained difference pass.
