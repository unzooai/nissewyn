/**
 * 内存实现。数据来自 app/data/mock.ts，改动只活在当前页面生命周期里。
 *
 * 这是控制台目前实际跑的实现，也是接真实后端前的行为基准：新实现要让
 * 组件表现不变，才算接对了。
 */

import {
  defaultConnectorStates,
  initialActivityItems,
  initialApprovals,
  initialArtifacts,
  initialTasks,
  initialTeamMembers,
  connectorTestLatencies,
} from "../data/mock";
import type {
  ActivityItem,
  ApprovalItem,
  ArtifactItem,
  ConnectorCheckResult,
  ConnectorId,
  TaskItem,
  TeamMember,
} from "../types";
import type {
  ActivityPort,
  ApprovalDecision,
  ApprovalPort,
  ArtifactPort,
  CapabilityLease,
  ConnectorPort,
  PolicyPort,
  PolicyVerdict,
  TaskPort,
  TeamPort,
  WorkspaceProvider,
  WorkspaceSnapshot,
} from "./provider";

/** 高风险动作的关键词。policy.check 的 mock 判据，真实实现走 unterm 的策略引擎。 */
const externalSendKeywords = ["发送", "上传", "分享", "提交", "发布"];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function nowLabel(): string {
  return "刚刚更新";
}

