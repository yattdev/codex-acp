# Kandev guarded-TTY extension, version 1

This document defines a private integration contract between Kandev and the
yattdev-maintained Codex ACP adapter. It is not standard ACP and must not be
advertised as provider-neutral.

## Wire contract

The initialize response advertises:

| Field | Exact value |
| --- | --- |
| Capability | `kandev.guarded-tty-exec` |
| Version | `1` |
| Probe | `_kandev/guarded_tty/capability` |
| Execute | `_kandev/guarded_tty/exec` |

The probe accepts exactly `{ sessionId: string }`. It reports support only
when that local session is active and current.

Execute accepts exactly:

```json
{
  "sessionId": "active-session-id",
  "argv": ["program", "literal-argument"]
}
```

`argv` must contain 1–64 non-empty strings, no NULs, at most 4 KiB per
argument and at most 8 KiB in aggregate. All sizes are UTF-8 byte sizes.

## Trusted dispatch

The adapter:

1. resolves the exact active session and captures its generation;
2. derives `cwd` and `sandboxPolicy` from trusted `SessionState`;
3. creates an unpredictable UUID process ID;
4. invokes Codex App Server `command/exec` with `tty: true`,
   `streamStdin: true`, `streamStdoutStderr: true`, a 10-second provider
   timeout, and a 64-KiB output cap;
5. accepts output notifications only for that process ID;
6. terminates on cancellation, timeout, invalid output, output overflow, or a
   stale/replaced/closed session; and
7. finalizes exactly once with a bounded receipt.

The method exposes no stdin, write, resize, attach, or long-lived process
lifecycle.

## Threat model

### Trusted

* the already-running Kandev-confined codex-acp/App Server process;
* the current local session object, generation, working directory, and sandbox
  policy;
* Kandev's authorization and task/execution binding before the ACP call; and
* the server-generated process ID.

### Untrusted

* all JSON-RPC request fields and argv contents;
* session identifiers supplied by the caller;
* App Server output and errors; and
* late, duplicated, malformed, or wrong-process notifications.

### Forbidden caller controls

`cwd`, `sandboxPolicy`, `permissionProfile`, `processId`, `tty`,
`env`, `stdin`, `write`, `resize`, and `attach` are rejected as extra
fields. The bridge never changes `CODEX_CONFIG`, never enables
`unified_exec`, and never creates a host-side executor.

### Security boundary

The ACP method itself does not decide whether a principal may execute a
command. Any connected ACP client can attempt to invoke extension methods, so
this adapter is suitable only inside the trusted Kandev launch/confinement
boundary. Kandev must fail closed before dispatch when package identity,
integrity, capability, method, version, session, execution, or receipt does not
match.

Bounded stdout/stderr may still contain sensitive text. It is returned only to
the authorized call path; the adapter must not add raw-output persistence or
log raw provider exceptions.

## Receipt

The receipt reports capability/version/session, `method: command/exec`,
requested and dispatched TTY state, process ID, trusted cwd, outcome and stable
denial code, bounded stdout/stderr with byte counts, exit code, and timestamps.
Unknown sessions are denied before dispatch with null process ID and cwd.
