import {chmodSync, cpSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {afterEach, describe, expect, it} from "vitest";
import {PrereleaseVersioningStrategy} from "release-please/build/src/versioning-strategies/prerelease.js";
import {Version} from "release-please/build/src/version.js";
import type {ConventionalCommit} from "release-please/build/src/commit.js";

const fixtureFiles = [
    "package.json",
    "package-lock.json",
    "fork-compatibility.json",
    ".release-please-manifest.json",
    "release-please-config.json",
];
const fixtureDirectories: string[] = [];

afterEach(() => {
    for (const directory of fixtureDirectories.splice(0)) {
        rmSync(directory, {recursive: true, force: true});
    }
});

describe("maintained fork policy", () => {
    it("accepts the checked-in compatibility receipt", () => {
        const result = runVerifier();
        expect(result.stderr).toBe("");
        expect(result.status).toBe(0);
    });

    it("rejects a package/version drift fixture", () => {
        const directory = createFixture();
        const packagePath = join(directory, "package.json");
        const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as {version: string};
        pkg.version = "1.7.0-kandev.2";
        writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

        const result = runVerifier(directory);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("package version");
    });

    it("rejects a capability-version drift fixture", () => {
        const directory = createFixture();
        const manifestPath = join(directory, "fork-compatibility.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
            contract: {version: number};
        };
        manifest.contract.version = 2;
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

        const result = runVerifier(directory);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("guarded-TTY contract version");
    });

    it("rejects a floating runtime dependency before release", () => {
        const directory = createFixture();
        const packagePath = join(directory, "package.json");
        const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as {
            dependencies: Record<string, string>;
        };
        pkg.dependencies["diff"] = "^9.0.0";
        writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

        const result = runVerifier(directory);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("runtime dependency diff must use an exact version");
    });

    it("dry-runs the pinned release-please strategy against fork version fixtures", () => {
        const config = JSON.parse(readFileSync("release-please-config.json", "utf8")) as {
            packages: {".": {"release-as": string, "prerelease-type": string, component: string}};
        };
        const policy = config.packages["."];
        const strategy = new PrereleaseVersioningStrategy({
            prerelease: true,
            prereleaseType: policy["prerelease-type"],
        });
        const fix = [conventionalCommit("fix")];
        const feature = [conventionalCommit("feat")];

        expect(policy["release-as"]).toBe("1.7.0-kandev.1");
        const sameBaseFix = strategy.bump(Version.parse(policy["release-as"]), fix).toString();
        expect(sameBaseFix).toBe("1.7.0-kandev.2");
        expect(strategy.bump(Version.parse("1.7.0-kandev.2"), feature).toString())
            .toBe("1.7.0-kandev.3");
        expect(`${policy.component}-v${policy["release-as"]}`).toBe("kandev-v1.7.0-kandev.1");
        expect(`${policy.component}-v${sameBaseFix}`).toBe("kandev-v1.7.0-kandev.2");

        // A new upstream base is the only reset path: it starts from a separately
        // reviewed manifest value, rather than allowing the current line to reset.
        const nextBaseManifest = Version.parse("1.8.0-kandev.1");
        expect(strategy.bump(nextBaseManifest, fix).toString()).toBe("1.8.0-kandev.2");
        expect(`${policy.component}-v${nextBaseManifest.toString()}`).toBe("kandev-v1.8.0-kandev.1");
        expect(strategy.bump(Version.parse("1.7.0-kandev.2"), fix).toString())
            .not.toContain("kandev.1");
    });

    it("creates byte-reproducible ZIPs after source mtimes change", () => {
        const directory = mkdtempSync(join(tmpdir(), "codex-acp-kandev-zip-"));
        fixtureDirectories.push(directory);
        const binary = join(directory, "codex-acp-kandev-x64-linux");
        const first = join(directory, "first.zip");
        const second = join(directory, "second.zip");
        writeFileSync(binary, "deterministic executable\n");
        chmodSync(binary, 0o755);
        utimesSync(binary, new Date("2020-01-01T00:00:00Z"), new Date("2020-01-01T00:00:00Z"));
        expect(runBinaryPackager(binary, first).status).toBe(0);
        utimesSync(binary, new Date("2030-01-01T00:00:00Z"), new Date("2030-01-01T00:00:00Z"));
        expect(runBinaryPackager(binary, second).status).toBe(0);

        expect(readFileSync(second)).toEqual(readFileSync(first));
    });
});

function createFixture(): string {
    const directory = mkdtempSync(join(tmpdir(), "codex-acp-kandev-policy-"));
    fixtureDirectories.push(directory);
    for (const file of fixtureFiles) {
        cpSync(file, join(directory, file));
    }
    return directory;
}

function runVerifier(fixtureDirectory?: string) {
    return spawnSync(process.execPath, ["scripts/verify-fork-policy.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
            ...process.env,
            ...(fixtureDirectory ? {KANDEV_FORK_POLICY_FIXTURE_DIR: fixtureDirectory} : {}),
        },
    });
}

function runBinaryPackager(binary: string, archive: string) {
    return spawnSync(process.execPath, ["scripts/package-binary.mjs", binary, archive], {
        cwd: process.cwd(),
        encoding: "utf8",
    });
}

function conventionalCommit(type: string): ConventionalCommit {
    return {
        type,
        scope: null,
        notes: [],
        references: [],
        bareMessage: `${type}: fixture`,
        breaking: false,
        sha: type,
        message: `${type}: fixture`,
    };
}
