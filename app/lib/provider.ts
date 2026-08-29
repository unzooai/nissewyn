/**
 * Unzoo One 工作台的数据契约。
 *
 * 控制台目前跑在内存 mock 上（app/data/mock.ts）。这一层的存在是为了让
 * 组件只依赖契约，接真实后端时换实现而不动 UI。
 *
 * 后端对照（2026-08-29 实测 unterm 0.71.0 / unzoo 2.5.32）：
 *
 *   approvals.list        -> unterm approval.list
 *   approvals.decide      -> unterm approval.decide
 *   artifacts.list        -> unterm artifact.list
 *   artifacts.verify      -> unterm artifact.verify
 *   artifacts.remove      -> unterm artifact.forget
 *   artifacts.usage       -> unterm artifact.usage
 *   connectors.list       -> unterm provider.list
 *   connectors.diagnose   -> unterm provider.diagnose
 *   connectors.acquire    -> unterm provider.acquire / unzoo lease_request
 *   connectors.revoke     -> unterm provider.revoke_lease
 *   connectors.leases     -> unterm provider.leases / unzoo lease_list
 *   policy.check          -> unterm policy.check
 *   policy.set            -> unterm policy.set
 *   activity.list         -> unterm audit.verify（只有校验，没有列表，见下）
 *   tasks.*               -> 无对应 MCP 方法，见下
 *
 * 两处已知缺口：
 *
 * 1. 任务的增删改查。unterm 0.71 的 task 命名空间只有 task.export_evidence
 *    和 task.verify_evidence，没有 create / list / update / run。unterm-tasks
 *    crate 存在但没有对外方法，接的时候要么等它补，要么走 Core 的 IPC。
 *
 * 2. 运行记录的读取。audit 命名空间只有 audit.verify（验证证据链），
 *    没有分页查询事件的方法。
 *
 * 另外 ApprovalItem.icon 是 lucide 组件，属于 UI 关注点混进了领域模型。
 * 真实后端不会返回图标，接的时候由 UI 层按 action 或 risk 映射。
 */

import type {
  ActivityItem,
  ApprovalItem,
  ArtifactItem,
  ConnectorCheckResult,
  ConnectorId,
  TaskItem,
  TeamMember,
} from "../types";

/** 审批决定。拒绝需要给出理由，会写进审计记录。 */
export type ApprovalDecision =
  | { kind: "approve" }
  | { kind: "reject"; reason: string };

/** 能力租约。unterm provider.acquire 和 unzoo lease_request 的公共形状。 */
export type CapabilityLease = {
  id: string;
  capability: string;
  holder: string;
  scope: string;
  expiresAt: string;
  status: "active" | "pending" | "expired" | "revoked";
};

/** 策略检查结果。允许时 reason 为空，拒绝或需要审批时说明原因。 */
export type PolicyVerdict = {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
};

export interface TaskPort {
  list(): Promise<TaskItem[]>;
  get(id: string): Promise<TaskItem | null>;
  create(draft: Omit<TaskItem, "id" | "updated" | "progress">): Promise<TaskItem>;
  update(id: string, patch: Partial<TaskItem>): Promise<TaskItem>;
  remove(id: string): Promise<void>;
  pause(id: string): Promise<TaskItem>;
  resume(id: string): Promise<TaskItem>;
  /** unterm task.export_evidence。返回证据包的下载地址或内容。 */
  exportEvidence(id: string): Promise<string>;
  /** unterm task.verify_evidence。校验证据链是否被篡改。 */
  verifyEvidence(id: string): Promise<boolean>;
}

export interface ApprovalPort {
  list(): Promise<ApprovalItem[]>;
  decide(id: string, decision: ApprovalDecision): Promise<void>;
  /** 批量决定。UI 的审批队列支持多选后一次处理。 */
  decideMany(ids: string[], decision: ApprovalDecision): Promise<void>;
  /** 稍后处理。截止时间到了重新回到队列，纯本地状态，后端不感知。 */
  defer(id: string, until: string): Promise<void>;
}

export interface ArtifactPort {
  list(): Promise<ArtifactItem[]>;
  get(id: string): Promise<ArtifactItem | null>;
  update(id: string, patch: Partial<ArtifactItem>): Promise<ArtifactItem>;
  remove(id: string): Promise<void>;
  /** unterm artifact.verify。确认成果内容与产出时一致。 */
  verify(id: string): Promise<boolean>;
  /** unterm artifact.usage。返回本机占用与引用它的任务。 */
  usage(): Promise<{ totalKb: number; count: number }>;
}

export interface ActivityPort {
  list(): Promise<ActivityItem[]>;
  /** 导出全部事件，用于离线归档。 */
  exportAll(): Promise<string>;
}

export interface ConnectorPort {
  list(): Promise<Record<ConnectorId, boolean>>;
  /** unterm provider.diagnose。返回连通性和延迟，失败时带错误码。 */
  diagnose(id: ConnectorId): Promise<ConnectorCheckResult>;
  leases(): Promise<CapabilityLease[]>;
  acquire(capability: string, scope: string, ttlSeconds: number): Promise<CapabilityLease>;
  revoke(leaseId: string): Promise<void>;
}

export interface PolicyPort {
  /** unterm policy.check。执行副作用前问一次，决定是否要走审批。 */
  check(action: string, target: string): Promise<PolicyVerdict>;
  set(rules: Record<string, unknown>): Promise<void>;
}

export interface TeamPort {
  list(): Promise<TeamMember[]>;
  invite(name: string, email: string, role: TeamMember["role"]): Promise<TeamMember>;
  updateRole(id: string, role: TeamMember["role"]): Promise<TeamMember>;
  remove(id: string): Promise<void>;
}

/**
 * 首屏种子。控制台是 SSR 渲染的，首屏必须同步拿到数据，改成异步加载会让
 * 首屏空白、既有的渲染断言也会失败。真实实现由 server component 预取后注入。
 */
export type WorkspaceSnapshot = {
  tasks: TaskItem[];
  approvals: ApprovalItem[];
  artifacts: ArtifactItem[];
  activity: ActivityItem[];
  members: TeamMember[];
  connectors: Record<ConnectorId, boolean>;
};

export interface WorkspaceProvider {
  tasks: TaskPort;
  approvals: ApprovalPort;
  artifacts: ArtifactPort;
  activity: ActivityPort;
  connectors: ConnectorPort;
  policy: PolicyPort;
  team: TeamPort;
  /** 当前状态的同步快照，用于初始化组件 state。 */
  snapshot(): WorkspaceSnapshot;
  /**
   * 出厂数据，纯读、无副作用。
   *
   * 恢复备份和读取本地缓存时只存了 id，要回到完整实体得从全集里按 id 捞，
   * 而当时的"当前状态"可能已经出队或被改过，所以这份不能用 snapshot() 顶替。
   */
  defaults(): WorkspaceSnapshot;
  /** 丢弃全部改动，回到出厂状态并返回它。"重置工作区"走这里。 */
  reset(): WorkspaceSnapshot;
}
