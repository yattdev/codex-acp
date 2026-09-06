# Kandev fork releases

This repository publishes the visibly fork-specific package
`@yattdev/codex-acp-kandev`. It must never publish the upstream package name,
create an upstream-style `v*` tag, update the ACP registry, or move npm's
`latest` dist-tag.

The initial release identity is fixed:

- npm: `@yattdev/codex-acp-kandev@1.7.0-kandev.1`
- channel: `kandev`
- CLI: `codex-acp-kandev`
- Git tag/release: `kandev-v1.7.0-kandev.1`

## Human-owned bootstrap gate

Before the first publish, a yattdev owner must claim or bootstrap the npm scope
and package, then bind npm trusted publishing to the public
`yattdev/codex-acp` repository, `.github/workflows/publish.yml`, its protected
`release` environment, and GitHub-hosted runners. The owner must also configure
review protection for `main`, `kandev-v*` tags, and the release environment.

That setup is performed once by the human owner and recorded as a redacted
receipt. Do not invent the receipt, copy an npm token into GitHub, or add a
long-lived publishing credential as a fallback. A missing or rejected OIDC
exchange stops the release.

## Candidate verification

Run from the exact reviewed release commit:

```sh
npm ci --include=dev
npm run verify:fork
npm run typecheck
npm run test:guarded-tty
npm test
npm run build
npm run bundle:all
npm run package:all
npm run verify:package
npm run test:packed-guarded-tty
npm audit --audit-level=high
npm audit --omit=dev
sha256sum dist/bin/*.zip > dist/bin/SHA256SUMS
npm pack --json --ignore-scripts --pack-destination "$(mktemp -d)"
```

Record the source commit, `fork-compatibility.json` SHA-256, package filename,
npm integrity and shasum, archive checksums, Node/npm/Bun versions, and test
summary. `package:all` normalizes executable timestamps and ZIP metadata, so a
retry of the same commit produces byte-identical archives. CI downloads the
candidate archives and executes each one on the matching hosted Linux, macOS,
or Windows x64/arm64 runner. Downstream acceptance uses the exact recorded npm
tarball before publication.

`npm run release:preflight` additionally verifies the open release PR, exact
version/tag/config, the core CI job and all six native smoke checks, repository
identity, policy manifest, and the presence of the human bootstrap receipt in
the protected release process.

## Automated release

Release Please maintains the fork changelog and uses prerelease versioning with
the `kandev` component. Merging the reviewed release PR creates a
`kandev-v<version>` GitHub prerelease. The protected workflow repeats the
secretless gates and publishes with the only permitted command. Release Please
uses the scoped `GITHUB_TOKEN`, so the workflow explicitly dispatches `ci.yml`
on the release PR branch after creating or updating it. This gives the reviewed
release commit the same required checks without a PAT or GitHub App secret.

The initial configuration contains a one-time `release-as` override for
`1.7.0-kandev.1`. After Release Please creates that release PR, the workflow
removes the override on the PR branch before dispatching CI. The reviewed merge
therefore leaves no persistent override: later fixes or features advance the
Kandev prerelease revision instead of attempting to reuse an immutable version.

```sh
npm publish "$CANDIDATE_TARBALL" --access public --tag kandev
```

GitHub-hosted npm OIDC supplies the short-lived publishing identity. npm
provenance is enabled in `package.json`. Before npm publication, the workflow
builds six archives, creates `dist/bin/SHA256SUMS`, attests and verifies all
seven files, and uploads them to the matching GitHub prerelease. It then
publishes the already-built reviewed tarball—not a newly packed directory—and
requires the registry `dist.integrity` and `dist.shasum` to match the candidate
on both first publication and retry. Existing assets must match byte-for-byte
and are never overwritten. There is no deployment or registry dispatch.

Verify the immutable result:

```sh
npm view '@yattdev/codex-acp-kandev@<version>' name version dist.integrity dist.shasum repository --json
npm view '@yattdev/codex-acp-kandev' dist-tags --json
npm audit signatures
EXPECTED_NPM_INTEGRITY='<candidate-integrity>' EXPECTED_NPM_SHASUM='<candidate-shasum>' \
  node scripts/verify-npm-provenance.mjs '<version>' 'kandev-v<version>'
gh release view 'kandev-v<version>' --repo yattdev/codex-acp
sha256sum --check dist/bin/SHA256SUMS
gh attestation verify dist/bin/<archive> --repo yattdev/codex-acp
```

The `kandev` tag must resolve to the exact release. `latest` must remain absent
or unchanged. Provenance must name this repository, this workflow, and the exact
release ref. Downstream pins the package version and lockfile integrity; it does
not consume a dist-tag at runtime.

## Updates and rollback

Conventional `feat`, `fix`, `perf`, and `revert` commits advance the maintained
Kandev prerelease line. An upstream-base or Codex update is always a reviewed
compatibility change; it may not widen ranges or regenerate types silently.

Published npm versions are immutable. On regression, Kandev omits the guarded
tool and restores its preceding reviewed exact pin. Deprecate the bad version,
publish a new reviewed replacement, and move only `kandev` after verification.
Never unpublish as a rollback mechanism and never touch `latest`.

If the GitHub release exists but publication or attestation failed, fix the
underlying gate and rerun the failed job against the same protected tag. The
workflow accepts an already-published exact version only so it can repeat the
registry, signature, and provenance checks; mismatched release assets or npm
identity still fail closed. Never create a different package from an existing
tag or reuse an npm version.
