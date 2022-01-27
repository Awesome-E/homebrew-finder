function updateBadge () {
  const badgeConfig = { color: '#000', text: 'test' }
  chrome.browserAction.setBadgeBackgroundColor({ color: badgeConfig.color }, () => {})
  chrome.browserAction.setBadgeText({ text: badgeConfig.text || '' }, () => {})
}
function updatePopupInfo () {
  if (chrome.extension.getViews({ type: 'popup' }).length) (chrome || browser).runtime.sendMessage({ type: 'popup-update', value: activeCallList }, function () {})
}
// Copy Text
// function copyText (txt) {
//   // Create a textbox field where we can insert text to.
//   const copyTextArea = document.createElement('textarea')
//   copyTextArea.value = txt
//   document.body.appendChild(copyTextArea)
//   copyTextArea.select()
//   copyTextArea.setSelectionRange(0, 9999999) // Mobile
//   document.execCommand('copy')
//   document.body.removeChild(copyTextArea)
// }

(chrome || browser).runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log(request)
  if (updateBadge()) {
    updatePopupInfo()
  }
  if (request === 'get-url') {
    sendResponse(window.location.href)
  }
});

(chrome || browser).tabs.onUpdated.addListener((tabId, info) => {
  console.log(tabId, info)
});

(chrome || browser).browserAction.setPopup({ popup: 'popup/index.html' })
const activeCallList = {}
