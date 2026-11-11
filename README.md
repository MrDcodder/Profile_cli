# Profile Desktop

A Linux desktop-inspired portfolio for Diwyesh Nerkar. The page runs as a static site and is designed for GitHub Pages.

## Features

- Displays public profile and repository details from GitHub's unauthenticated REST API.
- Refreshes profile and repository data on page load and every five minutes.
- Keeps the last successful GitHub response in browser local storage for offline/API-error fallback.
- Opens projects in animated, keyboard-accessible desktop windows.
- Shows the visiting browser's public IP using ipify, with a privacy disclosure. The page does not store the IP.
- Uses no build step, framework, backend, or GitHub token.

## Run locally

Open `index.html` in a browser, or serve this directory with any static web server:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish with GitHub Pages

1. Push the contents of this folder to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.

GitHub Pages is static hosting; the browser calls GitHub's public API directly. Unauthenticated GitHub API requests are rate-limited per visitor IP. Refreshing every five minutes makes two API calls per interval.

The IP indicator calls `api.ipify.org` when the page loads and every 15 minutes. GitHub and ipify receive requests from the visitor's browser, including its IP address. The portfolio does not save the IP.
