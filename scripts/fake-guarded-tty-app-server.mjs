#!/usr/bin/env node

import {appendFileSync} from "node:fs";
import {createInterface} from "node:readline";

const logPath = process.env["KANDEV_FAKE_APP_SERVER_LOG"];
const sessionId = "packed-session";

const input = createInterface({input: process.stdin});
input.on("line", (line) => {
    const message = JSON.parse(line);
    if (message.id === undefined) return;
    appendFileSync(logPath, `${JSON.stringify({method: message.method, params: message.params})}\n`);

    switch (message.method) {
        case "initialize":
            respond(message.id, {
                userAgent: "fake-app-server/1",
                codexHome: process.cwd(),
                platformFamily: "unix",
                platformOs: "linux",
            });
            break;
        case "account/read":
            respond(message.id, {account: null, requiresOpenaiAuth: false});
            break;
        case "skills/list":
            respond(message.id, {data: []});
            break;
        case "skills/extraRoots/set":
            respond(message.id, {});
            break;
        case "thread/start":
            respond(message.id, createThreadStartResponse(message.params.cwd));
            break;
        case "model/list":
            respond(message.id, {data: [createModel()], nextCursor: null});
            break;
        case "command/exec":
            setTimeout(() => {
                notify("command/exec/outputDelta", {
                    processId: message.params.processId,
                    stream: "stdout",
                    deltaBase64: Buffer.from("packed tty stdout\n").toString("base64"),
                    capReached: false,
                });
                notify("command/exec/outputDelta", {
                    processId: message.params.processId,
                    stream: "stderr",
                    deltaBase64: Buffer.from("packed tty stderr\n").toString("base64"),
                    capReached: false,
                });
                respond(message.id, {exitCode: 0, stdout: "", stderr: ""});
            }, 250);
            break;
        case "command/exec/terminate":
        case "thread/unsubscribe":
            respond(message.id, {});
            break;
        default:
            process.stdout.write(`${JSON.stringify({
                id: message.id,
                error: {code: -32601, message: `Unsupported fake method: ${message.method}`},
            })}\n`);
    }
});

function respond(id, result) {
    process.stdout.write(`${JSON.stringify({id, result})}\n`);
}

function notify(method, params) {
    process.stdout.write(`${JSON.stringify({method, params})}\n`);
}

function createThreadStartResponse(cwd) {
    const sandbox = {
        type: "workspaceWrite",
        writableRoots: [],
        networkAccess: false,
        excludeTmpdirEnvVar: false,
        excludeSlashTmp: false,
    };
    return {
        thread: {
            id: sessionId,
            sessionId,
            forkedFromId: null,
            parentThreadId: null,
            preview: "",
            ephemeral: false,
            section: null,
            sectionEnteredAt: null,
            modelProvider: "openai",
            createdAt: 0,
            updatedAt: 0,
            recencyAt: null,
            status: {type: "idle"},
            path: null,
            cwd,
            cliVersion: "fake",
            source: "appServer",
            threadSource: null,
            agentNickname: null,
            agentRole: null,
            gitInfo: null,
            name: null,
            turns: [],
        },
        model: "test-model",
        modelProvider: "openai",
        serviceTier: null,
        cwd,
        instructionSources: [],
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review",
        sandbox,
        reasoningEffort: "medium",
    };
}

function createModel() {
    return {
        id: "test-model",
        model: "test-model",
        upgrade: null,
        upgradeInfo: null,
        availabilityNux: null,
        displayName: "Test model",
        description: "Fake packaged-artifact model",
        modelSpecialty: null,
        hidden: false,
        supportedReasoningEfforts: [{reasoningEffort: "medium", description: "Balanced"}],
        defaultReasoningEffort: "medium",
        inputModalities: ["text", "image"],
        supportsPersonality: false,
        multiAgentVersion: null,
        additionalSpeedTiers: [],
        serviceTiers: [],
        defaultServiceTier: null,
        isDefault: true,
    };
}
