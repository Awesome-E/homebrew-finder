# <img src="extension/icons/pack-icon-32.png" width="32"> Homebrew Finder

A browser extension compatible with Chrome and Firefox that allows you to find Homebrew Packages for the current website you are visiting.

- Compatible: Works with Manifest V2 and V3
- Convenient: Find install links and binary downloads for applications as you browse their site!
- Customizable: Change search settings and popup actions (in progress)

Search API from [formulae.brew.sh](https://github.com/Homebrew/formulae.brew.sh)

## Develop in Local Environment

1. Clone the Repo
2. `npm install`
3. `npm run dev` to watch changes
4. Go to your browser and load the unpackaged add-on from the `build/chrome` or `build/firefox` directory, depending on your browser.

## Running Tests

1. `npm test` in the working directory. All tests are run with Jest.

Tests are run automatically with Jest using GitHub Actions for every push.
