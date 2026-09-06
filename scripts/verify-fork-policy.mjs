import {readFileSync} from "node:fs";
import {execFileSync, spawnSync} from "node:child_process";
import {join} from "node:path";

const expected = {
    package: "@yattdev/codex-acp-kandev",
    version: "1.7.0-kandev.1",
    tag: "kandev",
    bin: "codex-acp-kandev",
    gitTag: "kandev-v1.7.0-kandev.1",
};

const fixtureRoot = process.env["KANDEV_FORK_POLICY_FIXTURE_DIR"];
const policyPath = (path) => fixtureRoot ? join(fixtureRoot, path) : path;
const pkg = readJson(policyPath("package.json"));
const lock = readJson(policyPath("package-lock.json"));
const compatibility = readJson(policyPath("fork-compatibility.json"));
const releaseManifest = readJson(policyPath(".release-please-manifest.json"));
const releaseConfig = readJson(policyPath("release-please-config.json"));

assertEqual(pkg.name, expected.package, "package name");
assertEqual(pkg.version, expected.version, "package version");
assertEqual(pkg.publishConfig?.access, "public", "npm access");
assertEqual(pkg.publishConfig?.tag, expected.tag, "npm dist-tag");
assertEqual(pkg.publishConfig?.provenance, true, "npm provenance");
assertEqual(Object.keys(pkg.bin ?? {}).join(","), expected.bin, "CLI name");
assertEqual(pkg.bin?.[expected.bin], "dist/index.js", "CLI entry point");
assertEqual(pkg.repository?.url, "git+https://github.com/yattdev/codex-acp.git", "repository URL");
assertEqual(pkg.dependencies?.["@openai/codex"], "0.148.0", "Codex pin");
assertEqual(pkg.dependencies?.["@agentclientprotocol/sdk"], "1.4.0", "ACP SDK pin");

assertEqual(lock.name, pkg.name, "lockfile package name");
assertEqual(lock.version, pkg.version, "lockfile package version");
assertEqual(lock.packages?.[""]?.name, pkg.name, "lockfile root package name");
assertEqual(lock.packages?.[""]?.version, pkg.version, "lockfile root package version");
assertEqual(lock.packages?.[""]?.dependencies?.["@openai/codex"], "0.148.0", "lockfile Codex pin");
assertEqual(lock.packages?.[""]?.dependencies?.["@agentclientprotocol/sdk"], "1.4.0", "lockfile ACP SDK pin");

assertEqual(compatibility.distribution?.package, pkg.name, "compatibility package");
assertEqual(compatibility.distribution?.version, pkg.version, "compatibility version");
assertEqual(compatibility.distribution?.distTag, expected.tag, "compatibility dist-tag");
assertEqual(compatibility.distribution?.bin, expected.bin, "compatibility CLI");
assertEqual(compatibility.distribution?.gitTag, expected.gitTag, "compatibility Git tag");
assertEqual(compatibility.runtimeDependencies?.["@openai/codex"], pkg.dependencies["@openai/codex"], "manifest Codex pin");
assertEqual(compatibility.runtimeDependencies?.["@agentclientprotocol/sdk"], pkg.dependencies["@agentclientprotocol/sdk"], "manifest ACP SDK pin");

const rootRelease = releaseConfig.packages?.["."];
assertEqual(releaseManifest["."], pkg.version, "release manifest version");
assertEqual(rootRelease?.["release-type"], "node", "release strategy");
assertEqual(rootRelease?.versioning, "prerelease", "release versioning");
assertEqual(rootRelease?.prerelease, true, "GitHub prerelease mode");
assertEqual(rootRelease?.["prerelease-type"], "kandev", "release prerelease type");
assertEqual(rootRelease?.component, "kandev", "release component");
assert(
    rootRelease?.["release-as"] === undefined || rootRelease["release-as"] === expected.version,
    `initial release-as must be absent or ${expected.version}`,
);
assertEqual(releaseConfig["bootstrap-sha"], compatibility.upstream.baseCommit, "release bootstrap SHA");
assertEqual(rootRelease?.["include-component-in-tag"], true, "release component tag mode");
assertEqual(rootRelease?.["include-v-in-tag"], true, "release v tag mode");
assertEqual(rootRelease?.["changelog-path"], "CHANGELOG-KANDEV.md", "fork changelog");
assertEqual(compatibility.contract.version, 1, "guarded-TTY contract version");
assertEqual(`${rootRelease?.component}-v${pkg.version}`, expected.gitTag, "release tag construction");
assert(/^\d+\.\d+\.\d+-kandev\.\d+$/.test(pkg.version), "package version must stay on the Kandev prerelease line");

if (fixtureRoot) {
    console.log(`Verified maintained-fork metadata fixture for ${pkg.name}@${pkg.version}`);
    process.exit(0);
}

const source = readFileSync("src/AcpExtensions.ts", "utf8");
for (const literal of [
    compatibility.contract.capability,
    compatibility.contract.capabilityMethod,
    compatibility.contract.execMethod,
]) {
    assert(source.includes(JSON.stringify(literal)), `source is missing exact contract literal ${literal}`);
}

