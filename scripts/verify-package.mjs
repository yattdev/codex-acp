import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

const output = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {encoding: "utf8"},
);
const reports = JSON.parse(output);
if (!Array.isArray(reports) || reports.length !== 1) {
    throw new Error("npm pack must describe exactly one package");
}

const report = reports[0];
if (report.name !== "@yattdev/codex-acp-kandev" || report.version !== "1.7.0-kandev.1") {
    throw new Error(`unexpected package identity: ${report.name}@${report.version}`);
}

const files = report.files.map((file) => file.path).sort();
const required = [
    "CHANGELOG-KANDEV.md",
    "CHANGELOG.md",
    "LICENSE",
    "NOTICE",
    "README.md",
    "SECURITY.md",
    "dist/index.js",
    "docs/MAINTENANCE.md",
    "docs/guarded-tty-kandev.md",
    "fork-compatibility.json",
    "package.json",
];
for (const path of required) {
    if (!files.includes(path)) {
        throw new Error(`package is missing ${path}`);
    }
}

const allowed = new Set(required);
for (const path of files) {
    if (!allowed.has(path)) {
        throw new Error(`package contains unexpected file ${path}`);
    }
    if (path.endsWith(".map") || path.includes("node_modules") || path.includes("__tests__")) {
        throw new Error(`package contains forbidden file ${path}`);
    }
}

const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\/data\/tasks\//,
    /\/home\/runner\/work\//,
    /[A-Za-z]:\\Users\\[^\\]+\\/,
];
for (const path of files) {
    const content = readFileSync(path, "utf8");
    for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
            throw new Error(`package content matches a secret pattern in ${path}`);
        }
    }
}

console.log(`Verified ${report.filename}: ${files.length} allowlisted files, no secret patterns`);
