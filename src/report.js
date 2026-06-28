const { getMonthEntries } = require('./storage');
const { COMMUTE_TYPES, DAYS_OFF } = require('./config');

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
    const isConfiguredDayOff = DAYS_OFF.includes(dayOfWeek);
    const isNonWorkDay = isWeekend || isConfiguredDayOff;
    const dayLabel = DAY_NAMES[dayOfWeek];

    const logged = entries[dateStr];

    // Show regular configured days off as blank entries unless manually overridden.
    if (isConfiguredDayOff && !logged) {
      lines.push(`${dateStr} (${dayLabel}) -`);
      continue;
    }

    // Priority:
    // 1) Logged commute
    // 2) Day off / weekend (when not logged)
    // 3) Not logged
    if (logged) {
      // Either a workday or a non-work day with override
      const commuteType = COMMUTE_TYPES.find(t => t.id === logged);
      const label = commuteType ? `${commuteType.emoji} ${commuteType.label}` : logged;
      const tag = isWeekend ? ' (weekend)' : (isConfiguredDayOff ? ' (day off)' : '');
      lines.push(`${dateStr} (${dayLabel}) - ${label}${tag}`);

      if (!isNonWorkDay) {
        workDays++;
        loggedDays++;
      }

      // Add to summary for workdays only
      if (!isNonWorkDay) {
        summary[logged] = (summary[logged] || 0) + 1;
      }
    } else if (isNonWorkDay) {
      // Non-work day with no override
      const nonWorkLabel = '🌅 Weekend';
      lines.push(`${dateStr} (${dayLabel}) - ${nonWorkLabel}`);
    } else {
      // Weekday, not logged
      workDays++;
      missingDays++;
      lines.push(`${dateStr} (${dayLabel}) - ❓ Not logged`);
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
