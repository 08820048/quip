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
  assert.equal(QuipShared.normalizeSettings({}).autoRun, false);
  assert.equal(QuipShared.normalizeSettings({}).autoStopLikes, 20);
  assert.equal(QuipShared.normalizeSettings({}).autoStopComments, 10);
  const running = QuipShared.normalizeSettings({ autoRun: "on", autoStopLikes: "15", autoStopComments: 0, autoRunToken: 42 });
  assert.equal(running.autoRun, true);
  assert.equal(running.autoStopLikes, 15);
  assert.equal(running.autoStopComments, 0);
  assert.equal(running.autoRunToken, 42);
  assert.equal(QuipShared.normalizeSettings({ autoStopLikes: 1000 }).autoStopLikes, 20);
});

test("picks an automatic comment by position or at random", () => {
  const defaults = QuipShared.normalizeSettings({});
  assert.equal(defaults.autoInsert, "off");
  assert.equal(defaults.autoInsertIndex, 1);
  assert.equal(defaults.autoLike, false);
  const configured = QuipShared.normalizeSettings({ autoInsert: "position", autoInsertIndex: "3", autoLike: "on" });
  assert.equal(configured.autoInsert, "position");
  assert.equal(configured.autoInsertIndex, 3);
  assert.equal(configured.autoLike, true);
  assert.equal(QuipShared.normalizeSettings({ autoInsert: "sideways", autoInsertIndex: 9 }).autoInsert, "off");
  const comments = ["认同", "补充", "提问", "短评"];
  assert.equal(QuipShared.pickAutoComment(comments, { autoInsert: "off" }), null);
  assert.equal(QuipShared.pickAutoComment(comments, { autoInsert: "position", autoInsertIndex: 2 }), "补充");
  assert.equal(QuipShared.pickAutoComment(comments, { autoInsert: "position", autoInsertIndex: 5 }), "短评");
  assert.equal(QuipShared.pickAutoComment(comments, { autoInsert: "random" }, () => 0), "认同");
  assert.equal(QuipShared.pickAutoComment(comments, { autoInsert: "random" }, () => 0.99), "短评");
  const pace = { autoStopLikes: 20, autoStopComments: 10 };
  assert.equal(QuipShared.pickAutoAction({ ...pace, likes: 0, comments: 0 }, () => 0), "scroll");
  assert.equal(QuipShared.pickAutoAction({ ...pace, likes: 20, comments: 10 }, () => 0.5), "scroll");
  assert.equal(QuipShared.pickAutoAction({ ...pace, likes: 0, comments: 0, commentBlocked: true }, () => 0.45), "pause");
  assert.equal(QuipShared.autoRunFinished({ ...pace, likes: 20, comments: 10 }), true);
  assert.equal(QuipShared.autoRunFinished({ ...pace, likes: 19, comments: 10 }), false);
  assert.equal(QuipShared.autoRunFinished({ autoStopLikes: 0, autoStopComments: 0, likes: 0, comments: 0 }), true);
  assert.equal(QuipShared.autoRunFinished({ ...pace, likes: 20, comments: 1 }, true), true);
  let roll = 0;
  const sequence = [0, 0.5];
  assert.equal(QuipShared.autoWaitMs("scroll", () => sequence[roll++] ?? 0), 1200);
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
  assert.match(prompt.system, /人设：少用感叹号/);
  assert.match(prompt.user, /按这段人设写 5 条不同的回复：少用感叹号/);
  assert.equal(/认同|补充|轻提问|短评/.test(prompt.system), false);
  assert.equal(/认同|补充|轻提问|短评/.test(prompt.user), false);
  assert.match(prompt.system, /Use English/);
  assert.equal(QuipShared.commentStyles({ persona: "少用感叹号", count: 5 }).length, 0);
  const plain = QuipShared.buildPrompt({ count: 4, language: "zh" }, { text: "你好" });
  assert.match(plain.system, /数组顺序对应这些风格：认同、补充、轻提问、短评/);
  assert.equal(plain.system.includes("人设"), false);
  assert.deepEqual([...QuipShared.commentStyles({ count: 4 })], ["认同", "补充", "轻提问", "短评"]);
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
  assert.equal(manifest.action.default_popup, "src/popup.html");
  assert.equal(manifest.permissions.includes("storage"), true);
  assert.equal(JSON.stringify(manifest).includes("apiKey"), false);
  const popup = fs.readFileSync(path.join(root, "src/popup.html"), "utf8");
  assert.match(popup, /id="used"/);
  assert.match(popup, /name="autoInsert"/);
  assert.match(popup, /name="autoLike"/);
  assert.match(popup, /name="dailyCap"/);
  assert.match(popup, /完整设置/);
  assert.equal(/apiKey|type="password"/i.test(popup), false);
  const popupScript = fs.readFileSync(path.join(root, "src/popup.js"), "utf8");
  assert.match(popupScript, /chrome\.storage\.local\.set/);
  assert.match(popupScript, /openOptionsPage/);
  const background = fs.readFileSync(path.join(root, "src/background.js"), "utf8");
  assert.equal(background.includes("chrome.action.onClicked"), false);
});
