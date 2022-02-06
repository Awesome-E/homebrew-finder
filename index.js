const fs = require('fs')
const fse = require('fs-extra')
const watch = require('node-watch')
const chromeManifest = require('./manifest')(false)
const ffManifest = require('./manifest')(true)

function build () {
  fse.copySync('./extension', './build/chrome', { overwrite: true })
  fse.copySync('./extension', './build/firefox', { overwrite: true })

  fs.writeFileSync('./build/chrome/manifest.json', JSON.stringify(chromeManifest))
  fs.writeFileSync('./build/firefox/manifest.json', JSON.stringify(ffManifest))
}
build()

console.log('\x1b[32mBuild successful\x1b[0m')

if (process.argv.indexOf('--watch') > -1) {
  watch('extension', { recursive: true }, function (evt, name) {
    console.log('\x1b[36mRebuilding due to changes\x1b[0m')
    build()
  })
  watch('manifest.js', { recursive: true }, function (evt, name) {
    console.log('\x1b[36mRebuilding due to changes\x1b[0m')
    build()
  })
}
