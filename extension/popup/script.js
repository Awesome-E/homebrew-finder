let api = null
if (typeof chrome !== 'undefined') api = chrome
if (typeof browser !== 'undefined') api = browser

document.querySelectorAll('.content, .nocontent').forEach(elm => elm.classList.add('hidden'))

function copyText (txt) {
  // Create a textbox field where we can insert text to.
  const copyTextArea = document.createElement('textarea')
  copyTextArea.value = txt
  document.body.appendChild(copyTextArea)
  copyTextArea.select()
  copyTextArea.setSelectionRange(0, copyTextArea.value.length)
  document.execCommand('copy')
  document.body.removeChild(copyTextArea)
}

function addRows (data = {}, config = {}) {
  config.formula_click_action = 'current'
  document.querySelectorAll(data.total_hits ? '.content' : '.nocontent').forEach(elm => elm.classList.remove('hidden'))
  if (!data.results) return
  console.log(data)
  data.results.forEach(result => {
    const clone = document.getElementById('result-template').content.cloneNode(true).firstElementChild
    if (result.primary) clone.classList.add('primary-result')
    const cols = [...clone.querySelectorAll('td')]
    // Link to Formula on Homebrew
    const formulaLink = cols[0].querySelector('a')
    formulaLink.href = result.brew_url
    formulaLink.innerText = result.formula
    formulaLink.title = result.brew_url.replace(/#\w+$/, '')
    formulaLink.addEventListener('click', e => {
      e.preventDefault()
      if (config.formula_click_action === 'nothing') return
      api.runtime.sendMessage({ type: 'window-create', url: formulaLink.href })
    })
    // Link to Software Vendor Page
    const nameLink = cols[1].querySelector('a')
    nameLink.href = result.content_url
    nameLink.innerText = result.name || result.formula
    nameLink.title = result.content_url.replace(/#\w+$/, '')
    nameLink.addEventListener('click', e => {
      e.preventDefault()
      if (config.name_click_action === 'nothing') return
      api.runtime.sendMessage({ type: 'window-create', url: nameLink.href })
    })
    // Download Button
    const dlBtn = cols[2].querySelector('a.download')
    dlBtn.href = '#'
    dlBtn.title = 'Download ' + (result.name || result.formula)
    dlBtn.addEventListener('click', e => {
      e.preventDefault()
      const xhr = new XMLHttpRequest()
      if (result.type === 'Casks') {
        xhr.open('GET', `https://formulae.brew.sh/api/cask/${result.formula}.json`)
        xhr.addEventListener('load', () => {
          const res = xhr.responseText
          let response = {}
          try { response = JSON.parse(res) } catch (e) {}
          if (!confirm(`Are you sure you want to download ${result.name} v${response.version}?`)) return;
          (chrome || browser).runtime.sendMessage({
            type: 'window-redirect',
            url: response.url
          }, data => {})
        })
        xhr.send()
      } else {
        xhr.open('GET', `https://formulae.brew.sh/api/formula/${result.formula}.json`)
        xhr.addEventListener('load', () => {
          const res = xhr.responseText
          let response = {}
          try { response = JSON.parse(res) } catch (e) {}
          if (!response.urls || !response.urls.stable) return alert('Error fetching latest download URL')
          if (!confirm(`Are you sure you want to download ${result.formula} v${response.versions ? response.versions.stable : 'LATEST'}?`)) return;
          (chrome || browser).runtime.sendMessage({
            type: 'window-redirect',
            url: response.urls.stable.url
          }, data => {})
        })
        xhr.send()
      }
    })
    // Copy Homebrew Install Command Button
    const hbBtn = cols[2].querySelector('a.copy.hbcopy')
    hbBtn.href = '#'
    hbBtn.addEventListener('click', e => {
      e.preventDefault()
      copyText(`brew install ${result.formula}`)
      hbBtn.classList.remove('fa-terminal')
      hbBtn.classList.add('fa-check')
      setTimeout(() => {
        hbBtn.classList.remove('fa-check')
        hbBtn.classList.add('fa-terminal')
      }, 800)
    })
    document.querySelector(`.results-table[data-type="${result.type}"] tbody`).appendChild(clone)
    document.querySelectorAll('table tbody').forEach(t => {
      if (t.childElementCount < 2) t.parentNode.classList.add('hidden')
    })
  })
}

api.runtime.sendMessage({ type: 'get-site-packages' }, data => console.log(data))
api.runtime.onMessage.addListener(message => {
  if (message.type !== 'send-site-packages') return
  addRows(message.data)
})
