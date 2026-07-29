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
  assert.match(html, /unzoo-mark-ai\.webp/);
  assert.match(html, /unzoo-favicon\.png/);
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
  assert.match(page, /function createTask/);
  assert.match(page, /function beginEditTask/);
  assert.match(page, /function duplicateTask/);
  assert.match(page, /function confirmDeleteTask/);
  assert.match(page, /const taskTemplates:/);
  assert.match(page, /type TaskSchedule =/);
  assert.match(page, /role="radiogroup"/);
  assert.match(page, /role="switch"/);
  assert.match(page, /<textarea/);
  assert.match(page, /function updateTaskStatus/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /role="alertdialog"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /role="tab"/);
  assert.match(page, /aria-selected=/);
  assert.match(css, /\.task-detail-drawer/);
  assert.match(css, /\.task-template-picker/);
  assert.match(css, /\.composer-policy/);
  assert.match(css, /\.confirm-delete-dialog/);
  assert.match(css, /\.task-detail-heading-actions/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  const pixelFontSizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(
    (match) => Number(match[1]),
  );
  assert.ok(Math.min(...pixelFontSizes) >= 11);
  assert.match(layout, /AI 任务操作系统/);
  assert.match(packageJson, /"test": "npm run build && node --test/);

  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});
