const brewPackages = {}
let currentPageResults = {}
function toURL (url /* url object */) {
  if (Object.getPrototypeOf(url).constructor.name !== 'URL') return
  // Synonymize www with root domain, then allow search query to contain both
  return url.origin.replace(/\/\/www\./, '//') + url.pathname
}
function updateBadge () {
  if (!currentPageResults.total_hits) {
    chrome.browserAction.setBadgeText({ text: '' }, () => {})
    chrome.browserAction.setIcon({ path: '/icons/pack-icon-inactive-64.png' })
    return
  }
  const totalHits = currentPageResults.total_hits
  const primaryHits = currentPageResults.results.filter(r => r.primary).length
  const badgeConfig = { color: primaryHits ? '#be862d' : '#000', text: String(primaryHits || totalHits) }
  chrome.browserAction.setBadgeBackgroundColor({ color: badgeConfig.color }, () => {})
  chrome.browserAction.setBadgeText({ text: badgeConfig.text || '' }, () => {})
  chrome.browserAction.setIcon({ path: '/icons/pack-icon-64.png' })
}
function clearResult () {
  currentPageResults = {}
  updateBadge()
}

function updateAvailablePackages (url) {
  const xhr = new XMLHttpRequest()
  url = new URL(url)
  if (brewPackages[url]) return updateBadge() // Package Matches already exist
  if (!url.protocol.match(/^https?:$/)) return
  xhr.open('POST', 'https://bh4d9od16a-dsn.algolia.net/1/indexes/*/queries')
  xhr.addEventListener('load', () => {
    const res = xhr.responseText
    let response = {}
    try { response = JSON.parse(res) } catch (e) { }
    const data = {
      results: response.results[0].hits.filter(x => x.anchor === 'default').map(x => {
        return {
          brew_url: x.url,
          content_url: x.content,
          type: x.hierarchy.lvl0,
          formula: x.hierarchy.lvl1,
          primary: /* response.results[1] ? response.results[1].hits.some(primaryResult => primaryResult.url === x.url) : */ toURL(new URL(x.content)) === toURL(url),
          name: x.hierarchy.lvl0 === 'Casks' ? x.hierarchy.lvl2.replace(/^Name:\n\s+/, '') : ''
        }
      }),
      total_hits: response.results[0].nbHits
    }
    currentPageResults = brewPackages[toURL(url)] = data
    updateBadge()
  })
  const headers = {
    'Content-Type': 'application/json',
    'x-algolia-application-id': 'BH4D9OD16A',
    'x-algolia-api-key': 'a57ef92bf2adfae863a201ee43d6b5a1'
  }
  Object.entries(headers).forEach(e => {
    xhr.setRequestHeader(e[0], e[1])
  })
  function getUrlQuery (types) {
    // Add www to the front of the domain (won't affect search results for subdomains)
    const urls = {
      www_pathed: `${url.protocol}//www.${url.hostname.replace(/^www\./, '')}${url.pathname}`,
      currentOnly_pathed: toURL(url),
      currentAndSub_pathed: url.hostname + url.pathname,
      www: `${url.protocol}//www.${url.hostname.replace(/^www\./, '')}`,
      currentOnly: url.origin.replace(/\/\/www\./, '//') + '/',
      currentAndSub: url.hostname
    }
    // Backslash escape period so it works with Algolia
    Object.entries(urls).forEach(entry => { urls[entry[0]] = entry[1].replace(/\./g, '\\.') })
    // console.log(urls.currentAndSub, toURL(url).replace(/^\w+:\/\//, '').replace(/\./g, '\\.'))
    console.log(types.map(type => JSON.stringify(urls[type])).join(' '))
    return types.map(type => JSON.stringify(urls[type])).join(' ')
  }
  xhr.send(JSON.stringify({
    requests: [
      {
        indexName: 'brew_all',
        query: getUrlQuery(['currentOnly_pathed', 'currentOnly', 'www_pathed', 'www']),
        hitsPerPage: 10,
        facetFilters: '["lang: en", "site: formulae"]',
        advancedSyntax: true
      },
      (url.pathname !== '/'
        ? {
            // Primary Result Query
            indexName: 'brew_all',
            query: getUrlQuery(['currentOnly_pathed', 'www_pathed']),
            hitsPerPage: 10,
            facetFilters: '["lang: en", "site: formulae"]',
            advancedSyntax: true
          }
        : undefined)
    ].filter(q => !!q)
  }))
}

function findCurrentPagePackages () {
  chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  }, function (tabs) {
    const tab = tabs[0]
    if (!tab || !tab.url) return clearResult()
    const url = new URL(tab.url)
    if (!url.protocol.match(/^https?:$/)) return clearResult()
    currentPageResults = brewPackages[toURL(url)]
    // If current page is not stored, get packages
    if (!currentPageResults) return updateAvailablePackages(toURL(url))
    updateBadge()
  })
}

(chrome || browser).runtime.onMessage.addListener(function (request, sender, sendResponse) {
  switch (request.type) {
    case 'get-site-packages':
      sendResponse(currentPageResults)
      break
    case 'window-redirect':
      chrome.tabs.update({ url: request.url })
      break
  }
});

(chrome || browser).tabs.onUpdated.addListener((tabId, info) => {
  // console.log(tabId, info)
  if (!info.url) return
  currentPageResults = brewPackages[toURL(new URL(info.url))] || {}
  if (JSON.stringify(currentPageResults) === '{}') return updateAvailablePackages(info.url)
  updateBadge()
})
chrome.tabs.onActivated.addListener(activeInfo => {
  findCurrentPagePackages()
});

(chrome || browser).browserAction.setPopup({ popup: 'popup/index.html' })

const config = {
  resetInterval: 3
}
// Reset Temporary Package List
setInterval(() => {
  console.log('%cResetting Temporary Package List...', 'color: #f9d094; background-color: #2e2a24; padding: 4px 10px; border: 3px solid #2f2f2e;')
  Object.keys(brewPackages).forEach(key => delete brewPackages[key])
  currentPageResults = {}
  // Re-populate brewPackages using the current page
  findCurrentPagePackages()
}, config.resetInterval * 60 * 1000)
