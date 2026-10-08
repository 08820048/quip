function cell(html) {
  const wrapper = document.createElement("div");
  wrapper.dataset.testid = "cellInnerDiv";
  wrapper.innerHTML = html;
  return wrapper;
}

function tweet({ id, name, handle, text, extra = "", liked = false, dialog = false }) {
  const like = liked ? "unlike" : "like";
  const replyAttr = dialog ? " data-opens-dialog" : "";
  return cell(`
    <article data-testid="tweet" id="${id}">
      <div data-testid="User-Name">
        <a href="/${handle}"><span>${name}</span></a>
        <a href="/${handle}"><span>@${handle}</span></a>
      </div>
      ${text ? `<div data-testid="tweetText">${text}</div>` : ""}
      ${extra}
      <div role="group">
        <button data-testid="reply"${replyAttr}></button>
        <button data-testid="${like}"></button>
      </div>
    </article>
  `);
}

const timeline = document.querySelector("#timeline");
timeline.append(
  tweet({
    id: "tweet-a",
    name: "Ada",
    handle: "ada",
    text: "今天的构建终于绿了。",
    extra: '<div data-testid="tweetPhoto"></div>',
    dialog: true,
  }),
  tweet({ id: "tweet-empty", name: "空", handle: "empty", text: "" }),
  tweet({
    id: "tweet-quote",
    name: "Bea",
    handle: "bea",
    text: "同意，补一句。",
    extra: `
      <div role="link"><div data-testid="tweetText">原文在这里。</div></div>
      <a href="https://example.com/post">链接</a>
      <article data-testid="tweet" id="nested">
        <div data-testid="tweetText">嵌套正文</div>
        <div role="group"><button data-testid="reply"></button><button data-testid="like"></button></div>
      </article>
    `,
    liked: true,
  }),
  tweet({
    id: "tweet-inline",
    name: "Cara",
    handle: "cara",
    text: "这段已经打开回复框。",
    extra: '<div data-testid="tweetTextarea_0" id="inline-box" contenteditable="true">草稿</div>',
  }),
  tweet({ id: "tweet-silent", name: "Dio", handle: "dio", text: "回复框不会出现。" }),
);

function watchReply(button) {
  button.addEventListener("click", () => {
    button.dataset.clicks = String(Number(button.dataset.clicks || 0) + 1);
    if (button.hasAttribute("data-opens-dialog")) document.querySelector("#composer-slot").hidden = false;
  });
}
function watchLike(button) {
  button.addEventListener("click", () => {
    button.dataset.clicks = String(Number(button.dataset.clicks || 0) + 1);
    if (button.dataset.testid === "like") button.dataset.testid = "unlike";
  });
}
document.querySelectorAll('[data-testid="reply"]').forEach(watchReply);
document.querySelectorAll('[data-testid="like"], [data-testid="unlike"]').forEach(watchLike);
document.querySelector("#send").addEventListener("click", () => {
  document.querySelector("#send").dataset.clicks = String(Number(document.querySelector("#send").dataset.clicks || 0) + 1);
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, label, timeout = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return;
    await wait(20);
  }
  throw new Error(`超时：${label}`);
}

function panelRoot() {
  return document.querySelector("#quip-panel-host")?.shadowRoot || null;
}

function report(message) {
  let node = document.querySelector("#quip-result");
  if (!node) {
    node = document.createElement("pre");
    node.id = "quip-result";
    document.body.append(node);
  }
  node.textContent = message;
  document.title = message === "pass" ? "pass" : "fail";
}

function fail(error) {
  report(error?.message || String(error));
}

