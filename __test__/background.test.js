const { URLUtil, updateAvailablePackages } = require('../extension/background')
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
    expect(result).toBe('https://google.com/')
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
    expect(result).toBe('"https://www\\\\.formulae\\\\.brew\\\\.sh" "https://formulae\\\\.brew\\\\.sh" "formulae\\\\.brew\\\\.sh/"')
  })
  test('correct root URLs for GitHub repos', () => {
    const result = URLUtil.getSearchQuery(new URL('https://github.com/Awesome-E/homebrew-finder'), ['www_pathed', 'currentOnly_pathed', 'currentAndSub_pathed'])
    expect(result).toBe('"https://www\\\\.github\\\\.com/Awesome-E/homebrew-finder" "https://github\\\\.com/Awesome-E/homebrew-finder" "github\\\\.com/Awesome-E/homebrew-finder"')
  })
  test('correct pathed URLs for other URLs', () => {
    const result = URLUtil.getSearchQuery(new URL('https://formulae.brew.sh/firefox'), ['www_pathed', 'currentOnly_pathed', 'currentAndSub_pathed'])
    expect(result).toBe('"https://www\\\\.formulae\\\\.brew\\\\.sh/firefox" "https://formulae\\\\.brew\\\\.sh/firefox" "formulae\\\\.brew\\\\.sh/firefox"')
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
  test('undefined when page has not yet been searched', async () => {
    const result = updateAvailablePackages(new URL('https://www.google.com/'), -1)
    expect(result).toEqual(undefined)
  })
})
