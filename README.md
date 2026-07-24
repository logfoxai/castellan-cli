# castellan-cli

[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-blue)]()
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![AutoRel](https://img.shields.io/badge/%F0%9F%9A%80%20AutoRel-2D4DDE)](https://github.com/mhweiner/autorel)

Official CLI for [Castellan](https://github.com/logfoxai/castellan).

Trigger a registry check, stream rollout events, and wait until managed services settle healthy — or fail the process when Castellan rolls back.

For day-to-day ops, use Castellan’s dashboard. Use this CLI in automation (GitHub Actions, scripts) when you need a gate after pushing a new image digest.

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

## Usage

```bash
export CASTELLAN_URL=http://castellan.example:8443
export CASTELLAN_AUTH_TOKEN=…

# Force a registry check, then stream until settle (default)
castellan-cli api-service

# Watch only (something else already called forceCheck)
castellan-cli api-service --no-force-check

# Multiple services
castellan-cli api ingest-worker issue-worker
```

Service args match Castellan’s managed service **name**, or the image **repository basename** (e.g. `api-service` resolves to Castellan service `api` when that service’s repository ends in `api-service`).

### Options

| Flag | Env | Default | Meaning |
| --- | --- | --- | --- |
| `--url` | `CASTELLAN_URL` | required | Castellan base URL |
| `--token` | `CASTELLAN_AUTH_TOKEN` | required | Bearer token |
| `--no-force-check` | — | forceCheck on | Skip `POST /v1/forceCheck` |
| `--poll-ms` | — | `5000` | Poll interval |
| `--timeout-ms` | — | `900000` (15m) | Overall timeout |

### Exit codes

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
    castellan-cli api-service
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
