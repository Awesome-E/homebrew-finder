let api = null
let browserAction = 'browserAction'
if (typeof chrome !== 'undefined') {
  api = chrome
  browserAction = 'action'
}
if (typeof browser !== 'undefined') api = browser

const brewPackages = {}
const URLUtil = {
  toURL: function (url /* url object */) {
    if (Object.getPrototypeOf(url).constructor.name !== 'URL') return
    // Synonymize www with root domain, then allow search query to contain both
    return url.origin.replace(/\/\/www\./, '//') + url.pathname.replace(/^\/$/, '')
  },
  getSearchQuery: function (url, types) {
    if (Object.getPrototypeOf(url).constructor.name !== 'URL') return
    // Add www to the front of the domain (won't affect search results for subdomains)
    const urlOrigin = this.getOrigin(url)
    const urls = {
      www_pathed: `${url.protocol}//www.${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/^\/$/, '')}`,
      currentOnly_pathed: this.toURL(url),
      currentAndSub_pathed: new URL(urlOrigin).hostname + url.pathname.replace(/^\/$/, ''),
      www: urlOrigin.replace(/^(\w+):\/\//, '$1://www.'),
      currentOnly: urlOrigin,
      currentAndSub: new URL(urlOrigin).hostname + new URL(urlOrigin).pathname.replace(/^\/$/, '')
    }
    // Backslash escape period so it works with Algolia
    Object.entries(urls).forEach(entry => { urls[entry[0]] = entry[1].replace(/\./g, '\\.') })
    return types.map(type => JSON.stringify(urls[type])).join(' ')
  },
  siteSpecificRootPaths: {
    'github.com': {
      preMatchReplacer: {
        expression: /^\/(about|account|codespaces|collections|dashboard|events|explore|issues|marketplace|new|notifications|pricing|pulls|settings|sponsors|topics|trending|watching)/,
        replacement: '/'
      },
      // Append Pattern Must match pathname '/'
      appendPattern: { expression: /^(?:\/organizations|\/orgs)?(\/[0-9a-zA-Z-]*)/ }
    }
  },
  getOrigin: function (url) {
    if (Object.getPrototypeOf(url).constructor.name !== 'URL') return
    const sitePathData = this.siteSpecificRootPaths[url.hostname.replace(/^www\./, '')]
    if (!sitePathData) return url.origin.replace(/\/\/www\./, '//')
    const sitePath = url.pathname
      .replace(sitePathData.preMatchReplacer.expression, sitePathData.preMatchReplacer.replacement)
      .match(sitePathData.appendPattern.expression)[0]
    return url.origin.replace(/\/\/www\./, '//') + sitePath
  }
}
function updateBadge (url, tabId) {
  if (!api) return
  const pageResults = url ? (brewPackages[url] || brewPackages[URLUtil.getOrigin(new URL(url))] || {}) : {}
  if (!pageResults.total_hits) {
    api[browserAction].setBadgeText({ tabId, text: '' }, () => {})
    api[browserAction].setIcon({ tabId, path: '/icons/pack-icon-inactive-64.png' })
    return
  }
  const totalHits = pageResults.total_hits
  const primaryHits = pageResults.results.filter(r => r.primary).length
  const hitCount = primaryHits || totalHits
  const badgeConfig = { tabId, color: primaryHits ? '#be862d' : '#000', text: hitCount > 999 ? '1k+' : String(hitCount) }
  api[browserAction].setBadgeBackgroundColor({ tabId, color: badgeConfig.color }, () => {})
  api[browserAction].setBadgeText({ tabId, text: badgeConfig.text || '' }, () => {})
  api[browserAction].setIcon({ tabId, path: '/icons/pack-icon-64.png' })
}

function getSearchRequests (url, config = {}) {
  // only called if page has not been searched yet
  if (Object.getPrototypeOf(url).constructor.name !== 'URL') return { error: 'url is not of constructor URL' }
  const rootWasSearched = !!brewPackages[URLUtil.getOrigin(url)]
  const searchTypes = {}
  // Every new page visit will search this term
  searchTypes.page = [].concat(
    config.page_search === 'always' ? ['currentOnly_pathed', 'www_pathed'] : [],
    config.root_search === 'always' ? ['currentOnly', 'www'] : [],
    config.subdomain_search === 'always' ? ['currentAndSub'] : []
  )
  if (config.page_search === 'always' && config.subdomain_search === 'always') {
    // Insert one before the end
    searchTypes.page.splice(-1, 0, 'currentAndSub_pathed')
  }
  if (config.root_search === 'always' || config.subdomain_search === 'always') {
    searchTypes.root = [].concat(
      config.root_search === 'always' ? ['currentOnly', 'www'] : [],
      config.subdomain_search === 'always' ? ['currentAndSub'] : []
    )
  }
  const baseQuery = {
    indexName: 'brew_all',
    hitsPerPage: config.results_per,
    facetFilters: '["lang: en", "site: formulae"]',
    advancedSyntax: true
  }
  const pageQuery = Object.assign({ query: URLUtil.getSearchQuery(url, searchTypes.page) }, baseQuery)
  if (config.page_search !== 'always') {
    pageQuery.hitsPerPage = 0
    pageQuery.query = ''
  }
  const rootQuery = searchTypes.root && !rootWasSearched
    ? Object.assign({ query: URLUtil.getSearchQuery(url, searchTypes.root) }, baseQuery)
    : null
  return [pageQuery, rootQuery].filter(q => !!q)
}
function updateAvailablePackages (url, tabId) {
  if (!tabId) {
    if (api) console.error(new Error('No Tab ID Provided'))
    return { error: 'No tab ID provided' }
  }
  url = new URL(url)
  if (brewPackages[URLUtil.toURL(url)]) {
    updateBadge(URLUtil.toURL(url), tabId) // Package Matches already exist
    return { message: 'URL already searched, updating badge' }
  }
  if (!url.protocol.match(/^https?:$/)) {
    return { error: 'URL is not http or https' }
  }

  const requests = getSearchRequests(url, config)
  if (requests.length === 1 && requests[0].hitsPerPage === 0) return { message: 'Nothing to search' }

  fetch('https://bh4d9od16a-dsn.algolia.net/1/indexes/*/queries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-algolia-application-id': 'BH4D9OD16A',
      'x-algolia-api-key': 'a57ef92bf2adfae863a201ee43d6b5a1'
    },
    body: JSON.stringify({ requests })
  }).then(r => r.json()).then(response => {
    const data = response.results.map((result, index) => {
      return {
        results: result.hits.filter(x => x.anchor === 'default').map(x => {
          return {
            brew_url: x.url,
            content_url: x.content,
            type: x.hierarchy.lvl0,
            formula: x.hierarchy.lvl1,
            primary: URLUtil.toURL(new URL(x.content)) === URLUtil.toURL(url),
            name: x.hierarchy.lvl0 === 'Casks' ? x.hierarchy.lvl2.replace(/^Names?:\n\s+/, '').split(',')[0] : ''
          }
        }),
        total_hits: requests[index].hitsPerPage ? result.nbHits : 0
      }
    })
    if (requests[0].hitsPerPage) brewPackages[URLUtil.toURL(url)] = data[0]
    if (data[1]) brewPackages[URLUtil.getOrigin(url)] = data[1]
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
function refreshPackageList () {
  console.log('%cResetting Temporary Package List...', 'color: #f9d094; background-color: #2e2a24; padding: 4px 10px; border: 3px solid #2f2f2e;')
  Object.keys(brewPackages).forEach(key => delete brewPackages[key])
  // Re-populate brewPackages using the current pages
  findCurrentPagePackages(false)
}

const config = {
  refreshInterval: null
}

if (api) {
  api.storage.sync.get({
    options: {
      root_search: 'always',
      subdomain_search: 'never',
      page_search: 'always',
      results_per: 10,
      cache_hrs: 12
    }
  }, data => {
    Object.assign(config, data.options)
    // Reset Temporary Package List
    if (config.refreshInterval) clearInterval(config.refreshInterval)
    config.refreshInterval = setInterval(refreshPackageList, config.cache_hrs * 3600 * 1000)
  })

  api.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    switch (request.type) {
      case 'get-site-packages': {
        // Always received from popup -> will always query active tab
        sendResponse({ message: 'request received' })
        api.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
          const tab = tabs[0]
          function exit (url) {
            updateBadge(url ? URLUtil.toURL(url) : undefined, tab.id)
            const data = url ? brewPackages[URLUtil.toURL(url)] || brewPackages[URLUtil.getOrigin(url)] || {} : {}
            api.runtime.sendMessage({ type: 'send-site-packages', data })
          }
          if (!tab || !tab.url) return exit() // Will have zero matches -> disables icon
          const url = new URL(tab.url)
          if (!url.protocol.match(/^https?:$/)) return exit() // Will have zero matches -> disables icon
          exit(url)
        })
        break
      }
      case 'window-redirect': {
        api.tabs.update({ url: request.url })
        sendResponse({ message: 'success' })
        break
      }
      case 'update-settings': {
        Object.assign(config, request.data)
        if (config.refreshInterval) clearInterval(config.refreshInterval)
        config.refreshInterval = setInterval(refreshPackageList, config.cache_hrs * 3600 * 1000)
        refreshPackageList()
        sendResponse({ message: 'success' })
        break
      }
    }
  })

  api.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== 'loading') return
    if (!info.url) return findCurrentPagePackages()
    const urlNoWWW = URLUtil.toURL(new URL(info.url))
    const pageResults = brewPackages[urlNoWWW]
    if (!pageResults) return updateAvailablePackages(urlNoWWW, tabId)
    updateBadge(urlNoWWW, tabId)
  })
  api.tabs.onActivated.addListener(activeInfo => {
    findCurrentPagePackages()
  })

  api[browserAction].setPopup({ popup: 'popup/index.html' })

  // Keep Service Worker Active
  function ping () {}
  setInterval(() => { ping() }, 60000)

  findCurrentPagePackages(false)
}

if (typeof module !== 'undefined') module.exports = { URLUtil, updateAvailablePackages, getSearchRequests }
