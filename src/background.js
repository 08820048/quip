importScripts("shared.js");

const controllers = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender?.id !== chrome.runtime.id) return false;
  if (message?.type === "open-options") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "set-auto-run") {
    setAutoRun(message.enabled === true).then(sendResponse);
    return true;
  }
  if (message?.type === "get-public-settings") {
    enqueueUsage(publicSettings).then(sendResponse);
    return true;
  }
  if (message?.type === "record-comment") {
    enqueueUsage(recordComment).then(sendResponse);
    return true;
  }
  if (message?.type === "cancel") {
    cancelGenerate(message.requestId);
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "generate") {
    generate(message).then(sendResponse);
    return true;
  }
  return false;
});

let usageQueue = Promise.resolve();

function enqueueUsage(task) {
  const run = usageQueue.then(task, task);
  usageQueue = run.then(() => {}, () => {});
  return run;
}

async function publicSettings() {
  const stored = await chrome.storage.local.get(["settings", "usage"]);
  const settings = QuipShared.normalizeSettings(stored.settings);
  const usage = QuipShared.usageSnapshot(stored.usage, settings.dailyCap, QuipShared.localDateKey());
  return {
    insertMode: settings.insertMode,
    language: settings.language,
    count: settings.count,
    hasKey: Boolean(settings.apiKey),
    used: usage.used,
    dailyCap: usage.dailyCap,
    blocked: usage.blocked,
    autoInsert: settings.autoInsert,
    autoInsertIndex: settings.autoInsertIndex,
    autoLike: settings.autoLike,
    autoRun: settings.autoRun,
    autoStopLikes: settings.autoStopLikes,
    autoStopComments: settings.autoStopComments,
    autoRunToken: settings.autoRunToken,
  };
}

async function setAutoRun(enabled) {
  const stored = await chrome.storage.local.get("settings");
  const current = QuipShared.normalizeSettings(stored.settings);
  const next = QuipShared.normalizeSettings({
    ...current,
    autoRun: enabled,
    autoRunToken: enabled && !current.autoRun ? Date.now() : current.autoRunToken,
  });
  await chrome.storage.local.set({ settings: next });
  return { ok: true, autoRun: next.autoRun, autoRunToken: next.autoRunToken };
}

async function recordComment() {
  const stored = await chrome.storage.local.get(["settings", "usage"]);
  const settings = QuipShared.normalizeSettings(stored.settings);
  const today = QuipShared.localDateKey();
  const current = QuipShared.usageSnapshot(stored.usage, settings.dailyCap, today);
  if (current.blocked) {
    return { ok: false, code: "CAP", message: QuipShared.capMessage(current), ...current };
  }
  const used = current.used + 1;
  await chrome.storage.local.set({ usage: { date: today, count: used } });
  const next = QuipShared.usageSnapshot({ date: today, count: used }, settings.dailyCap, today);
  return { ok: true, ...next, message: next.blocked ? QuipShared.capMessage(next) : "" };
}

function cancelGenerate(requestId) {
  const controller = controllers.get(requestId);
  if (!controller) return;
  controllers.delete(requestId);
  controller.abort();
}

async function generate(message) {
  const stored = await chrome.storage.local.get("settings");
  const settings = QuipShared.normalizeSettings(stored.settings);
  if (!settings.apiKey) {
    return { ok: false, code: "NO_KEY", message: "请先在选项页配置 API Key" };
  }

  const post = message.post || {};
  if (!String(post.text || "").trim()) {
    return { ok: false, code: "EMPTY", message: "无法提取帖子正文" };
  }

  const controller = new AbortController();
  controllers.set(message.requestId, controller);
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const request = QuipShared.buildProviderRequest(settings, post);
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403
        ? "AUTH"
        : response.status === 429
          ? "RATE"
          : "HTTP";
      return {
        ok: false,
        code,
        message: QuipShared.providerErrorMessage(response.status, raw, settings.apiKey),
      };
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return { ok: false, code: "PARSE", message: "模型没有返回有效的评论列表" };
    }
    const content = QuipShared.extractProviderText(settings.provider, payload);
    const comments = QuipShared.parseComments(content, settings.count);
    return {
      ok: true,
      comments,
      styles: QuipShared.commentStyles(settings),
      insertMode: settings.insertMode,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      if (!controllers.has(message.requestId)) return { ok: false, code: "CANCELLED", message: "" };
      return { ok: false, code: "TIMEOUT", message: "请求超时，请稍后重试" };
    }
    if (error?.message === "模型没有返回有效的评论列表" || error?.message === "模型返回的评论数量不足") {
      return { ok: false, code: "PARSE", message: error.message };
    }
    return { ok: false, code: "NETWORK", message: "网络错误，请检查连接后重试" };
  } finally {
    clearTimeout(timer);
    controllers.delete(message.requestId);
  }
}
