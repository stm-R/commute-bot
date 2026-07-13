const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const VACATION_FILE = path.join(DATA_DIR, 'vacation.txt');

// Ensure data directory exists
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getVacationFile() {
  return VACATION_FILE;
}

// Single-user bot: vacation status isn't tracked per Discord user ID, just one
// shared end date for the one person using the bot.
async function getVacationEndDate() {
  ensureDir();
  if (!fs.existsSync(VACATION_FILE)) return null;

  try {
    const data = fs.readFileSync(VACATION_FILE, 'utf8');
    return data.trim() || null;
  } catch (error) {
    console.error('[Vacation] Error reading vacation file:', error);
    return null;
  }
}

async function saveVacationEndDate(endDate) {
  ensureDir();
  try {
    if (endDate) {
      fs.writeFileSync(VACATION_FILE, endDate);
    } else if (fs.existsSync(VACATION_FILE)) {
      fs.unlinkSync(VACATION_FILE);
    }
  } catch (error) {
    console.error('[Vacation] Error saving vacation file:', error);
    throw error;
  }
}

async function isUserOnVacation() {
  const endDateStr = await getVacationEndDate();
  if (!endDateStr) return false;
  return true;
}

module.exports = { getVacationFile, getVacationEndDate, saveVacationEndDate, isUserOnVacation };