async function run() {
  await waitFor(() => document.querySelectorAll("[data-quip-ai]").length >= 4, "时间线按钮");
  if (document.querySelector("[data-quip-ai]").textContent !== "Quip") throw new Error("操作栏按钮文案不是 Quip");

  const ada = QuipPage.extractPost(document.querySelector("#tweet-a"));
  if (ada.authorName !== "Ada" || ada.handle !== "@ada" || ada.text !== "今天的构建终于绿了。" || !ada.hasImage) {
    throw new Error(`帖子提取错误 ${JSON.stringify(ada)}`);
  }
  const quote = QuipPage.extractPost(document.querySelector("#tweet-quote"));
  if (quote.text !== "同意，补一句。" || quote.quotedText !== "原文在这里。" || !quote.hasLink) {
    throw new Error(`引用帖提取错误 ${JSON.stringify(quote)}`);
  }
  if (document.querySelector("#nested [data-quip-anchor]")) throw new Error("嵌套帖子不应有入口");
  if (!document.querySelector("#tweet-quote [data-quip-anchor]")) throw new Error("外层帖子缺少入口");

  const generateCount = () => window.__calls.filter((call) => call.type === "generate").length;
  const beforeEmpty = generateCount();
  document.querySelector("#tweet-empty [data-quip-ai]").click();
  await waitFor(() => panelRoot()?.textContent.includes("无法提取帖子正文"), "空帖提示");
  if (!panelRoot().textContent.includes("今日 0/600")) throw new Error("没有显示今日用量");
  if (generateCount() !== beforeEmpty) throw new Error("空帖子不应该请求模型");

  const inlineReply = document.querySelector("#tweet-inline [data-testid='reply']");
  document.querySelector("#tweet-inline [data-quip-ai]").click();
  await waitFor(() => panelRoot()?.textContent.includes("认同这条"), "行内候选");
  panelRoot().querySelector(".quip-insert").click();
  await waitFor(() => document.querySelector("#inline-box").innerText.includes("认同这条"), "写入行内回复框");
  if (!document.querySelector("#inline-box").innerText.includes("草稿")) throw new Error("追加时丢掉了原内容");
  if (Number(inlineReply.dataset.clicks || 0) !== 0) throw new Error("回复框已经打开时不应再点回复");
  if (document.querySelector("#home-compose").innerText.trim() !== "首页草稿") throw new Error("写进了首页发布框");

  document.querySelector("#tweet-a [data-quip-ai]").click();
  await waitFor(() => panelRoot()?.textContent.includes("轻提问"), "弹层候选");
  panelRoot().querySelectorAll(".quip-insert")[2].click();
  await waitFor(() => document.querySelector("#dialog-box").innerText.includes("你怎么看？"), "写入弹层回复框");
  if (document.querySelector("#quip-panel-host").style.display !== "none") throw new Error("写入成功后浮层还在");
  if (Number(document.querySelector("#send").dataset.clicks || 0) !== 0) throw new Error("插件点击了发送");
  if (document.querySelector("#home-compose").innerText.trim() !== "首页草稿") throw new Error("弹层写入污染了首页发布框");

  const scratch = document.createElement("div");
  scratch.contentEditable = "true";
  scratch.textContent = "已有内容";
  document.body.append(scratch);
  if (!QuipPage.insertIntoEditor(scratch, "覆盖文案", "overwrite") || scratch.innerText.includes("已有内容")) {
    throw new Error("覆盖写入失败");
  }

  const liked = document.querySelector("#tweet-quote [data-testid='unlike']");
  document.querySelector("#tweet-quote [data-quip-like]").click();
  if (Number(liked.dataset.clicks || 0) !== 0) throw new Error("已赞帖子被再次点击");
  if (document.querySelector("#tweet-quote [data-quip-like]").getAttribute("aria-pressed") !== "true") {
    throw new Error("已赞状态没有反映到按钮");
  }
  const like = document.querySelector("#tweet-a [data-testid='like']");
  document.querySelector("#tweet-a [data-quip-like]").click();
  if (Number(like.dataset.clicks || 0) !== 1 || like.dataset.testid !== "unlike") throw new Error("点赞没有触发原按钮");

  timeline.append(tweet({ id: "tweet-new", name: "Eve", handle: "eve", text: "新加载的帖子。", dialog: true }));
  await waitFor(() => document.querySelector("#tweet-new [data-quip-ai]"), "新帖子入口");

  window.__mode = "no-key";
  document.querySelector("#tweet-new [data-quip-ai]").click();
  await waitFor(() => panelRoot()?.textContent.includes("请先在选项页配置 API Key"), "缺少 Key");
  if (!panelRoot().textContent.includes("打开选项页")) throw new Error("没有去选项页的入口");

  window.__mode = "ok";
  const dialogText = document.querySelector("#dialog-box").innerText;
  document.querySelector("#tweet-silent [data-quip-ai]").click();
  await waitFor(() => panelRoot()?.textContent.includes("不错"), "失败场景候选");
  panelRoot().querySelector(".quip-insert").click();
  await waitFor(() => panelRoot()?.textContent.includes("写入失败，回复框没有出现"), "写入失败提示", 7000);
  if (!panelRoot().textContent.includes("认同这条")) throw new Error("失败后候选不可见");
  if (document.querySelector("#dialog-box").innerText !== dialogText) throw new Error("失败时改写了别的回复框");

  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await waitFor(() => document.querySelector("#quip-panel-host").style.display === "none", "点击空白关闭");

  const beforeRepeat = generateCount();
  document.querySelector("#tweet-a [data-quip-ai]").click();
  await waitFor(() => panelRoot()?.textContent.includes("短评"), "重新生成");
  document.querySelector("#tweet-a [data-quip-ai]").click();
  await waitFor(() => generateCount() >= beforeRepeat + 2, "重复点击重新请求");

  if (window.__used !== 2) throw new Error(`写入计数错误 ${window.__used}`);

  window.__autoInsert = "position";
  window.__autoInsertIndex = 2;
  window.__autoLike = true;
  timeline.append(tweet({
    id: "tweet-auto",
    name: "Finn",
    handle: "finn",
    text: "自动写入这一条。",
    extra: '<div data-testid="tweetTextarea_0" id="auto-box" contenteditable="true"></div>',
  }));
  watchLike(document.querySelector("#tweet-auto [data-testid='like']"));
  await waitFor(() => document.querySelector("#tweet-auto [data-quip-ai]"), "自动写入入口");
  const sendsBeforeAuto = Number(document.querySelector("#send").dataset.clicks || 0);
  document.querySelector("#tweet-auto [data-quip-ai]").click();
  await waitFor(() => document.querySelector("#auto-box").innerText.includes("补一个例子"), "自动写入第 2 条");
  await waitFor(() => document.querySelector("#tweet-auto [data-testid='unlike']")?.dataset.clicks === "1", "评论后自动点赞");
  if (document.querySelector("#quip-panel-host").style.display !== "none") throw new Error("自动写入后浮层还在");
  if (Number(document.querySelector("#send").dataset.clicks || 0) !== sendsBeforeAuto) throw new Error("自动写入时点击了发送");

  window.__autoInsert = "random";
  window.__autoLike = true;
  timeline.append(tweet({
    id: "tweet-random",
    name: "Gia",
    handle: "gia",
    text: "随机写入这一条。",
    extra: '<div data-testid="tweetTextarea_0" id="random-box" contenteditable="true"></div>',
    liked: true,
  }));
  const randomLike = document.querySelector("#tweet-random [data-testid='unlike']");
  watchLike(randomLike);
  await waitFor(() => document.querySelector("#tweet-random [data-quip-ai]"), "随机写入入口");
  document.querySelector("#tweet-random [data-quip-ai]").click();
  await waitFor(() => ["认同这条", "补一个例子", "你怎么看？", "不错"].some((comment) => document.querySelector("#random-box").innerText.includes(comment)), "随机写入一条");
  if (Number(randomLike.dataset.clicks || 0) !== 0) throw new Error("已赞帖子被自动点赞再次点击");

  window.__autoInsert = "off";
  window.__autoLike = false;
  window.__dailyCap = window.__used;
  const generatesAtCap = generateCount();
  const likeClicks = Number(document.querySelector("#tweet-a [data-testid='unlike']").dataset.clicks || 0);
  document.querySelector("#tweet-a [data-quip-ai]").click();
  await waitFor(() => {
    const notice = document.querySelector("#quip-cap-notice");
    return notice && !notice.hidden && notice.shadowRoot?.textContent.includes(`达到 ${window.__dailyCap} 条上限`);
  }, "上限提示");
  if (document.querySelector("#tweet-a [data-quip-ai]").disabled !== true) throw new Error("达到上限后 Quip 按钮仍可点");
  if (document.querySelector("#tweet-a [data-quip-like]").disabled !== true) throw new Error("达到上限后点赞图标仍可点");
  if (generateCount() !== generatesAtCap) throw new Error("达到上限后仍在请求模型");
  document.querySelector("#tweet-a [data-quip-like]").click();
  if (Number(document.querySelector("#tweet-a [data-testid='unlike']").dataset.clicks || 0) !== likeClicks) {
    throw new Error("达到上限后仍能点赞");
  }
  timeline.append(tweet({ id: "tweet-capped", name: "Mia", handle: "mia", text: "上限之后的新帖。", dialog: true }));
  await waitFor(() => document.querySelector("#tweet-capped [data-quip-ai]")?.disabled === true, "新帖子也停用");

  window.__quipFollowFast = true;
  const me = document.createElement("a");
  me.dataset.testid = "AppTabBar_Profile_Link";
  me.setAttribute("href", "/myself");
  document.body.append(me);
  if (QuipPage.loggedInHandle() !== "myself") throw new Error("没有读到当前登录账号");

  function userRow({ handle, name, verified, follows, aria }) {
    const node = document.createElement("div");
    node.dataset.testid = "UserCell";
    node.id = `user-${handle}${aria ? "-aria" : ""}`;
    const badge = verified
      ? '<svg data-testid="icon-verified" aria-label="Verified account"></svg>'
      : (aria ? '<svg aria-label="已认证"></svg>' : "");
    node.innerHTML = `
      <div data-testid="User-Name">
        <a href="/${handle}"><span>${name}</span></a>
        <a href="/${handle}"><span>@${handle}</span></a>
        ${badge}
      </div>
      ${follows ? '<span data-testid="userFollowIndicator">关注了你</span>' : ""}
      <button data-testid="${handle}-unfollow" aria-label="Following @${handle}"></button>
    `;
    const button = node.querySelector("button");
    button.addEventListener("click", () => {
      button.dataset.clicks = String(Number(button.dataset.clicks || 0) + 1);
      const sheet = document.createElement("button");
      sheet.dataset.testid = "confirmationSheetConfirm";
      document.body.append(sheet);
      sheet.addEventListener("click", () => {
        sheet.dataset.clicks = String(Number(sheet.dataset.clicks || 0) + 1);
        sheet.remove();
      });
    });
    return node;
  }

  const follows = document.createElement("div");
  follows.id = "follows";
  follows.append(
    userRow({ handle: "gold", name: "Gold", verified: true, follows: false }),
    userRow({ handle: "gold", name: "Gold", verified: true, follows: false }),
    userRow({ handle: "pal", name: "Pal", verified: true, follows: true }),
    userRow({ handle: "plain", name: "Plain", verified: false, follows: false }),
    userRow({ handle: "aria", name: "Aria", aria: true, follows: false }),
    userRow({ handle: "myself", name: "Me", verified: true, follows: false }),
  );
  document.body.append(follows);
  const listed = QuipPage.collectVerifiedNonMutual(follows).map((row) => row.handle);
  if (listed.join(",") !== "gold,aria") throw new Error(`未回关名单不对 ${listed.join(",")}`);
  const pal = QuipPage.readUserCell(follows.querySelector("#user-pal"));
  if (!pal.verified || !pal.followsYou) throw new Error("回关的认证账号被看成未回关");
  const sendsBeforeUnfollow = Number(document.querySelector("#send").dataset.clicks || 0);
  const goldButton = follows.querySelector("#user-gold [data-testid$='-unfollow']");
  const palButton = follows.querySelector("#user-pal [data-testid$='-unfollow']");
  if (!await QuipPage.unfollowCell(follows.querySelector("#user-gold"))) throw new Error("未回关的认证账号没有取消关注");
  if (goldButton.dataset.clicks !== "1") throw new Error("取消关注没有点到按钮");
  if (document.querySelector("[data-testid='confirmationSheetConfirm']")) throw new Error("确认层没有关掉");
  if (await QuipPage.unfollowCell(follows.querySelector("#user-pal"))) throw new Error("回关的认证账号被取消关注");
  if (Number(palButton.dataset.clicks || 0) !== 0) throw new Error("回关账号的按钮被点了");
  if (await QuipPage.unfollowCell(follows.querySelector("#user-plain"))) throw new Error("未认证账号被取消关注");
  if (Number(document.querySelector("#send").dataset.clicks || 0) !== sendsBeforeUnfollow) throw new Error("取消关注时点了发送");

  const ownPost = tweet({ id: "tweet-own", name: "Me", handle: "myself", text: "这是我自己发的。" });
  const otherPost = tweet({ id: "tweet-other", name: "Ada", handle: "ada", text: "这是别人的。" });
  const repliedPost = tweet({ id: "tweet-replied", name: "Bea", handle: "bea", text: "我回复过的原帖。" });
  const marker = document.createElement("div");
  marker.dataset.testid = "socialContext";
  marker.textContent = "你回复了";
  repliedPost.prepend(marker);
  if (!QuipPage.isOwnInteraction(ownPost.querySelector("article"))) throw new Error("自己的帖子还会被互动");
  if (QuipPage.isOwnInteraction(otherPost.querySelector("article"))) throw new Error("别人的帖子被当成自己的");
  if (!QuipPage.isOwnInteraction(repliedPost.querySelector("article"))) throw new Error("自己发出的评论还会被互动");
  if (QuipPage.shouldRefreshTimeline(2, 60000)) throw new Error("还没刷完就刷新");
  if (!QuipPage.shouldRefreshTimeline(3, 60000)) throw new Error("刷完没有刷新");
  if (QuipPage.shouldRefreshTimeline(3, 1000)) throw new Error("刚刷新完又刷新");

  const runtime = window.chrome.runtime;
  window.chrome.runtime = new Proxy(runtime, {
    get(_target, prop) {
      if (prop === "id" || prop === "sendMessage") throw new Error("Extension context invalidated.");
      return undefined;
    },
  });
  const stale = document.querySelector("#tweet-capped [data-quip-ai]");
  stale.disabled = false;
  stale.click();
  await waitFor(() => document.querySelector("#quip-reload-notice")?.textContent.includes("请刷新页面"), "扩展更新提示");

  report("pass");
}

run().catch(fail);
