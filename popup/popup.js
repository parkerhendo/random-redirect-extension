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
const snoozeBlocked = document.getElementById('snooze-blocked');
const scheduleDayBtns = document.querySelectorAll('.schedule-day-btn');
const scheduleStart = document.getElementById('schedule-start');
const scheduleEnd = document.getElementById('schedule-end');
const addScheduleBtn = document.getElementById('add-schedule-btn');
const scheduleList = document.getElementById('schedule-list');
const toggleScheduleForm = document.getElementById('toggle-schedule-form');
const scheduleForm = document.getElementById('schedule-form');
const menuBtn = document.getElementById('menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');
const menuSchedules = document.getElementById('menu-schedules');
const schedulesModal = document.getElementById('schedules-modal');
const closeModal = document.getElementById('close-modal');
const whitelistInput = document.getElementById('whitelist-input');
const addWhitelistBtn = document.getElementById('add-whitelist-btn');
const whitelistList = document.getElementById('whitelist-list');
const menuStats = document.getElementById('menu-stats');
const statsModal = document.getElementById('stats-modal');
const closeStatsModal = document.getElementById('close-stats-modal');
const statsList = document.getElementById('stats-list');
const clearStatsBtn = document.getElementById('clear-stats-btn');
const focusModeToggle = document.getElementById('focus-mode-toggle');
const delaySelect = document.getElementById('delay-select');

// State
let settings = {
  triggerSites: [],
  destinations: [],
  whitelist: [],
  snoozeUntil: null,
  snoozeBlockSchedules: [],
  redirectStats: {},
  triggerCategories: {},
  destinationCategories: {},
  snoozedSites: {},
  focusMode: false,
  redirectDelay: 0
};

// Predefined categories
const CATEGORIES = ['social', 'news', 'video', 'shopping', 'work', 'learning'];

let snoozeInterval = null;

// Load settings from storage
async function loadSettings() {
  const stored = await chrome.storage.sync.get({
    triggerSites: [],
    destinations: [],
    whitelist: [],
    snoozeUntil: null,
    snoozeBlockSchedules: [],
    redirectStats: {},
    triggerCategories: {},
    destinationCategories: {},
    snoozedSites: {},
    focusMode: false,
    redirectDelay: 0
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

    // overnight: e.g. 22:00-06:00 on same calendar day
    if (end <= start) return mins >= start || mins < end;
    return mins >= start && mins < end;
  });
}

