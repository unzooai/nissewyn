import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Unzoo One task console", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>Unzoo One \| AI 任务操作系统<\/title>/);
  assert.match(html, /下午好，今天有 4 件事需要你处理/);
  assert.match(html, /跟踪竞品发布动态/);
  assert.match(html, /需要你处理/);
  assert.match(html, /你交给 Unzoo One 的工作/);
  assert.match(html, /ai-core-premium\.webp/);
  assert.match(html, /unzoo-one-mark\.svg/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("keeps commercial task interactions and accessibility in source", async () => {
  const [page, css, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/clarity.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const taskFilters: TaskFilter\[\]/);
  assert.match(page, /window\.localStorage\.setItem\("unzoo-one-tasks"/);
  assert.match(page, /window\.localStorage\.setItem\("unzoo-one-settings"/);
  assert.match(page, /"unzoo-one-connectors"/);
  assert.match(page, /"unzoo-one-team"/);
  assert.match(page, /"unzoo-one-usage"/);
  assert.match(page, /"unzoo-one-schema-version", "9"/);
  assert.match(page, /window\.localStorage\.setItem\(\s*"unzoo-one-activity"/);
  assert.match(page, /window\.localStorage\.setItem\(\s*"unzoo-one-artifacts"/);
  assert.match(page, /"unzoo-one-pending-approvals"/);
  assert.match(page, /function createTask/);
  assert.match(page, /function beginEditTask/);
  assert.match(page, /function duplicateTask/);
  assert.match(page, /function confirmDeleteTask/);
  assert.match(page, /function recordActivity/);
  assert.match(page, /type ApprovalRisk =/);
  assert.match(page, /type ArtifactItem =/);
  assert.match(page, /const initialArtifacts: ArtifactItem\[\]/);
  assert.match(page, /function isArtifactItem/);
  assert.match(page, /function openTaskArtifacts/);
  assert.match(page, /function downloadArtifact/);
  assert.match(page, /async function copyArtifactContent/);
  assert.match(page, /function toggleArtifactStar/);
  assert.match(page, /type ArtifactRevision =/);
  assert.match(page, /function artifactCanBeEdited/);
  assert.match(page, /function openArtifactEditor/);
  assert.match(page, /function requestCloseArtifactEditor/);
  assert.match(page, /function loadArtifactRevision/);
  assert.match(page, /async function saveArtifactEdit/);
  assert.match(page, /status: artifact\.type === "报告" \? "已修订"/);
  assert.match(page, /aria-labelledby="artifact-editor-title"/);
  assert.match(page, /aria-labelledby="artifact-discard-title"/);
  assert.match(page, /function requestToggleLocalPersistence/);
  assert.match(page, /function confirmTemporaryMode/);
  assert.match(page, /type ConnectorId =/);
  assert.match(page, /const defaultConnectorStates/);
  assert.match(page, /const connectorCatalog/);
  assert.match(page, /function isConnectorState/);
  assert.match(page, /function connectConnector/);
  assert.match(page, /function testConnector/);
  assert.match(page, /function confirmDisconnectConnector/);
  assert.match(page, /connectors: connectorStates/);
  assert.match(page, /selectedConnectorId/);
  assert.match(page, /type TeamMember =/);
  assert.match(page, /const initialTeamMembers/);
  assert.match(page, /const teamRoleDetails/);
  assert.match(page, /function isTeamMember/);
  assert.match(page, /function inviteTeamMember/);
  assert.match(page, /function saveTeamMemberRole/);
  assert.match(page, /function confirmRemoveTeamMember/);
  assert.match(page, /members: teamMembers/);
  assert.match(page, /teamInviteFormErrors/);
  assert.match(page, /type UsageSettings =/);
  assert.match(page, /const defaultUsageSettings: UsageSettings/);
  assert.match(page, /function isUsageSettings/);
  assert.match(page, /function openUsageBudget/);
  assert.match(page, /function saveUsageBudget/);
  assert.match(page, /function exportUsageReport/);
  assert.match(page, /usage: usageSettings/);
  assert.match(page, /aria-label="本月 AI 额度使用"/);
  assert.match(page, /function scrollWorkspaceTop/);
  assert.match(page, /temporaryModeOpen/);
  assert.match(page, /关闭页面后保留工作区/);
  assert.match(page, /mobileLabel/);
  assert.match(page, /clarity-mobile-topbar/);
  assert.match(page, /clarity-mobile-create/);
  assert.match(page, /aria-current=/);
  assert.match(page, /function requestRejectApproval/);
  assert.match(page, /function confirmRejectApproval/);
  assert.match(page, /function chooseApproval/);
  assert.match(page, /function scrollApprovalIntoView/);
  assert.match(page, /approvalDetailRef/);
  assert.match(page, /rejectedApproval/);
  assert.match(page, /拒绝后自动暂停任务/);
  assert.match(page, /function exportActivity/);
  assert.match(page, /function exportActivityItem/);
  assert.match(page, /aria-label="搜索运行记录"/);
  assert.match(page, /aria-label="运行记录排序"/);
  assert.match(page, /aria-label="复制事件 ID"/);
  assert.match(page, /function exportWorkspace/);
  assert.match(page, /async function importWorkspace/);
  assert.match(page, /type PendingWorkspaceImport =/);
  assert.match(page, /pendingWorkspaceImport/);
  assert.match(page, /function confirmWorkspaceImport/);
  assert.match(page, /Number\.isNaN\(Date\.parse\(backup\.exportedAt\)\)/);
  assert.match(page, /备份已通过校验/);
  assert.match(page, /确认并恢复/);
  assert.match(page, /先备份当前工作区/);
  assert.match(page, /function resetWorkspace/);
  assert.match(page, /function parseWorkspaceBackup/);
  assert.match(page, /workspaceResetOpen/);
  assert.match(page, /accept="\.json,application\/json"/);
  assert.match(page, /function openTaskActivity/);
  assert.match(page, /const scopedActivityLog = useMemo/);
  assert.match(page, /selectedTaskActivity\.map/);
  assert.match(page, /activityTaskId/);
  assert.match(page, /const taskTemplates:/);
  assert.match(page, /type TaskSchedule =/);
  assert.match(page, /type Weekday =/);
  assert.match(page, /function formatTaskSchedule/);
  assert.match(page, /function getNextRunLabel/);
  assert.match(page, /taskScheduleTime/);
  assert.match(page, /taskScheduleDay/);
  assert.match(page, /role="radiogroup"/);
  assert.match(page, /aria-label="运行记录筛选"/);
  assert.match(page, /role="switch"/);
  assert.match(page, /<textarea/);
  assert.match(page, /<select/);
  assert.match(page, /type="time"/);
  assert.match(page, /function updateTaskStatus/);
  assert.match(page, /type TaskRunStatus =/);
  assert.match(page, /type TaskRun =/);
  assert.match(page, /function isTaskRun/);
  assert.match(page, /function retryTask/);
  assert.match(page, /function formatTaskRunDuration/);
  assert.match(page, /MAIL_AUTH_EXPIRED/);
  assert.match(page, /任务未完成，但没有执行外部发送/);
  assert.match(page, /aria-label="运行健康"/);
  assert.match(page, /selectedTaskIds/);
  assert.match(page, /function toggleAllVisibleTasks/);
  assert.match(page, /function bulkPauseTasks/);
  assert.match(page, /function bulkResumeTasks/);
  assert.match(page, /function bulkEnableApproval/);
  assert.match(page, /function confirmBulkDelete/);
  assert.match(page, /function undoBulkDelete/);
  assert.match(page, /role="toolbar"/);
  assert.match(page, /全选当前/);
  assert.match(page, /approvalListQuery/);
  assert.match(page, /approvalRiskFilter/);
  assert.match(page, /selectedApprovalIds/);
  assert.match(page, /function toggleAllVisibleApprovals/);
  assert.match(page, /function confirmBulkApprove/);
  assert.match(page, /function confirmBulkReject/);
  assert.match(page, /approval\.risk !== "高风险"/);
  assert.match(page, /approvalRejectReason\.trim\(\)\.length < 4/);
  assert.match(page, /aria-label="批量审批操作"/);
  assert.match(page, /aria-label="审批风险筛选"/);
  assert.match(page, /useRef<HTMLInputElement>/);
  assert.match(page, /function chooseSearchResult/);
  assert.match(page, /function handleSearchKeyDown/);
  assert.match(page, /aria-controls="global-search-results"/);
  assert.match(page, /role="listbox"/);
  assert.match(page, /role="option"/);
  assert.match(page, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /role="alertdialog"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /role="tab"/);
  assert.match(page, /aria-selected=/);
  assert.match(css, /\.task-detail-drawer/);
  assert.match(css, /\.task-detail-intro-heading/);
  assert.match(css, /\.task-failure-diagnostic/);
  assert.match(css, /\.task-run-health/);
  assert.match(css, /\.task-run-list/);
  assert.match(css, /\.status-label\.status-失败/);
  assert.match(page, /执行边界与审计/);
  assert.match(page, /打开完整运行记录/);
  assert.match(css, /\.settings-trust-center/);
  assert.match(css, /\.settings-connectors-center/);
  assert.match(css, /\.settings-connector-grid/);
  assert.match(css, /\.connector-detail-dialog/);
  assert.match(css, /\.connector-disconnect-confirm/);
  assert.match(css, /\.settings-team-center/);
  assert.match(css, /\.settings-team-row/);
  assert.match(css, /\.team-invite-dialog/);
  assert.match(css, /\.team-member-dialog/);
  assert.match(css, /\.team-member-remove-confirm/);
  assert.match(css, /\.settings-usage-center/);
  assert.match(css, /\.settings-usage-center\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
  assert.match(css, /\.usage-budget-track/);
  assert.match(css, /\.usage-breakdown-list/);
  assert.match(css, /\.usage-budget-dialog/);
  assert.match(css, /\.usage-budget-warning/);
  assert.match(page, /handleOverlayKeyDown/);
  assert.match(page, /data-overlay-initial-focus/);
  assert.match(page, /notificationWrapRef/);
  assert.match(page, /recentSearchKeys/);
  assert.match(page, /readNotificationIds/);
  assert.match(page, /workspaceLoadWarning/);
  assert.match(page, /aria-busy={!tasksReady}/);
  assert.match(page, /className="workspace-loading"/);
  assert.match(page, /role="status"/);
  assert.match(page, /type TaskFormErrors =/);
  assert.match(page, /taskFormSubmitted/);
  assert.match(page, /taskFormHasErrors/);
  assert.match(page, /aria-invalid=/);
  assert.match(page, /composer-error-summary/);
  assert.match(page, /role="alert"/);
  assert.match(page, /isSavingTask/);
  assert.match(page, /aria-label="通知筛选"/);
  assert.match(page, /全部已读/);
  assert.match(page, /aria-label="搜索任务列表"/);
  assert.match(page, /aria-label="任务排序"/);
  assert.match(page, /aria-label="搜索成果列表"/);
  assert.match(page, /aria-label="成果排序"/);
  assert.match(css, /\.task-list-controls/);
  assert.match(css, /\.task-bulk-bar/);
  assert.match(css, /\.task-selection-control/);
  assert.match(css, /\.task-table-row-shell/);
  assert.match(css, /\.bulk-delete-dialog/);
  assert.match(css, /\.clarity-toast-undo/);
  assert.match(css, /\.clarity-search-section/);
  assert.match(css, /\.notification-item\.unread/);
  assert.match(css, /\.clarity-notification-badge/);
  assert.match(css, /\.artifact-list-controls/);
  assert.match(css, /\.task-template-picker/);
  assert.match(css, /\.composer-policy/);
  assert.match(css, /\.composer-schedule-detail/);
  assert.match(css, /\.schedule-timezone/);
  assert.match(css, /\.confirm-delete-dialog/);
  assert.match(css, /\.approval-context-grid/);
  assert.match(css, /\.approval-policy-review/);
  assert.match(css, /\.approval-reject-dialog/);
  assert.match(css, /\.approval-inbox-toolbar/);
  assert.match(css, /\.approval-bulk-bar/);
  assert.match(css, /\.approval-selection-control/);
  assert.match(css, /\.approval-queue-row-shell/);
  assert.match(css, /\.bulk-approval-dialog/);
  assert.match(css, /\.approval-reject-reason/);
  assert.match(css, /bottom:\s*calc\(68px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.artifact-overview/);
  assert.match(css, /\.artifact-workspace/);
  assert.match(css, /\.artifact-content-preview/);
  assert.match(css, /\.artifact-editor-dialog/);
  assert.match(css, /\.artifact-version-panel/);
  assert.match(css, /\.artifact-editor-actions/);
  assert.match(css, /\.artifact-discard-dialog/);
  assert.match(css, /\.artifact-preview-actions button\.edit/);
  assert.match(css, /\.activity-workspace/);
  assert.match(css, /\.activity-inspector/);
  assert.match(css, /\.task-detail-artifacts/);
  assert.match(css, /\.temporary-session-dialog/);
  assert.match(css, /\.workspace-data-summary\.is-temporary/);
  assert.match(css, /\.clarity-mobile-topbar/);
  assert.match(css, /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.task-detail-heading-actions/);
  assert.match(css, /\.activity-filter-tabs/);
  assert.match(css, /\.activity-export/);
  assert.match(css, /\.activity-scope-clear/);
  assert.match(css, /\.task-activity-list/);
  assert.match(css, /\.task-trace-empty/);
  assert.match(css, /\.workspace-overview/);
  assert.match(css, /\.workspace-data-actions/);
  assert.match(css, /\.workspace-reset-dialog/);
  assert.match(css, /\.workspace-import-dialog/);
  assert.match(css, /\.workspace-import-meta/);
  assert.match(css, /\.workspace-import-facts/);
  assert.match(css, /\.workspace-import-comparison/);
  assert.match(css, /\.workspace-import-actions/);
  assert.match(css, /\.workspace-loading/);
  assert.match(css, /\.workspace-warning/);
  assert.match(css, /\.composer-field-error/);
  assert.match(css, /\.composer-error-summary/);
  assert.match(css, /\.clarity-toast\.caution/);
  assert.match(css, /\.timeline-kind/);
  assert.match(css, /\.clarity-search-panel/);
  assert.match(css, /\.clarity-search-results/);
  assert.match(css, /\.clarity-search-result-icon/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  const pixelFontSizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(
    (match) => Number(match[1]),
  );
  assert.ok(Math.min(...pixelFontSizes) >= 11);
  assert.match(layout, /AI 任务操作系统/);
  assert.match(packageJson, /"test": "npm run build && node --test/);

  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});
