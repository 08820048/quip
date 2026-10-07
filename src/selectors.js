// X 的帖子结构经常改。入口找不到时，只改这里的选择器。
const QUIP_SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',
  replyButton: '[data-testid="reply"]',
  likeButton: '[data-testid="like"]',
  unlikeButton: '[data-testid="unlike"]',
  actionGroup: '[role="group"]',
  photo: '[data-testid="tweetPhoto"]',
  video: '[data-testid="videoPlayer"], [data-testid="videoComponent"]',
  card: '[data-testid="card.wrapper"]',
  composer: '[data-testid="tweetTextarea_0"]',
  cell: '[data-testid="cellInnerDiv"]',
  sendButton: '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]',
};

globalThis.QUIP_SELECTORS = QUIP_SELECTORS;