// Update snooze display
function updateSnoozeDisplay() {
  const blocked = isSnoozeBlocked(settings.snoozeBlockSchedules);

  // Update focus mode toggle
  focusModeToggle.checked = settings.focusMode;

  // Update delay select
  delaySelect.value = settings.redirectDelay.toString();

  // Focus mode status takes precedence
  if (settings.focusMode) {
    snoozeControls.classList.add('hidden');
    snoozeActive.classList.add('hidden');
    snoozeBlocked.classList.add('hidden');
    statusEl.textContent = 'Focus';
    statusEl.className = 'status status-focus';
    return;
  }

  if (blocked) {
    snoozeControls.classList.add('hidden');
    snoozeActive.classList.add('hidden');
    snoozeBlocked.classList.remove('hidden');
    statusEl.textContent = 'Blocked';
    statusEl.className = 'status status-blocked';
    return;
  }

  snoozeBlocked.classList.add('hidden');

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
        if (isSnoozeBlocked(settings.snoozeBlockSchedules)) {
          render();
        } else if (settings.snoozeUntil && Date.now() < settings.snoozeUntil) {
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

// Toggle focus mode
async function toggleFocusMode() {
  settings.focusMode = focusModeToggle.checked;
  await saveSettings();
  render();
}

// Update redirect delay
async function updateDelay() {
  settings.redirectDelay = parseInt(delaySelect.value, 10);
  await saveSettings();
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

// Render list with category support
function renderListWithCategories(listEl, items, categoryMap, onRemove, onCategoryChange) {
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
    li.className = 'item-with-category';
    const currentCat = categoryMap[item] || '';
    const options = CATEGORIES.map(c =>
      `<option value="${c}" ${currentCat === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    li.innerHTML = `
      <span class="item-name">${item}</span>
      <select class="category-select" data-item="${item}">
        <option value="">—</option>
        ${options}
      </select>
      <button class="remove-btn" data-index="${index}">&times;</button>
    `;
    li.querySelector('.remove-btn').addEventListener('click', () => onRemove(index));
    li.querySelector('.category-select').addEventListener('change', (e) => {
      onCategoryChange(item, e.target.value);
    });
    listEl.appendChild(li);
  });
}

// Render trigger list with category and per-site snooze
function renderTriggerList() {
  triggerList.innerHTML = '';

  if (settings.triggerSites.length === 0) {
    const emptyEl = document.createElement('li');
    emptyEl.className = 'empty-message';
    emptyEl.textContent = 'No items added yet';
    triggerList.appendChild(emptyEl);
    return;
  }

  settings.triggerSites.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'item-with-category';
    const currentCat = settings.triggerCategories[item] || '';
    const options = CATEGORIES.map(c =>
      `<option value="${c}" ${currentCat === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    const snoozedUntil = settings.snoozedSites[item];
    const isSnoozed = snoozedUntil && Date.now() < snoozedUntil;
    const snoozeLabel = isSnoozed ? formatRemainingTime(snoozedUntil - Date.now()) : '💤';

    li.innerHTML = `
      <span class="item-name">${item}</span>
      <button class="site-snooze-btn ${isSnoozed ? 'snoozed' : ''}" data-site="${item}" title="${isSnoozed ? 'Cancel snooze' : 'Snooze 30min'}">${snoozeLabel}</button>
      <select class="category-select" data-item="${item}">
        <option value="">—</option>
        ${options}
      </select>
      <button class="remove-btn" data-index="${index}">&times;</button>
    `;
    li.querySelector('.remove-btn').addEventListener('click', () => removeTrigger(index));
    li.querySelector('.category-select').addEventListener('change', (e) => {
      setTriggerCategory(item, e.target.value);
    });
    li.querySelector('.site-snooze-btn').addEventListener('click', () => {
      toggleSiteSnooze(item);
    });
    triggerList.appendChild(li);
  });
}

// Toggle per-site snooze
async function toggleSiteSnooze(site) {
  const snoozedUntil = settings.snoozedSites[site];
  if (snoozedUntil && Date.now() < snoozedUntil) {
    delete settings.snoozedSites[site];
  } else {
    settings.snoozedSites[site] = Date.now() + (30 * 60 * 1000); // 30 min
  }
  await saveSettings();
  render();
}

// Main render function
function render() {
  updateSnoozeDisplay();
  renderTriggerList();
  renderListWithCategories(destinationList, settings.destinations, settings.destinationCategories, removeDestination, setDestinationCategory);
  renderList(whitelistList, settings.whitelist, removeWhitelist);
  renderSchedules();
}

// Set trigger category
async function setTriggerCategory(site, category) {
  if (category) {
    settings.triggerCategories[site] = category;
  } else {
    delete settings.triggerCategories[site];
  }
  await saveSettings();
}

// Set destination category
async function setDestinationCategory(site, category) {
  if (category) {
    settings.destinationCategories[site] = category;
  } else {
    delete settings.destinationCategories[site];
  }
  await saveSettings();
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
  const site = settings.triggerSites[index];
  settings.triggerSites.splice(index, 1);
  delete settings.triggerCategories[site];
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
  const site = settings.destinations[index];
  settings.destinations.splice(index, 1);
  delete settings.destinationCategories[site];
  await saveSettings();
  render();
}

// Add whitelist entry
async function addWhitelist() {
  const site = normalizeSite(whitelistInput.value, true);  // preserve path
  if (!site) return;

  if (!settings.whitelist.includes(site)) {
    settings.whitelist.push(site);
    await saveSettings();
    render();
  }
  whitelistInput.value = '';
}

// Remove whitelist entry
async function removeWhitelist(index) {
  settings.whitelist.splice(index, 1);
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

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Render stats
function renderStats() {
  statsList.innerHTML = '';
  const stats = settings.redirectStats || {};
  const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    const emptyEl = document.createElement('li');
    emptyEl.className = 'empty-message';
    emptyEl.textContent = 'No redirects yet';
    statsList.appendChild(emptyEl);
    return;
  }

  entries.forEach(([site, count]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${site}</span><span class="stat-count">${count}</span>`;
    statsList.appendChild(li);
  });
}

// Clear stats
async function clearStats() {
  settings.redirectStats = {};
  await saveSettings();
  renderStats();
}

// Render schedules
function renderSchedules() {
  scheduleList.innerHTML = '';

  if (settings.snoozeBlockSchedules.length === 0) {
    const emptyEl = document.createElement('li');
    emptyEl.className = 'empty-message';
    emptyEl.textContent = 'No schedules';
    scheduleList.appendChild(emptyEl);
    return;
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  settings.snoozeBlockSchedules.forEach(schedule => {
    const daysStr = schedule.days.map(d => dayNames[d]).join(', ');
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${daysStr} ${schedule.startTime}-${schedule.endTime}</span>
      <button class="remove-btn" data-id="${schedule.id}">&times;</button>
    `;
    li.querySelector('.remove-btn').addEventListener('click', () => removeSchedule(schedule.id));
    scheduleList.appendChild(li);
  });
}

// Add schedule
async function addSchedule() {
  const selectedDays = [...document.querySelectorAll('.schedule-day-btn.selected')]
    .map(btn => parseInt(btn.dataset.day));

  if (selectedDays.length === 0) return;

  const startTime = scheduleStart.value;
  const endTime = scheduleEnd.value;
  if (!startTime || !endTime) return;

  settings.snoozeBlockSchedules.push({
    id: generateId(),
    days: selectedDays,
    startTime,
    endTime
  });

  await saveSettings();
  render();
  clearScheduleInputs();
}

// Remove schedule
async function removeSchedule(id) {
  settings.snoozeBlockSchedules = settings.snoozeBlockSchedules.filter(s => s.id !== id);
  await saveSettings();
  render();
}

// Clear schedule inputs and hide form
function clearScheduleInputs() {
  scheduleDayBtns.forEach(btn => btn.classList.remove('selected'));
  scheduleStart.value = '';
  scheduleEnd.value = '';
  scheduleForm.classList.add('hidden');
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

addWhitelistBtn.addEventListener('click', addWhitelist);
whitelistInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addWhitelist();
});

// Toggle schedule form visibility
toggleScheduleForm.addEventListener('click', () => {
  scheduleForm.classList.toggle('hidden');
});

// Schedule day toggle
scheduleDayBtns.forEach(btn => {
  btn.addEventListener('click', () => btn.classList.toggle('selected'));
});

addScheduleBtn.addEventListener('click', addSchedule);

// Menu toggle
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle('hidden');
});

