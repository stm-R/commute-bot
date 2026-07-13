const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

// Legacy files (pre-consolidation) — read once for automatic migration, then ignored.
const LEGACY_COMMUTES_FILE = path.join(DATA_DIR, 'commutes.json');
const LEGACY_VACATION_FILE = path.join(DATA_DIR, 'vacation.txt');

function emptyData() {
  return { commutes: {}, vacation: { endDate: null } };
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// One-time migration: if data.json doesn't exist yet but legacy files do, fold them in.
// Leaves the old files untouched as a backup.
function migrateLegacy() {
  const data = emptyData();
  let migrated = false;

  if (fs.existsSync(LEGACY_COMMUTES_FILE)) {
    try {
      const raw = fs.readFileSync(LEGACY_COMMUTES_FILE, 'utf8');
      const normalized = raw.replace(/,\s*([}\]])/g, '$1');
      data.commutes = JSON.parse(normalized) || {};
      migrated = true;
    } catch (err) {
      console.error(`[Storage] Failed to migrate ${LEGACY_COMMUTES_FILE}: ${err.message}`);
    }
  }

  if (fs.existsSync(LEGACY_VACATION_FILE)) {
    try {
      const endDate = fs.readFileSync(LEGACY_VACATION_FILE, 'utf8').trim();
      data.vacation.endDate = endDate || null;
      migrated = true;
    } catch (err) {
      console.error(`[Storage] Failed to migrate ${LEGACY_VACATION_FILE}: ${err.message}`);
    }
  }

  if (migrated) {
    console.log('[Storage] Migrated legacy data files into data.json');
  }
  return data;
}

// Ensure data.json exists, migrating from legacy files on first run.
function ensureFile() {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(migrateLegacy(), null, 2));
  }
}

// Load the whole struct, tolerating hand-edit mistakes and normalizing shape.
function load() {
  ensureFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const normalized = raw.replace(/,\s*([}\]])/g, '$1'); // tolerate trailing commas
    const parsed = JSON.parse(normalized);
    return {
      commutes: parsed.commutes || {},
      vacation: { endDate: parsed.vacation?.endDate ?? null },
    };
  } catch (err) {
    console.error(`[Storage] Failed to parse ${DATA_FILE}: ${err.message}`);
    return emptyData();
  }
}

function save(data) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ─── Commutes (synchronous) ──────────────────────────────────────────────────
function getEntry(dateStr) {
  return load().commutes[dateStr] || null;
}

function setEntry(dateStr, commuteId) {
  const data = load();
  data.commutes[dateStr] = commuteId;
  save(data);
}

function getMonthEntries(yearMonth) {
  const { commutes } = load();
  const result = {};
  for (const [date, value] of Object.entries(commutes)) {
    if (date.startsWith(yearMonth)) {
      result[date] = value;
    }
  }
  return result;
}

// ─── Vacation (async, matching the previous vacation-storage signatures) ──────
async function getVacationEndDate() {
  return load().vacation.endDate || null;
}

async function saveVacationEndDate(endDate) {
  const data = load();
  data.vacation.endDate = endDate || null;
  save(data);
}

async function isUserOnVacation() {
  return (await getVacationEndDate()) !== null;
}

module.exports = {
  getEntry,
  setEntry,
  getMonthEntries,
  load,
  getVacationEndDate,
  saveVacationEndDate,
  isUserOnVacation,
};
