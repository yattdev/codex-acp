import assert from "node:assert/strict";
import {execFileSync, spawn} from "node:child_process";
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {Readable, Writable} from "node:stream";
import * as acp from "@agentclientprotocol/sdk";

const root = mkdtempSync(join(tmpdir(), "codex-acp-kandev-packed-"));
const packageDirectory = join(root, "package");
const installDirectory = join(root, "install");
const workspaceDirectory = join(root, "workspace");
const appServerLog = join(root, "app-server-requests.ndjson");
const fakeAppServer = resolve("scripts/fake-guarded-tty-app-server.mjs");
let agentProcess;

try {
    mkdirSync(packageDirectory);
    mkdirSync(workspaceDirectory);
    const packReport = JSON.parse(execFileSync("npm", [
        "pack",
        "--json",
        "--ignore-scripts",
        "--pack-destination",
        packageDirectory,
    ], {encoding: "utf8"}))[0];
    const tarball = join(packageDirectory, packReport.filename);
    execFileSync("npm", [
        "install",
        "--prefix",
        installDirectory,
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        tarball,
    ], {stdio: "inherit"});

    chmodSync(fakeAppServer, 0o755);
    const executable = process.platform === "win32"
        ? join(installDirectory, "node_modules", ".bin", "codex-acp-kandev.cmd")
        : join(installDirectory, "node_modules", ".bin", "codex-acp-kandev");
    assert.equal(
        execFileSync(executable, ["--version"], {encoding: "utf8"}).trim(),
        "@yattdev/codex-acp-kandev 1.7.0-kandev.1",
    );
    agentProcess = spawn(executable, [], {
        env: {
            ...process.env,
            CODEX_PATH: fakeAppServer,
            INITIAL_AGENT_MODE: "agent",
            KANDEV_FAKE_APP_SERVER_LOG: appServerLog,
        },
        stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    agentProcess.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
    });
    const connection = new acp.ClientSideConnection(
        () => ({
            requestPermission: async () => ({outcome: {outcome: "cancelled"}}),
            sessionUpdate: async () => {},
        }),
        acp.ndJsonStream(
            Writable.toWeb(agentProcess.stdin),
            Readable.toWeb(agentProcess.stdout),
        ),
    );

    const initialized = await connection.initialize({
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: {},
        clientInfo: {name: "packed-contract-test", version: "1"},
    });
    assert.deepEqual(initialized._meta.guardedTtyExec, {
        capability: "kandev.guarded-tty-exec",
        version: 1,
        capabilityMethod: "_kandev/guarded_tty/capability",
        execMethod: "_kandev/guarded_tty/exec",
    });

    const session = await connection.newSession({cwd: workspaceDirectory, mcpServers: []});
    assert.equal(session.sessionId, "packed-session");
    const capability = await connection.extMethod("_kandev/guarded_tty/capability", {
        sessionId: session.sessionId,
    });
    assert.equal(capability.supported, true);
    assert.equal(capability.version, 1);

    const execution = connection.extMethod("_kandev/guarded_tty/exec", {
        sessionId: session.sessionId,
        argv: ["sh", "-lc", "test -t 0 && test -t 1"],
    });
    const concurrentProbe = await connection.extMethod("_kandev/guarded_tty/capability", {
        sessionId: session.sessionId,
    });
    assert.equal(concurrentProbe.supported, true);

    const receipt = await execution;
    assert.deepEqual({
        capability: receipt.capability,
        version: receipt.version,
        session_id: receipt.session_id,
        method: receipt.method,
        requested_tty: receipt.requested_tty,
        dispatched_tty: receipt.dispatched_tty,
        cwd: receipt.cwd,
        outcome: receipt.outcome,
        denial_code: receipt.denial_code,
        stdout: receipt.stdout,
        stderr: receipt.stderr,
        exit_code: receipt.exit_code,
    }, {
        capability: "kandev.guarded-tty-exec",
        version: 1,
        session_id: session.sessionId,
        method: "command/exec",
        requested_tty: true,
        dispatched_tty: true,
        cwd: workspaceDirectory,
        outcome: "completed",
        denial_code: null,
        stdout: "packed tty stdout\n",
        stderr: "packed tty stderr\n",
        exit_code: 0,
    });

    await assert.rejects(connection.extMethod("_kandev/guarded_tty/exec", {
        sessionId: session.sessionId,
        argv: ["pwd"],
        cwd: "/caller-controlled",
    }));
    const stale = await connection.extMethod("_kandev/guarded_tty/exec", {
        sessionId: "unknown-session",
        argv: ["pwd"],
    });
    assert.deepEqual({
        outcome: stale.outcome,
        denial_code: stale.denial_code,
        dispatched_tty: stale.dispatched_tty,
        process_id: stale.process_id,
        cwd: stale.cwd,
    }, {
        outcome: "denied",
        denial_code: "stale_session",
        dispatched_tty: false,
        process_id: null,
        cwd: null,
    });

    const requests = readFileSync(appServerLog, "utf8").trim().split("\n").map(JSON.parse);
    const commandRequests = requests.filter((request) => request.method === "command/exec");
    assert.equal(commandRequests.length, 1, "denied/malformed calls must not dispatch");
    assert.deepEqual(commandRequests[0].params, {
        command: ["sh", "-lc", "test -t 0 && test -t 1"],
        processId: receipt.process_id,
        tty: true,
        streamStdin: true,
        streamStdoutStderr: true,
        outputBytesCap: 65536,
        timeoutMs: 10000,
        cwd: workspaceDirectory,
        sandboxPolicy: {
            type: "workspaceWrite",
            writableRoots: [],
            networkAccess: false,
            excludeTmpdirEnvVar: false,
            excludeSlashTmp: false,
        },
    });

    await connection.closeSession({sessionId: session.sessionId});
    agentProcess.stdin.end();
    const exitCode = await waitForExit(agentProcess, 5_000);
    assert.equal(exitCode, 0, `packed agent failed: ${stderr}`);
    console.log(`Verified packed guarded-TTY contract for ${packReport.name}@${packReport.version}`);
} finally {
    if (agentProcess && agentProcess.exitCode === null) agentProcess.kill();
    rmSync(root, {recursive: true, force: true});
}

async function waitForExit(child, timeoutMs) {
    if (child.exitCode !== null) return child.exitCode;
    return await Promise.race([
        new Promise((resolveExit) => child.once("exit", resolveExit)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("packed agent did not exit")), timeoutMs)),
    ]);
}
