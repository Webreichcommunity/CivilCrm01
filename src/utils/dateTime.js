export const getLocalDateTimeInputValue = (date = new Date()) => {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export const isDateWithinRange = (dateValue, fromDate, toDate) => {
  const target = new Date(dateValue).getTime();
  const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
  const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

  if (from && target < from) return false;
  if (to && target > to) return false;
  return true;
};

