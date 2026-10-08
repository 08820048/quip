const form = document.querySelector("#quick");
const capInput = form.elements.dailyCap;
const indexField = document.querySelector("#index-field");
const status = document.querySelector("#save-status");
let usageRecord = null;
let statusTimer = 0;
let capTimer = 0;
let ready = false;

function checked(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value;
}

function setChecked(name, value) {
  const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function readForm() {
  return {
    autoInsert: checked("autoInsert"),
    autoInsertIndex: form.elements.autoInsertIndex.value,
    autoLike: checked("autoLike"),
    insertMode: checked("insertMode"),
    count: checked("count"),
    language: checked("language"),
    dailyCap: capInput.value,
    autoRun: checked("autoRun"),
    autoStopLikes: form.elements.autoStopLikes.value,
    autoStopComments: form.elements.autoStopComments.value,
  };
}

function showForm(settings) {
  setChecked("autoInsert", settings.autoInsert);
  setChecked("autoLike", settings.autoLike ? "on" : "off");
  setChecked("insertMode", settings.insertMode);
  setChecked("count", String(settings.count));
  setChecked("language", settings.language);
  form.elements.autoInsertIndex.value = String(settings.autoInsertIndex);
  setChecked("autoRun", settings.autoRun ? "on" : "off");
  if (document.activeElement !== capInput) capInput.value = String(settings.dailyCap);
  if (document.activeElement !== form.elements.autoStopLikes) {
    form.elements.autoStopLikes.value = String(settings.autoStopLikes);
  }
  if (document.activeElement !== form.elements.autoStopComments) {
    form.elements.autoStopComments.value = String(settings.autoStopComments);
  }
  indexField.hidden = settings.autoInsert !== "position";
}

function showProgress(snapshot) {
  document.querySelector("#used").textContent = String(snapshot.used);
  document.querySelector("#cap").textContent = `/ ${snapshot.dailyCap}`;
  const scale = snapshot.dailyCap > 0 ? Math.min(1, snapshot.used / snapshot.dailyCap) : 1;
  document.querySelector("#fill").style.width = `${Math.round(scale * 100)}%`;
  const bar = document.querySelector("#bar");
  bar.setAttribute("aria-valuemax", String(snapshot.dailyCap));
  bar.setAttribute("aria-valuenow", String(Math.min(snapshot.used, snapshot.dailyCap)));
  document.querySelector("#progress-note").textContent = snapshot.blocked
    ? QuipShared.capMessage(snapshot)
    : `还剩 ${snapshot.remaining} 条。写入回复框成功才计数。`;
}

function markSaved() {
  status.textContent = "已更新";
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    status.textContent = "";
  }, 1200);
}

async function persist() {
  if (!ready) return;
  const stored = await chrome.storage.local.get(["settings", "usage"]);
  usageRecord = stored.usage || null;
  const current = QuipShared.normalizeSettings(stored.settings);
  const formValues = readForm();
  const turningOn = formValues.autoRun === "on" && !current.autoRun;
  const next = QuipShared.normalizeSettings({
    ...current,
    ...formValues,
    autoRunToken: turningOn ? Date.now() : current.autoRunToken,
  });
  await chrome.storage.local.set({ settings: next });
  showForm(next);
  showProgress(QuipShared.usageSnapshot(usageRecord, next.dailyCap, QuipShared.localDateKey()));
  markSaved();
}

async function load() {
  const stored = await chrome.storage.local.get(["settings", "usage"]);
  usageRecord = stored.usage || null;
  const settings = QuipShared.normalizeSettings(stored.settings);
  showForm(settings);
  showProgress(QuipShared.usageSnapshot(usageRecord, settings.dailyCap, QuipShared.localDateKey()));
  ready = true;
}

form.addEventListener("change", () => {
  indexField.hidden = checked("autoInsert") !== "position";
  persist().catch(() => {
    status.textContent = "没有保存";
  });
});

for (const input of [capInput, form.elements.autoStopLikes, form.elements.autoStopComments]) {
  input.addEventListener("input", () => {
    clearTimeout(capTimer);
    capTimer = setTimeout(() => persist(), 400);
  });
}

document.querySelector("#open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

load();
