#!/usr/bin/env bash

# Validate the reviewed Kandev prerelease before its release PR is merged.
# This script never publishes, creates a release, or mutates registry state.

set -euo pipefail

EXPECTED_REPO="yattdev/codex-acp"
EXPECTED_PACKAGE="@yattdev/codex-acp-kandev"
PENDING_LABEL="autorelease: pending"
REQUIRED_CHECK="ci"

fail() {
  printf 'FAIL  %s\n' "$1" >&2
  exit 1
}

pass() {
  printf 'ok    %s\n' "$1"
}

command -v gh >/dev/null 2>&1 || fail "GitHub CLI (gh) is not installed."
gh auth status >/dev/null 2>&1 || fail "GitHub CLI is not authenticated."

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null) ||
  fail "cannot resolve the GitHub repository from this checkout."
[ "$repo" = "$EXPECTED_REPO" ] ||
  fail "release preflight is restricted to $EXPECTED_REPO, received $repo."
pass "repository identity is $EXPECTED_REPO"

npm run verify:fork
pass "fork metadata, provenance, compatibility, and workflow policy agree"

if [ -z "${KANDEV_NPM_BOOTSTRAP_RECEIPT_SHA256:-}" ]; then
  fail "the Human-owned npm trusted-publisher bootstrap receipt digest is absent.
      Set KANDEV_NPM_BOOTSTRAP_RECEIPT_SHA256 to the redacted receipt SHA-256
      only after the yattdev owner has completed and reviewed the setup."
fi
[[ "$KANDEV_NPM_BOOTSTRAP_RECEIPT_SHA256" =~ ^[0-9a-f]{64}$ ]] ||
  fail "bootstrap receipt must be exactly 64 lowercase hexadecimal characters."
pass "Human-owned bootstrap receipt digest is present"

gh api "repos/$repo/environments/release" >/dev/null 2>&1 ||
  fail "protected GitHub environment 'release' is not configured."
pass "release environment exists"

rows=$(gh pr list --repo "$repo" --state open --label "$PENDING_LABEL" \
  --json number,title,headRefName --jq '.[] | [.number, .headRefName, .title] | @tsv')
count=$(printf '%s\n' "$rows" | grep -c . || true)
[ "$count" -eq 1 ] || fail "expected one open '$PENDING_LABEL' PR, received $count."
IFS=$(printf '\t') read -r pr_number head_ref pr_title <<EOF
$rows
EOF
pass "one open release PR: #$pr_number ($pr_title)"

title_version=${pr_title##* }
case "$title_version" in
  [0-9]*.[0-9]*.[0-9]*-kandev.[0-9]*) ;;
  *) fail "release PR title does not end in a Kandev prerelease version: $pr_title" ;;
esac

pkg_name=$(gh api "repos/$repo/contents/package.json?ref=$head_ref" \
  -H "Accept: application/vnd.github.raw" --jq .name)
pkg_version=$(gh api "repos/$repo/contents/package.json?ref=$head_ref" \
  -H "Accept: application/vnd.github.raw" --jq .version)
manifest_version=$(gh api "repos/$repo/contents/.release-please-manifest.json?ref=$head_ref" \
  -H "Accept: application/vnd.github.raw" --jq '."."')

[ "$pkg_name" = "$EXPECTED_PACKAGE" ] || fail "release PR package is $pkg_name."
[ "$title_version" = "$pkg_version" ] || fail "PR/package version mismatch."
[ "$title_version" = "$manifest_version" ] || fail "PR/manifest version mismatch."
pass "package and version identity agree: $EXPECTED_PACKAGE@$title_version"

expected_tag="kandev-v$title_version"
compare_tag=$(gh pr view "$pr_number" --repo "$repo" --json body --jq '
  .body | capture("/compare/[^)]*[.][.][.](?<to>[^)\\s]+)").to // ""' 2>/dev/null || true)
case "$compare_tag" in
  "" | "$expected_tag") ;;
  *) fail "release-please proposes tag '$compare_tag', expected '$expected_tag'." ;;
esac
gh release view "$expected_tag" --repo "$repo" >/dev/null 2>&1 &&
  fail "release $expected_tag already exists."
pass "release tag is new and fork-specific: $expected_tag"

build=$(gh pr view "$pr_number" --repo "$repo" --json statusCheckRollup --jq "
  [.statusCheckRollup[]? | select(.name == \"$REQUIRED_CHECK\")]
  | if length == 0 then \"MISSING\" else (.[0].conclusion // .[0].status // \"PENDING\") end")
[ "$build" = "SUCCESS" ] ||
  fail "required check '$REQUIRED_CHECK' is $build, expected SUCCESS."
pass "required CI check passed"

cat <<EOF

Ready for reviewed merge of #$pr_number.

Expected immutable release: $EXPECTED_PACKAGE@$title_version
Expected GitHub prerelease: $expected_tag
Expected npm command:       npm publish --access public --tag kandev

No deployment is performed. The release workflow must stop if OIDC, provenance,
attestation, environment approval, or post-publish identity verification fails.
EOF
