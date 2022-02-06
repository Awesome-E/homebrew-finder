module.exports = function (isFF) {
  const manifest = {
    name: 'Homebrew Finder',
    description: "A Browser Extension that finds Homebrew Packages for the current website you're on",
    version: '0.1',
    // All host permissions so that we automatically have access to pages
    // Also removes the annoying/confusing "Access Requested" message
    host_permissions: ['*'],
    permissions: [
      'activeTab',
      'tabs',
      'storage'
    ],
    web_accessible_resources: [],
    background: isFF ? { scripts: ['background.js'] } : { service_worker: 'background.js' },
    content_scripts: [],
    icons: {
      16: 'icons/pack-icon-16.png',
      32: 'icons/pack-icon-32.png',
      48: 'icons/pack-icon-48.png'
    },
    minimum_chrome_version: '80.0.3987',
    manifest_version: isFF ? 2 : 3,
    options_page: './options/index.html'
  }
  if (isFF) manifest.browser_specific_settings = { gecko: { id: '{b8f1f5ea-0b21-47d1-bb89-d2e41507819a}' } }
  manifest[isFF ? 'browser_action' : 'action'] = {
    default_title: 'Homebrew Finder',
    default_icon: 'icons/pack-icon-inactive-64.png',
    default_popup: ''
  }
  return manifest
}
