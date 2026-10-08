// X 的页面结构经常改。时间线入口或关注列表找不到时，只改这里的选择器。
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
  column: '[data-testid="primaryColumn"]',
  socialContext: '[data-testid="socialContext"]',
  sendButton: '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]',
  userCell: '[data-testid="UserCell"]',
  verifiedIcon: '[data-testid="icon-verified"]',
  followsYou: '[data-testid="userFollowIndicator"]',
  unfollowButton: '[data-testid$="-unfollow"]',
  unfollowConfirm: '[data-testid="confirmationSheetConfirm"]',
  unfollowCancel: '[data-testid="confirmationSheetCancel"]',
  profileTab: 'a[data-testid="AppTabBar_Profile_Link"]',
};

globalThis.QUIP_SELECTORS = QUIP_SELECTORS;
