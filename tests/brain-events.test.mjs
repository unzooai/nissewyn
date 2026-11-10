import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fromAgentRuleDraft,
  toAgentRule,
  toBrainEvent,
  turnOutcome,
} from "../.test-build/brain-events.mjs";
import {
  brainModeFor,
  parseAgentRunSettings,
} from "../.test-build/agent-run-settings.mjs";

test("output.delta 的文字在 text 字段（契约），推理流单独标出", () => {
  const said = toBrainEvent({
    event: "output.delta",
    at: "2026-11-10T03:00:00Z",
    task_id: "task-1",
    run_id: "run-1",
    step_id: "run-1-step-1",
    stream: "assistant",
    text: "已经建好仓库",
  });
  assert.equal(said.message, "已经建好仓库");
  assert.equal(said.stream, "assistant");
  assert.equal(said.taskId, "task-1");

  const thought = toBrainEvent({ event: "output.delta", at: "", stream: "reasoning", text: "先看看目录" });
  assert.equal(thought.stream, "reasoning");
});

test("error 的文字在 error.message；turn.completed 带上收敛状态", () => {
  const error = toBrainEvent({ event: "error", at: "", error: { code: "x", message: "CLI 退出了" } });
  assert.equal(error.message, "CLI 退出了");
  const done = toBrainEvent({ event: "turn.completed", at: "", state: "interrupted" });
  assert.equal(done.state, "interrupted");
});

test("托管会话一轮结束看 turn.completed，不看会话状态", () => {
  assert.deepEqual(turnOutcome([{ event: "output.delta", at: "", message: "x" }]), { done: false });
  assert.deepEqual(
    turnOutcome([
      { event: "approval.resolved", at: "" },
      { event: "turn.completed", at: "", state: "interrupted" },
    ]),
    { done: true, state: "interrupted" },
  );
  assert.deepEqual(turnOutcome([{ event: "turn.completed", at: "" }]), { done: true, state: "finished" });
});

test("规则：unterm 的蛇形字段转过来，不完整的丢掉", () => {
  const rule = toAgentRule({
    id: "rule_1",
    tool: "Bash",
    command_prefix: "git status",
    decision: "allow",
    workspace: "C:\\code\\demo",
    created_at: "2026-11-10T03:00:00Z",
    created_by: "remember",
  });
  assert.equal(rule.commandPrefix, "git status");
  assert.equal(rule.createdBy, "remember");
  assert.equal(toAgentRule({ id: "rule_2", tool: "Bash", decision: "maybe" }), null);
  assert.equal(toAgentRule({ tool: "Bash", decision: "deny" }), null);
});

test("规则草稿：空串当作没给，不会生成只匹配空命令的规则", () => {
  assert.deepEqual(fromAgentRuleDraft({ tool: " Bash ", decision: "deny", commandPrefix: "  ", workspace: "" }), {
    tool: "Bash",
    decision: "deny",
  });
  assert.deepEqual(
    fromAgentRuleDraft({ tool: "Bash", decision: "allow", commandPrefix: "cargo test", workspace: "C:\\w" }),
    { tool: "Bash", decision: "allow", command_prefix: "cargo test", workspace: "C:\\w" },
  );
});

test("运行设置：坏数据退回默认，受管只给 Claude Code", () => {
  assert.deepEqual(parseAgentRunSettings(null), { cwd: "", governed: true });
  assert.deepEqual(parseAgentRunSettings("{oops"), { cwd: "", governed: true });
  assert.deepEqual(parseAgentRunSettings('{"cwd":" C:\\\\w ","governed":false}'), { cwd: "C:\\w", governed: false });
  assert.equal(brainModeFor("claude-code", { cwd: "", governed: true }), "governed");
  assert.equal(brainModeFor("codex-cli", { cwd: "", governed: true }), "hosted");
  assert.equal(brainModeFor("claude-code", { cwd: "", governed: false }), "hosted");
});
