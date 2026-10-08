const QuipShared = (() => {
  const DEFAULTS = {
    provider: "openai",
    apiKey: "",
    model: "",
    persona: "",
    language: "auto",
    count: 4,
    insertMode: "append",
    dailyCap: 600,
    autoInsert: "off",
    autoInsertIndex: 1,
    autoLike: false,
    autoRun: false,
    autoStopLikes: 20,
    autoStopComments: 10,
    autoRunToken: 0,
  };

  const DEFAULT_MODELS = {
    openai: "gpt-4.1-mini",
    xai: "grok-4.7",
    anthropic: "claude-sonnet-5",
    deepseek: "deepseek-flash",
  };

  const PROVIDER_URLS = {
    openai: "https://api.openai.com/v1/chat/completions",
    xai: "https://api.x.ai/v1/chat/completions",
    anthropic: "https://api.anthropic.com/v1/messages",
    deepseek: "https://api.deepseek.com/chat/completions",
  };

  const STYLE_NAMES = ["认同", "补充", "轻提问", "短评", "短评"];
  const TEXT_LIMIT = 1200;
  const COMMENT_LIMIT = 80;
  const DAILY_CAP_MAX = 9999;
  const PROVIDERS = ["openai", "xai", "anthropic", "deepseek"];

  function normalizeSettings(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const provider = PROVIDERS.includes(input.provider) ? input.provider : DEFAULTS.provider;
    const countNumber = Number(input.count);
    const count = countNumber === 3 || countNumber === 4 || countNumber === 5 ? countNumber : DEFAULTS.count;
    const language = input.language === "zh" || input.language === "en" || input.language === "auto"
      ? input.language
      : DEFAULTS.language;
    const insertMode = input.insertMode === "overwrite" ? "overwrite" : "append";
    const autoInsert = input.autoInsert === "position" || input.autoInsert === "random" ? input.autoInsert : "off";
    const indexNumber = Number(input.autoInsertIndex);
    const autoInsertIndex = Number.isInteger(indexNumber) && indexNumber >= 1 && indexNumber <= 5 ? indexNumber : DEFAULTS.autoInsertIndex;
    return {
      provider,
      apiKey: String(input.apiKey || "").trim(),
      model: String(input.model || "").trim().slice(0, 120),
      persona: String(input.persona || "").trim().slice(0, 800),
      language,
      count,
      insertMode,
      dailyCap: normalizeDailyCap(input.dailyCap),
      autoInsert,
      autoInsertIndex,
      autoLike: input.autoLike === true || input.autoLike === "on" || input.autoLike === "true",
      autoRun: input.autoRun === true || input.autoRun === "on" || input.autoRun === "true",
      autoStopLikes: normalizeStopCount(input.autoStopLikes, DEFAULTS.autoStopLikes),
      autoStopComments: normalizeStopCount(input.autoStopComments, DEFAULTS.autoStopComments),
      autoRunToken: normalizeToken(input.autoRunToken),
    };
  }

  function normalizeStopCount(value, fallback) {
    if (value === "" || value === null || value === undefined) return fallback;
    const number = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isInteger(number) || number < 0 || number > 999) return fallback;
    return number;
  }

  function normalizeToken(value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0 || number > 1e15) return 0;
    return number;
  }

  function autoRunFinished(input, commentBlocked) {
    const settings = normalizeSettings(input);
    const likes = Math.max(0, Math.floor(Number(input?.likes) || 0));
    const comments = Math.max(0, Math.floor(Number(input?.comments) || 0));
    const likeDone = settings.autoStopLikes <= 0 || likes >= settings.autoStopLikes;
    const commentDone = settings.autoStopComments <= 0 || comments >= settings.autoStopComments || commentBlocked === true;
    return likeDone && commentDone;
  }

  function pickAutoAction(input, random = Math.random) {
    const settings = normalizeSettings(input);
    const likes = Math.max(0, Math.floor(Number(input?.likes) || 0));
    const comments = Math.max(0, Math.floor(Number(input?.comments) || 0));
    const likeOpen = settings.autoStopLikes > 0 && likes < settings.autoStopLikes;
    const commentOpen = settings.autoStopComments > 0 && comments < settings.autoStopComments && input?.commentBlocked !== true;
    const weights = [
      ["scroll", 34],
      ["pause", 12],
      ["like", likeOpen ? 22 : 0],
      ["comment", commentOpen ? 18 : 0],
      ["detail", 8],
      ["profile", 6],
    ];
    const total = weights.reduce((sum, item) => sum + item[1], 0);
    let roll = Number(random());
    if (!Number.isFinite(roll)) roll = 0;
    roll = Math.min(0.999999, Math.max(0, roll)) * total;
    for (const [name, weight] of weights) {
      roll -= weight;
      if (roll < 0) return name;
    }
    return "scroll";
  }

  function autoWaitMs(action, random = Math.random) {
    const roll = () => {
      const value = Number(random());
      return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    };
    const bands = {
      pause: [8000, 20000],
      scroll: [1200, 4200],
      like: [2200, 8000],
      comment: [3000, 11000],
      detail: [2000, 7000],
      profile: [2500, 8000],
    };
    const band = bands[action] || [2000, 6000];
    const waitMs = band[0] + Math.floor(roll() * (band[1] - band[0]));
    if (roll() < 0.14) return waitMs + 15000 + Math.floor(roll() * 20000);
    return waitMs;
  }

  function pickAutoComment(comments, settingsInput, random = Math.random) {
    const settings = normalizeSettings(settingsInput);
    const list = Array.isArray(comments) ? comments.filter((item) => String(item || "").trim()) : [];
    if (!list.length || settings.autoInsert === "off") return null;
    if (settings.autoInsert === "random") {
      const roll = Number(random());
      const index = Number.isFinite(roll) ? Math.floor(roll * list.length) : 0;
      return list[Math.min(list.length - 1, Math.max(0, index))];
    }
    return list[Math.min(list.length, settings.autoInsertIndex) - 1];
  }

  function normalizeDailyCap(value) {
    if (value === "" || value === null || value === undefined) return DEFAULTS.dailyCap;
    const number = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isInteger(number) || number < 0 || number > DAILY_CAP_MAX) return DEFAULTS.dailyCap;
    return number;
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function usageSnapshot(stored, cap, today) {
    const dailyCap = normalizeDailyCap(cap);
    const used = stored && stored.date === today ? Math.max(0, Math.floor(Number(stored.count) || 0)) : 0;
    return {
      date: today,
      used,
      dailyCap,
      remaining: Math.max(0, dailyCap - used),
      blocked: used >= dailyCap,
    };
  }

  function capMessage(snapshot) {
    const used = Math.max(0, Math.floor(Number(snapshot?.used) || 0));
    const dailyCap = normalizeDailyCap(snapshot?.dailyCap);
    return `今日已写入 ${used} 条，达到 ${dailyCap} 条上限。可在 Quip 设置里调整。`;
  }

  function effectiveModel(settings) {
    return settings.model || DEFAULT_MODELS[settings.provider] || DEFAULT_MODELS.openai;
  }

  function truncateText(value) {
    const chars = Array.from(String(value || ""));
    if (chars.length <= TEXT_LIMIT) return { text: chars.join(""), truncated: false };
    return { text: chars.slice(0, TEXT_LIMIT).join(""), truncated: true };
  }

  function detectLanguage(text) {
    const sample = String(text || "");
    const cjk = (sample.match(/[\u3400-\u9fff]/g) || []).length;
    const latin = (sample.match(/[A-Za-z]/g) || []).length;
    if (cjk === 0 && latin === 0) return "zh";
    return cjk >= latin ? "zh" : "en";
  }

  function resolveLanguage(setting, text) {
    if (setting === "zh" || setting === "en") return setting;
    return detectLanguage(text);
  }

  function stylesFor(count) {
    return STYLE_NAMES.slice(0, count);
  }

  function commentStyles(settingsInput) {
    const settings = normalizeSettings(settingsInput);
    if (settings.persona) return [];
    return stylesFor(settings.count);
  }

  function capComment(value) {
    const chars = Array.from(String(value || "").trim());
    if (chars.length <= COMMENT_LIMIT) return chars.join("");
    return chars.slice(0, COMMENT_LIMIT).join("").replace(/[，。,.\s]+$/u, "");
  }

  function buildPrompt(settingsInput, post) {
    const settings = normalizeSettings(settingsInput);
    const clipped = truncateText(post?.text || "");
    const quoted = truncateText(post?.quotedText || "");
    const language = resolveLanguage(settings.language, clipped.text);
    const styles = stylesFor(settings.count);
    const persona = settings.persona;
    const lines = persona
      ? [
          "你是 X 回复助手。用户给出的人设是唯一的写作依据。写什么、从哪个角度写、用什么口吻，都只按人设。",
          `人设：${persona}`,
          "根据帖子写可以直接发送的评论候选。",
          `只输出一个 JSON 字符串数组，长度正好是 ${settings.count}。不要使用 markdown，不要解释。`,
          `写 ${settings.count} 条彼此不同的评论，差别由人设决定。`,
          "每条不超过 80 个字。",
          language === "zh" ? "使用中文。" : "Use English.",
          "不要堆砌话题标签。可以称呼账号，但不要假装认识作者，不要暗示你们以前交流过。",
          "不要编造帖子里没有的事实。如果帖子带图片、视频或链接，不要假装看过媒体内容。",
        ]
      : [
          "你是 X 回复助手。根据帖子写可以直接发送的评论候选。",
          `只输出一个 JSON 字符串数组，长度正好是 ${settings.count}。不要使用 markdown，不要解释。`,
          `数组顺序对应这些风格：${styles.join("、")}。`,
          settings.count === 5 ? "第 5 条仍是短评，但换一个角度。" : "",
          "每条不超过 80 个字。",
          language === "zh" ? "使用中文。" : "Use English.",
          "不要堆砌话题标签。可以称呼账号，但不要假装认识作者，不要暗示你们以前交流过。",
          "不要编造帖子里没有的事实。如果帖子带图片、视频或链接，不要假装看过媒体内容。",
        ].filter(Boolean);

    const user = [
      persona ? `按这段人设写 ${settings.count} 条不同的回复：${persona}` : "",
      post?.authorName ? `作者：${post.authorName}` : "",
      post?.handle ? `账号：${post.handle}` : "",
      `正文：${clipped.text}`,
      clipped.truncated ? "（正文已截断）" : "",
      quoted.text ? `引用：${quoted.text}` : "",
      `媒体：${post?.hasImage ? "有图片" : "无图片"}，${post?.hasVideo ? "有视频" : "无视频"}，${post?.hasLink ? "有链接" : "无链接"}`,
    ].filter(Boolean).join("\n");

    return { system: lines.join("\n"), user };
  }

  function parseComments(raw, count) {
    const wanted = Number(count) || DEFAULTS.count;
    const text = String(raw || "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start === -1 || end <= start) throw new Error("模型没有返回有效的评论列表");
      try {
        data = JSON.parse(text.slice(start, end + 1));
      } catch {
        throw new Error("模型没有返回有效的评论列表");
      }
    }

    let list = null;
    if (Array.isArray(data)) {
      list = data;
    } else if (data && typeof data === "object") {
      for (const key of ["comments", "replies", "suggestions", "items", "data"]) {
        if (Array.isArray(data[key])) {
          list = data[key];
          break;
        }
      }
      if (!list) {
        const arrays = Object.values(data).filter(Array.isArray);
        if (arrays.length === 1) list = arrays[0];
      }
    }
    if (!list || list.some((item) => typeof item !== "string")) {
      throw new Error("模型没有返回有效的评论列表");
    }
    const comments = list.map(capComment).filter(Boolean);
    if (comments.length < wanted) throw new Error("模型返回的评论数量不足");
    return comments.slice(0, wanted);
  }

  function redact(value, secrets) {
    let out = String(value || "");
    for (const secret of secrets || []) {
      if (secret && secret.length > 4) out = out.split(secret).join("***");
    }
    return out.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "***");
  }

  function providerErrorMessage(status, body, secret) {
    let detail = "";
    try {
      const json = JSON.parse(body);
      detail = json.error?.message || json.message || "";
      if (detail && typeof detail !== "string") detail = JSON.stringify(detail);
    } catch {
      detail = String(body || "");
    }
    detail = redact(String(detail).replace(/\s+/g, " ").trim(), [secret]).slice(0, 160);
    if (status === 401 || status === 403) {
      return detail
        ? `API Key 无效或没有权限。请检查 Key。（${detail}）`
        : "API Key 无效或没有权限。请检查 Key。";
    }
    if (status === 429) {
      return detail
        ? `请求过于频繁或额度不足，请稍后重试。（${detail}）`
        : "请求过于频繁或额度不足，请稍后重试。";
    }
    return detail ? `模型接口返回 ${status}。${detail}` : `模型接口返回 ${status}。`;
  }

  function buildProviderRequest(settingsInput, post) {
    const settings = normalizeSettings(settingsInput);
    const prompt = buildPrompt(settings, post);
    const model = effectiveModel(settings);
    if (settings.provider === "anthropic") {
      return {
        url: PROVIDER_URLS.anthropic,
        headers: {
          "content-type": "application/json",
          "x-api-key": settings.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: {
          model,
          max_tokens: 2000,
          system: prompt.system,
          messages: [{ role: "user", content: prompt.user }],
        },
      };
    }
    return {
      url: PROVIDER_URLS[settings.provider],
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${settings.apiKey}`,
      },
      body: {
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        ...(settings.provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
      },
    };
  }

  function extractProviderText(provider, payload) {
    if (provider === "anthropic") {
      const blocks = Array.isArray(payload?.content) ? payload.content : [];
      return blocks
        .filter((block) => block?.type === "text")
        .map((block) => block.text || "")
        .join("\n");
    }
    const message = payload?.choices?.[0]?.message;
    if (!message) return "";
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
    }
    return "";
  }

  return {
    DEFAULTS,
    DEFAULT_MODELS,
    TEXT_LIMIT,
    COMMENT_LIMIT,
    DAILY_CAP_MAX,
    normalizeSettings,
    pickAutoComment,
    autoRunFinished,
    pickAutoAction,
    autoWaitMs,
    normalizeDailyCap,
    localDateKey,
    usageSnapshot,
    capMessage,
    effectiveModel,
    truncateText,
    detectLanguage,
    resolveLanguage,
    stylesFor,
    commentStyles,
    capComment,
    buildPrompt,
    parseComments,
    redact,
    providerErrorMessage,
    buildProviderRequest,
    extractProviderText,
  };
})();

globalThis.QuipShared = QuipShared;
