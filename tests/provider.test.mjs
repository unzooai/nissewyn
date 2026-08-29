import assert from "node:assert/strict";
import { test } from "node:test";

import { createMockProvider } from "../.test-build/provider.mjs";

test("任务：列出、创建、改状态、删除", async () => {
  const p = createMockProvider();
  const before = await p.tasks.list();
  assert.ok(before.length > 0, "mock 应该有初始任务");

  const created = await p.tasks.create({
    title: "契约测试任务",
    description: "验证 create 返回完整实体",
    target: "example.com",
    status: "运行中",
  });
  assert.match(created.id, /^task-/);
  assert.equal(created.progress, 0);
  assert.equal((await p.tasks.list()).length, before.length + 1);

  const paused = await p.tasks.pause(created.id);
  assert.equal(paused.status, "已暂停");
  assert.equal((await p.tasks.get(created.id)).status, "已暂停");

  await p.tasks.remove(created.id);
  assert.equal(await p.tasks.get(created.id), null);
  assert.equal((await p.tasks.list()).length, before.length);
});

test("任务：删除会连带清掉它的成果和待审批", async () => {
  const p = createMockProvider();
  const artifacts = await p.artifacts.list();
  const target = artifacts[0].taskId;
  assert.ok(target, "取一个有成果的任务");

  await p.tasks.remove(target);
  const left = await p.artifacts.list();
  assert.equal(left.filter((a) => a.taskId === target).length, 0);
  const approvals = await p.approvals.list();
  assert.equal(approvals.filter((a) => a.taskId === target).length, 0);
});

test("审批：批准和拒绝都出队并写进运行记录", async () => {
  const p = createMockProvider();
  const [first, second] = await p.approvals.list();
  const activityBefore = (await p.activity.list()).length;

  await p.approvals.decide(first.id, { kind: "approve" });
  let left = await p.approvals.list();
  assert.equal(left.find((a) => a.id === first.id), undefined);

  await p.approvals.decide(second.id, { kind: "reject", reason: "范围超出预期" });
  left = await p.approvals.list();
  assert.equal(left.find((a) => a.id === second.id), undefined);

  const activity = await p.activity.list();
  assert.equal(activity.length, activityBefore + 2);
  assert.equal(activity[0].kind, "审批");
  assert.equal(activity[0].detail, "范围超出预期");
});

test("审批：批量决定一次清空多条", async () => {
  const p = createMockProvider();
  const all = await p.approvals.list();
  await p.approvals.decideMany(all.map((a) => a.id), { kind: "approve" });
  assert.equal((await p.approvals.list()).length, 0);
});

test("成果：改动落库，用量随之变化", async () => {
  const p = createMockProvider();
  const [item] = await p.artifacts.list();
  const usageBefore = await p.artifacts.usage();

  const updated = await p.artifacts.update(item.id, { starred: true });
  assert.equal(updated.starred, true);
  assert.equal((await p.artifacts.get(item.id)).starred, true);
  assert.equal(await p.artifacts.verify(item.id), true);

  await p.artifacts.remove(item.id);
  const usageAfter = await p.artifacts.usage();
  assert.equal(usageAfter.count, usageBefore.count - 1);
  assert.ok(Math.abs(usageAfter.totalKb - (usageBefore.totalKb - item.sizeKb)) < 0.001);
  assert.equal(await p.artifacts.verify(item.id), false);
});

test("策略：外部发送要审批，本地读取不用", async () => {
  const p = createMockProvider();
  const send = await p.policy.check("发送摘要", "领导沟通群");
  assert.equal(send.requiresApproval, true);
  assert.ok(send.reason?.includes("领导沟通群"));

  const read = await p.policy.check("读取页面", "competitor.com");
  assert.equal(read.requiresApproval, false);
});

test("连接器：租约有有效期，撤销后状态变更", async () => {
  const p = createMockProvider();
  assert.equal((await p.connectors.leases()).length, 0);

  const lease = await p.connectors.acquire("browser", "仅当前页面", 900);
  assert.equal(lease.status, "active");
  assert.equal(lease.capability, "browser");
  assert.ok(new Date(lease.expiresAt).getTime() > Date.now());

  await p.connectors.revoke(lease.id);
  const [after] = await p.connectors.leases();
  assert.equal(after.status, "revoked");
});

test("连接器：诊断返回延迟", async () => {
  const p = createMockProvider();
  const result = await p.connectors.diagnose("browser");
  assert.equal(typeof result.latency, "number");
  assert.ok(result.checkedAt);
});

test("团队：邀请的成员处于待接受状态", async () => {
  const p = createMockProvider();
  const before = await p.team.list();
  const member = await p.team.invite("张三", "zhangsan@unzoo.local", "成员");
  assert.equal(member.status, "已邀请");
  assert.equal((await p.team.list()).length, before.length + 1);

  const promoted = await p.team.updateRole(member.id, "审批者");
  assert.equal(promoted.role, "审批者");

  await p.team.remove(member.id);
  assert.equal((await p.team.list()).length, before.length);
});

test("provider 之间互不共享状态", async () => {
  const a = createMockProvider();
  const b = createMockProvider();
  const countBefore = (await b.tasks.list()).length;
  await a.tasks.remove((await a.tasks.list())[0].id);
  assert.equal((await b.tasks.list()).length, countBefore);
});

test("返回的是副本，改它不会污染 provider 内部状态", async () => {
  const p = createMockProvider();
  const tasks = await p.tasks.list();
  tasks[0].title = "被外部改掉了";
  const again = await p.tasks.list();
  assert.notEqual(again[0].title, "被外部改掉了");
});
