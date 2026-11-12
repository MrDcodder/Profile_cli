# Profile Desktop

A Linux desktop-inspired portfolio for Diwyesh Nerkar, built with React, TypeScript, and Vite. The production build is a static site suitable for GitHub Pages.

## Features

- Displays public profile and repository details from GitHub's unauthenticated REST API.
- Refreshes profile and repository data on page load and every five minutes.
- Keeps the last successful GitHub response in browser local storage for offline/API-error fallback.
- Shows the desktop inside a retro CRT monitor frame with scanline effects and a custom pointer.
- Opens multiple project windows, a searchable-style repository drawer, and an interactive profile terminal.
- Lists terminal commands with `/help`; supports profile, skills, repository, navigation, and window-opening commands.
- Shows the visiting browser's public IP using ipify, with a privacy disclosure. The page does not store the IP.
- Uses typed React components and client-side state without a backend or GitHub token.

## Run locally

Install dependencies and start the Vite development server:

```powershell
npm install
npm run dev
```

To create and preview the static production build:

```powershell
npm run build
npm run preview
```

## Publish with GitHub Pages

The live profile is available at **[mrdcodder.github.io/Profile_cli](https://mrdcodder.github.io/Profile_cli/)**.

Pushes to `main` automatically build the Vite site and deploy the `dist` output using the workflow in `.github/workflows/deploy.yml`. The workflow configures GitHub Pages for Actions-based deployments if needed.

GitHub Pages is static hosting; the browser calls GitHub's public API directly. Unauthenticated GitHub API requests are rate-limited per visitor IP. Refreshing every five minutes makes two API calls per interval.

The IP indicator calls `api.ipify.org` when the page loads and every 15 minutes. GitHub and ipify receive requests from the visitor's browser, including its IP address. The portfolio does not save the IP.
