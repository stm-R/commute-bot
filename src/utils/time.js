const WEEKDAY_NAME_TO_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function getNowInTimezoneParts(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type)?.value;
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const timeStr = `${get('hour')}:${get('minute')}:${get('second')}`;

  return {
    weekdayAbbrev: get('weekday'),
    dateStr,
    timeStr
  };
}

module.exports = { getNowInTimezoneParts, WEEKDAY_NAME_TO_INDEX };
