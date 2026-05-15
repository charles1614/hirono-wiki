---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/openclaw/openclaw/issues/11131
tags: [tooling, production-deployment]
---

# [2026-02-12] Bug: Docker CLI container cannot reach gateway (127.0.0.1); doc missing --url and --token

## TL;DR

GitHub issue #11131 on `openclaw/openclaw` (opened Feb 7, closed Feb 23, 2026). When running the OpenClaw CLI in a Docker Compose container, the CLI defaults to `ws://127.0.0.1:18789` — which resolves to the CLI container itself, not the `openclaw-gateway` service — causing a WebSocket 1006 close error. The issue was resolved by adding Unix socket support so the CLI and gateway containers share a socket via a shared volume, eliminating the need for `--url` / `--token` flags.

## Key claims

- **Root cause**: OpenClaw CLI hard-codes loopback (`127.0.0.1`) as the gateway target. Inside Docker Compose, `127.0.0.1` is the CLI container itself; the gateway runs in a separate service (`openclaw-gateway`). The CLI has no auto-detection for Docker networking. — Issue OP (aureliolk)
- **Workaround (pre-fix)**: Pass `--url ws://openclaw-gateway:18789 --token "$OPENCLAW_GATEWAY_TOKEN"` on every CLI invocation, OR set `gateway.mode: "remote"` and `gateway.remote.url` in `~/.openclaw/openclaw.json`. — aureliolk
- **Secondary blocker — pairing loop**: Using `--url` without a previously paired device triggers "gateway closed (1008): pairing required". Approving devices also requires a gateway connection, creating a circular dependency. — loloman333, wang48
- **Workaround for pairing loop**: `docker compose exec openclaw-gateway node dist/index.js devices approve <requestId> --token "$OPENCLAW_GATEWAY_TOKEN"` — exec into the gateway container directly rather than using the CLI container. — MarMun
- **TLS workaround for dashboard**: Enable `gateway.tls.autoGenerate: true` + `gateway.controlUi.allowInsecureAuth: true` in config; access via `https://localhost:18789/chat?session=main#token=<token>`. Needed because browser contexts from Docker bridge IP are treated as remote clients, breaking auto-pairing; and `dangerouslyDisableDeviceAuth` removes all scopes. — baldasso
- **New security gate in newer versions**: `ws://` (plaintext) to a non-loopback address is blocked with a SECURITY ERROR — must use `wss://` or an SSH tunnel to localhost. — lpares12 (v2026.2.19)
- **Resolution (Unix socket)**: Gateway creates a Unix socket at `~/.openclaw/gateway.sock`; CLI and gateway containers share the socket via a volume mount. Unix socket connections are trusted as local — device pairing is skipped automatically. No flags needed; backward-compatible (falls back to TCP). — assistant-chan
- Closed as duplicate of issue #5559. — sebslight (maintainer)

## Visual observations

*No load-bearing images — source has no images*

## Entities touched

[[OpenClaw]]

## Topics touched

## Raw source

[github.com/openclaw/openclaw/issues/11131](https://github.com/openclaw/openclaw/issues/11131) — 11 participants · 10 comments · closed Feb 23, 2026 as duplicate of #5559
