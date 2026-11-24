import assert from "node:assert/strict";
import { test } from "node:test";

import { pageInLanguage, pluginCatalog, pluginWords } from "../.test-build/plugin-i18n.mjs";

test("a plugin's manifest text follows the interface language", () => {
  const i18n = { en: { 写稿: "Writing", 自动: "Automatic" } };
  const en = pluginWords(i18n, "en");
  assert.equal(en("写稿"), "Writing");
  assert.equal(en("没有译文的字"), "没有译文的字");
  assert.equal(pluginWords(i18n, "zh-CN")("写稿"), "写稿");
  assert.equal(pluginWords(undefined, "en")("写稿"), "写稿");
});

test("a regional code falls back to its language family", () => {
  assert.deepEqual(pluginCatalog({ zh: { a: "甲" } }, "zh-CN"), { a: "甲" });
  assert.deepEqual(pluginCatalog({ "zh-CN": { a: "乙" }, zh: { a: "甲" } }, "zh-CN"), { a: "乙" });
});

test("the plugin's page is opened in the interface language", () => {
  assert.equal(pageInLanguage("http://127.0.0.1:5000/", "en"), "http://127.0.0.1:5000/?lang=en");
  assert.equal(pageInLanguage("http://127.0.0.1:5000/?x=1#top", "zh-CN"), "http://127.0.0.1:5000/?x=1&lang=zh-CN#top");
  assert.equal(pageInLanguage(null, "en"), null);
});
