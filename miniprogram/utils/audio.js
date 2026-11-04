/* 单词发音：使用在线词典语音；正式发布需在小程序后台配置 downloadFile 合法域名 */
var ctx = null;

function speak(word) {
  if (!word) return;
  try {
    if (!ctx) {
      ctx = wx.createInnerAudioContext();
      ctx.onError(function () {
        wx.showToast({ title: "发音加载失败，请检查网络或域名配置", icon: "none" });
      });
    }
    ctx.stop();
    ctx.src = "https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(word) + "&type=2";
    ctx.play();
  } catch (e) {
    wx.showToast({ title: "当前环境不支持发音", icon: "none" });
  }
}

module.exports = { speak: speak };