export function createMockProvider(): WorkspaceProvider {
  // ApprovalItem 和 ConnectorDefinition 带 lucide 组件，不能走 JSON 深拷贝。
  let tasks: TaskItem[] = clone(initialTasks);
  let approvals: ApprovalItem[] = initialApprovals.slice();
  let artifacts: ArtifactItem[] = clone(initialArtifacts);
  let activity: ActivityItem[] = clone(initialActivityItems);
  let members: TeamMember[] = clone(initialTeamMembers);
  const connectors: Record<ConnectorId, boolean> = { ...defaultConnectorStates };
  const leases: CapabilityLease[] = [];

  const taskPort: TaskPort = {
    async list() {
      return clone(tasks);
    },
    async get(id) {
      const found = tasks.find((t) => t.id === id);
      return found ? clone(found) : null;
    },
    async create(draft) {
      if (tasks.some((t) => t.id === draft.id)) throw new Error(`任务 id 已存在: ${draft.id}`);
      const task: TaskItem = { progress: 0, ...clone(draft), updated: nowLabel() };
      tasks = [task, ...tasks];
      return clone(task);
    },
    async update(id, patch) {
      const index = tasks.findIndex((t) => t.id === id);
      if (index === -1) throw new Error(`任务不存在: ${id}`);
      tasks[index] = { ...tasks[index], ...clone(patch), updated: nowLabel() };
      return clone(tasks[index]);
    },
    async remove(id) {
      tasks = tasks.filter((t) => t.id !== id);
      artifacts = artifacts.filter((a) => a.taskId !== id);
      approvals = approvals.filter((a) => a.taskId !== id);
    },
    async pause(id) {
      return taskPort.update(id, { status: "已暂停" });
    },
    async resume(id) {
      return taskPort.update(id, { status: "运行中" });
    },
    async exportEvidence(id) {
      const task = tasks.find((t) => t.id === id);
      if (!task) throw new Error(`任务不存在: ${id}`);
      const related = artifacts.filter((a) => a.taskId === id);
      return JSON.stringify({ task, artifacts: related, exportedAt: new Date().toISOString() }, null, 2);
    },
    async verifyEvidence(id) {
      return tasks.some((t) => t.id === id);
    },
  };

  const approvalPort: ApprovalPort = {
    async list() {
      return approvals.slice();
    },
    async decide(id, decision) {
      return approvalPort.decideMany([id], decision);
    },
    async decideMany(ids, decision) {
      const handled = approvals.filter((a) => ids.includes(a.id));
      approvals = approvals.filter((a) => !ids.includes(a.id));
      for (const item of handled) {
        activity = [
          {
            id: nextId("activity"),
            time: nowLabel(),
            createdAt: new Date().toISOString(),
            title: decision.kind === "approve" ? `已批准：${item.title}` : `已拒绝：${item.title}`,
            detail: decision.kind === "approve" ? item.impact : decision.reason,
            icon: "shield",
            tone: decision.kind === "approve" ? "green" : "red",
            kind: "审批",
            taskId: item.taskId,
          },
          ...activity,
        ];
      }
    },
    async defer() {
      // 稍后处理只改本地队列顺序，后端不感知，mock 不做事。
    },
  };

  const artifactPort: ArtifactPort = {
    async list() {
      return clone(artifacts);
    },
    async get(id) {
      const found = artifacts.find((a) => a.id === id);
      return found ? clone(found) : null;
    },
    async update(id, patch) {
      const index = artifacts.findIndex((a) => a.id === id);
      if (index === -1) throw new Error(`成果不存在: ${id}`);
      artifacts[index] = { ...artifacts[index], ...clone(patch), updated: nowLabel() };
      return clone(artifacts[index]);
    },
    async remove(id) {
      artifacts = artifacts.filter((a) => a.id !== id);
    },
    async verify(id) {
      return artifacts.some((a) => a.id === id);
    },
    async usage() {
      return {
        totalKb: artifacts.reduce((sum, a) => sum + a.sizeKb, 0),
        count: artifacts.length,
      };
    },
  };

  const activityPort: ActivityPort = {
    async list() {
      return clone(activity);
    },
    async exportAll() {
      return JSON.stringify(activity, null, 2);
    },
  };

  const connectorPort: ConnectorPort = {
    async list() {
      return { ...connectors };
    },
    async connect(id) {
      connectors[id] = true;
    },
    async disconnect(id) {
      connectors[id] = false;
      for (const lease of leases) {
        if (lease.capability === id && lease.status === "active") lease.status = "revoked";
      }
    },
    async diagnose(id): Promise<ConnectorCheckResult> {
      return { checkedAt: nowLabel(), latency: connectorTestLatencies[id] };
    },
    async leases() {
      return clone(leases);
    },
    async acquire(capability, scope, ttlSeconds) {
      const lease: CapabilityLease = {
        id: nextId("lease"),
        capability,
        holder: "unzoo-one-console",
        scope,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        status: "active",
      };
      leases.push(lease);
      return clone(lease);
    },
    async revoke(leaseId) {
      const lease = leases.find((l) => l.id === leaseId);
      if (lease) lease.status = "revoked";
    },
  };

  const policyPort: PolicyPort = {
    async check(action, target): Promise<PolicyVerdict> {
      const external = externalSendKeywords.some((k) => action.includes(k));
      if (!external) return { allowed: true, requiresApproval: false };
      return {
        allowed: true,
        requiresApproval: true,
        reason: `${action} 会把内容送到 ${target}，属于外部发送，需要先确认。`,
      };
    },
    async set() {
      // mock 不持久化策略，真实实现走 unterm policy.set。
    },
  };

  const teamPort: TeamPort = {
    async list() {
      return clone(members);
    },
    async invite(member) {
      if (members.some((m) => m.id === member.id)) throw new Error(`成员 id 已存在: ${member.id}`);
      members = [...members, clone(member)];
      return clone(member);
    },
    async updateRole(id, role) {
      const index = members.findIndex((m) => m.id === id);
      if (index === -1) throw new Error(`成员不存在: ${id}`);
      members[index] = { ...members[index], role };
      return clone(members[index]);
    },
    async remove(id) {
      members = members.filter((m) => m.id !== id);
    },
  };

  function snapshot(): WorkspaceSnapshot {
    return {
      tasks: clone(tasks),
      approvals: approvals.slice(),
      artifacts: clone(artifacts),
      activity: clone(activity),
      members: clone(members),
      connectors: { ...connectors },
    };
  }

  function defaults(): WorkspaceSnapshot {
    return {
      tasks: clone(initialTasks),
      approvals: initialApprovals.slice(),
      artifacts: clone(initialArtifacts),
      activity: clone(initialActivityItems),
      members: clone(initialTeamMembers),
      connectors: { ...defaultConnectorStates },
    };
  }

  function reset(): WorkspaceSnapshot {
    const factory = defaults();
    tasks = factory.tasks;
    approvals = factory.approvals;
    artifacts = factory.artifacts;
    activity = factory.activity;
    members = factory.members;
    Object.assign(connectors, factory.connectors);
    leases.length = 0;
    return snapshot();
  }

  return {
    tasks: taskPort,
    approvals: approvalPort,
    artifacts: artifactPort,
    activity: activityPort,
    connectors: connectorPort,
    policy: policyPort,
    team: teamPort,
    snapshot,
    defaults,
    reset,
  };
}

let current: WorkspaceProvider | null = null;

/** 当前生效的实现。接真实后端时改这里，组件不用动。 */
export function getProvider(): WorkspaceProvider {
  if (!current) current = createMockProvider();
  return current;
}

/** 测试用：换掉实现或重置内存状态。 */
export function setProvider(provider: WorkspaceProvider | null): void {
  current = provider;
}
