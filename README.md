# composewatch

[![next](https://img.shields.io/github/actions/workflow/status/logfoxai/composewatch/release.yml?branch=next&label=next)](https://github.com/logfoxai/composewatch/actions/workflows/release.yml)
[![release](https://img.shields.io/github/actions/workflow/status/logfoxai/composewatch/release.yml?branch=main&label=release)](https://github.com/logfoxai/composewatch/actions/workflows/release.yml)
[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-blue)]()
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![AutoRel](https://img.shields.io/badge/%F0%9F%9A%80%20AutoRel-2D4DDE)](https://github.com/mhweiner/autorel)

A keen, low-friction watcher for **Docker Compose** stacks reached over **Tailscale SSH**. Sibling of [`ecswatch`](https://github.com/logfoxai/ecswatch) — same UX surface (CI stream / TUI / inspect), tuned for Watchtower rollouts on Logfox platform hosts.

- **CI mode**: polls image digests + health until Watchtower rolls a new digest and services settle healthy; exits non-zero on restart loops / exits; GitHub Actions `::group::` / `::error::` annotations.
- **Interactive TUI** (default on a real TTY): services, health, digests, diagnostics, live log poll over SSH.
- **Snapshot mode** (`inspect`): one-shot kubectl-style tables.
- **One transport**: Tailscale SSH for every env — no SSM / Dockerode dual path.

## Install

```bash
npm install -g composewatch
```

From a local checkout:

```bash
git clone https://github.com/logfoxai/composewatch.git && cd composewatch
npm install
npm link
```

## Config

Create `~/.config/composewatch/config.json`:

```json
{
  "default_env": "prime",
  "hosts": {
    "prime": { "ssh": "ubuntu@logfox-prime", "dir": "/opt/logfox/compose" },
    "dev":   { "ssh": "ubuntu@logfox-dev",   "dir": "/opt/logfox/compose" },
    "prod":  { "ssh": "root@logfox-prod",    "dir": "/opt/logfox/compose" }
  }
}
```

Defaults (overridable per host or via flags):

| Field | Default |
| --- | --- |
| `dir` | `/opt/logfox/compose` |
| `compose_file` | `docker-compose.yml` |
| `env_file` | `/opt/logfox/.env` |
| `watched` | `api-1`, `api-2`, `ingest-worker`, `issue-worker` |

Overrides: `--env`, `--ssh`, `--dir`, `--watched`, `COMPOSEWATCH_ENV`, `COMPOSEWATCH_SSH`.

**Prerequisite:** Tailscale must reach the host; SSH uses `BatchMode=yes` (agent keys / Tailscale SSH). There is no localhost fallback.

## Usage

```bash
composewatch watch                 # TUI on a TTY, CI stream in CI
composewatch inspect               # one-shot snapshot
composewatch inspect --logs 80     # also tail 80 log lines
composewatch ci                    # force CI streaming (Watchtower rollout gate)
composewatch tui                   # force interactive TUI
composewatch watch --once          # snapshot then exit
composewatch watch --env prod
composewatch inspect --ssh ubuntu@logfox-prime
```

### CI exit codes

| Code | Meaning |
| --- | --- |
| `0` | Rollout success (digest changed, settled, watched services healthy) — or `--once` / `inspect` with no error diagnostics |
| `1` | SSH/host failure, rollout failed, or inspect found error diagnostics |
| `130` | SIGINT during CI watch |

### Watchtower rollout signal

CI tracks **image IDs** of watched services:

1. Capture baseline digests
2. Wait until at least one watched digest changes (Watchtower pulled)
3. Wait until digests stop changing and every watched service is `running` and not `unhealthy`/`starting`
4. Fail early on `exited` / `restarting` / high restart counts during the rollout

## Follow-ups (not in v1)

- Wire `composewatch ci --env prime` into app `release.yml` post-deploy gates
- Optional LLM root-cause (copy from ecswatch)

## Develop

```bash
npm run validate   # lint + typecheck + build + test
npm run dev        # esbuild watch
```

## License

MIT
