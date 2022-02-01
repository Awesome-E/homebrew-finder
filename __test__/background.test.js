const { URLUtil, updateAvailablePackages } = require('../extension/background')

test('toURL returns undefined when not given URL constructor object', () => {
  const result = URLUtil.toURL('https://brew.sh/')
  expect(result).toBe(undefined)
})
test('toURL strips query and hash', () => {
  const result = URLUtil.toURL(new URL('https://formulae.brew.sh/google-chrome?v=1#default'))
  expect(result).toBe('https://formulae.brew.sh/google-chrome')
})
test('toURL strips www in hostname', () => {
  const result = URLUtil.toURL(new URL('https://www.google.com/'))
  expect(result).toBe('https://google.com/')
})

test('getSearchQuery returns undefined when not given URL constructor object', () => {
  const result = URLUtil.getSearchQuery('https://brew.sh/')
  expect(result).toBe(undefined)
})
test('getSearchQuery returns the correct root URLs for GitHub repos', () => {
  const result = URLUtil.getSearchQuery(new URL('https://github.com/Awesome-E/homebrew-finder'), ['www', 'currentOnly', 'currentAndSub'])
  expect(result).toBe('"https://www\\\\.github\\\\.com/Awesome-E" "https://github\\\\.com/Awesome-E" "github\\\\.com/Awesome-E"')
})
test('getSearchQuery returns the correct root URLs for other URLs', () => {
  const result = URLUtil.getSearchQuery(new URL('https://formulae.brew.sh/'), ['www', 'currentOnly', 'currentAndSub'])
  expect(result).toBe('"https://www\\\\.formulae\\\\.brew\\\\.sh" "https://formulae\\\\.brew\\\\.sh" "formulae\\\\.brew\\\\.sh/"')
})
test('getSearchQuery returns the correct root URLs for GitHub repos', () => {
  const result = URLUtil.getSearchQuery(new URL('https://github.com/Awesome-E/homebrew-finder'), ['www_pathed', 'currentOnly_pathed', 'currentAndSub_pathed'])
  expect(result).toBe('"https://www\\\\.github\\\\.com/Awesome-E/homebrew-finder" "https://github\\\\.com/Awesome-E/homebrew-finder" "github\\\\.com/Awesome-E/homebrew-finder"')
})
test('getSearchQuery returns the correct pathed URLs for other URLs', () => {
  const result = URLUtil.getSearchQuery(new URL('https://formulae.brew.sh/firefox'), ['www_pathed', 'currentOnly_pathed', 'currentAndSub_pathed'])
  expect(result).toBe('"https://www\\\\.formulae\\\\.brew\\\\.sh/firefox" "https://formulae\\\\.brew\\\\.sh/firefox" "formulae\\\\.brew\\\\.sh/firefox"')
})

test('getOrigin returns undefined when not given URL constructor object', () => {
  const result = URLUtil.getOrigin('https://brew.sh/')
  expect(result).toBe(undefined)
})
test('getOrigin returns correct origin for root URLs', () => {
  const result = URLUtil.getOrigin(new URL('https://brew.sh'))
  expect(result).toBe('https://brew.sh')
})
test('getOrigin returns root domain for www URLs', () => {
  const result = URLUtil.getOrigin(new URL('https://www.google.com'))
  expect(result).toBe('https://google.com')
})
test('getOrigin returns root domain for github URLs', () => {
  const result = URLUtil.getOrigin(new URL('https://www.github.com/Awesome-E/homebrew-finder'))
  expect(result).toBe('https://github.com/Awesome-E')
})
