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
  assert.match(html, /下午好，今天有 1 件事需要你处理/);
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
  assert.match(page, /function requestToggleLocalPersistence/);
  assert.match(page, /function confirmTemporaryMode/);
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
  assert.match(page, /执行边界与审计/);
  assert.match(page, /打开完整运行记录/);
  assert.match(css, /\.settings-trust-center/);
  assert.match(page, /handleOverlayKeyDown/);
  assert.match(page, /data-overlay-initial-focus/);
  assert.match(page, /notificationWrapRef/);
  assert.match(page, /aria-label="搜索任务列表"/);
  assert.match(page, /aria-label="任务排序"/);
  assert.match(page, /aria-label="搜索成果列表"/);
  assert.match(page, /aria-label="成果排序"/);
  assert.match(css, /\.task-list-controls/);
  assert.match(css, /\.artifact-list-controls/);
  assert.match(css, /\.task-template-picker/);
  assert.match(css, /\.composer-policy/);
  assert.match(css, /\.composer-schedule-detail/);
  assert.match(css, /\.schedule-timezone/);
  assert.match(css, /\.confirm-delete-dialog/);
  assert.match(css, /\.approval-context-grid/);
  assert.match(css, /\.approval-policy-review/);
  assert.match(css, /\.approval-reject-dialog/);
  assert.match(css, /bottom:\s*calc\(68px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.artifact-overview/);
  assert.match(css, /\.artifact-workspace/);
  assert.match(css, /\.artifact-content-preview/);
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
