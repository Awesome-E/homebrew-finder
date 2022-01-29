const brewPackages = {}
function toURL (url /* url object */) {
  if (Object.getPrototypeOf(url).constructor.name !== 'URL') return
  // Synonymize www with root domain, then allow search query to contain both
  return url.origin.replace(/\/\/www\./, '//') + url.pathname
}
function updateBadge (url, tabId) {
  const pageResults = brewPackages[url] || {}
  if (!pageResults.total_hits) {
    chrome.action.setBadgeText({ tabId, text: '' }, () => {})
    chrome.action.setIcon({ tabId, path: '/icons/pack-icon-inactive-64.png' })
    return
  }
  const totalHits = pageResults.total_hits
  const primaryHits = pageResults.results.filter(r => r.primary).length
  const badgeConfig = { tabId, color: primaryHits ? '#be862d' : '#000', text: String(primaryHits || totalHits) }
  chrome.action.setBadgeBackgroundColor({ tabId, color: badgeConfig.color }, () => {})
  chrome.action.setBadgeText({ tabId, text: badgeConfig.text || '' }, () => {})
  chrome.action.setIcon({ tabId, path: '/icons/pack-icon-64.png' })
}

function updateAvailablePackages (url, tabId) {
  if (!tabId) return console.error(new Error('No Tab ID Provided'))

  url = new URL(url)
  if (brewPackages[toURL(url)]) return updateBadge(toURL(url), tabId) // Package Matches already exist
  if (!url.protocol.match(/^https?:$/)) return

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
    return types.map(type => JSON.stringify(urls[type])).join(' ')
  }
  fetch('https://bh4d9od16a-dsn.algolia.net/1/indexes/*/queries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-algolia-application-id': 'BH4D9OD16A',
      'x-algolia-api-key': 'a57ef92bf2adfae863a201ee43d6b5a1'
    },
    body: JSON.stringify({
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
    })
  }).then(r => r.json()).then(response => {
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
    brewPackages[toURL(url)] = data
    updateBadge(toURL(url), tabId)
  })
}

function findCurrentPagePackages (activeWindowOnly = true) {
  chrome.tabs.query({
    active: true,
    lastFocusedWindow: activeWindowOnly
  }, function (tabs) {
    tabs.forEach(tab => {
      if (!tab || !tab.url) return
      const url = new URL(tab.url)
      if (!url.protocol.match(/^https?:$/)) return updateBadge(tab.url, tab.id) // Will have zero matches -> disables icon
      const pageResults = brewPackages[toURL(url)]
      // If current page is not stored, get packages
      if (!pageResults) return updateAvailablePackages(toURL(url), tab.id)
      updateBadge(toURL(url), tab.id)
    })
  })
}

(chrome || browser).runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  switch (request.type) {
    case 'get-site-packages': {
      // Always received from popup -> will always query active tab
      sendResponse({ message: 'request received' })
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
        const tab = tabs[0]
        if (!tab || !tab.url) return updateBadge(tab.url, tab.id) // Will have zero matches -> disables icon
        const url = new URL(tab.url)
        if (!url.protocol.match(/^https?:$/)) return updateBadge(tab.url, tab.id); // Will have zero matches -> disables icon
        (chrome || browser).runtime.sendMessage({ type: 'send-site-packages', data: brewPackages[toURL(url)] })
      })
      break
    }
    case 'window-redirect':
      chrome.tabs.update({ url: request.url })
      break
  }
});

(chrome || browser).tabs.onUpdated.addListener((tabId, info) => {
  if (!info.url) return findCurrentPagePackages()
  const urlNoWWW = toURL(new URL(info.url))
  const pageResults = brewPackages[urlNoWWW]
  if (!pageResults) return updateAvailablePackages(urlNoWWW, tabId)
  updateBadge(urlNoWWW, tabId)
})
chrome.tabs.onActivated.addListener(activeInfo => {
  findCurrentPagePackages()
});

(chrome || browser).action.setPopup({ popup: 'popup/index.html' })

const config = {
  resetInterval: 3
}
// Reset Temporary Package List
setInterval(() => {
  console.log('%cResetting Temporary Package List...', 'color: #f9d094; background-color: #2e2a24; padding: 4px 10px; border: 3px solid #2f2f2e;')
  Object.keys(brewPackages).forEach(key => delete brewPackages[key])
  // Re-populate brewPackages using the current page
  findCurrentPagePackages(false)
}, config.resetInterval * 60 * 1000)
findCurrentPagePackages(false)
