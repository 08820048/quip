import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromeCandidates = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Dia.app/Contents/MacOS/Dia",
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const unit = await run(process.execPath, ["--test", "tests/shared.test.js"]);
process.stdout.write(unit.stdout);
process.stderr.write(unit.stderr);
if (unit.code !== 0) process.exit(unit.code);

const chrome = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!chrome) {
  console.error("未找到 Chrome、Edge 或 Chromium，跳过了页面夹具。");
  process.exit(1);
}

const fixture = `file://${path.join(root, "tests/fixture.html")}`;
const result = await runFixture(chrome, fixture);
if (result !== "pass") {
  console.error(result || "夹具没有写出结果");
  process.exit(1);
}
console.log("fixture: pass");

async function runFixture(chromePath, url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "quip-ext-"));
  const port = 9400 + Math.floor(Math.random() * 400);
  const child = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-sync",
    "--allow-file-access-from-files",
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  try {
    await waitForDevtools(port);
    const created = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    if (!created.ok) throw new Error(`无法打开夹具页面：${created.status}`);
    const page = await created.json();
    const client = cdp(page.webSocketDebuggerUrl);
    await client.opened;
    const started = Date.now();
    let latest = "";
    while (Date.now() - started < 15000) {
      const evaluated = await client.send("Runtime.evaluate", {
        expression: "document.querySelector('#quip-result')?.textContent || ''",
        returnByValue: true,
      });
      latest = evaluated.result?.value || "";
      if (latest) return latest;
      await delay(100);
    }
    throw new Error(`夹具超时。${stderr.slice(-1000)}`);
  } finally {
    child.kill("SIGKILL");
  }
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let sequence = 0;
  const pending = new Map();
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("调试连接失败")), { once: true });
  });
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (!data.id || !pending.has(data.id)) return;
    const waiter = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) waiter.reject(new Error(JSON.stringify(data.error)));
    else waiter.resolve(data.result);
  });
  return {
    opened,
    send(method, params) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function waitForDevtools(port) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error("Chrome 调试端口没有打开");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
