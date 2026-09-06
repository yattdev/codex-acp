import {mkdtempSync, readFileSync, readdirSync, rmSync, statSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join, relative} from "node:path";

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
scanFiles(process.cwd(), files);

const packDirectory = mkdtempSync(join(tmpdir(), "codex-acp-kandev-pack-"));
try {
    const actualReport = JSON.parse(execFileSync(
        "npm",
        ["pack", "--json", "--ignore-scripts", "--pack-destination", packDirectory],
        {encoding: "utf8"},
    ))[0];
    const archive = join(packDirectory, actualReport.filename);
    execFileSync("tar", ["-xzf", archive, "-C", packDirectory]);
    const packageRoot = join(packDirectory, "package");
    const extractedFiles = listFiles(packageRoot).sort();
    if (JSON.stringify(extractedFiles) !== JSON.stringify(files)) {
        throw new Error(`actual tarball inventory differs from dry run: ${JSON.stringify(extractedFiles)}`);
    }
    scanFiles(packageRoot, extractedFiles);
    console.log(
        `Verified ${actualReport.filename}: ${files.length} allowlisted files, actual tarball extracted, no secret patterns`,
    );
} finally {
    rmSync(packDirectory, {recursive: true, force: true});
}

function listFiles(root) {
    const result = [];
    const visit = (directory) => {
        for (const entry of readdirSync(directory, {withFileTypes: true})) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) {
                visit(path);
            } else if (entry.isFile() && statSync(path).isFile()) {
                result.push(relative(root, path).replaceAll("\\", "/"));
            }
        }
    };
    visit(root);
    return result;
}

function scanFiles(root, paths) {
    for (const path of paths) {
        const content = readFileSync(join(root, path), "utf8");
        for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
                throw new Error(`package content matches a secret pattern in ${path}`);
            }
        }
    }
}
