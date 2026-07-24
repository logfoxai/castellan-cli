# composewatch

[![next](https://img.shields.io/github/actions/workflow/status/logfoxai/composewatch/release.yml?branch=next&label=next)](https://github.com/logfoxai/composewatch/actions/workflows/release.yml)
[![release](https://img.shields.io/github/actions/workflow/status/logfoxai/composewatch/release.yml?branch=main&label=release)](https://github.com/logfoxai/composewatch/actions/workflows/release.yml)
[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-blue)]()
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![AutoRel](https://img.shields.io/badge/%F0%9F%9A%80%20AutoRel-2D4DDE)](https://github.com/mhweiner/autorel)

CLI for watching Docker Compose rollouts over SSH. Same modes as [`ecswatch`](https://github.com/logfoxai/ecswatch): CI stream, TUI, and inspect.

- **CI mode**: waits for watched service digests to change and settle healthy; exits non-zero on restart loops or container exits; emits GitHub Actions annotations.
- **TUI** (default on a TTY): services, health, digests, diagnostics, log tail over SSH.
- **Snapshot** (`inspect`): one-shot tabular report.
- **Remote only**: talks to the host over SSH; no local Docker socket.

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
  "default_env": "staging",
  "hosts": {
    "staging": {
      "ssh": "deploy@my-server",
      "dir": "/srv/app/compose",
      "compose_file": "docker-compose.yml",
      "env_file": "/srv/app/compose/.env",
      "watched": ["web", "worker"]
    },
    "prod": {
      "ssh": "deploy@prod.example.com",
      "dir": "/srv/app/compose",
      "watched": ["web", "worker", "scheduler"]
    }
  }
}
```

Required per host (or via flags): `ssh`, `dir`, `watched`.

Optional per host: `compose_file` (default `docker-compose.yml`), `env_file` (omit to skip `--env-file`).

Overrides: `--env`, `--ssh`, `--dir`, `--compose-file`, `--env-file`, `--watched`, `COMPOSEWATCH_ENV`, `COMPOSEWATCH_SSH`.

**Prerequisite:** SSH must reach the host (`BatchMode=yes` — agent keys, Tailscale SSH, etc.).

## Usage

```bash
composewatch watch                 # TUI on a TTY, CI stream in CI
composewatch inspect               # one-shot snapshot
composewatch inspect --logs 80     # also tail 80 log lines
composewatch ci                    # force CI streaming (rollout gate)
composewatch tui                   # force interactive TUI
composewatch watch --once          # snapshot then exit
composewatch watch --env staging
composewatch inspect --ssh deploy@my-server --dir /srv/app/compose --watched web,worker
```

### CI exit codes

| Code | Meaning |
| --- | --- |
| `0` | Rollout success (digest changed, settled, watched services healthy) — or `--once` / `inspect` with no error diagnostics |
| `1` | SSH/host failure, rollout failed, or inspect found error diagnostics |
| `130` | SIGINT during CI watch |

### Rollout signal

CI tracks **image IDs** of watched services:

1. Capture baseline digests
2. Wait until at least one watched digest changes (deploy happened)
3. Wait until digests stop changing and every watched service is `running` and not `unhealthy`/`starting`
4. Fail early on `exited` / `restarting` / high restart counts during the rollout

Works with any deploy path that updates running container digests (manual `compose pull`, a deploy controller, etc.).

## Follow-ups (not in v1)

- Optional root-cause analysis (copy from ecswatch)

## Develop

```bash
npm run validate   # lint + typecheck + build + test
npm run dev        # esbuild watch
```

## License

MIT
