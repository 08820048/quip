const form = document.querySelector("#settings");
const keyStatus = document.querySelector("#key-status");
const modelHint = document.querySelector("#model-hint");
const saveStatus = document.querySelector("#save-status");
const selectorList = document.querySelector("#selector-list");
const usageUsed = document.querySelector("#usage-used");
const usageCapLabel = document.querySelector("#usage-cap-label");
const usageNote = document.querySelector("#usage-note");
let savedKey = "";
let usageRecord = null;
let autoRunToken = 0;
let autoRunWasOn = false;

function renderUsage(settings) {
  const snapshot = QuipShared.usageSnapshot(usageRecord, settings.dailyCap, QuipShared.localDateKey());
  usageUsed.textContent = String(snapshot.used);
  usageCapLabel.textContent = `/ ${snapshot.dailyCap}`;
  usageNote.textContent = snapshot.blocked
    ? QuipShared.capMessage(snapshot)
    : "写入回复框成功后计 1 条。按这台电脑的本地时间，每天重新计数。";
}

function selected(name) {
  return form.elements[name].value;
}

function setRadio(name, value) {
  const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function updateModelHint() {
  const provider = selected("provider");
  const model = QuipShared.DEFAULT_MODELS[provider];
  modelHint.textContent = `留空则使用 ${model}。请求直接发往供应商，不经过中转。`;
  form.elements.model.placeholder = model;
}

function showKeyStatus() {
  keyStatus.textContent = savedKey ? "Key 已保存在本地。输入新 Key 会替换它，留空则保持不变。" : "未配置";
}

function updateAutoInsertFields() {
  const mode = form.querySelector('input[name="autoInsert"]:checked')?.value;
  document.querySelector("#auto-insert-index-label").hidden = mode !== "position";
}

function formSettings(apiKey) {
  return QuipShared.normalizeSettings({
    provider: selected("provider"),
    apiKey,
    model: form.elements.model.value,
    persona: form.elements.persona.value,
    language: form.querySelector('input[name="language"]:checked')?.value,
    count: form.elements.count.value,
    insertMode: form.querySelector('input[name="insertMode"]:checked')?.value,
    dailyCap: form.elements.dailyCap.value,
    autoInsert: form.querySelector('input[name="autoInsert"]:checked')?.value,
    autoInsertIndex: form.elements.autoInsertIndex.value,
    autoLike: form.querySelector('input[name="autoLike"]:checked')?.value,
    autoRun: form.querySelector('input[name="autoRun"]:checked')?.value,
    autoStopLikes: form.elements.autoStopLikes.value,
    autoStopComments: form.elements.autoStopComments.value,
    autoRunToken,
  });
}

async function load() {
  const stored = await chrome.storage.local.get(["settings", "usage"]);
  const settings = QuipShared.normalizeSettings(stored.settings);
  usageRecord = stored.usage || null;
  savedKey = settings.apiKey;
  form.elements.provider.value = settings.provider;
  form.elements.model.value = settings.model;
  form.elements.persona.value = settings.persona;
  form.elements.count.value = String(settings.count);
  form.elements.dailyCap.value = String(settings.dailyCap);
  form.elements.apiKey.value = "";
  setRadio("language", settings.language);
  setRadio("insertMode", settings.insertMode);
  setRadio("autoInsert", settings.autoInsert);
  setRadio("autoLike", settings.autoLike ? "on" : "off");
  setRadio("autoRun", settings.autoRun ? "on" : "off");
  form.elements.autoInsertIndex.value = String(settings.autoInsertIndex);
  form.elements.autoStopLikes.value = String(settings.autoStopLikes);
  form.elements.autoStopComments.value = String(settings.autoStopComments);
  autoRunToken = settings.autoRunToken;
  autoRunWasOn = settings.autoRun;
  showKeyStatus();
  updateModelHint();
  updateAutoInsertFields();
  renderUsage(settings);
}

async function persist(settings) {
  await chrome.storage.local.set({ settings });
  savedKey = settings.apiKey;
  form.elements.apiKey.value = "";
  showKeyStatus();
  renderUsage(settings);
}

form.elements.provider.addEventListener("change", updateModelHint);
form.addEventListener("change", (event) => {
  if (event.target.name === "autoInsert") updateAutoInsertFields();
  if (event.target.name !== "autoRun" || !event.target.checked) return;
  const turningOn = event.target.value === "on";
  if (turningOn && !autoRunWasOn) autoRunToken = Date.now();
  autoRunWasOn = turningOn;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const typedKey = form.elements.apiKey.value.trim();
  await persist(formSettings(typedKey || savedKey));
  saveStatus.textContent = "已保存";
});

document.querySelector("#clear-key").addEventListener("click", async () => {
  await persist(formSettings(""));
  saveStatus.textContent = "Key 已清除";
});

for (const [name, selector] of Object.entries(QUIP_SELECTORS)) {
  const item = document.createElement("li");
  const key = document.createElement("code");
  key.textContent = name;
  const value = document.createElement("code");
  value.textContent = selector;
  item.append(key, value);
  selectorList.append(item);
}

load();
