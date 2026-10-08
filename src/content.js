const PANEL_CSS = `
:host { all: initial; }
.quip-panel {
  width: min(320px, calc(100vw - 16px));
  max-height: min(70vh, 520px);
  overflow: auto;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 18px;
  background: #fffdf8;
  color: #1c1915;
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  box-shadow:
    0 0 0 1px rgba(28, 25, 21, 0.08),
    0 16px 40px rgba(28, 25, 21, 0.16);
}
.quip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 4px 8px;
}
.quip-header h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  text-wrap: balance;
}
.quip-usage {
  margin: -4px 4px 8px;
  color: #5c6770;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.quip-header-actions { display: flex; gap: 4px; }
.quip-header button, .quip-copy, .quip-insert, .quip-text-btn {
  font: inherit;
  cursor: pointer;
}
.quip-like, .quip-close {
  min-height: 36px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
}
.quip-like { padding: 0 10px; font-size: 13px; font-weight: 600; }
.quip-close { width: 36px; font-size: 18px; line-height: 1; }
.quip-like:hover, .quip-close:hover, .quip-copy:hover, .quip-insert:hover {
  background: rgba(28, 25, 21, 0.05);
}
.quip-like:active, .quip-close:active, .quip-copy:active, .quip-insert:active, .quip-text-btn:active {
  transform: scale(0.96);
}
.quip-note {
  margin: 0 4px 8px;
  font-size: 13px;
  line-height: 1.45;
  text-wrap: pretty;
}
.quip-text-btn {
  display: inline-flex;
  align-items: center;
  margin-top: 8px;
  min-height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: #1d9bf0;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  transition-property: transform, background-color;
  transition-duration: 120ms;
}
.quip-row {
  display: flex;
  gap: 4px;
  border-radius: 12px;
  animation: quip-in 160ms cubic-bezier(0.2, 0, 0, 1) both;
}
.quip-insert {
  flex: 1;
  min-height: 44px;
  text-align: left;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  padding: 8px 10px;
  transition-property: transform, background-color;
  transition-duration: 120ms;
}
.quip-style {
  display: block;
  margin-bottom: 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #5c6770;
}
.quip-text { display: block; font-size: 14px; text-wrap: pretty; user-select: text; }
.quip-copy {
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #5c6770;
  font-size: 12px;
  font-weight: 600;
  transition-property: transform, background-color;
  transition-duration: 120ms;
}
.quip-skeleton {
  height: 52px;
  margin: 4px;
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(28, 25, 21, 0.05), rgba(28, 25, 21, 0.12), rgba(28, 25, 21, 0.05));
  background-size: 200% 100%;
  animation: quip-shimmer 1s linear infinite;
}
:host([data-theme="dark"]) .quip-panel {
  background: #15202b;
  color: #e7e9ea;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 16px 40px rgba(0, 0, 0, 0.45);
}
:host([data-theme="dark"]) .quip-style,
:host([data-theme="dark"]) .quip-copy,
:host([data-theme="dark"]) .quip-usage { color: #8b98a5; }
:host([data-theme="dark"]) .quip-like:hover,
:host([data-theme="dark"]) .quip-close:hover,
:host([data-theme="dark"]) .quip-copy:hover,
:host([data-theme="dark"]) .quip-insert:hover { background: rgba(255, 255, 255, 0.06); }
:host([data-theme="dark"]) .quip-skeleton {
  background: linear-gradient(90deg, rgba(231, 233, 234, 0.05), rgba(231, 233, 234, 0.12), rgba(231, 233, 234, 0.05));
  background-size: 200% 100%;
}
@keyframes quip-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes quip-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) {
  .quip-row, .quip-skeleton { animation: none; }
  .quip-like:active, .quip-close:active, .quip-copy:active, .quip-insert:active, .quip-text-btn:active { transform: none; }
}
`;

const ui = {
  open: false,
  host: null,
  panel: null,
  list: null,
  note: null,
  likeHeader: null,
  article: null,
  anchor: null,
  busyButton: null,
  requestId: 0,
  comments: [],
  styles: [],
  insertMode: "append",
  autoInsert: "off",
  autoInsertIndex: 1,
  autoLike: false,
  inserting: false,
  usage: null,
  capHost: null,
};

const quota = { used: 0, dailyCap: 600, blocked: false };

function rememberAutomation(settings) {
  const normalized = QuipShared.normalizeSettings(settings);
  ui.autoInsert = normalized.autoInsert;
  ui.autoInsertIndex = normalized.autoInsertIndex;
  ui.autoLike = normalized.autoLike;
  ui.autoRun = normalized.autoRun;
  ui.autoStopLikes = normalized.autoStopLikes;
  ui.autoStopComments = normalized.autoStopComments;
  ui.autoRunToken = normalized.autoRunToken;
}

function capText() {
  return QuipShared.capMessage(quota);
}

function usageLabel() {
  return `今日 ${quota.used}/${quota.dailyCap}`;
}

function applyQuota(payload) {
  if (!payload || !Number.isInteger(payload.dailyCap) || !Number.isInteger(payload.used)) return;
  quota.used = Math.max(0, payload.used);
  quota.dailyCap = payload.dailyCap;
  quota.blocked = quota.used >= quota.dailyCap;
  document.querySelectorAll("[data-quip-anchor]").forEach(applyAnchorState);
  updateUsageLine();
  updateLikeHeader();
  if (quota.blocked) showCapNotice();
  else hideCapNotice();
}

