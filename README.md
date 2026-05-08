# GitHub HTML Preview Local

Preview HTML files directly inside GitHub's file view, without entering a GitHub access token.

This extension adds a Preview button to GitHub HTML file pages. It reads the HTML source that is already displayed on the current GitHub file page and renders it in the same file panel. It is designed for quick checks of HTML files in both public repositories and repositories you can already access in your browser.

## Features

- Adds a Preview button to GitHub `.html` file pages
- Switches the GitHub file panel between source code and rendered preview
- No GitHub access token required
- Works from the HTML source already visible in the GitHub page
- Resolves relative CSS and image paths through GitHub raw file URLs
- Renders the preview in an extension sandbox frame to avoid GitHub page CSP restrictions
- Useful for private repositories when the file is already visible to you on GitHub

## How It Works

1. Open an HTML file on GitHub.
2. Click the Preview button added beside GitHub's Raw file controls.
3. The extension reads the displayed source code from the page.
4. The HTML is rendered inside the current GitHub file panel.

The extension does not need to call the GitHub API to read the current file, because it uses the content already shown in the browser. Relative assets are resolved from GitHub raw URLs and rendered inside an extension-owned sandbox frame.

## Privacy

This extension is intended to preview the current GitHub HTML file locally.

- It does not require a GitHub access token.
- It does not upload your repository content to an external server.
- It only targets GitHub pages needed for previewing displayed HTML files.

## Limitations

Because the extension previews the displayed source instead of fetching repository files through the GitHub API, some behavior may differ from a deployed website.

- Relative paths are resolved against GitHub raw URLs, so assets must be accessible from the current browser session.
- Files that are not displayed on the current GitHub page may not be available to the preview.
- GitHub UI changes may require updates to the extension.
- JavaScript execution is disabled in the rendered preview sandbox.

## Intended Use

This extension is best for quickly checking simple HTML files, prototypes, documentation pages, and small static examples directly from GitHub.

It is not intended to replace a full local development server or GitHub Pages deployment for complex websites.

## Development

The extension source is organized so `src/` contains the editable source and `dist/` contains the unpacked Chrome extension output.

```sh
npm install
npm run check
npm run build
```

To try the extension locally:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select the `dist` directory.

After making source changes, run `npm run build` and reload the extension from `chrome://extensions`.

## Repository

This project is under development.
