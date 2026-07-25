<div align="center">
  <picture>
    <source srcset="assets/castellan-lockup-light.svg" media="(prefers-color-scheme: light)" />
    <source srcset="assets/castellan-lockup-dark.svg" media="(prefers-color-scheme: dark)" />
    <img src="assets/castellan-lockup-dark.svg" alt="Castellan" />
  </picture>

  <p><strong>Official CLI</strong></p>

  <p>
    <img src="https://img.shields.io/badge/SemVer-2.0.0-blue" alt="SemVer" />
    <img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits" />
    <a href="https://github.com/mhweiner/autorel"><img src="https://img.shields.io/badge/%F0%9F%9A%80%20AutoRel-2D4DDE" alt="AutoRel" /></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  </p>

  <p>
    Trigger a registry check, stream rollout events, and wait until services settle —
    or fail the process when Castellan rolls back.
  </p>
</div>

# Get started

[**Castellan CLI**](https://www.npmjs.com/package/castellan-cli) is the command-line companion to [Castellan](https://github.com/logfoxai/castellan) — the compose deploy controller with health checks, rollback, and a dashboard.

Use the **dashboard** for day-to-day ops. Use this CLI in **automation** (GitHub Actions, scripts) when you need a hard gate after pushing a new image digest.

```bash
export CASTELLAN_URL=http://castellan.example:8443
export CASTELLAN_AUTH_TOKEN=…

castellan watch api-service
```

```text
🔎 Watching api-service
✓ api STABLE myorg/api-service:staging a1b2c3d4e5f6
🔄 Checking registry for updates…
✓ Check started — waiting for rollout
📥 api pulling sha256:f6e5d4…
🚀 api UPDATING a1b2c3d4e5f6 → f6e5d4c3b2a1
· waiting. UPDATING — 12s elapsed, 14m 48s left
· waiting.. UPDATING — 17s elapsed, 14m 43s left
✓ api STABLE f6e5d4c3b2a1
✅ Healthy in 42s
api a1b2c3d4e5f6 → f6e5d4c3b2a1
```

Quiet polls rewrite the `· waiting…` line in a TTY; CI logs print each heartbeat on its own line. Colors and `STATE` pills show in a real terminal / GitHub Actions log.

Castellan’s own health wait (`CASTELLAN_ROLLBACK_HEALTH_TIMEOUT_MS`, default 2m) is separate from this CLI `--timeout-ms`. Docker healthcheck `timeout` is only per probe, not the overall wait.

## Install

```bash
npm install -g castellan-cli
```

From a local checkout:

```bash
git clone https://github.com/logfoxai/castellan-cli.git && cd castellan-cli
npm install
npm link
```

## Commands

| Command | What it does |
| --- | --- |
| `watch <services…>` | Stream status/history until settle (runs `forceCheck` first by default) |
| `status [services…]` | One-shot status snapshot |
| `check` | `POST /v1/forceCheck` only — ask Castellan to check registries / roll out |

```bash
export CASTELLAN_URL=http://castellan.example:8443
export CASTELLAN_AUTH_TOKEN=…

# Force a registry check, then stream until settle
castellan watch api-service

# Watch only (something else already called check)
castellan watch api-service --no-force-check

# Multiple services
castellan watch api ingest-worker issue-worker

# Snapshot
castellan status
castellan status api-service

# Kick Castellan without waiting
castellan check
```

Service args match Castellan’s managed service **name**, or the image **repository basename** (e.g. `api-service` resolves to Castellan service `api` when that service’s repository ends in `api-service`).

### Shared options

| Flag | Env | Meaning |
| --- | --- | --- |
| `--url` | `CASTELLAN_URL` | Castellan base URL (required) |
| `--token` | `CASTELLAN_AUTH_TOKEN` | Bearer token (required) |

### `watch` options

| Flag | Default | Meaning |
| --- | --- | --- |
| `--no-force-check` | check on | Skip asking Castellan to check the registry |
| `--poll-ms` | `5000` | Poll interval |
| `--timeout-ms` | `900000` (15m) | CLI wait for rollout to settle (not Docker/Castellan health timeouts) |

### Exit codes (`watch`)

| Code | Meaning |
| --- | --- |
| `0` | Watched services settled `stable` on a new digest |
| `1` | Unreachable API, unknown service, `forceCheck` error, failed/rollback, or timeout |
| `130` | SIGINT |

### Success / failure signal

Castellan-native:

1. Capture baseline digests from `/v1/status`
2. Optionally `forceCheck`
3. Stream new `/v1/history` events and state transitions (`checking` → `updating` → `verifying` → `stable` / `rollback` / `failed`)
4. **Success** when every watched service saw deploy activity and settled `stable`/`idle` with `currentDigest ≠ baseline`
5. **Failure** on `failed` state, failure events, or rollback that ends on the baseline digest

Emits GitHub Actions annotations (`::error::`, `::notice::`) when running in Actions.

## CI example

```yaml
- name: Connect Tailscale
  uses: tailscale/github-action@v3
  with:
    oauth-client-id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
    oauth-secret: ${{ secrets.TS_OAUTH_SECRET }}
    tags: tag:ci

- name: Deploy + watch
  env:
    CASTELLAN_URL: http://castellan.prime.logfox.ai:8443
    CASTELLAN_AUTH_TOKEN: ${{ /* from Secrets Manager or env */ }}
  run: |
    deploy-compose-service api-service "$VERSION" "$PWD"
    castellan watch api-service
```

## First npm publish (maintainers)

Releases use [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) from `.github/workflows/release.yml`. There is no `NPM_TOKEN` secret.

npm cannot create a **new** package name via OIDC alone. Bootstrap once as the npm owner:

1. `npm login` and publish an initial version (or a `0.0.0` stub) so `castellan-cli` exists on the registry.
2. On [npm package access](https://www.npmjs.com/package/castellan-cli/access), add a Trusted Publisher:
   - Organization / user: `logfoxai`
   - Repository: `castellan-cli`
   - Workflow: `release.yml`
3. Re-run the Release workflow on `main` (or merge a release-triggering commit).

## Develop

```bash
npm run validate   # lint + typecheck + build + test
npm run dev        # esbuild watch
```

## License

MIT

---

<sub>Related: for ECS rollouts, see [`ecswatch`](https://github.com/logfoxai/ecswatch).</sub>
