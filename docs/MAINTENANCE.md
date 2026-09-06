# Maintained fork policy

## Compatibility baseline

Every release supports only the exact envelope in
`fork-compatibility.json`. The initial line is derived from upstream source
commit `69ca755d9878238aecf0737c0e4568b3bab37be2`, with Codex `0.148.0`,
ACP SDK `1.4.0`, and Kandev capability version `1`. Every production dependency
uses an exact version and is mirrored in the compatibility manifest; floating
ranges and unrecorded source commits are rejected before release.

## Upstream synchronization

* Inspect upstream commits and security advisories weekly.
* Assess a routine synchronization at least monthly.
* Start a risk assessment within 48 hours of a critical/high advisory affecting
  upstream codex-acp, `@openai/codex`, the ACP SDK, or release tooling.
* Sync through a dedicated reviewed PR. Record old/new full upstream commits,
  upstream release ancestry, fork patch rebases, dependency versions, generated
  App Server tree, and Kandev contract compatibility.
* Regenerate `src/app-server` only when the selected exact Codex version
  requires it. Follow the repository's codex-update-compat skill, update typed
  fixtures rather than weakening types, and handle every new event variant
  explicitly.
* Never automatically merge an upstream or dependency update. Never widen a
  supported range without secretless fork and downstream integration evidence.

The scheduled compatibility job reads upstream `main`, checks published
upstream advisories updated during the weekly window, audits pinned runtime and
release dependencies at high severity, and reports current Codex/ACP SDK
versions. It is read-only and never opens, merges, publishes, or deploys a
change.

When the upstream version changes, start a new
`<upstream-version>-kandev.1` line. Changes on the same upstream base
increment only the final Kandev revision.

## Change and release ownership

yattdev owns this fork. Guarded-TTY, compatibility, security and release paths
require CODEOWNER review plus Kandev integration review. Release publication is
allowed only from the protected workflow/ref and release environment after the
one-time human-owned npm trusted-publisher bootstrap is verified.

`CHANGELOG-KANDEV.md` records fork changes. The inherited `CHANGELOG.md`
remains upstream history. Each release entry includes the upstream base,
imported/rebased Kandev patches, Codex/SDK versions, capability version,
security impact, and rollback predecessor.

## Rollback

Kandev pins package name, complete version, npm integrity, compatibility
manifest digest, capability version and method names. A regression is handled
by omitting the tool, proving zero dispatch, and restoring the last reviewed
exact pin. npm packages remain immutable: deprecate the bad version, publish a
reviewed successor, and move the `kandev` dist-tag only after verification.
Never use npm unpublish or `latest` as rollback mechanisms.

## Provider-neutral upstream work

The owned package ships independently of PR #451. Keep that PR draft and
unchanged as a reference. A future upstream effort belongs in the ACP
protocol-suggestions/RFD process and must define a provider-neutral namespace,
authorization and threat model, and multi-client compatibility semantics
before implementation. Do not cosmetically relabel the private Kandev contract.