function applyAnchorState(anchor) {
  anchor.querySelectorAll("button").forEach((button) => {
    button.disabled = quota.blocked;
    if (quota.blocked) button.title = capText();
    else if (button.dataset.quipAi === "true") button.title = usageLabel();
    else button.removeAttribute("title");
  });
}

let stopped = false;
let pageObserver = null;

function extensionAlive() {
  if (stopped) return false;
  try {
    return Boolean(chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

function invalidated(error) {
  return /invalidated|context/i.test(String(error?.message || error));
}

function stopQuip() {
  if (stopped) return;
  stopped = true;
  clearTimeout(scanTimer);
  clearInterval(autoPoll);
  stopAutoWaits();
  try { ui.autoHost?.remove(); } catch { /* 页面节点可能已经不可用。 */ }
  try { pageObserver?.disconnect(); } catch { /* 扩展上下文已经失效。 */ }
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  document.removeEventListener("keydown", onDocumentKeyDown);
  window.removeEventListener("scroll", onViewportChange, true);
  window.removeEventListener("resize", onViewportChange);
  window.removeEventListener("focus", onWindowFocus);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  try { ui.host?.remove(); } catch { /* 页面节点可能已经不可用。 */ }
  try { ui.capHost?.remove(); } catch { /* 页面节点可能已经不可用。 */ }
  try { showReloadNotice(); } catch { /* 无法再改页面时安静退出。 */ }
}

function showReloadNotice() {
  if (!document.body || document.getElementById("quip-reload-notice")) return;
  const note = document.createElement("div");
  note.id = "quip-reload-notice";
  note.setAttribute("role", "status");
  note.textContent = "Quip 已更新，请刷新页面后再用。";
  note.style.cssText = "position:fixed;z-index:2147483000;top:12px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 24px);box-sizing:border-box;padding:10px 14px;border-radius:16px;background:#fffdf8;color:#1c1915;font:13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 0 0 1px rgba(28,25,21,.08),0 12px 32px rgba(28,25,21,.16)";
  document.body.append(note);
}

function sendToBackground(message) {
  if (!extensionAlive()) {
    stopQuip();
    return Promise.resolve(null);
  }
  try {
    return Promise.resolve(chrome.runtime.sendMessage(message)).catch((error) => {
      if (!extensionAlive() || invalidated(error)) stopQuip();
      return null;
    });
  } catch (error) {
    if (!extensionAlive() || invalidated(error)) stopQuip();
    return Promise.resolve(null);
  }
}

async function refreshQuota() {
  if (!extensionAlive()) {
    stopQuip();
    return;
  }
  const settings = await sendToBackground({ type: "get-public-settings" });
  if (stopped || !settings) return;
  rememberAutomation(settings);
  try {
    applyQuota(settings);
  } catch (error) {
    if (!extensionAlive() || invalidated(error)) stopQuip();
    return;
  }
  if (settings.autoRun) maybeStartAuto();
  else if (autoLoopRunning) stopAutoWaits();
}

function onWindowFocus() {
  refreshQuota().catch(() => stopQuip());
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") refreshQuota().catch(() => stopQuip());
}

function ensureCapNotice() {
  if (ui.capHost) return;
  const host = document.createElement("div");
  host.id = "quip-cap-notice";
  host.hidden = true;
  host.style.cssText = "position:fixed;z-index:2147483000;top:12px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 24px);";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .quip-cap {
      display: flex;
      align-items: center;
      gap: 12px;
      box-sizing: border-box;
      padding: 10px 10px 10px 14px;
      border-radius: 16px;
      background: #fffdf8;
      color: #1c1915;
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
      box-shadow: 0 0 0 1px rgba(28, 25, 21, 0.08), 0 12px 32px rgba(28, 25, 21, 0.16);
    }
    p { margin: 0; text-wrap: pretty; }
    button {
      flex: 0 0 auto;
      min-height: 36px;
      padding: 0 12px;
      border: 0;
      border-radius: 999px;
      background: #1c1915;
      color: #fffdf8;
      font: 600 13px/1 inherit;
      cursor: pointer;
      transition-property: transform, background-color;
      transition-duration: 120ms;
    }
    button:active { transform: scale(0.96); }
    :host([data-theme="dark"]) .quip-cap {
      background: #15202b;
      color: #e7e9ea;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 12px 32px rgba(0, 0, 0, 0.45);
    }
    :host([data-theme="dark"]) button { background: #e7e9ea; color: #15202b; }
    @media (prefers-reduced-motion: reduce) { button:active { transform: none; } }
  `;
  const bar = document.createElement("div");
  bar.className = "quip-cap";
  bar.setAttribute("role", "status");
  const text = document.createElement("p");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "打开设置";
  button.addEventListener("click", () => {
    sendToBackground({ type: "open-options" });
  });
  bar.append(text, button);
  shadow.append(style, bar);
  document.body.append(host);
  ui.capHost = host;
  ui.capText = text;
}

function showCapNotice() {
  ensureCapNotice();
  ui.capHost.dataset.theme = pageIsDark() ? "dark" : "light";
  ui.capText.textContent = capText();
  ui.capHost.hidden = false;
}

function hideCapNotice() {
  if (!ui.capHost) return;
  ui.capHost.hidden = true;
}

function updateUsageLine() {
  if (!ui.usage) return;
  ui.usage.textContent = usageLabel();
}

function boot() {
  if (boot.started || !document.body) return;
  boot.started = true;
  pageObserver = new MutationObserver(() => {
    if (!extensionAlive()) {
      stopQuip();
      return;
    }
    scheduleScan();
  });
  pageObserver.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("keydown", onDocumentKeyDown);
  window.addEventListener("scroll", onViewportChange, true);
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("focus", onWindowFocus);
  document.addEventListener("visibilitychange", onVisibilityChange);
  scheduleScan();
  refreshQuota().catch(() => stopQuip());
  autoPoll = setInterval(() => {
    if (!extensionAlive()) return;
    refreshQuota().catch(() => stopQuip());
  }, 2000);
}

let scanTimer = 0;
function scheduleScan() {
  if (!extensionAlive()) {
    stopQuip();
    return;
  }
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    if (!extensionAlive()) {
      stopQuip();
      return;
    }
    scanTweets();
  }, 80);
}

function scanTweets() {
  if (!document.body) return;
  try {
    document.querySelectorAll(QUIP_SELECTORS.tweet).forEach(attachTweet);
    refreshLikeButtons();
    if (ui.open && (!ui.article?.isConnected || !ui.anchor?.isConnected)) closePanel();
  } catch (error) {
    if (!extensionAlive() || invalidated(error)) stopQuip();
  }
}

function attachTweet(article) {
  if (article.parentElement?.closest(QUIP_SELECTORS.tweet)) return;
  if (article.querySelector("[data-quip-anchor]")) return;
  const reply = ownControl(article, QUIP_SELECTORS.replyButton);
  if (!reply) return;
  const group = reply.closest(QUIP_SELECTORS.actionGroup);
  if (!group || group.closest(QUIP_SELECTORS.tweet) !== article) return;

  const actions = document.createElement("div");
  actions.className = "quip-actions";
  actions.dataset.quipAnchor = "true";
  actions.style.color = getComputedStyle(reply).color || "rgb(113, 118, 123)";

  const like = document.createElement("button");
  like.type = "button";
  like.className = "quip-icon-btn";
  like.dataset.quipLike = "true";
  like.append(heartIcon());
  bindClick(like, () => {
    if (quota.blocked) {
      showCapNotice();
      return;
    }
    const result = likeTweet(articleFrom(like));
    refreshLikeButtons();
    updateLikeHeader();
    if (!result.ok) showNote(result.message);
  });

  const ai = document.createElement("button");
  ai.type = "button";
  ai.className = "quip-icon-btn is-label";
  ai.dataset.quipAi = "true";
  ai.textContent = "Quip";
  ai.setAttribute("aria-label", "生成评论候选");
  bindClick(ai, () => {
    onAiClick(articleFrom(ai), ai);
  });

  actions.append(like, ai);
  group.append(actions);
  applyAnchorState(actions);
  refreshLikeButton(article);
}

function bindClick(button, action) {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!extensionAlive()) {
      stopQuip();
      return;
    }
    try {
      const result = action();
      if (result && typeof result.then === "function") {
        result.catch((error) => {
          if (!extensionAlive() || invalidated(error)) stopQuip();
        });
      }
    } catch (error) {
      if (!extensionAlive() || invalidated(error)) stopQuip();
    }
  });
}

function articleFrom(node) {
  return node?.closest(QUIP_SELECTORS.tweet) || null;
}

function ownElements(article, selector) {
  return [...article.querySelectorAll(selector)].filter((node) => node.closest(QUIP_SELECTORS.tweet) === article);
}

function ownControl(article, selector) {
  return ownElements(article, selector)[0] || null;
}

function cleanText(node) {
  return (node?.innerText || "").replace(/\s+/g, " ").trim();
}

function extractPost(article) {
  const textNodes = ownElements(article, QUIP_SELECTORS.tweetText);
  const chunks = textNodes.map(cleanText).filter(Boolean);
  const nameBlock = ownElements(article, QUIP_SELECTORS.userName)[0];
  const handle = nameBlock
    ? [...nameBlock.querySelectorAll("span")].map((span) => span.textContent.trim()).find((value) => value.startsWith("@")) || ""
    : "";
  const authorName = nameBlock ? (nameBlock.querySelector("a")?.innerText || "").replace(/\s+/g, " ").trim() : "";
  const hasHttpLink = ownElements(article, "a").some((anchor) => /^https?:/i.test(anchor.getAttribute("href") || ""));
  return {
    authorName,
    handle,
    text: chunks[0] || "",
    quotedText: chunks.slice(1).join("\n"),
    hasImage: ownElements(article, QUIP_SELECTORS.photo).length > 0,
    hasVideo: ownElements(article, QUIP_SELECTORS.video).length > 0,
    hasLink: ownElements(article, QUIP_SELECTORS.card).length > 0 || hasHttpLink,
  };
}

function isLiked(article) {
  return Boolean(article && ownControl(article, QUIP_SELECTORS.unlikeButton));
}

function likeTweet(article) {
  if (!article) return { ok: false, liked: false, message: "找不到点赞按钮" };
  if (isLiked(article)) return { ok: true, liked: true };
  const button = ownControl(article, QUIP_SELECTORS.likeButton);
  if (!button) return { ok: false, liked: false, message: "找不到点赞按钮" };
  button.click();
  return { ok: true, liked: isLiked(article) };
}

function refreshLikeButtons() {
  document.querySelectorAll(QUIP_SELECTORS.tweet).forEach(refreshLikeButton);
}

function refreshLikeButton(article) {
  const button = article.querySelector("[data-quip-like]");
  if (!button) return;
  const liked = isLiked(article);
  button.classList.toggle("is-liked", liked);
  button.setAttribute("aria-pressed", liked ? "true" : "false");
  button.setAttribute("aria-label", liked ? "已赞" : "点赞");
}

function heartIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M12 19.4 10.9 18.4C6.1 14.2 3.6 12 3.6 8.9 3.6 6.5 5.4 4.8 7.8 4.8c1.4 0 2.7.6 3.6 1.7.9-1.1 2.2-1.7 3.6-1.7 2.4 0 4.2 1.7 4.2 4.1 0 3.1-2.5 5.3-7.3 9.5L12 19.4z");
  svg.append(path);
  return svg;
}

function ensureHost() {
  if (ui.host) return;
  const host = document.createElement("div");
  host.id = "quip-panel-host";
  host.hidden = true;
  host.style.cssText = "position:fixed;z-index:2147483000;top:0;left:0;display:none;width:max-content;max-width:calc(100vw - 16px);";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = PANEL_CSS;
  const panel = document.createElement("section");
  panel.className = "quip-panel";
  panel.tabIndex = -1;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "评论候选");

  const header = document.createElement("div");
  header.className = "quip-header";
  const title = document.createElement("h2");
  title.textContent = "评论候选";
  const headerActions = document.createElement("div");
  headerActions.className = "quip-header-actions";
  const like = document.createElement("button");
  like.type = "button";
  like.className = "quip-like";
  like.textContent = "点赞";
  like.addEventListener("click", () => {
    const result = likeTweet(ui.article);
    refreshLikeButtons();
    updateLikeHeader();
    if (!result.ok) showNote(result.message);
  });
  const close = document.createElement("button");
  close.type = "button";
  close.className = "quip-close";
  close.setAttribute("aria-label", "关闭");
  close.textContent = "×";
  close.addEventListener("click", closePanel);
  headerActions.append(like, close);
  header.append(title, headerActions);
  const usage = document.createElement("p");
  usage.className = "quip-usage";
  usage.textContent = usageLabel();

  const note = document.createElement("p");
  note.className = "quip-note";
  note.hidden = true;
  const list = document.createElement("div");
  list.className = "quip-list";
  panel.append(header, usage, note, list);
  shadow.append(style, panel);
  document.body.append(host);
  ui.host = host;
  ui.panel = panel;
  ui.note = note;
  ui.list = list;
  ui.likeHeader = like;
  ui.usage = usage;
}

function pageIsDark() {
  try {
    const color = getComputedStyle(document.body).backgroundColor;
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return window.matchMedia("(prefers-color-scheme: dark)").matches;
    const red = Number(match[1]);
    const green = Number(match[2]);
    const blue = Number(match[3]);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 140;
  } catch (error) {
    if (!extensionAlive() || invalidated(error)) stopQuip();
    return false;
  }
}

function showPanel(article, anchor) {
  ensureHost();
  ui.open = true;
  ui.article = article;
  ui.anchor = anchor;
  ui.host.hidden = false;
  ui.host.style.display = "block";
  ui.host.dataset.theme = pageIsDark() ? "dark" : "light";
  updateUsageLine();
  updateLikeHeader();
  positionPanel();
}

function closePanel() {
  if (!ui.open && ui.host?.style.display === "none") return;
  invalidateRequest();
  ui.open = false;
  setBusy(ui.busyButton, false);
  if (!ui.host) return;
  ui.host.hidden = true;
  ui.host.style.display = "none";
}

function positionPanel() {
  if (!ui.host || !ui.anchor?.isConnected) return;
  const rect = ui.anchor.getBoundingClientRect();
  const width = ui.host.offsetWidth || 320;
  const height = ui.host.offsetHeight || 0;
  let top = rect.bottom + 8;
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 8);
  let left = rect.right - width;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  ui.host.style.top = `${Math.round(top)}px`;
  ui.host.style.left = `${Math.round(left)}px`;
}

function updateLikeHeader() {
  if (!ui.likeHeader) return;
  const liked = isLiked(ui.article);
  ui.likeHeader.textContent = liked ? "已赞" : "点赞";
  ui.likeHeader.setAttribute("aria-pressed", liked ? "true" : "false");
  ui.likeHeader.disabled = quota.blocked;
}

function showNote(message) {
  if (!ui.note) return;
  ui.note.hidden = false;
  ui.note.replaceChildren(document.createTextNode(message));
  positionPanel();
}

function showFailure(message, code) {
  ui.list.replaceChildren();
  ui.note.hidden = false;
  ui.note.replaceChildren(document.createTextNode(message));
  if (code === "NO_KEY") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quip-text-btn";
    button.textContent = "打开选项页";
    button.addEventListener("click", () => {
      sendToBackground({ type: "open-options" });
    });
    ui.note.append(button);
  }
  positionPanel();
}

function showLoading() {
  ui.note.hidden = true;
  ui.list.replaceChildren();
  for (let index = 0; index < 4; index += 1) {
    const row = document.createElement("div");
    row.className = "quip-skeleton";
    ui.list.append(row);
  }
  positionPanel();
}

function showComments() {
  ui.note.hidden = true;
  ui.list.replaceChildren();
  ui.comments.forEach((comment, index) => {
    const row = document.createElement("div");
    row.className = "quip-row";
    row.style.animationDelay = `${index * 40}ms`;
    const insert = document.createElement("button");
    insert.type = "button";
    insert.className = "quip-insert";
    const styleName = ui.styles[index];
    if (styleName) {
      const style = document.createElement("span");
      style.className = "quip-style";
      style.textContent = styleName;
      insert.append(style);
    }
    const text = document.createElement("span");
    text.className = "quip-text";
    text.textContent = comment;
    insert.append(text);
    insert.addEventListener("click", () => {
      chooseComment(comment).catch((error) => {
        if (!extensionAlive() || invalidated(error)) stopQuip();
      });
    });
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "quip-copy";
    copy.textContent = "复制";
    copy.addEventListener("click", () => {
      copy.textContent = copyText(comment) ? "已复制" : "复制失败";
      setTimeout(() => {
        if (copy.isConnected) copy.textContent = "复制";
      }, 1200);
    });
    row.append(insert, copy);
    ui.list.append(row);
  });
  positionPanel();
  ui.panel.focus({ preventScroll: true });
}

function invalidateRequest() {
  const previous = ui.requestId;
  ui.requestId += 1;
  if (!previous) return;
  sendToBackground({ type: "cancel", requestId: previous });
}

function setBusy(button, busy) {
  if (!button) return;
  button.classList.toggle("is-busy", busy);
  if (busy) button.setAttribute("aria-busy", "true");
  else button.removeAttribute("aria-busy");
}

async function onAiClick(article, anchor) {
  if (!article) return;
  setBusy(ui.busyButton, false);
  if (!extensionAlive()) {
    stopQuip();
    return;
  }
  const requestId = (() => {
    const previous = ui.requestId;
    ui.requestId += 1;
    if (previous) sendToBackground({ type: "cancel", requestId: previous });
    return ui.requestId;
  })();
  showPanel(article, anchor);
  ui.busyButton = anchor;
  setBusy(anchor, true);
  showLoading();
  await refreshQuota();
  if (stopped || requestId !== ui.requestId) return;
  if (quota.blocked) {
    setBusy(anchor, false);
    showCapNotice();
    closePanel();
    return;
  }
  const post = extractPost(article);
  if (!post.text) {
    setBusy(anchor, false);
    showFailure("无法提取帖子正文");
    return;
  }
  const response = await sendToBackground({ type: "generate", requestId, post });
  if (stopped || requestId !== ui.requestId) return;
  setBusy(anchor, false);
  if (!response?.ok) {
    if (response?.code === "CANCELLED") return;
    showFailure(response?.message || "生成失败", response?.code);
    return;
  }
  ui.comments = response.comments || [];
  ui.styles = response.styles || [];
  ui.insertMode = response.insertMode || "append";
  showComments();
  const picked = QuipShared.pickAutoComment(ui.comments, ui);
  if (picked) await chooseComment(picked);
}

async function chooseComment(text) {
  if (ui.inserting) return;
  ui.inserting = true;
  try {
    await writeChosenComment(text);
  } finally {
    ui.inserting = false;
  }
}

async function writeChosenComment(text) {
  const article = ui.article;
  if (!article?.isConnected) {
    showNote("这条帖子已经不在页面上。可以复制候选后手动粘贴。");
    return;
  }
  let mode = ui.insertMode;
  const settings = await sendToBackground({ type: "get-public-settings" });
  if (stopped) return;
  if (settings) {
    rememberAutomation(settings);
    try { applyQuota(settings); } catch (error) {
      if (!extensionAlive() || invalidated(error)) stopQuip();
      return;
    }
    if (settings.insertMode) mode = settings.insertMode;
  }
  if (quota.blocked) {
    showCapNotice();
    showNote(capText());
    return;
  }
  const editor = await ensureComposer(article);
  if (!ui.open || ui.article !== article) return;
  if (!editor) {
    showNote("写入失败，回复框没有出现。可以复制候选后手动粘贴。");
    return;
  }
  // 回复框刚挂上时，Draft 编辑器还没绑上输入事件。
  await wait(80);
  if (!insertIntoEditor(editor, text, mode)) {
    showNote("写入失败，回复框没有接受这段文字。可以复制候选后手动粘贴。");
    return;
  }
  if (ui.autoLike) {
    likeTweet(article);
    refreshLikeButtons();
  }
  const anchor = ui.anchor;
  closePanel();
  anchor?.focus?.();
  const recorded = await sendToBackground({ type: "record-comment" });
  if (stopped || !recorded) return;
  try { applyQuota(recorded); } catch (error) {
    if (!extensionAlive() || invalidated(error)) stopQuip();
  }
}

function isVisible(node) {
  if (!node || node.closest("[hidden]")) return false;
  const style = getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return node.getClientRects().length > 0;
}

function visibleComposers() {
  return [...document.querySelectorAll(QUIP_SELECTORS.composer)].filter(isVisible);
}

function tweetCell(article) {
  const cell = article.closest(QUIP_SELECTORS.cell);
  if (!cell) return null;
  const tweets = [...cell.querySelectorAll(QUIP_SELECTORS.tweet)].filter((node) => !node.parentElement?.closest(QUIP_SELECTORS.tweet));
  if (tweets.length !== 1 || tweets[0] !== article) return null;
  return cell;
}

function findInlineComposer(article) {
  const cell = tweetCell(article);
  if (cell) {
    const inCell = [...cell.querySelectorAll(QUIP_SELECTORS.composer)].find(isVisible);
    if (inCell) return inCell;
  }
  const sibling = article.nextElementSibling;
  if (!sibling || sibling.matches(QUIP_SELECTORS.tweet)) return null;
  const node = sibling.matches(QUIP_SELECTORS.composer) ? sibling : sibling.querySelector(QUIP_SELECTORS.composer);
  return node && isVisible(node) ? node : null;
}

async function ensureComposer(article) {
  const inline = findInlineComposer(article);
  if (inline) return resolveEditor(inline);
  const reply = ownControl(article, QUIP_SELECTORS.replyButton);
  if (!reply) return null;
  const before = new Set(visibleComposers());
  reply.click();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const inlineNow = findInlineComposer(article);
    if (inlineNow && !before.has(inlineNow)) return resolveEditor(inlineNow);
    const fresh = visibleComposers().find((node) => !before.has(node));
    if (fresh) return resolveEditor(fresh);
    await wait(50);
  }
  return null;
}

function resolveEditor(node) {
  if (!node) return null;
  if (node.getAttribute("contenteditable") === "true") return node;
  return node.querySelector('[contenteditable="true"]') || node;
}

function readEditorText(editor) {
  return (editor.innerText || editor.textContent || "").replace(/[\u200b\uFEFF]/g, "").replace(/\u00a0/g, " ").trim();
}

function insertIntoEditor(editor, text, mode) {
  const target = resolveEditor(editor);
  if (!target || !text) return false;
  const existing = readEditorText(target);
  const replacing = mode === "overwrite" || !existing;
  const payload = replacing ? text : `\n${text}`;
  target.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(target);
  if (!replacing) range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  // X 的回复框是 Draft.js。execCommand('insertText') 会走它的 beforeinput，直接改 textContent 不会进草稿。
  try {
    document.execCommand("insertText", false, payload);
  } catch {
    // 命令抛错时下面的文本检查会判定为写入失败。
  }
  if (!readEditorText(target).includes(text)) {
    target.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: payload,
    }));
  }
  const written = readEditorText(target);
  if (!written.includes(text)) return false;
  if (!replacing && existing && !written.startsWith(existing)) return false;
  return true;
}

function copyText(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const autoWaits = new Set();
let autoLoopRunning = false;
let autoPoll = 0;
let autoSeen = new Set();
let autoNote = "";

function autoWait(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      autoWaits.delete(finish);
      resolve();
    }, ms);
    const finish = () => {
      clearTimeout(timer);
      autoWaits.delete(finish);
      resolve();
    };
    autoWaits.add(finish);
  });
}

function stopAutoWaits() {
  for (const finish of [...autoWaits]) finish();
}

function haltAutoLocal() {
  ui.autoRun = false;
  const previous = ui.requestId;
  ui.requestId += 1;
  if (previous) sendToBackground({ type: "cancel", requestId: previous });
  stopAutoWaits();
  hideAutoHud();
}

function loadAutoProgress(token) {
  try {
    const saved = JSON.parse(sessionStorage.getItem("quip-auto-progress") || "null");
    if (saved && saved.token === token) {
      return {
        token,
        likes: Math.max(0, Math.floor(Number(saved.likes) || 0)),
        comments: Math.max(0, Math.floor(Number(saved.comments) || 0)),
      };
    }
  } catch {
    // 读不到进度时从 0 开始。
  }
  return { token, likes: 0, comments: 0 };
}

function saveAutoProgress(progress) {
  try {
    sessionStorage.setItem("quip-auto-progress", JSON.stringify(progress));
  } catch {
    // 这一轮仍用内存里的计数。
  }
}

function maybeStartAuto() {
  if (!ui.autoRun || stopped || autoLoopRunning) return;
  autoLoopRunning = true;
  runAutoLoop().finally(() => {
    autoLoopRunning = false;
  });
}

async function runAutoLoop() {
  let progress = loadAutoProgress(ui.autoRunToken);
  let closing = "";
  while (!stopped && extensionAlive()) {
    const settings = await sendToBackground({ type: "get-public-settings" });
    if (stopped || !settings) break;
    rememberAutomation(settings);
    try {
      applyQuota(settings);
    } catch (error) {
      if (!extensionAlive() || invalidated(error)) stopQuip();
      break;
    }
    if (!ui.autoRun) break;
    if (progress.token !== ui.autoRunToken) {
      progress = { token: ui.autoRunToken, likes: 0, comments: 0 };
      autoSeen = new Set();
    }
    if (QuipShared.autoRunFinished({ ...settings, likes: progress.likes, comments: progress.comments }, quota.blocked)) {
      closing = quota.blocked && progress.comments < ui.autoStopComments ? "今日评论已到上限，已停下" : "已到上限，已停下";
      renderAutoHud(progress, closing);
      await sendToBackground({ type: "set-auto-run", enabled: false });
      ui.autoRun = false;
      await autoWait(1800);
      break;
    }
    renderAutoHud(progress, "");
    if (autoSkipsPage()) {
      await autoWait(4000);
      continue;
    }
    let action = QuipShared.pickAutoAction({
      ...settings,
      likes: progress.likes,
      comments: progress.comments,
      commentBlocked: quota.blocked,
    }, Math.random);
    if (ui.open || ui.inserting) action = "pause";
    await autoWait(QuipShared.autoWaitMs(action, Math.random));
    if (stopped || !extensionAlive() || !ui.autoRun) break;
    let outcome = "";
    try {
      outcome = await performAutoAction(action);
    } catch (error) {
      if (!extensionAlive() || invalidated(error)) {
        stopQuip();
        break;
      }
    }
    if (outcome === "halt") {
      closing = autoNote || "已停下";
      renderAutoHud(progress, closing);
      await sendToBackground({ type: "set-auto-run", enabled: false });
      ui.autoRun = false;
      await autoWait(1800);
      break;
    }
    if (outcome === "like") progress.likes += 1;
    if (outcome === "comment") progress.comments += 1;
    saveAutoProgress(progress);
  }
  if (!closing) hideAutoHud();
  else await autoWait(200);
  hideAutoHud();
}

async function performAutoAction(action) {
  if (action === "pause") return "";
  if (action === "scroll") {
    autoScroll();
    return "";
  }
  if (action === "like") return (await autoLikeOne()) ? "like" : "";
  if (action === "comment") return autoCommentOne();
  if (action === "detail" || action === "profile") {
    await autoVisit(action);
    return "";
  }
  return "";
}

function autoSkipsPage() {
  return /^\/(messages|settings|compose|account|i\/)/.test(location.pathname);
}

function autoScroll() {
  const direction = Math.random() < 0.18 ? -1 : 1;
  const distance = (280 + Math.floor(Math.random() * 720)) * direction;
  window.scrollBy({ top: distance, behavior: "smooth" });
}

function visibleTweets() {
  return [...document.querySelectorAll(QUIP_SELECTORS.tweet)].filter((article) => {
    if (article.parentElement?.closest(QUIP_SELECTORS.tweet)) return false;
    const rect = article.getBoundingClientRect();
    return rect.bottom > 80 && rect.top < window.innerHeight - 40 && rect.height > 40;
  });
}

function pickTweet(filter) {
  const list = visibleTweets().filter(filter);
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function statusLink(article) {
  return ownElements(article, 'a[href*="/status/"]').find((anchor) => /\/status\/\d+/.test(anchor.getAttribute("href") || "")) || null;
}

function profileLink(article) {
  const block = ownElements(article, QUIP_SELECTORS.userName)[0];
  if (!block) return null;
  return [...block.querySelectorAll("a[href]")].find((anchor) => /^\/[^/]+$/.test(anchor.getAttribute("href") || "")) || null;
}

function tweetKey(article) {
  const href = statusLink(article)?.getAttribute("href") || "";
  const match = href.match(/\/status\/(\d+)/);
  if (match) return match[1];
  return extractPost(article).text.slice(0, 80);
}

async function autoLikeOne() {
  const article = pickTweet((node) => !isLiked(node) && ownControl(node, QUIP_SELECTORS.likeButton));
  if (!article) {
    autoScroll();
    return false;
  }
  article.scrollIntoView({ block: "center", behavior: "smooth" });
  await autoWait(350 + Math.floor(Math.random() * 900));
  if (stopped || !ui.autoRun || isLiked(article)) return false;
  likeTweet(article);
  await autoWait(400);
  refreshLikeButtons();
  return isLiked(article);
}

async function autoVisit(kind) {
  const article = pickTweet((node) => (kind === "detail" ? statusLink(node) : profileLink(node)));
  if (!article) {
    autoScroll();
    return;
  }
  const link = kind === "detail" ? statusLink(article) : profileLink(article);
  if (!link) return;
  article.scrollIntoView({ block: "center", behavior: "smooth" });
  await autoWait(400 + Math.floor(Math.random() * 800));
  if (stopped || !ui.autoRun) return;
  const before = location.href;
  link.click();
  await autoWait(4000 + Math.floor(Math.random() * 8000));
  if (stopped || !ui.autoRun) return;
  if (location.href !== before) history.back();
  await autoWait(1000 + Math.floor(Math.random() * 1500));
}

function chooseAutoText(comments) {
  const picked = QuipShared.pickAutoComment(comments, ui);
  if (picked) return picked;
  const list = (comments || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (!list.length) return "";
  return list[Math.floor(Math.random() * list.length)];
}

async function autoCommentOne() {
  if (quota.blocked || ui.inserting || ui.open) return "";
  const article = pickTweet((node) => extractPost(node).text && !autoSeen.has(tweetKey(node)));
  if (!article) {
    autoScroll();
    return "";
  }
  const post = extractPost(article);
  const key = tweetKey(article);
  article.scrollIntoView({ block: "center", behavior: "smooth" });
  await autoWait(500 + Math.floor(Math.random() * 900));
  if (stopped || !ui.autoRun || ui.open) return "";
  const requestId = (() => {
    ui.requestId += 1;
    return ui.requestId;
  })();
  const response = await sendToBackground({ type: "generate", requestId, post });
  if (stopped || !ui.autoRun || requestId !== ui.requestId) return "";
  if (!response?.ok) {
    if (response?.code === "NO_KEY" || response?.code === "CAP") {
      autoNote = response.message || "已停下";
      return "halt";
    }
    return "";
  }
  const text = chooseAutoText(response.comments || []);
  if (!text) return "";
  autoSeen.add(key);
  ui.inserting = true;
  try {
    const editor = await ensureComposer(article);
    if (!editor || stopped || !ui.autoRun) return "";
    await autoWait(700 + Math.floor(Math.random() * 1200));
    if (!insertIntoEditor(editor, text, response.insertMode || "append")) {
      closeComposer(editor);
      return "";
    }
    await autoWait(600 + Math.floor(Math.random() * 1400));
    if (stopped || !ui.autoRun) {
      closeComposer(editor);
      return "";
    }
    if (!clickSend(editor)) {
      closeComposer(editor);
      return "";
    }
    const sent = await waitUntilSent(editor, text);
    if (!sent) {
      closeComposer(editor);
      return "";
    }
    const recorded = await sendToBackground({ type: "record-comment" });
    if (recorded) {
      try { applyQuota(recorded); } catch (error) {
        if (!extensionAlive() || invalidated(error)) stopQuip();
      }
    }
    return "comment";
  } finally {
    ui.inserting = false;
  }
}

function composerRoot(editor) {
  return editor.closest('[role="dialog"]') || editor.closest(QUIP_SELECTORS.cell) || editor.parentElement;
}

function clickSend(editor) {
  const button = composerRoot(editor)?.querySelector(QUIP_SELECTORS.sendButton);
  if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return false;
  button.click();
  return true;
}

async function waitUntilSent(editor, text) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (!editor.isConnected) return true;
    if (!readEditorText(editor).includes(text)) return true;
    await autoWait(200);
    if (stopped || !ui.autoRun) return false;
  }
  return false;
}

function closeComposer(editor) {
  const root = composerRoot(editor);
  const close = root?.querySelector('[data-testid="app-bar-close"]');
  if (close) {
    close.click();
    return;
  }
  root?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

function renderAutoHud(progress, note) {
  const host = ensureAutoHud();
  host.dataset.theme = pageIsDark() ? "dark" : "light";
  host.hidden = false;
  const likes = host.shadowRoot.querySelector("[data-auto-likes]");
  const comments = host.shadowRoot.querySelector("[data-auto-comments]");
  const status = host.shadowRoot.querySelector("[data-auto-note]");
  likes.textContent = `赞 ${progress.likes}/${ui.autoStopLikes}`;
  comments.textContent = `评论 ${progress.comments}/${ui.autoStopComments}`;
  status.textContent = note || "正在刷时间线";
}

function hideAutoHud() {
  if (!ui.autoHost) return;
  ui.autoHost.hidden = true;
}

function ensureAutoHud() {
  if (ui.autoHost) return ui.autoHost;
  const host = document.createElement("div");
  host.id = "quip-auto-host";
  host.hidden = true;
  host.style.cssText = "position:fixed;z-index:2147483000;right:16px;bottom:16px;width:max-content;max-width:calc(100vw - 32px);";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { color-scheme: light; }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 8px 8px 8px 14px;
      border-radius: 18px;
      background: #fffdf8;
      color: #1c1915;
      font: 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
      box-shadow: 0 0 0 1px rgba(28, 25, 21, 0.08), 0 12px 32px rgba(28, 25, 21, 0.16);
    }
    strong { font-weight: 600; }
    span { font-variant-numeric: tabular-nums; font-weight: 600; }
    em { font-style: normal; color: #5c564c; }
    button {
      min-height: 40px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      background: #1c1915;
      color: #fffdf8;
      font: 600 13px/1 inherit;
      cursor: pointer;
    }
    button:active { transform: scale(0.96); }
    :host([data-theme="dark"]) .bar {
      background: #15202b;
      color: #e7e9ea;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 12px 32px rgba(0, 0, 0, 0.45);
    }
    :host([data-theme="dark"]) em { color: #8b98a5; }
    :host([data-theme="dark"]) button { background: #e7e9ea; color: #15202b; }
    @media (prefers-reduced-motion: reduce) { button:active { transform: none; } }
  `;
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "status");
  const title = document.createElement("strong");
  title.textContent = "全自动";
  const likes = document.createElement("span");
  likes.dataset.autoLikes = "true";
  const comments = document.createElement("span");
  comments.dataset.autoComments = "true";
  const note = document.createElement("em");
  note.dataset.autoNote = "true";
  const stop = document.createElement("button");
  stop.type = "button";
  stop.textContent = "停止";
  stop.addEventListener("click", () => {
    haltAutoLocal();
    sendToBackground({ type: "set-auto-run", enabled: false });
  });
  bar.append(title, likes, comments, note, stop);
  shadow.append(style, bar);
  document.body.append(host);
  ui.autoHost = host;
  return host;
}

function onDocumentPointerDown(event) {
  if (!ui.open) return;
  const path = event.composedPath();
  if (ui.host && path.includes(ui.host)) return;
  if (event.target instanceof Element && event.target.closest("[data-quip-anchor]")) return;
  closePanel();
}

function onDocumentKeyDown(event) {
  if (event.key === "Escape" && ui.open) closePanel();
}

function onViewportChange() {
  if (!ui.open) return;
  if (!ui.article?.isConnected || !ui.anchor?.isConnected) {
    closePanel();
    return;
  }
  positionPanel();
}

globalThis.QuipPage = {
  extractPost,
  insertIntoEditor,
  ensureComposer,
  likeTweet,
  isLiked,
  scanTweets,
};

if (globalThis.chrome?.runtime?.id) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}
