const { getMonthEntries } = require('./storage');
const { COMMUTE_TYPES } = require('./config');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Generate a full monthly report.
 * @param {number} year  - Full year, e.g. 2025
 * @param {number} month - 0-indexed month (0 = January)
 */
function generateReport(year, month) {
  const monthStr = `${year}-${pad2(month + 1)}`; // YYYY-MM
  const entries = getMonthEntries(monthStr);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lines = [];
  const summary = {};
  let workDays = 0;
  let loggedDays = 0;
  let missingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayLabel = DAY_NAMES[dayOfWeek];

    const logged = entries[dateStr];

    if (isWeekend && !logged) {
      // Weekend with no override
      lines.push(`\`${dateStr}\` (${dayLabel}) — 🌅 Weekend`);
    } else if (logged) {
      // Either a weekday or a weekend with override
      const commuteType = COMMUTE_TYPES.find(t => t.id === logged);
      const label = commuteType ? `${commuteType.emoji} ${commuteType.label}` : logged;
      const tag = isWeekend ? ' *(weekend)*' : '';
      lines.push(`\`${dateStr}\` (${dayLabel}) — ${label}${tag}`);

      if (!isWeekend) {
        workDays++;
        loggedDays++;
      }

      // Add to summary (weekday entries only for the count, but track all)
      if (!isWeekend) {
        summary[logged] = (summary[logged] || 0) + 1;
      }
    } else {
      // Weekday, not logged
      workDays++;
      missingDays++;
      lines.push(`\`${dateStr}\` (${dayLabel}) — ❓ *Not logged*`);
    }
  }

  return {
    monthLabel: `${MONTH_NAMES[month]} ${year}`,
    lines,
    workDays,
    loggedDays,
    missingDays,
    summary
  };
}

module.exports = { generateReport };
