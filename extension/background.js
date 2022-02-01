let api = {}
if (typeof chrome !== 'undefined') api = chrome
if (typeof browser !== 'undefined') api = browser

const brewPackages = {}
const URLUtil = {
  toURL: function (url /* url object */) {
    if (Object.getPrototypeOf(url).constructor.name !== 'URL') return
    // Synonymize www with root domain, then allow search query to contain both
    return url.origin.replace(/\/\/www\./, '//') + url.pathname
  },
  getSearchQuery: function (url, types) {
    // Add www to the front of the domain (won't affect search results for subdomains)
    const urlOrigin = this.getOrigin(url)
    const urls = {
      www_pathed: `${url.protocol}//www.${url.hostname.replace(/^www\./, '')}${url.pathname}`,
      currentOnly_pathed: this.toURL(url),
      currentAndSub_pathed: url.hostname + url.pathname,
      www: urlOrigin.replace(/^(\w+):\/\//, '$1://www.'),
      currentOnly: urlOrigin,
      currentAndSub: new URL(urlOrigin).hostname + new URL(urlOrigin).pathname
    }
    // Backslash escape period so it works with Algolia
    Object.entries(urls).forEach(entry => { urls[entry[0]] = entry[1].replace(/\./g, '\\.') })
    return types.map(type => JSON.stringify(urls[type])).join(' ')
  },
  siteSpecificRootPaths: {
    'github.com': {
      preMatchReplacer: {
        expression: /^\/(about|account|codespaces|collections|dashboard|events|explore|issues|marketplace|new|notifications|organizations|pricing|pulls|settings|sponsors|topics|trending|watching)/,
        replacement: '/'
      },
      // Append Pattern Must match pathname '/'
      appendPattern: { expression: /^\/[0-9a-zA-Z-]*/ }
    }
  },
  getOrigin: function (url) {
    const sitePathData = this.siteSpecificRootPaths[url.hostname.replace(/^www\./, '')]
    if (!sitePathData) return url.origin.replace(/\/\/www\./, '//')
    const sitePath = url.pathname
      .replace(sitePathData.preMatchReplacer.expression, sitePathData.preMatchReplacer.replacement)
      .match(sitePathData.appendPattern.expression)[0]
    return url.origin.replace(/\/\/www\./, '//') + sitePath
  }
}
function updateBadge (url, tabId) {
  const pageResults = brewPackages[url] || {}
  if (!pageResults.total_hits) {
    api.action.setBadgeText({ tabId, text: '' }, () => {})
    api.action.setIcon({ tabId, path: '/icons/pack-icon-inactive-64.png' })
    return
  }
  const totalHits = pageResults.total_hits
  const primaryHits = pageResults.results.filter(r => r.primary).length
  const badgeConfig = { tabId, color: primaryHits ? '#be862d' : '#000', text: String(primaryHits || totalHits) }
  api.action.setBadgeBackgroundColor({ tabId, color: badgeConfig.color }, () => {})
  api.action.setBadgeText({ tabId, text: badgeConfig.text || '' }, () => {})
  api.action.setIcon({ tabId, path: '/icons/pack-icon-64.png' })
}

function updateAvailablePackages (url, tabId) {
  if (!tabId) return console.error(new Error('No Tab ID Provided'))

  url = new URL(url)
  if (brewPackages[URLUtil.toURL(url)]) return updateBadge(URLUtil.toURL(url), tabId) // Package Matches already exist
  if (!url.protocol.match(/^https?:$/)) return

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
          query: URLUtil.getSearchQuery(url, ['currentOnly_pathed', 'currentOnly', 'www_pathed', 'www']),
          hitsPerPage: 10,
          facetFilters: '["lang: en", "site: formulae"]',
          advancedSyntax: true
        },
        // Get Root if it hasn't been searched
        (!brewPackages[URLUtil.getOrigin(url)]
          ? {
              indexName: 'brew_all',
              query: URLUtil.getSearchQuery(url, ['currentOnly', 'www']),
              hitsPerPage: 10,
              facetFilters: '["lang: en", "site: formulae"]',
              advancedSyntax: true
            }
          : undefined)
      ].filter(q => !!q)
    })
  }).then(r => r.json()).then(response => {
    const data = response.results.map(result => {
      return {
        results: result.hits.filter(x => x.anchor === 'default').map(x => {
          return {
            brew_url: x.url,
            content_url: x.content,
            type: x.hierarchy.lvl0,
            formula: x.hierarchy.lvl1,
            primary: /* response.results[1] ? response.results[1].hits.some(primaryResult => primaryResult.url === x.url) : */ URLUtil.toURL(new URL(x.content)) === URLUtil.toURL(url),
            name: x.hierarchy.lvl0 === 'Casks' ? x.hierarchy.lvl2.replace(/^Names?:\n\s+/, '').split(',')[0] : ''
          }
        }),
        total_hits: result.nbHits
      }
    })
    brewPackages[URLUtil.toURL(url)] = data[0]
    if (data[1]) brewPackages[url.origin.replace(/\/\/www\./, '//')] = data[1]
    updateBadge(URLUtil.toURL(url), tabId)
  })
}

