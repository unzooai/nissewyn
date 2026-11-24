/**
 * contracts/v0 的兼容性测试。
 *
 * 这份测试就是「契约冻结」这件事本身：schema 是跨语言唯一事实来源，改动是否
 * 破坏兼容由它来判。三件事：
 *
 * 1. 每个 schema 能编译，$ref 全部解析得到（跨文件引用断了会当场红）。
 * 2. 每个示例必须通过——示例是文档，也是各仓库对齐时照着写的样板。
 * 3. 每个反例必须被拒绝——防的是 schema 越改越松却没人发现。
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "contracts", "v0");
const BASE = "https://contracts.unzoo.ai/v0/";

/** contracts/v0 下所有 *.schema.json，路径统一成正斜杠，好和 $id 对得上。 */
function schemaFiles(dir = ROOT) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...schemaFiles(full));
    else if (entry.name.endsWith(".schema.json")) out.push(full);
  }
  return out.sort();
}

const relPath = (file) => relative(ROOT, file).split("\\").join("/");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

const files = schemaFiles();
const schemas = files.map((file) => ({ file, rel: relPath(file), doc: readJson(file) }));

function buildAjv() {
  // 关掉的两项都是 ajv 自己的风格检查，不是 JSON Schema 规范要求：
  // strictRequired 不让 if/then 里 required 父层已定义的属性，
  // strictTypes 要求条件分支里把 type 再写一遍。
  // strictSchema 保留着——拼错关键字仍然会红，那才是这里真正要防的。
  const ajv = new Ajv2020({
    strict: true,
    strictRequired: false,
    strictTypes: false,
    allErrors: true,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  for (const { doc } of schemas) ajv.addSchema(doc);
  return ajv;
}

test("契约：每个 schema 的 $id 与它的路径一致", () => {
  assert.ok(schemas.length >= 22, `schema 数量异常：${schemas.length}`);
  for (const { rel, doc } of schemas) {
    assert.equal(doc.$id, BASE + rel, `${rel} 的 $id 对不上路径`);
    assert.equal(
      doc.$schema,
      "https://json-schema.org/draft/2020-12/schema",
      `${rel} 没有声明 2020-12`,
    );
    assert.ok(doc.title, `${rel} 缺 title`);
    assert.ok(doc.description, `${rel} 缺 description——契约文件必须自解释`);
  }
});

test("契约：每个 schema 都能编译，跨文件 $ref 全部解析得到", () => {
  const ajv = buildAjv();
  for (const { rel, doc } of schemas) {
    assert.doesNotThrow(() => ajv.getSchema(doc.$id), `${rel} 编译失败`);
    assert.ok(ajv.getSchema(doc.$id), `${rel} 取不到编译结果`);
  }
});

test("契约：带 schema_version 的对象都把版本钉成常量", () => {
  // schema_version 是可判别字段。写成自由字符串的话，v1 上线后没人能一眼区分两版数据。
  for (const { rel, doc } of schemas) {
    const version = doc.properties?.schema_version;
    if (!version) continue;
    assert.ok(version.const, `${rel} 的 schema_version 应该是 const`);
    assert.match(version.const, /^[a-z_]+\.v0$/, `${rel} 的 schema_version 格式不对`);
    assert.ok(
      doc.required?.includes("schema_version"),
      `${rel} 的 schema_version 必须是 required`,
    );
  }
});

test("示例：index.json 覆盖了每一个 schema", () => {
  const index = readJson(join(ROOT, "examples", "index.json"));
  const covered = new Set(index.cases.map((c) => c.schema.split("#")[0]));
  covered.add(index.event_stream.schema);

  // primitives 只有 $defs，没有根约束，给它写示例没有意义。
  const exempt = new Set(["common/primitives.schema.json"]);

  for (const { rel } of schemas) {
    if (exempt.has(rel)) continue;
    assert.ok(covered.has(rel), `${rel} 没有示例。新增 schema 必须在 examples/index.json 补一条`);
  }
});

test("示例：全部通过校验", () => {
  const ajv = buildAjv();
  const index = readJson(join(ROOT, "examples", "index.json"));

  for (const { file, schema } of index.cases) {
    const validate = ajv.getSchema(BASE + schema);
    assert.ok(validate, `找不到 schema：${schema}`);
    const instance = readJson(join(ROOT, "examples", file));
    const ok = validate(instance);
    assert.ok(ok, `示例 ${file} 不符合 ${schema}：${ajv.errorsText(validate.errors)}`);
  }
});

test("示例：完整任务事件流自洽", () => {
  const ajv = buildAjv();
  const validate = ajv.getSchema(BASE + "events/envelope.schema.json");
  const stream = readJson(join(ROOT, "examples", "task-event-stream.json"));

  assert.ok(stream.length >= 20, "样例事件流太短，覆盖不到一次完整任务");

  const ids = new Set();
  let previous = 0;
  for (const event of stream) {
    assert.ok(validate(event), `事件 ${event.event_id} 不合法：${ajv.errorsText(validate.errors)}`);
    assert.equal(event.sequence, previous + 1, "sequence 必须在 Task 内单调递增且不跳号");
    previous = event.sequence;
    assert.ok(!ids.has(event.event_id), "event_id 必须唯一，客户端靠它去重");
    ids.add(event.event_id);
  }

  // 一次任务该有的骨架：创建、开跑、要审批、批了、发出去、成了、有产物、收尾。
  const types = stream.map((e) => e.type);
  for (const required of [
    "task.created",
    "run.started",
    "tool_call.requested",
    "approval.requested",
    "approval.resolved",
    "grant.issued",
    "tool_call.dispatched",
    "tool_call.succeeded",
    "artifact.created",
    "run.completed",
    "task.state_changed",
  ]) {
    assert.ok(types.includes(required), `事件流缺少 ${required}`);
  }

  // 授权必须发生在派发之前。顺序反了就是先斩后奏。
  assert.ok(
    types.indexOf("approval.resolved") < types.indexOf("tool_call.dispatched"),
    "审批必须在动作派发之前",
  );
  assert.ok(
    types.indexOf("grant.issued") < types.indexOf("tool_call.dispatched"),
    "Grant 必须在动作派发之前签发",
  );
});

test("反例：全部被拒绝", () => {
  const ajv = buildAjv();
  const dir = join(ROOT, "invalid");
  const fixtures = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json");

  assert.ok(fixtures.length >= 25, `反例太少：${fixtures.length}`);

  for (const name of fixtures) {
    const { schema, reason, instance } = readJson(join(dir, name));
    assert.ok(schema && reason, `${name} 缺 schema 或 reason`);
    const validate = ajv.getSchema(BASE + schema);
    assert.ok(validate, `找不到 schema：${schema}`);
    assert.equal(validate(instance), false, `${name} 本该被拒绝：${reason}`);
  }
});

test("反例：index.json 和固件文件一一对应", () => {
  const dir = join(ROOT, "invalid");
  const onDisk = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort();
  const listed = readJson(join(dir, "index.json")).cases.map((c) => c.name).sort();
  assert.deepEqual(listed, onDisk, "invalid/index.json 与目录内容不一致");
});
