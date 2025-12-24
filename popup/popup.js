// DOM Elements
const statusEl = document.getElementById('status');
const snoozeControls = document.getElementById('snooze-controls');
const snoozeActive = document.getElementById('snooze-active');
const snoozeDuration = document.getElementById('snooze-duration');
const snoozeBtn = document.getElementById('snooze-btn');
const cancelSnoozeBtn = document.getElementById('cancel-snooze-btn');
const snoozeRemaining = document.getElementById('snooze-remaining');
const triggerInput = document.getElementById('trigger-input');
const addTriggerBtn = document.getElementById('add-trigger-btn');
const triggerList = document.getElementById('trigger-list');
const destinationInput = document.getElementById('destination-input');
const addDestinationBtn = document.getElementById('add-destination-btn');
const destinationList = document.getElementById('destination-list');

// State
let settings = {
  triggerSites: [],
  destinations: [],
  snoozeUntil: null
};

let snoozeInterval = null;

// Load settings from storage
async function loadSettings() {
  const stored = await chrome.storage.sync.get({
    triggerSites: [],
    destinations: [],
    snoozeUntil: null
  });
  settings = stored;
  render();
}

// Save settings to storage
async function saveSettings() {
  await chrome.storage.sync.set(settings);
}

// Format remaining time
function formatRemainingTime(ms) {
  const minutes = Math.ceil(ms / 60000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

// Update snooze display
function updateSnoozeDisplay() {
  if (settings.snoozeUntil && Date.now() < settings.snoozeUntil) {
    const remaining = settings.snoozeUntil - Date.now();
    snoozeRemaining.textContent = formatRemainingTime(remaining);
    snoozeControls.classList.add('hidden');
    snoozeActive.classList.remove('hidden');
    statusEl.textContent = 'Snoozed';
    statusEl.className = 'status status-snoozed';

    // Set up interval to update countdown
    if (!snoozeInterval) {
      snoozeInterval = setInterval(() => {
        if (settings.snoozeUntil && Date.now() < settings.snoozeUntil) {
          snoozeRemaining.textContent = formatRemainingTime(settings.snoozeUntil - Date.now());
        } else {
          clearSnooze();
        }
      }, 1000);
    }
  } else {
    snoozeControls.classList.remove('hidden');
    snoozeActive.classList.add('hidden');
    statusEl.textContent = 'Active';
    statusEl.className = 'status status-active';

    if (snoozeInterval) {
      clearInterval(snoozeInterval);
      snoozeInterval = null;
    }
  }
}

// Render list items
function renderList(listEl, items, onRemove) {
  listEl.innerHTML = '';

  if (items.length === 0) {
    const emptyEl = document.createElement('li');
    emptyEl.className = 'empty-message';
    emptyEl.textContent = 'No items added yet';
    listEl.appendChild(emptyEl);
    return;
  }

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item}</span>
      <button class="remove-btn" data-index="${index}">&times;</button>
    `;
    li.querySelector('.remove-btn').addEventListener('click', () => onRemove(index));
    listEl.appendChild(li);
  });
}

// Main render function
function render() {
  updateSnoozeDisplay();
  renderList(triggerList, settings.triggerSites, removeTrigger);
  renderList(destinationList, settings.destinations, removeDestination);
}

// Normalize site input (remove protocol, www prefix, trailing slashes)
// preservePath: if true, keep the path (for triggers like substack.com/inbox)
function normalizeSite(input, preservePath = false) {
  let site = input.trim().toLowerCase();
  site = site.replace(/^https?:\/\//, '');
  site = site.replace(/^www\./, '');
  if (preservePath) {
    // Remove trailing slash but keep path
    site = site.replace(/\/$/, '');
  } else {
    // Remove everything after hostname
    site = site.replace(/\/.*$/, '');
  }
  return site;
}

// Add trigger site
async function addTrigger() {
  const site = normalizeSite(triggerInput.value, true);  // preserve path
  if (!site) return;

  if (!settings.triggerSites.includes(site)) {
    settings.triggerSites.push(site);
    await saveSettings();
    render();
  }
  triggerInput.value = '';
}

// Remove trigger site
async function removeTrigger(index) {
  settings.triggerSites.splice(index, 1);
  await saveSettings();
  render();
}

// Add destination
async function addDestination() {
  const site = normalizeSite(destinationInput.value);
  if (!site) return;

  if (!settings.destinations.includes(site)) {
    settings.destinations.push(site);
    await saveSettings();
    render();
  }
  destinationInput.value = '';
}

// Remove destination
async function removeDestination(index) {
  settings.destinations.splice(index, 1);
  await saveSettings();
  render();
}

// Start snooze
async function startSnooze() {
  const minutes = parseInt(snoozeDuration.value, 10);
  settings.snoozeUntil = Date.now() + (minutes * 60 * 1000);
  await saveSettings();
  render();
}

// Clear snooze
async function clearSnooze() {
  settings.snoozeUntil = null;
  await saveSettings();
  render();
}

// Event listeners
snoozeBtn.addEventListener('click', startSnooze);
cancelSnoozeBtn.addEventListener('click', clearSnooze);

addTriggerBtn.addEventListener('click', addTrigger);
triggerInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTrigger();
});

addDestinationBtn.addEventListener('click', addDestination);
destinationInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addDestination();
});

// Initialize
loadSettings();