function findCurrentPagePackages (activeWindowOnly = true) {
  api.tabs.query({
    active: true,
    lastFocusedWindow: activeWindowOnly
  }, function (tabs) {
    tabs.forEach(tab => {
      if (!tab || !tab.url) return
      const url = new URL(tab.url)
      if (!url.protocol.match(/^https?:$/)) return updateBadge(tab.url, tab.id) // Will have zero matches -> disables icon
      const pageResults = brewPackages[URLUtil.toURL(url)]
      // If current page is not stored, get packages
      if (!pageResults) return updateAvailablePackages(URLUtil.toURL(url), tab.id)
      updateBadge(URLUtil.toURL(url), tab.id)
    })
  })
}

api.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  switch (request.type) {
    case 'get-site-packages': {
      // Always received from popup -> will always query active tab
      sendResponse({ message: 'request received' })
      api.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
        const tab = tabs[0]
        if (!tab || !tab.url) return updateBadge(tab.url, tab.id) // Will have zero matches -> disables icon
        const url = new URL(tab.url)
        if (!url.protocol.match(/^https?:$/)) return updateBadge(tab.url, tab.id) // Will have zero matches -> disables icon
        api.runtime.sendMessage({ type: 'send-site-packages', data: brewPackages[URLUtil.toURL(url)] })
      })
      break
    }
    case 'window-redirect':
      api.tabs.update({ url: request.url })
      break
  }
})

api.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== 'loading') return
  if (!info.url) findCurrentPagePackages()
  const urlNoWWW = URLUtil.toURL(new URL(info.url))
  const pageResults = brewPackages[urlNoWWW]
  if (!pageResults) return updateAvailablePackages(urlNoWWW, tabId)
  updateBadge(urlNoWWW, tabId)
})
api.tabs.onActivated.addListener(activeInfo => {
  findCurrentPagePackages()
})

api.action.setPopup({ popup: 'popup/index.html' })

const config = {
  resetInterval: 15
}

// Keep Service Worker Active
function ping () {}
setInterval(() => { ping() }, 60000)

// Reset Temporary Package List
setInterval(() => {
  console.log('%cResetting Temporary Package List...', 'color: #f9d094; background-color: #2e2a24; padding: 4px 10px; border: 3px solid #2f2f2e;')
  Object.keys(brewPackages).forEach(key => delete brewPackages[key])
  // Re-populate brewPackages using the current page
  findCurrentPagePackages(false)
}, config.resetInterval * 60 * 1000)
findCurrentPagePackages(false)

if (typeof module !== 'undefined') module.exports = { URLUtil, updateAvailablePackages }
