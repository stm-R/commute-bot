const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'commutes.json');

// Ensure data directory and file exist
function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
  }
}

// Load all entries: { "YYYY-MM-DD": "commuteId", ... }
function load() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

// Save all entries
function save(data) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get single entry
function getEntry(dateStr) {
  const data = load();
  return data[dateStr] || null;
}

// Set single entry
function setEntry(dateStr, commuteId) {
  const data = load();
  data[dateStr] = commuteId;
  save(data);
}

// Get all entries for a given year-month (YYYY-MM)
function getMonthEntries(yearMonth) {
  const data = load();
  const result = {};
  for (const [date, value] of Object.entries(data)) {
    if (date.startsWith(yearMonth)) {
      result[date] = value;
    }
  }
  return result;
}

module.exports = { getEntry, setEntry, getMonthEntries, load };
