import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = process.argv[2] ?? pkg.version;
const tag = process.argv[3] ?? `kandev-v${version}`;
const packageId = `pkg:npm/%40yattdev/codex-acp-kandev@${version}`;
const expectedRef = `refs/tags/${tag}`;
const expectedCommit = execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim();
const expectedIntegrity = process.env["EXPECTED_NPM_INTEGRITY"];
const expectedShasum = process.env["EXPECTED_NPM_SHASUM"];

assert(pkg.name === "@yattdev/codex-acp-kandev", `unexpected package ${pkg.name}`);
assert(version === pkg.version, `expected package version ${pkg.version}, received ${version}`);
assert(tag === `kandev-v${version}`, `unexpected release tag ${tag}`);

const metadataUrl = `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${encodeURIComponent(version)}`;
const metadata = await fetchJsonWithRetry(
    metadataUrl,
    (value) => typeof value.dist?.attestations?.url === "string",
);
assert(typeof expectedIntegrity === "string" && expectedIntegrity.length > 0,
    "EXPECTED_NPM_INTEGRITY is required");
assert(typeof expectedShasum === "string" && expectedShasum.length > 0,
    "EXPECTED_NPM_SHASUM is required");
assert(metadata.dist?.integrity === expectedIntegrity, "published npm integrity differs from the reviewed tarball");
assert(metadata.dist?.shasum === expectedShasum, "published npm shasum differs from the reviewed tarball");
const attestationsUrl = metadata.dist?.attestations?.url;
assert(typeof attestationsUrl === "string", "published package is missing npm attestations");
const document = await fetchJsonWithRetry(
    attestationsUrl,
    (value) => value.attestations?.some(
        (attestation) => attestation.predicateType === "https://slsa.dev/provenance/v1",
    ),
);
assert(Array.isArray(document.attestations), "npm attestation response is malformed");

const statements = document.attestations.map((attestation) => {
    const payload = attestation.bundle?.dsseEnvelope?.payload;
    assert(typeof payload === "string", "npm attestation is missing its DSSE payload");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
});
const provenance = statements.find((statement) => statement.predicateType === "https://slsa.dev/provenance/v1");
assert(provenance, "npm package is missing SLSA provenance");
assert(provenance.subject?.some((subject) => subject.name === packageId), "provenance subject is not the exact package");

const workflow = provenance.predicate?.buildDefinition?.externalParameters?.workflow;
assert(workflow?.repository === "https://github.com/yattdev/codex-acp", "provenance repository mismatch");
assert(workflow?.path === ".github/workflows/publish.yml", "provenance workflow mismatch");
assert(workflow?.ref === expectedRef, `provenance ref must be ${expectedRef}`);
assert(
    provenance.predicate?.runDetails?.builder?.id === "https://github.com/actions/runner/github-hosted",
    "publication did not use a GitHub-hosted runner",
);
assert(
    provenance.predicate?.buildDefinition?.resolvedDependencies?.some(
        (dependency) => dependency.digest?.gitCommit === expectedCommit,
    ),
    "provenance does not resolve to the checked-out release commit",
);

console.log(`Verified npm provenance for ${pkg.name}@${version} from ${expectedRef}`);

async function fetchJsonWithRetry(url, isReady = () => true) {
    let lastError;
    for (let attempt = 1; attempt <= 12; attempt += 1) {
        try {
            const response = await fetch(url, {headers: {accept: "application/json"}});
            if (response.ok) {
                const value = await response.json();
                if (isReady(value)) return value;
                lastError = new Error(`${url} is available but required provenance is not ready`);
            } else {
                lastError = new Error(`${url} returned HTTP ${response.status}`);
            }
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    throw lastError;
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}
