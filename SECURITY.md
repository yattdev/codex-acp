# Security policy

## Ownership

yattdev owns security response and release trust for
`@yattdev/codex-acp-kandev`. Changes to the guarded-TTY bridge,
`fork-compatibility.json`, runtime dependencies, or release workflows require
the yattdev CODEOWNER and a Kandev integration reviewer.

The upstream Agent Client Protocol project, JetBrains, and OpenAI do not own or
endorse this derivative or its private Kandev methods.

## Supported versions

Only the exact version referenced by the npm `kandev` dist-tag and the
compatibility manifest is supported. The initial supported version is
`1.7.0-kandev.1`. npm `latest` is never used by this project.

## Reporting

Report vulnerabilities with GitHub private vulnerability reporting in
`yattdev/codex-acp`. Do not include credentials, production output, or
customer data in an issue. Public issues are suitable only after coordinated
disclosure.

For a critical or high-severity report, the repository owner targets an initial
risk assessment within 48 hours. The owner either prepares a reviewed fix or
withdraws the affected Kandev capability while investigation continues.

## Response and revocation

1. Disable or omit guarded-TTY negotiation downstream; verify zero dispatch.
2. Preserve the immutable package and attestations as incident evidence.
3. Deprecate the affected npm version with a non-sensitive warning. Do not rely
   on npm unpublish.
4. Publish a new reviewed version through OIDC and attestations.
5. Move the `kandev` tag only after the replacement passes all gates.
6. Have Kandev pin the replacement's exact version, integrity, manifest digest,
   capability version, and method names.

No workflow may fall back from OIDC to a long-lived npm token.
