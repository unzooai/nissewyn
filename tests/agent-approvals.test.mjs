import assert from "node:assert/strict";
import { test } from "node:test";

import {
  agentApprovalId,
  isAgentApprovalId,
  parseAgentApprovalId,
  reconcileAgentApprovals,
  toApprovalItem,
} from "../.test-build/agent-approvals.mjs";

// unterm GET /api/agent/approvals 的一条，取自一次真实的托管 Claude 会话。
const claudeAsks = {
  session_id: "ags_e0cf5d3d40994840b57957747887075e",
  adapter: "claude",
  at: "2026-11-10T03:00:00+00:00",
  task_id: "task_01JBQ8XG4T7N2M9V0KRSD3WZ1A",
  event: "approval.requested",
  approval: {
    request_id: "31551e4b-7fbb-46cf-86b1-06f0360c2dc5",
    description: "Write hi to out.txt",
    tool_call: { tool: "Bash", arguments: { command: "echo hi > out.txt", description: "Write hi to out.txt" } },
  },
};

test("托管审批：id 能反解回会话和请求，请求 id 里带冒号也不切错", () => {
  const id = agentApprovalId("ags_1", "req:with:colons");
  assert.ok(isAgentApprovalId(id));
  assert.deepEqual(parseAgentApprovalId(id), { sessionId: "ags_1", requestId: "req:with:colons" });
  assert.equal(parseAgentApprovalId("send-summary"), null, "本地审批不是托管审批");
  assert.equal(parseAgentApprovalId("agent:ags_1:"), null, "缺请求 id 不算");
  assert.equal(isAgentApprovalId("send-summary"), false);
});

test("托管审批：一条 approval.requested 变成收件箱里说清楚要做什么的一条", () => {
  const now = Date.parse("2026-11-10T03:05:30+00:00");
  const item = toApprovalItem(claudeAsks, now);
  assert.equal(item.id, `agent:${claudeAsks.session_id}:${claudeAsks.approval.request_id}`);
  assert.equal(item.taskId, claudeAsks.task_id, "挂回调用方给的任务");
  assert.equal(item.title, "Claude Code 请求执行命令");
  assert.equal(item.target, "echo hi > out.txt", "命令原文，而不是整段 JSON");
  assert.equal(item.reason, "Write hi to out.txt");
  assert.equal(item.scope, "仅本次调用");
  assert.equal(item.risk, "中风险");
  assert.equal(item.requestedAt, "5 分钟前");

  // agy 的命令在 CommandLine 里；Codex 的补丁、权限请求各有各的样子。
  const agy = toApprovalItem({
    session_id: "ags_2", adapter: "agy",
    approval: { request_id: "1", tool_call: { tool: "run_command", arguments: { CommandLine: "echo hi > out.txt" } } },
  });
  assert.equal(agy.title, "Antigravity 请求执行命令");
  assert.equal(agy.target, "echo hi > out.txt");
  assert.equal(agy.requestedAt, "刚刚", "没有时间就当刚刚");

  const patch = toApprovalItem({
    session_id: "ags_3", adapter: "codex",
    approval: { request_id: "5", tool_call: { tool: "apply_patch", arguments: [{ path: "a.txt", kind: "add" }] } },
  });
  assert.equal(patch.action, "修改文件");
  assert.match(patch.target, /a\.txt/);

  const perms = toApprovalItem({
    session_id: "ags_4", adapter: "codex",
    approval: { request_id: "9", tool_call: { tool: "permissions", arguments: { network: { enabled: true } } } },
  });
  assert.equal(perms.risk, "高风险", "放宽权限影响之后的每一次调用");
});

test("托管审批：轮询结果并进队列，只动托管的那些，没变化就不换数组", () => {
  const local = { ...toApprovalItem(claudeAsks), id: "send-summary" };
  const a = toApprovalItem(claudeAsks);
  const b = toApprovalItem({ ...claudeAsks, approval: { ...claudeAsks.approval, request_id: "second" } });

  const first = reconcileAgentApprovals([local], [a]);
  assert.deepEqual(first.map((x) => x.id), ["send-summary", a.id], "新问题追加在后面");

  const same = reconcileAgentApprovals(first, [a]);
  assert.equal(same, first, "没变化时原样返回，不触发重渲染");

  const next = reconcileAgentApprovals(first, [b]);
  assert.deepEqual(next.map((x) => x.id), ["send-summary", b.id], "答复过的去掉，新的进来，本地的不动");

  assert.deepEqual(reconcileAgentApprovals(next, []).map((x) => x.id), ["send-summary"], "unterm 那边空了就全清掉");
});