// Close menu when clicking outside
document.addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
});

// Show schedules modal
menuSchedules.addEventListener('click', () => {
  schedulesModal.classList.remove('hidden');
  menuDropdown.classList.add('hidden');
});

// Show stats modal
menuStats.addEventListener('click', () => {
  renderStats();
  statsModal.classList.remove('hidden');
  menuDropdown.classList.add('hidden');
});

// Close stats modal
closeStatsModal.addEventListener('click', () => {
  statsModal.classList.add('hidden');
});

// Close stats modal on backdrop click
statsModal.addEventListener('click', (e) => {
  if (e.target === statsModal) {
    statsModal.classList.add('hidden');
  }
});

// Clear stats
clearStatsBtn.addEventListener('click', clearStats);

// Focus mode toggle
focusModeToggle.addEventListener('change', toggleFocusMode);

// Delay select
delaySelect.addEventListener('change', updateDelay);

// Close modal
closeModal.addEventListener('click', () => {
  schedulesModal.classList.add('hidden');
  scheduleForm.classList.add('hidden');
});

// Close modal on backdrop click
schedulesModal.addEventListener('click', (e) => {
  if (e.target === schedulesModal) {
    schedulesModal.classList.add('hidden');
    scheduleForm.classList.add('hidden');
  }
});

// Initialize
loadSettings();
