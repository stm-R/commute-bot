# Storage consolidation plan

**Goal:** Merge the two persistence layers into one. Today the bot writes commutes to
`data/commutes.json` (via `src/storage.js`) and the vacation end-date to `data/vacation.txt`
(via `src/vacation-storage.js`). These become **one file** `data/data.json` and **one module**
`src/storage.js`. `src/vacation-storage.js` is deleted.

This is a storage-layer-only change. No directory reorg, no changes to commands, scheduling,
or Discord behaviour. Every consumer keeps working with the smallest possible edit.

---

## 1. New on-disk format

Replace the two files with a single struct in `data/data.json`:

```json
{
  "commutes": {
    "2026-07-13": "car"
  },
  "vacation": {
    "endDate": "2026-08-08"
  }
}
```

- `commutes` — same map the old `commutes.json` held: `"YYYY-MM-DD" -> commuteId`.
- `vacation.endDate` — the string the old `vacation.txt` held, or `null` when not on vacation.
- The struct is extensible: future settings get a new top-level key, no new files.

`data/` is gitignored, so nothing here is committed. The real data lives on the deployed
instance, so **migration must be automatic and safe** (see §3).

---

## 2. Rewrite `src/storage.js`

Replace the whole file with the version below. It keeps a small private low-level layer
(`ensureFile` / `load` / `save`) shared by both the commute and vacation accessors — this is
the "same code" for both concerns.

Design rules to preserve exactly:
- **Commute functions stay synchronous** (`getEntry`, `setEntry`, `getMonthEntries`) — callers
  in `buttons.js` and `log.js` call them without `await`.
- **Vacation functions stay `async`** (`getVacationEndDate`, `saveVacationEndDate`,
  `isUserOnVacation`) — callers use `await`. Keeping the signatures means callers don't change.
- Keep the tolerant-parse (trailing-comma strip) behaviour from the old `storage.js`.
- **Drop `getVacationFile()`** — it is exported today but never consumed anywhere. Confirm with
  `grep -rn getVacationFile src` (only its own definition should appear) before removing.

```js
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
```

> Note: `isUserOnVacation` keeps the original semantics — it returns `true` whenever an end-date
> is set, without comparing against today. (The old code did the same; the "has the vacation
> already ended?" check lives in `command-handlers/vacation.js` and is unchanged.)

---

## 3. Delete `src/vacation-storage.js`

Remove the file entirely. Its functionality now lives in `src/storage.js`.

```
git rm src/vacation-storage.js   # or delete the file
```

---

## 4. Update the two callers that referenced vacation storage

Everything that already did `require('../storage')` / `require('./storage')` keeps working
unchanged (`report.js`, `interactions/buttons.js`, `command-handlers/log.js`). Only the two
files that reached into `vacation-storage` need edits.

### 4a. `src/command-handlers/vacation.js`

Change only the import line (line 1):

```js
// before
const { getVacationEndDate, saveVacationEndDate } = require('../vacation-storage');
// after
const { getVacationEndDate, saveVacationEndDate } = require('../storage');
```

Nothing else in this file changes — the function names and async usage are identical.

### 4b. `src/scheduler.js`

It currently imports `storage` and, separately, `isUserOnVacation` from `vacation-storage`
(lines 2–3). Collapse to a single import:

```js
// before (lines 2-3)
const storage = require('./storage');
const { isUserOnVacation } = require('./vacation-storage');
// after
const storage = require('./storage');
const { isUserOnVacation } = storage;
```

The call site `await isUserOnVacation()` (line 19) is unchanged.

---

## 5. Verification

1. `grep -rn "vacation-storage" src` → **no matches** (proves the old module is fully gone).
2. `grep -rn "getVacationFile" src` → **no matches** (dead export removed).
3. `node -e "require('./src/storage')"` → loads without error.
4. Migration check (only meaningful where legacy data exists, e.g. the deployed instance):
   with an old `data/commutes.json` and/or `data/vacation.txt` present and no `data.json`,
   start the bot (or call `require('./src/storage').load()`); confirm `data/data.json` is
   created with both sections populated and the old files left intact.
5. Smoke-test the flows that touch storage:
   - `/log` a commute and `/report` the month → the entry appears.
   - `/vacation set <future date>`, `/vacation status`, `/vacation off` → status reflects the
     writes; the scheduler's `isUserOnVacation()` gate still skips prompts while set.

## Summary of file changes

| File | Change |
|------|--------|
| `data/commutes.json`, `data/vacation.txt` | Replaced by `data/data.json` (auto-migrated at runtime; old files kept as backup) |
| `src/storage.js` | Rewritten: one module, both concerns, shared low-level IO + migration |
| `src/vacation-storage.js` | **Deleted** |
| `src/command-handlers/vacation.js` | Import path `../vacation-storage` → `../storage` |
| `src/scheduler.js` | `isUserOnVacation` now pulled from `./storage` |
| `src/report.js`, `src/interactions/buttons.js`, `src/command-handlers/log.js` | **No change** |
