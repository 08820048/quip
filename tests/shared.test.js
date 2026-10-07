const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadShared() {
  const context = { console, globalThis: null };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "src/shared.js"), "utf8"), context);
  return context.QuipShared;
}

const QuipShared = loadShared();

test("normalizes settings and ignores unknown values", () => {
  const settings = QuipShared.normalizeSettings({
    provider: "nope",
    count: 9,
    language: "jp",
    insertMode: "sideways",
    model: "  grok-4.7  ",
    persona: "  短一点  ",
    apiKey: "  secret  ",
  });
  assert.equal(settings.provider, "openai");
  assert.equal(settings.count, 4);
  assert.equal(settings.language, "auto");
  assert.equal(settings.insertMode, "append");
  assert.equal(settings.model, "grok-4.7");
  assert.equal(settings.persona, "短一点");
  assert.equal(settings.apiKey, "secret");
  assert.equal(QuipShared.normalizeSettings({}).dailyCap, 600);
  assert.equal(QuipShared.normalizeSettings({ dailyCap: 0 }).dailyCap, 0);
  assert.equal(QuipShared.normalizeSettings({ dailyCap: " 80 " }).dailyCap, 80);
  assert.equal(QuipShared.normalizeSettings({ dailyCap: 9999 }).dailyCap, 9999);
  assert.equal(QuipShared.normalizeSettings({ dailyCap: 10000 }).dailyCap, 600);
  assert.equal(QuipShared.normalizeSettings({ dailyCap: 12.5 }).dailyCap, 600);
});

test("resets the daily comment count on a new local date", () => {
  const rolled = QuipShared.usageSnapshot({ date: "2026-10-06", count: 600 }, 600, "2026-10-07");
  assert.equal(rolled.used, 0);
  assert.equal(rolled.blocked, false);
  const full = QuipShared.usageSnapshot({ date: "2026-10-07", count: 600 }, 600, "2026-10-07");
  assert.equal(full.blocked, true);
  assert.equal(full.remaining, 0);
  assert.match(QuipShared.capMessage(full), /600/);
  assert.match(QuipShared.localDateKey(new Date(2026, 9, 7)), /^2026-10-07$/);
});

test("detects post language and truncates to 1200 characters", () => {
  assert.equal(QuipShared.detectLanguage("hello world"), "en");
  assert.equal(QuipShared.detectLanguage("今天发布了"), "zh");
  assert.equal(QuipShared.resolveLanguage("en", "中文帖子"), "en");
  const long = "字".repeat(1300);
  const clipped = QuipShared.truncateText(long);
  assert.equal(Array.from(clipped.text).length, 1200);
  assert.equal(clipped.truncated, true);
});

test("builds a prompt without the API key", () => {
  const prompt = QuipShared.buildPrompt(
    { provider: "xai", apiKey: "sk-super-secret-value", persona: "少用感叹号", count: 5, language: "auto" },
    {
      authorName: "Ada",
      handle: "@ada",
      text: "Ship it. ".repeat(400),
      quotedText: "original",
      hasImage: true,
      hasVideo: false,
      hasLink: true,
    },
  );
  assert.match(prompt.system, /认同、补充、轻提问、短评、短评/);
  assert.match(prompt.system, /少用感叹号/);
  assert.match(prompt.system, /Use English/);
  assert.match(prompt.user, /（正文已截断）/);
  assert.match(prompt.user, /引用：original/);
  assert.equal(prompt.system.includes("sk-super-secret-value"), false);
  assert.equal(prompt.user.includes("sk-super-secret-value"), false);
  assert.equal(Array.from(prompt.user.match(/正文：(.+)/)[1].replace("（正文已截断）", "")).length <= 1200, true);
});

test("parses a JSON string array and caps each comment at 80 characters", () => {
  const comments = QuipShared.parseComments('```json\n["好","补充一点","真的吗？","' + "啊".repeat(90) + '"]\n```', 4);
  assert.equal(comments.length, 4);
  assert.equal(Array.from(comments[3]).length <= 80, true);
  assert.deepEqual([...QuipShared.parseComments('{"comments":["一","二","三"]}', 3)], ["一", "二", "三"]);
  assert.throws(() => QuipShared.parseComments("不是 json", 4), /评论列表/);
  assert.throws(() => QuipShared.parseComments('["只有一条"]', 4), /数量不足/);
});

test("provider request keeps the key in headers only", () => {
  const key = "sk-test-secret-value-123456";
  for (const provider of ["openai", "xai", "anthropic", "deepseek"]) {
    const request = QuipShared.buildProviderRequest(
      { provider, apiKey: key, count: 4, language: "zh" },
      { text: "中文帖子", authorName: "林", handle: "@lin" },
    );
    const serialized = JSON.stringify(request.body);
    assert.equal(serialized.includes(key), false);
    assert.equal(request.url.startsWith("https://"), true);
    if (provider === "anthropic") assert.equal(request.headers["x-api-key"], key);
    else assert.equal(request.headers.authorization, `Bearer ${key}`);
  }
  const openai = QuipShared.buildProviderRequest({ provider: "openai", apiKey: key }, { text: "hi" });
  assert.equal(openai.body.model, "gpt-4.1-mini");
  assert.equal(openai.url, "https://api.openai.com/v1/chat/completions");
  const deepseek = QuipShared.buildProviderRequest({ provider: "deepseek", apiKey: key }, { text: "hi" });
  assert.equal(deepseek.body.model, "deepseek-flash");
  assert.equal(deepseek.url, "https://api.deepseek.com/chat/completions");
  assert.equal(deepseek.body.thinking.type, "disabled");
  assert.equal(openai.body.thinking, undefined);
});

test("extracts text and redacts keys from provider errors", () => {
  assert.equal(
    QuipShared.extractProviderText("openai", { choices: [{ message: { content: '["好"]' } }] }),
    '["好"]',
  );
  assert.equal(
    QuipShared.extractProviderText("anthropic", { content: [{ type: "text", text: '["好","行"]' }] }),
    '["好","行"]',
  );
  const key = "sk-test-secret-value-123456";
  const message = QuipShared.providerErrorMessage(401, JSON.stringify({ error: { message: `invalid ${key}` } }), key);
  assert.match(message, /检查 Key/);
  assert.equal(message.includes(key), false);
  assert.match(QuipShared.providerErrorMessage(429, "{}", key), /稍后重试/);
});

test("manifest is a v3 extension aimed at X", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "Quip");
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://x.com/*", "https://twitter.com/*"]);
  assert.equal(manifest.permissions.includes("storage"), true);
  assert.equal(JSON.stringify(manifest).includes("apiKey"), false);
});
