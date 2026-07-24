# castwatch

[![release](https://img.shields.io/github/actions/workflow/status/logfoxai/castwatch/release.yml?branch=main&label=release)](https://github.com/logfoxai/castwatch/actions/workflows/release.yml)
[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-blue)]()
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![AutoRel](https://img.shields.io/badge/%F0%9F%9A%80%20AutoRel-2D4DDE)](https://github.com/mhweiner/autorel)

CI CLI for watching [Castellan](https://github.com/logfoxai/castellan) compose rollouts over HTTP. Same role as [`ecswatch`](https://github.com/logfoxai/ecswatch) for ECS: stream deploy progress in GitHub Actions, exit non-zero on failure.

- Talks only to Castellan’s API (`/v1/status`, `/v1/history`, `/v1/forceCheck`) — no SSH, no local Docker socket.
- Streams Castellan events and service state pills (`checking` / `updating` / `verifying` / `stable` / `rollback` / `failed`).
- Emits GitHub Actions annotations (`::error::`, `::notice::`).
- For day-to-day ops, use Castellan’s dashboard — this tool is the CI gate.

## Install

```bash
npm install -g castwatch
```

From a local checkout:

```bash
git clone https://github.com/logfoxai/castwatch.git && cd castwatch
npm install
npm link
```

## Usage

```bash
export CASTELLAN_URL=http://castellan.example:8443
export CASTELLAN_AUTH_TOKEN=…

# Force a registry check, then stream until settle (default)
castwatch ci api-service

# Watch only (something else already called forceCheck)
castwatch ci api-service --no-force-check

# Multiple services
castwatch ci api ingest-worker issue-worker
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
3. Stream new `/v1/history` events and state transitions
4. **Success** when every watched service saw deploy activity and settled `stable`/`idle` with `currentDigest ≠ baseline`
5. **Failure** on `failed` state, failure events, or rollback that ends on the baseline digest

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
    castwatch ci api-service
```

## Develop

```bash
npm run validate   # lint + typecheck + build + test
npm run dev        # esbuild watch
```

## License

MIT
