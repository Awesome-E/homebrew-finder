const { URLUtil, updateAvailablePackages, getSearchRequests } = require('../extension/background')
global.fetch = jest.fn(() => {
  console.log('fetching')
  return Promise.resolve({
    json: () => Promise.resolve({
      results: []
    })
  })
})

describe('toURL behaves as expected', () => {
  beforeEach(() => {
    jest.resetModules()
  })
  test('returns undefined when not given URL constructor object', () => {
    const result = URLUtil.toURL('https://brew.sh/')
    expect(result).toBe(undefined)
  })
  test('strips query and hash', () => {
    const result = URLUtil.toURL(new URL('https://formulae.brew.sh/google-chrome?v=1#default'))
    expect(result).toBe('https://formulae.brew.sh/google-chrome')
  })
  test('strips www in hostname', () => {
    const result = URLUtil.toURL(new URL('https://www.google.com/'))
    expect(result).toBe('https://google.com')
  })
})

describe('getSearchQuery returns the correct values', () => {
  test('undefined when not given URL constructor object', () => {
    const result = URLUtil.getSearchQuery('https://brew.sh/')
    expect(result).toBe(undefined)
  })
  test('correct root URLs for GitHub repos', () => {
    const result = URLUtil.getSearchQuery(new URL('https://github.com/Awesome-E/homebrew-finder'), ['www', 'currentOnly', 'currentAndSub'])
    expect(result).toBe('"https://www\\\\.github\\\\.com/Awesome-E" "https://github\\\\.com/Awesome-E" "github\\\\.com/Awesome-E"')
  })
  test('correct root URLs for other URLs', () => {
    const result = URLUtil.getSearchQuery(new URL('https://formulae.brew.sh/'), ['www', 'currentOnly', 'currentAndSub'])
    expect(result).toBe('"https://www\\\\.formulae\\\\.brew\\\\.sh" "https://formulae\\\\.brew\\\\.sh" "formulae\\\\.brew\\\\.sh"')
  })
  test('correct pathed URLs for GitHub repos', () => {
    const result = URLUtil.getSearchQuery(new URL('https://github.com/Awesome-E/homebrew-finder'), ['www_pathed', 'currentOnly_pathed', 'currentAndSub_pathed'])
    expect(result).toBe('"https://www\\\\.github\\\\.com/Awesome-E/homebrew-finder" "https://github\\\\.com/Awesome-E/homebrew-finder" "github\\\\.com/Awesome-E/homebrew-finder"')
  })
  test('correct pathed URLs for other URLs', () => {
    const result = URLUtil.getSearchQuery(new URL('https://formulae.brew.sh/firefox'), ['www_pathed', 'currentOnly_pathed', 'currentAndSub_pathed'])
    expect(result).toBe('"https://www\\\\.formulae\\\\.brew\\\\.sh/firefox" "https://formulae\\\\.brew\\\\.sh/firefox" "formulae\\\\.brew\\\\.sh/firefox"')
  })
  test('same result for pathed and root when on homepage', () => {
    const result = URLUtil.getSearchQuery(new URL('https://github.com/Awesome-E'), ['www_pathed', 'currentOnly_pathed', 'currentAndSub_pathed'])
    expect(result).toBe('"https://www\\\\.github\\\\.com/Awesome-E" "https://github\\\\.com/Awesome-E" "github\\\\.com/Awesome-E"')
    const result2 = URLUtil.getSearchQuery(new URL('https://brew.sh'), ['www_pathed', 'currentOnly_pathed', 'currentAndSub_pathed'])
    expect(result2).toBe('"https://www\\\\.brew\\\\.sh" "https://brew\\\\.sh" "brew\\\\.sh"')
  })
  test('currentAndSub should strip www', () => {
    const result = URLUtil.getSearchQuery(new URL('https://www.google.com/chrome'), ['currentAndSub', 'currentAndSub_pathed'])
    expect(result).toBe('"google\\\\.com" "google\\\\.com/chrome"')
  })
})

