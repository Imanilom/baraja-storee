const DELIMITERS = [',', ';', '\t'];

const countDelimiter = (line, delimiter) => {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      count += 1;
    }
  }
  return count;
};

const detectDelimiter = (text) => {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || '';
  return DELIMITERS.reduce((best, delimiter) => (
    countDelimiter(firstLine, delimiter) > countDelimiter(firstLine, best) ? delimiter : best
  ), DELIMITERS[0]);
};

export const parseMutationCsv = (source) => {
  const text = source.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
};

export const detectMutationColumns = (headers) => {
  const find = (patterns) => headers.findIndex((header) => {
    const name = String(header || '').toLowerCase();
    return patterns.some((pattern) => pattern.test(name));
  });
  const amount = headers.findIndex((header) => {
    const name = String(header || '').toLowerCase();
    if (/(dr.?cr|debit.?kredit|debet.?kredit|kredit.?(?:debit|debet)|credit.?debit)/.test(name)) return false;
    return [/debit/, /debet/, /pengeluaran/, /keluar/, /nominal/, /\bamount\b/, /mutasi/]
      .some((pattern) => pattern.test(name));
  });

  return {
    date: find([/tanggal/, /\btgl\b/, /\bdate\b/]),
    description: find([/keterangan/, /deskripsi/, /description/, /remark/, /uraian/, /berita/, /\bnama\b/, /penerima/, /beneficiary/, /recipient/]),
    reference: find([/referensi/, /\breference\b/, /\bref\b/, /reff/, /trace/, /\bkode\b/]),
    amount,
    direction: find([/dr.?cr/, /debit.?kredit/, /debet.?kredit/, /kredit.?(?:debit|debet)/, /arah mutasi/, /direction/, /jenis (?:debit|kredit|mutasi)/])
  };
};

export const cellToText = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return value === null || value === undefined ? '' : String(value).trim();
};
