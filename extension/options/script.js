let api = null
if (typeof chrome !== 'undefined') api = chrome
if (typeof browser !== 'undefined') api = browser

api.storage.sync.get({
  options: {
    root_search: 'always',
    subdomain_search: 'never',
    page_search: 'always',
    results_per: 10,
    cache_hrs: 12,
    formula_click_action: 'newtab',
    name_click_action: 'newtab'
  }
}, function (items) {
  const data = items.options
  Object.keys(data).forEach(option => {
    const value = data[option]
    switch (typeof value) {
      case 'boolean':
        document.getElementById(option).checked = value
        break
      case 'string':
        if (value.match(/^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i)) {
          const input = document.getElementById(option)
          // new jscolor(input, { backgroundColor: 'rgba(32, 90, 82, 0.9)', borderColor: 'rgba(46, 132, 121, 0.9)', hash: true, closable: true, inI: true, closeText: 'Close Color Picker', value: value })
          input.classList.add('jscolor')
          input.addEventListener('change', function () {
            if (input.checkValidity()) document.documentElement.style.setProperty('--' + input.id.replace(/\$/, '-'), input.value)
          })
          document.documentElement.style.setProperty('--' + input.id.replace(/\$/, '-'), input.value)
          break
        }
      // eslint-disable-next-line no-fallthrough
      case 'number':
        if (document.getElementById(option)) {
          document.getElementById(option).value = value
        } else {
          document.querySelector(`input[name="${option}"][value="${value}"]`).checked = true
        }
        break
    }
  })
})

document.addEventListener('input', () => {
  const data = {}
  document.querySelectorAll('input').forEach(input => {
    switch (input.type) {
      case 'checkbox':
        data[input.name] = input.checked
        break
      case 'radio':
        if (input.checked) data[input.name] = input.value
        break
      case 'number':
        data[input.name] = parseFloat(input.value)
        break
      case 'string':
        data[input.name] = input.value
        break
    }
  })
  api.storage.sync.set({ options: data }, () => {
    api.runtime.sendMessage({ type: 'update-settings', data }, () => {})
  })
})

function resetPrefs () {
  if (!confirm('Are you sure you want to restore defaults? This action cannot be undone!')) return
  api.storage.sync.set({ options: {} }, () => {
    api.runtime.sendMessage({ type: 'update-settings', data: {} }, () => location.reload())
  })
}
document.getElementById('reset').addEventListener('click', resetPrefs)
