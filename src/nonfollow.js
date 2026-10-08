const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const unfollowButton = document.querySelector("#unfollow");
const statusNode = document.querySelector("#status");
const results = document.querySelector("#results");
const list = document.querySelector("#list");
const allBox = document.querySelector("#all");
const countNode = document.querySelector("#count");

let job = 0;
let running = false;
let tabId = 0;
let settled = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setStatus(text) {
  statusNode.textContent = text;
}

function selectedHandles() {
  return [...list.querySelectorAll("input:checked")].map((input) => input.value);
}

function refreshCount() {
  const boxes = [...list.querySelectorAll("input")];
  const selected = boxes.filter((box) => box.checked).length;
  allBox.checked = boxes.length > 0 && selected === boxes.length;
  allBox.indeterminate = selected > 0 && selected < boxes.length;
  countNode.textContent = `已选 ${selected} / ${boxes.length}`;
  unfollowButton.disabled = running || selected === 0;
  results.hidden = boxes.length === 0;
}

function rowFor(user) {
  const label = document.createElement("label");
  label.className = "person";
  label.dataset.handle = user.handle.toLowerCase();
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = true;
  input.value = user.handle;
  const who = document.createElement("span");
  who.className = "who";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = user.name || user.handle;
  const handle = document.createElement("span");
  handle.className = "handle";
  handle.textContent = `@${user.handle}`;
  who.append(name, handle);
  label.append(input, who);
  return label;
}

function upsertUsers(users) {
  const have = new Set([...list.querySelectorAll("input")].map((input) => input.value.toLowerCase()));
  for (const user of users || []) {
    const handle = String(user?.handle || "");
    if (!/^[A-Za-z0-9_]{1,15}$/.test(handle) || have.has(handle.toLowerCase())) continue;
    have.add(handle.toLowerCase());
    list.append(rowFor({ handle, name: String(user.name || handle).slice(0, 80) }));
  }
  refreshCount();
}

function removeHandle(handle) {
  list.querySelector(`[data-handle="${CSS.escape(String(handle).toLowerCase())}"]`)?.remove();
  refreshCount();
}

function setRunning(next) {
  running = next;
  startButton.disabled = next;
  stopButton.hidden = !next;
  stopButton.disabled = !next;
  refreshCount();
}

async function findXTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active && /^https:\/\/(x|twitter)\.com\//.test(active.url || "")) return active;
  const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] });
  return tabs[0] || null;
}

function waitUntilLoaded(id) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }, 15000);
    function onUpdated(updatedId, info) {
      if (updatedId === id && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function whoami(id, currentJob) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (currentJob !== job) return null;
    try {
      const reply = await chrome.tabs.sendMessage(id, { type: "whoami", job: currentJob });
      if (reply?.ok && reply.handle) return reply;
    } catch {
      // 页面还在加载，或内容脚本还没挂上。
    }
    await wait(400);
  }
  return null;
}

async function openFollowing(tab, handle) {
  const host = new URL(tab.url).host;
  const next = `https://${host}/${handle}/following`;
  const path = new URL(tab.url).pathname.replace(/\/+$/, "").toLowerCase();
  if (path === `/${handle.toLowerCase()}/following`) {
    await chrome.tabs.update(tab.id, { active: true });
    return;
  }
  await chrome.tabs.update(tab.id, { url: next, active: true });
  await waitUntilLoaded(tab.id);
}

function reason(code) {
  if (code === "NO_TAB") return "先打开 x.com 并登录，再点开始查看。";
  if (code === "NO_HANDLE") return "没有读到当前登录的账号。刷新 x.com 后再试。";
  if (code === "NOT_READY") return "这个标签页还没有 Quip。刷新 x.com 后再试。";
  if (code === "NOT_FOLLOWING") return "没有停在正在关注页面。再点一次开始查看。";
  if (code === "BUSY") return "上一次还在进行。先停掉，或等它结束。";
  if (code === "EMPTY") return "先勾选要取消关注的账号。";
  return "没有完成。刷新 x.com 后再试。";
}

