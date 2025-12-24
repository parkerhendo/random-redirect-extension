# Random Redirect

A Chrome extension that redirects specified websites to random destinations from your curated list. Useful for breaking browsing habits by redirecting distracting sites to more productive alternatives.

## Features

- **Trigger Sites**: Define which sites should trigger a redirect (supports paths like `substack.com/inbox`)
- **Random Destinations**: Add multiple destination sites - one will be randomly chosen for each redirect
- **Snooze**: Temporarily disable redirects for 5 minutes to 1 hour
- **Subdomain Matching**: Triggers match subdomains automatically (e.g., `youtube.com` matches `www.youtube.com` and `music.youtube.com`)

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension icon will appear in your toolbar

## Usage

1. Click the extension icon to open the popup
2. Add **Trigger Sites** - websites you want to redirect away from
   - Example: `youtube.com`, `twitter.com`, `reddit.com/r/all`
3. Add **Destinations** - websites to redirect to
   - Example: `mathacademy.com`, `wikipedia.org`, `exercism.org`
4. When you navigate to a trigger site, you'll be redirected to a random destination

### Snooze

Need temporary access to a trigger site? Use the snooze feature:
- Select a duration (5, 15, 30, or 60 minutes)
- Click "Snooze" to pause all redirects
- Click "Cancel" to resume redirects early

## How It Works

The extension uses the Chrome `webNavigation` API to intercept navigation to trigger sites before the page loads. When a match is found:

1. Checks if snooze is active
2. Matches the URL against your trigger sites (including path matching)
3. Randomly selects a destination from your list
4. Redirects the tab to the chosen destination

Settings are synced across your Chrome browsers using `chrome.storage.sync`.

## Permissions

- `storage`: Save your trigger sites, destinations, and snooze settings
- `webNavigation`: Detect when you navigate to trigger sites
- `tabs`: Redirect the current tab to a destination
- `<all_urls>`: Required to intercept navigation to any trigger site you configure

## License

MIT
