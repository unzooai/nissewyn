import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activityLine,
  activitySummary,
  conversationStatus,
  decisionLabel,
  inlinePieces,
  pendingQuestions,
  replyBlocks,
  riskTone,
  sortConversations,
} from "../.test-build/conversation.mjs";
import { parseAgentRunSettings } from "../.test-build/agent-run-settings.mjs";

const base = { title: "x", description: "x", target: "", progress: 0, updated: "" };

test("a conversation's status comes from its latest turn", () => {
  const running = { ...base, id: "task-1", status: "运行中", runs: [{ id: "r", status: "运行中", startedAt: "", summary: "" }] };
  const waiting = { ...running, runs: [{ ...running.runs[0], waiting: true }] };
  const failed = { ...base, id: "task-2", status: "失败", runs: [{ id: "r", status: "失败", startedAt: "", summary: "" }] };
  const done = { ...base, id: "task-3", status: "已完成", runs: [{ id: "r", status: "成功", startedAt: "", summary: "" }] };
  const scheduled = { ...done, schedule: "每天", status: "待确认" };
  assert.equal(conversationStatus(running), "running");
  assert.equal(conversationStatus(waiting), "waiting");
  assert.equal(conversationStatus(failed), "failed");
  assert.equal(conversationStatus(done), "done");
  assert.equal(conversationStatus(scheduled), "scheduled");
  assert.equal(conversationStatus({ ...base, id: "task-4", status: "已暂停", runs: [] }), "idle");
});

test("conversations that need you come first, then the most recent", () => {
  const at = (id, status, startedAt, waiting = false) => ({
    ...base,
    id,
    status: status === "成功" ? "已完成" : status,
    runs: [{ id: `r-${id}`, status, startedAt, summary: "", waiting }],
  });
  const sorted = sortConversations([
    at("old", "成功", "2026-11-01T00:00:00Z"),
    at("new", "成功", "2026-11-10T00:00:00Z"),
    at("busy", "运行中", "2026-11-02T00:00:00Z"),
    at("asks", "运行中", "2026-11-03T00:00:00Z", true),
  ]);
  assert.deepEqual(sorted.map((task) => task.id), ["asks", "busy", "new", "old"]);
});

test("only an open question in a live turn is pending", () => {
  const activity = [
    { tool: "Bash", verb: "run", target: "npm test", decided_by: "autonomy", decision: "allow" },
    { tool: "Bash", verb: "run", target: "git push", request_id: "r2" },
  ];
  assert.deepEqual(
    pendingQuestions({ state: "running", activity }).map((item) => item.request_id),
    ["r2"],
  );
  assert.deepEqual(pendingQuestions({ state: "succeeded", activity }), []);
});

test("actions read as one line each, with who let them happen", () => {
  assert.equal(activityLine({ tool: "Bash", verb: "run", target: "npm test" }), "Run npm test");
  assert.equal(activityLine({ tool: "mcp__x__y", verb: "use", target: "" }), "Use the mcp__x__y tool");
  assert.equal(decisionLabel({ decided_by: "autonomy", decision: "allow" }), "Auto");
  assert.equal(decisionLabel({ decided_by: "person", decision: "deny" }), "Rejected");
  assert.equal(decisionLabel({ decided_by: "policy", decision: "deny" }), "Refused by rule");
  assert.equal(decisionLabel({ request_id: "r1" }), "Waiting for you");
  assert.equal(decisionLabel({}), null);
  assert.equal(riskTone("destructive"), "high");
  assert.equal(riskTone("external_side_effect"), "medium");
  assert.equal(riskTone("exec"), "low");
  assert.equal(activitySummary([{ decision: "deny" }, {}, {}]), "3 actions, 1 declined");
});

test("a reply is split into paragraphs, lists, code and headings, never HTML", () => {
  const blocks = replyBlocks(
    "## Done\n\nI checked **3** pages:\n- a.html\n- b.html\n  still broken\n\n1. fix\n2. ship\n\n```\nnpm test\n```\n<b>not html</b>",
  );
  assert.deepEqual(
    blocks.map((block) => block.kind),
    ["heading", "paragraph", "list", "list", "code", "paragraph"],
  );
  assert.deepEqual(blocks[2], { kind: "list", ordered: false, items: ["a.html", "b.html still broken"] });
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks[4].text, "npm test");
  assert.equal(blocks[5].text, "<b>not html</b>");
  assert.deepEqual(inlinePieces("run `npm test` **now**"), [
    { kind: "text", text: "run " },
    { kind: "code", text: "npm test" },
    { kind: "text", text: " " },
    { kind: "strong", text: "now" },
  ]);
});

test("autonomy defaults to balanced and refuses unknown levels", () => {
  assert.equal(parseAgentRunSettings(null).autonomy, "balanced");
  assert.equal(parseAgentRunSettings(JSON.stringify({ agent: "claude-code", autonomy: "autonomous" })).autonomy, "autonomous");
  assert.equal(parseAgentRunSettings(JSON.stringify({ agent: "claude-code", autonomy: "yolo" })).autonomy, "balanced");
  assert.equal(parseAgentRunSettings(JSON.stringify({ agent: "agy" })).agent, "agy");
  // The runtime says browser_profile; the console keeps browserProfile.
  assert.equal(parseAgentRunSettings(JSON.stringify({ agent: "claude-code", browser_profile: " default " })).browserProfile, "default");
  assert.equal(parseAgentRunSettings(null).browserProfile, "");
});