for (const path of [
    "README.md",
    "NOTICE",
    "CHANGELOG-KANDEV.md",
    "SECURITY.md",
    "docs/guarded-tty-kandev.md",
    "docs/MAINTENANCE.md",
    ".github/CODEOWNERS",
]) {
    readFileSync(path);
}

const readme = readFileSync("README.md", "utf8");
assert(readme.startsWith("# Kandev-owned Codex ACP adapter"), "README must lead with the fork identity");
assert(readme.includes("upstream `@agentclientprotocol/codex-acp` package"), "README must disclaim upstream identity");

const publishWorkflow = readFileSync(".github/workflows/publish.yml", "utf8");
assert(!publishWorkflow.includes("NPM_TOKEN"), "publish workflow must not use NPM_TOKEN");
assert(!publishWorkflow.includes("RELEASE_PLZ_APP"), "publish workflow must not use upstream GitHub App secrets");
assert(!publishWorkflow.includes("REGISTRY_UPDATER"), "publish workflow must not dispatch the upstream registry");
assert(publishWorkflow.includes("npm publish --access public --tag kandev"), "publish command must select the kandev tag");
assert(publishWorkflow.includes("id-token: write"), "publish job must request OIDC");
assert(!/npm\s+publish[^\n]*--tag\s+latest/.test(publishWorkflow), "publish workflow must never select latest");

for (const workflow of ["ci.yml", "e2e.yml", "codex-update.yml", "publish.yml"]) {
    const content = readFileSync(`.github/workflows/${workflow}`, "utf8");
    for (const line of content.split("\n").filter((line) => /^\s*-?\s*uses:/.test(line))) {
        assert(/@[0-9a-f]{40}(?:\s|$)/.test(line), `${workflow} contains an unpinned action: ${line.trim()}`);
    }
    assert(!content.includes("OPENAI_API_KEY"), `${workflow} must remain secretless`);
    assert(!content.includes("create-github-app-token"), `${workflow} must not mint an app token`);
}

const notice = readFileSync("NOTICE", "utf8");
assert(notice.includes("Apache License 2.0"), "NOTICE must preserve the Apache-2.0 attribution");
assert(notice.includes("22c17a27676cff894ef45ec2f5f8d83fcf31dc22"), "NOTICE must record the guarded-TTY import");
assert(notice.includes("1a5d8b9cf1f70a8677ead500088a8e022cdc65bb"), "NOTICE must record the termination import");

const base = compatibility.upstream.baseCommit;
assertEqual(compatibility.upstream.minimumCommit, base, "minimum supported commit");
assertEqual(compatibility.upstream.maximumCommit, base, "maximum supported commit");
const typesTree = git(["rev-parse", `${base}:src/app-server`]).trim();
assertEqual(typesTree, compatibility.upstream.appServerTypesTree, "App Server type tree");
const typesDiff = spawnSync("git", ["diff", "--quiet", base, "--", "src/app-server"]);
assert(typesDiff.status === 0, "generated App Server types changed outside the compatibility envelope");
assert(spawnSync("git", ["merge-base", "--is-ancestor", "0bd0f8fb74a0dfec93eb3a8e586dc0d7c0e8488d", "HEAD"]).status !== 0,
    "proposal merge 0bd0f8f must not be imported");

for (const imported of compatibility.imports) {
    git(["cat-file", "-e", `${imported.sourceCommit}^{commit}`]);
    git(["cat-file", "-e", `${imported.importedCommit}^{commit}`]);
    const message = git(["show", "-s", "--format=%B", imported.importedCommit]);
    assert(
        message.includes(`(cherry picked from commit ${imported.sourceCommit})`),
        `imported commit ${imported.importedCommit} is missing its -x provenance trailer`,
    );
    assertEqual(patchId(imported.sourceCommit), imported.patchId, `source patch ID ${imported.sourceCommit}`);
    assertEqual(patchId(imported.importedCommit), imported.patchId, `imported patch ID ${imported.importedCommit}`);
}
assertEqual(git(["rev-parse", `${compatibility.imports[0].importedCommit}^`]).trim(), base, "first import parent");
assertEqual(
    git(["rev-parse", `${compatibility.imports[1].importedCommit}^`]).trim(),
    compatibility.imports[0].importedCommit,
    "second import parent",
);

if (process.env["GITHUB_REF_TYPE"] === "tag") {
    assertEqual(process.env["GITHUB_REF_NAME"], expected.gitTag, "release ref");
}

console.log(`Verified maintained fork policy for ${pkg.name}@${pkg.version}`);

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function git(args) {
    return execFileSync("git", args, {encoding: "utf8"});
}

function patchId(commit) {
    const patch = execFileSync("git", ["show", "--format=medium", commit]);
    const result = spawnSync("git", ["patch-id", "--stable"], {
        input: patch,
        encoding: "utf8",
    });
    assert(result.status === 0, `git patch-id failed for ${commit}: ${result.stderr}`);
    return result.stdout.trim().split(/\s+/)[0];
}

function assertEqual(actual, expectedValue, label) {
    assert(
        actual === expectedValue,
        `${label}: expected ${JSON.stringify(expectedValue)}, received ${JSON.stringify(actual)}`,
    );
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
