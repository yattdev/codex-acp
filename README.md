# Kandev-owned Codex ACP adapter

> **This is a Kandev-specific derivative.** It is published as
> `@yattdev/codex-acp-kandev`, is maintained by yattdev, and is not the
> upstream `@agentclientprotocol/codex-acp` package. The private
> `_kandev/guarded_tty/*` methods are not standard or provider-neutral ACP.

This package carries a narrow guarded-TTY bridge for Kandev while preserving
the upstream Codex ACP adapter. It starts the Codex App Server, translates ACP
requests into Codex operations, and maps Codex events back to the client.

The upstream project and inherited history are available at
[agentclientprotocol/codex-acp](https://github.com/agentclientprotocol/codex-acp).
See [NOTICE](NOTICE) for provenance and attribution.

## Install the Kandev channel

Consumers must pin the complete package version and integrity. Do not use a
range and do not install the upstream package as a substitute.

```bash
npx -y @yattdev/codex-acp-kandev@1.7.0-kandev.1
```

Or install the exact version globally:

```bash
npm install -g @yattdev/codex-acp-kandev@1.7.0-kandev.1
codex-acp-kandev --version
```

The package is published only on the npm `kandev` dist-tag. It never owns or
moves npm's `latest` tag.

## Private guarded-TTY contract

The version-1 contract is intentionally Kandev-namespaced:

- capability: `kandev.guarded-tty-exec`
- capability probe: `_kandev/guarded_tty/capability`
- one-shot execution: `_kandev/guarded_tty/exec`

The bridge is not a generic authorization boundary. Kandev must authorize the
request before calling it, and the adapter must already be running inside the
Kandev-controlled confinement for the exact active session. Do not expose this
package as a general remote ACP endpoint to untrusted clients.

The caller may provide only `sessionId` and a bounded, non-empty `argv`. The
adapter derives the working directory and sandbox policy from trusted session
state, creates the process ID, forces `tty: true`, streams output with fixed
time and byte ceilings, and exposes no stdin/write/resize/attach lifecycle.
See [the guarded-TTY contract and threat model](docs/guarded-tty-kandev.md).

## Compatibility

`1.7.0-kandev.1` supports only the exact compatibility envelope recorded in
[fork-compatibility.json](fork-compatibility.json):

- upstream source base `69ca755d9878238aecf0737c0e4568b3bab37be2`
- `@openai/codex` `0.148.0`
- `@agentclientprotocol/sdk` `1.4.0`
- guarded-TTY capability version `1`

No other upstream commit or dependency range is implied. Downstream consumers
must negotiate the exact capability and fail closed on any identity, version,
method, session, receipt, or integrity mismatch.

## Runtime environment

The inherited adapter supports these environment variables:

- `CODEX_API_KEY` — API key selected by the ACP authentication flow.
- `OPENAI_API_KEY` — fallback API key selected by that flow.
- `CODEX_PATH` — optional path to a compatible Codex executable.
- `CODEX_CONFIG` — JSON merged into Codex session configuration.
- `MODEL_PROVIDER` — model provider for new sessions.
- `DEFAULT_AUTH_REQUEST` — ACP auth request JSON.
- `INITIAL_AGENT_MODE` — `read-only`, `agent`, or `agent-full-access`.
- `NO_BROWSER` — hide browser-based login when set.
- `APP_SERVER_LOGS` — directory for adapter logs.

The guarded-TTY methods cannot set or alter any of these values.

## Development

```bash
npm ci --include=dev
npm run typecheck
npm run test:guarded-tty
npm test
npm run build
npm run verify:fork
```

Building the six standalone binaries additionally requires Bun 1.3.11:

```bash
npm run bundle:all
npm run package:all
npm run verify:package
```

See [maintenance policy](docs/MAINTENANCE.md), [release procedure](docs/RELEASES.md),
and [security policy](SECURITY.md).

## License

This derivative remains licensed under Apache-2.0. Modified-file and upstream
attribution obligations are documented in [NOTICE](NOTICE).
