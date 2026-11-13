export const formatDateInput = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const getDateRange = (dateValue, period) => {
  const selectedDate = new Date(`${dateValue}T12:00:00`);
  const start = new Date(selectedDate);
  start.setHours(0, 0, 0, 0);

  if (period === 'weekly') {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + (period === 'weekly' ? 7 : 1));
  end.setMilliseconds(end.getMilliseconds() - 1);

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end)
  };
};
