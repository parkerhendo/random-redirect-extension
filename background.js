// Default settings
const DEFAULT_SETTINGS = {
  triggerSites: [],
  destinations: [],
  whitelist: [],
  snoozeUntil: null,
  snoozeBlockSchedules: [],
  redirectStats: {},  // { "site.com": count }
  triggerCategories: {},  // { "site.com": "social" }
  destinationCategories: {},  // { "site.com": "learning" }
  snoozedSites: {},  // { "site.com": timestamp }
  focusMode: false  // when true, ignores all snoozes
};

// Parse a URL into hostname and path
function parseUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname;
    return { hostname, path };
  } catch {
    return null;
  }
}

// Parse a trigger string into hostname and optional path
function parseTrigger(trigger) {
  const normalized = trigger.replace(/^www\./, '');
  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) {
    return { hostname: normalized, path: null };
  }
  return {
    hostname: normalized.substring(0, slashIndex),
    path: normalized.substring(slashIndex)
  };
}

// Check if a URL matches any trigger site, returns matching trigger or null
function getMatchingTrigger(url, triggerSites) {
  const parsed = parseUrl(url);
  if (!parsed) return null;

  return triggerSites.find(trigger => {
    const triggerParsed = parseTrigger(trigger);

    // Check hostname match (exact or subdomain)
    const hostnameMatches =
      parsed.hostname === triggerParsed.hostname ||
      parsed.hostname.endsWith('.' + triggerParsed.hostname);

    if (!hostnameMatches) return false;

    // If trigger has no path, match any path on this domain
    if (!triggerParsed.path) return true;

    // If trigger has a path, URL must start with that path
    return parsed.path.startsWith(triggerParsed.path);
  }) || null;
}

// Check if a URL matches any trigger site
function isTriggerSite(url, triggerSites) {
  return getMatchingTrigger(url, triggerSites) !== null;
}

// Check if URL is whitelisted
function isWhitelisted(url, whitelist) {
  if (!whitelist?.length) return false;
  const parsed = parseUrl(url);
  if (!parsed) return false;

  return whitelist.some(entry => {
    const entryParsed = parseTrigger(entry);
    const hostnameMatches =
      parsed.hostname === entryParsed.hostname ||
      parsed.hostname.endsWith('.' + entryParsed.hostname);

    if (!hostnameMatches) return false;
    if (!entryParsed.path) return true;
    return parsed.path.startsWith(entryParsed.path);
  });
}

// Check if snooze is active
function isSnoozed(snoozeUntil) {
  if (!snoozeUntil) return false;
  return Date.now() < snoozeUntil;
}

// Check if snooze is blocked by schedule
function isSnoozeBlocked(schedules) {
  if (!schedules?.length) return false;
  const now = new Date();
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();

  return schedules.some(s => {
    if (!s.days.includes(day)) return false;
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    const start = sh * 60 + sm, end = eh * 60 + em;

    if (end <= start) return mins >= start || mins < end;
    return mins >= start && mins < end;
  });
}

// Get random destination from list, optionally filtered by category
function getRandomDestination(destinations, category = null, destinationCategories = {}) {
  if (!destinations || destinations.length === 0) return null;

  let filtered = destinations;
  if (category) {
    filtered = destinations.filter(d => destinationCategories[d] === category);
    // Fallback to all destinations if no matches
    if (filtered.length === 0) filtered = destinations;
  }

  const index = Math.floor(Math.random() * filtered.length);
  return filtered[index];
}

// Format destination as full URL
function formatDestinationUrl(destination) {
  if (!destination.startsWith('http://') && !destination.startsWith('https://')) {
    return 'https://' + destination;
  }
  return destination;
}

// Track tabs we've already redirected to prevent loops
const redirectedTabs = new Set();

// Listen for navigation events
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only handle main frame navigation
  if (details.frameId !== 0) return;

  // Skip if we just redirected this tab
  if (redirectedTabs.has(details.tabId)) {
    redirectedTabs.delete(details.tabId);
    return;
  }

  // Get settings
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  // Focus mode ignores all snoozes
  const focusActive = settings.focusMode;

  // Check if snoozed (ignore snooze if blocked by schedule or focus mode)
  if (!focusActive && !isSnoozeBlocked(settings.snoozeBlockSchedules) && isSnoozed(settings.snoozeUntil)) return;

  // Check if this is a trigger site
  const matchedTrigger = getMatchingTrigger(details.url, settings.triggerSites);
  if (!matchedTrigger) return;

  // Check if whitelisted
  if (isWhitelisted(details.url, settings.whitelist)) return;

  // Check if this specific site is snoozed (ignored in focus mode)
  if (!focusActive) {
    const siteSnoozedUntil = settings.snoozedSites?.[matchedTrigger];
    if (siteSnoozedUntil && Date.now() < siteSnoozedUntil) return;
  }

  // Get category of trigger site
  const triggerCategory = settings.triggerCategories?.[matchedTrigger] || null;

  // Get random destination (filtered by category if set)
  const destination = getRandomDestination(
    settings.destinations,
    triggerCategory,
    settings.destinationCategories || {}
  );
  if (!destination) return;

  // Mark tab as redirected
  redirectedTabs.add(details.tabId);

  // Update redirect stats
  const stats = settings.redirectStats || {};
  stats[matchedTrigger] = (stats[matchedTrigger] || 0) + 1;
  chrome.storage.sync.set({ redirectStats: stats });

  // Redirect
  const destinationUrl = formatDestinationUrl(destination);
  chrome.tabs.update(details.tabId, { url: destinationUrl });
});

// Clean up snooze if expired (on extension wake)
chrome.runtime.onStartup.addListener(async () => {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  if (settings.snoozeUntil && Date.now() >= settings.snoozeUntil) {
    await chrome.storage.sync.set({ snoozeUntil: null });
  }
});
