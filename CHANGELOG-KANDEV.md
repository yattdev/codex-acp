# Kandev fork changelog

This changelog covers only the yattdev/Kandev derivative. The inherited
upstream history remains in [CHANGELOG.md](CHANGELOG.md).

## [1.7.0-kandev.1](https://github.com/yattdev/codex-acp/compare/kandev-v1.7.0-kandev.1...kandev-v1.7.0-kandev.1) (2026-09-06)


### Features

* add guarded TTY ACP bridge ([eb871ee](https://github.com/yattdev/codex-acp/commit/eb871ee11fc5b6a33e19e40fc38b60571fdd6247))
* add maintained Kandev guarded-TTY distribution ([f4df079](https://github.com/yattdev/codex-acp/commit/f4df079f6f6a31e300772f537b14db54136a0ff6))
* prepare maintained Kandev guarded-TTY distribution ([7c19e87](https://github.com/yattdev/codex-acp/commit/7c19e8777781ed29e463091cb051ace8150d63ba))

## 1.7.0-kandev.1 (unreleased)

### Added

* Add the private, versioned `kandev.guarded-tty-exec` capability and
  `_kandev/guarded_tty/capability` / `_kandev/guarded_tty/exec` methods.
* Dispatch one-shot, bounded TTY commands through the active Codex App Server
  session with trusted working-directory and sandbox state.
* Add a Kandev-owned package identity, exact compatibility manifest,
  maintenance/security policy, secretless CI, npm OIDC provenance, and
  attested binary release gates.
* Pin the full production dependency graph, produce byte-reproducible ZIPs,
  smoke-test all six matching hosted targets, and bind registry integrity to
  the reviewed npm tarball.

### Provenance

* Upstream base: `69ca755d9878238aecf0737c0e4568b3bab37be2`
* Imported commits: `22c17a27676cff894ef45ec2f5f8d83fcf31dc22`,
  `1a5d8b9cf1f70a8677ead500088a8e022cdc65bb`
* Codex: `0.148.0`
* ACP SDK: `1.4.0`
* Contract: `kandev.guarded-tty-exec` version `1`

### Rollback

This is the first maintained release. If it is withdrawn, Kandev must omit the
guarded-TTY tool and dispatch nothing until a reviewed replacement exists.
