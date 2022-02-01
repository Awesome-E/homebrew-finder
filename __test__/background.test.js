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
test('getSearchQuery returns the correct root URLs', () => {
  const result = URLUtil.getSearchQuery(new URL('https://formulae.brew.sh/'), ['www', 'currentOnly', 'currentAndSub'])
  expect(result).toBe('"https://www\\\\.formulae\\\\.brew\\\\.sh" "https://formulae\\\\.brew\\\\.sh" "formulae\\\\.brew\\\\.sh/"')
})
