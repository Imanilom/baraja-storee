export function buildCsv(rows, delimiter = ';') {
  if (!Array.isArray(rows)) {
    throw new TypeError('CSV rows must be an array.');
  }

  const encodeCell = (value) => {
    let text = typeof value === 'number'
      ? (Number.isFinite(value) ? String(value) : '')
      : String(value ?? '');
    if (typeof value === 'string' && /^[\t\r\n ]*[=+\-@]/.test(text)) {
      text = `'${text}`;
    }
    if (text.includes(delimiter) || /["\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return `\uFEFF${rows.map((row) => {
    if (!Array.isArray(row)) {
      throw new TypeError('Each CSV row must be an array.');
    }
    return row.map(encodeCell).join(delimiter);
  }).join('\r\n')}`;
}

export function downloadCsv(filename, rows) {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
