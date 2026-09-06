import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {afterEach, describe, expect, it} from "vitest";

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