function scanSummary(message) {
  const count = message.users?.length || 0;
  if (message.stopped) return `已停下。看到 ${count} 个未回关的认证账号。`;
  if (count === 0) return "没有找到未回关的认证账号。如果页面是空的，先确认打开的是你的正在关注。";
  return `看完了。${count} 个认证账号没有回关。勾选后可以取消关注。`;
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender?.id !== chrome.runtime.id || message?.type !== "nonmutual-progress" || message.job !== job) return;
  if (message.phase === "scan") {
    upsertUsers(message.users);
    if (message.done) {
      settled = true;
      setStatus(scanSummary(message));
      setRunning(false);
    } else {
      setStatus(`正在往下看… 已看过 ${message.looked || 0} 人，未回关认证 ${message.users?.length || 0} 人`);
    }
    return;
  }
  if (message.phase === "unfollow") {
    if (message.ok && message.handle) removeHandle(message.handle);
    if (message.finished) {
      settled = true;
      const missed = message.missed?.length || 0;
      setStatus(message.stopped
        ? `已停下。取消了 ${message.done || 0} 个。`
        : `已取消关注 ${message.done || 0} 个。${missed ? `还有 ${missed} 个没点到，还留在列表里。` : ""}`);
      setRunning(false);
      return;
    }
    if (message.handle) {
      setStatus(`正在取消关注 @${message.handle}（${message.done || 0}/${message.total || 0}）`);
    }
  }
});

async function startScan() {
  const currentJob = job;
  setRunning(true);
  settled = false;
  list.replaceChildren();
  refreshCount();
  setStatus("正在找已登录的 X 标签页…");
  const tab = await findXTab();
  if (currentJob !== job) return;
  if (!tab?.id || !tab.url) {
    setStatus(reason("NO_TAB"));
    setRunning(false);
    return;
  }
  tabId = tab.id;
  let identity = null;
  try {
    identity = await whoami(tab.id, currentJob);
  } catch {
    identity = null;
  }
  if (currentJob !== job) return;
  if (!identity?.handle) {
    setStatus(reason("NO_HANDLE"));
    setRunning(false);
    return;
  }
  setStatus(`正在打开 @${identity.handle} 的正在关注…`);
  try {
    await openFollowing(tab, identity.handle);
  } catch {
    setStatus(reason("NOT_READY"));
    setRunning(false);
    return;
  }
  if (currentJob !== job) return;
  const ready = await whoami(tab.id, currentJob);
  if (currentJob !== job) return;
  if (!ready?.handle) {
    setStatus(reason("NOT_READY"));
    setRunning(false);
    return;
  }
  setStatus("正在往下看关注列表…");
  let reply = null;
  try {
    reply = await chrome.tabs.sendMessage(tab.id, { type: "scan-nonmutual", job: currentJob });
  } catch {
    reply = null;
  }
  if (currentJob !== job || settled) return;
  if (!reply?.ok) {
    setStatus(reason(reply?.code || "NOT_READY"));
    setRunning(false);
    return;
  }
  upsertUsers(reply.users);
  setStatus(scanSummary(reply));
  setRunning(false);
}

startButton.addEventListener("click", () => {
  job += 1;
  startScan().catch(() => {
    setStatus(reason("NOT_READY"));
    setRunning(false);
  });
});

stopButton.addEventListener("click", () => {
  stopButton.disabled = true;
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: "stop-follow-job", job }).catch(() => {});
  }
});

allBox.addEventListener("change", () => {
  for (const input of list.querySelectorAll("input")) input.checked = allBox.checked;
  refreshCount();
});

list.addEventListener("change", refreshCount);

unfollowButton.addEventListener("click", () => {
  let handles = selectedHandles();
  if (!handles.length || !tabId) {
    setStatus(reason(handles.length ? "NO_TAB" : "EMPTY"));
    return;
  }
  if (handles.length > 500) {
    handles = handles.slice(0, 500);
    setStatus("一次最多取消 500 个。这一次先处理前 500 个。");
  }
  const confirmed = window.confirm(`取消关注这 ${handles.length} 个账号？只会点掉当前勾选的，并且会先再看一次是不是认证、有没有回关。`);
  if (!confirmed) return;
  job += 1;
  const currentJob = job;
  settled = false;
  setRunning(true);
  setStatus(`准备取消关注 ${handles.length} 个账号…`);
  chrome.tabs.sendMessage(tabId, { type: "unfollow-nonmutual", job: currentJob, handles }).then((reply) => {
    if (currentJob !== job || settled) return;
    if (!reply?.ok) {
      setStatus(reason(reply?.code || "NOT_READY"));
      setRunning(false);
      return;
    }
    for (const handle of reply.done || []) removeHandle(handle);
    const missed = reply.missed?.length || 0;
    setStatus(reply.stopped
      ? `已停下。取消了 ${reply.done?.length || 0} 个。`
      : `已取消关注 ${reply.done?.length || 0} 个。${missed ? `还有 ${missed} 个没点到，还留在列表里。` : ""}`);
    setRunning(false);
  }).catch(() => {
    if (settled || currentJob !== job) return;
    setStatus(reason("NOT_READY"));
    setRunning(false);
  });
});
