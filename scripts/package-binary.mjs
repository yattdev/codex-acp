#!/usr/bin/env node

import {chmodSync, rmSync, statSync, utimesSync} from "node:fs";
import {basename, dirname, resolve} from "node:path";
import {spawnSync} from "node:child_process";

const [inputArgument, archiveArgument] = process.argv.slice(2);
if (!inputArgument || !archiveArgument) {
    throw new Error("usage: package-binary.mjs <binary> <archive.zip>");
}

const input = resolve(inputArgument);
const archive = resolve(archiveArgument);
if (dirname(input) !== dirname(archive) || !basename(archive).endsWith(".zip")) {
    throw new Error("binary and ZIP archive must share one directory");
}
if (!statSync(input).isFile()) {
    throw new Error(`${inputArgument} is not a regular file`);
}

// Info-ZIP otherwise records the fresh Bun output mtime and platform-specific
// extra fields. Normalize both so a retry of the same source commit produces
// the exact archive bytes required by the immutable release check.
const epoch = new Date("1980-01-01T00:00:00.000Z");
chmodSync(input, 0o755);
utimesSync(input, epoch, epoch);
rmSync(archive, {force: true});
const result = spawnSync("zip", ["-X", "-9", basename(archive), basename(input)], {
    cwd: dirname(input),
    env: {...process.env, TZ: "UTC"},
    encoding: "utf8",
});
if (result.status !== 0) {
    throw new Error(`zip failed: ${result.stderr || result.stdout}`);
}