describe('getOrigin returns the correct values', () => {
  test('undefined when not given URL constructor object', () => {
    const result = URLUtil.getOrigin('https://brew.sh/')
    expect(result).toBe(undefined)
  })
  test('correct origin for root URLs', () => {
    const result = URLUtil.getOrigin(new URL('https://brew.sh'))
    expect(result).toBe('https://brew.sh')
  })
  test('root domain for www URLs', () => {
    const result = URLUtil.getOrigin(new URL('https://www.google.com'))
    expect(result).toBe('https://google.com')
  })
  test('root domain for github URLs', () => {
    const result = URLUtil.getOrigin(new URL('https://www.github.com/Awesome-E/homebrew-finder'))
    expect(result).toBe('https://github.com/Awesome-E')
  })
})

describe('getSearchRequests returns the correct values', () => {
  beforeEach(() => {
    global.reqData = {
      base: {
        indexName: 'brew_all',
        hitsPerPage: 10,
        facetFilters: '["lang: en", "site: formulae"]',
        advancedSyntax: true
      },
      base2: {
        indexName: 'brew_all',
        hitsPerPage: 10,
        facetFilters: '["lang: en", "site: formulae"]',
        advancedSyntax: true
      }
    }
  })
  test('no URL constructor -> error object', () => {
    const result = getSearchRequests('https://www.github.com/')
    expect(result).toEqual({ error: 'url is not of constructor URL' })
  })
  test('no search pages -> array(1) that has 0 hits per page', () => {
    const result = getSearchRequests(new URL('https://www.github.com/'))
    expect(result).toEqual([Object.assign(global.reqData.base, { hitsPerPage: 0, query: '' })])
  })
  test('search current page only -> array(1) containing page query', () => {
    const result = getSearchRequests(new URL('https://www.github.com/'), { page_search: 'always', results_per: 10 })
    expect(result).toEqual([Object.assign(global.reqData.base, { hitsPerPage: 10, query: '"https://github\\\\.com" "https://www\\\\.github\\\\.com"' })])
  })
  test('search root only -> array(2) containing [empty query, root query]', () => {
    const result = getSearchRequests(new URL('https://www.github.com/'), { root_search: 'always', results_per: 10 })
    expect(result).toEqual([
      Object.assign(global.reqData.base, { hitsPerPage: 0, query: '' }),
      Object.assign(global.reqData.base2, { hitsPerPage: 10, query: '"https://github\\\\.com/" "https://www\\\\.github\\\\.com/"' })
    ])
  })
  test('search page and root -> array(2) containing [page query, root query]', () => {
    const result = getSearchRequests(new URL('https://www.github.com/'), { page_search: 'always', root_search: 'always', results_per: 10 })
    expect(result).toEqual([
      Object.assign(global.reqData.base, { hitsPerPage: 10, query: '"https://github\\\\.com" "https://www\\\\.github\\\\.com" "https://github\\\\.com/" "https://www\\\\.github\\\\.com/"' }),
      Object.assign(global.reqData.base2, { hitsPerPage: 10, query: '"https://github\\\\.com/" "https://www\\\\.github\\\\.com/"' })
    ])
  })
  test('search current and subdomain -> array(2) containing [page query, subdomain query]', () => {
    const result = getSearchRequests(new URL('https://www.github.com/Awesome-E/homebrew-finder'), { page_search: 'always', subdomain_search: 'always', results_per: 10 })
    expect(result).toEqual([
      Object.assign(global.reqData.base, { hitsPerPage: 10, query: '"https://github\\\\.com/Awesome-E/homebrew-finder" "https://www\\\\.github\\\\.com/Awesome-E/homebrew-finder" "github\\\\.com/Awesome-E/homebrew-finder" "github\\\\.com/Awesome-E"' }),
      Object.assign(global.reqData.base2, { hitsPerPage: 10, query: '"github\\\\.com/Awesome-E"' })
    ])
  })
  afterAll(() => {
    delete global.reqData
  })
})

describe('updateAvailablePackages returns the correct values', () => {
  beforeEach(() => {
    jest.resetModules()
  })
  test('error when no tab is given', () => {
    const result = updateAvailablePackages(new URL('https://brew.sh/'))
    expect(result).toEqual({ error: 'No tab ID provided' })
  })
  test('error when the URL is not http or https', () => {
    const result = updateAvailablePackages(new URL('chrome-extension://extension-id/'), -1)
    expect(result).toEqual({ error: 'URL is not http or https' })
  })
  test('nothing to search when page has not yet been searched but no queries', async () => {
    const result = updateAvailablePackages(new URL('https://www.google.com/'), -1)
    expect(result).toEqual({ message: 'Nothing to search' })
  })
})
