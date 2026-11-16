const DELIMITERS = [',', ';', '\t'];
const PDF_AMOUNT_PATTERN = /(?<![\d,])[-]?\s*(?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2})-?(?![\d,])/g;

export const parseMutationPdfText = (source) => {
  const entries = [];
  let currentLines = [];
  const finishEntry = () => {
    if (!currentLines.length) return;
    const text = currentLines.join(' ').replace(/\s+/g, ' ').trim();
    const dateMatch = text.match(/^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\b/i);
    const timeMatch = text.match(/\b\d{2}:\d{2}:\d{2}\b/);
    const amountMatches = [...text.matchAll(PDF_AMOUNT_PATTERN)];
    if (amountMatches.length >= 2) {
      const transactionAmount = amountMatches[amountMatches.length - 2];
      let description = text;
      amountMatches.slice(-2).reverse().forEach((match) => {
        description = `${description.slice(0, match.index)}${description.slice(match.index + match[0].length)}`;
      });
      description = description
        .replace(dateMatch?.[0] || '', '')
        .replace(timeMatch?.[0] || '', '')
        .replace(/\s+/g, ' ')
        .trim();

      const amount = transactionAmount[0].trim();
      const isDebit = amount.startsWith('-') || amount.endsWith('-');
      entries.push([
        `${dateMatch?.[1] || ''}${timeMatch ? ` ${timeMatch[0]}` : ''}`.trim(),
        description,
        '',
        amount,
        isDebit ? 'Debit' : 'Kredit'
      ]);
    }
    currentLines = [];
  };

  String(source || '').split(/\r?\n/).forEach((line) => {
    const value = line.replace(/\s+/g, ' ').trim();
    if (!value) return;
    if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/i.test(value)) {
      finishEntry();
      currentLines = [value];
    } else if (currentLines.length && !/^(?:tanggal|deskripsi|description|debit|kredit|credit|saldo)\b/i.test(value)) {
      currentLines.push(value);
    }
  });
  finishEntry();

  if (!entries.length) {
    throw new Error('PDF tidak berisi baris mutasi teks yang dikenali. Pastikan PDF bukan hasil scan gambar.');
  }
  return [
    ['Tanggal', 'Deskripsi', 'Referensi', 'Nominal', 'Arah'],
    ...entries
  ];
};

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
    direction: find([/dr.?cr/, /debit.?kredit/, /debet.?kredit/, /kredit.?(?:debit|debet)/, /^arah$/, /arah mutasi/, /direction/, /jenis (?:debit|kredit|mutasi)/])
  };
};

export const cellToText = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return value === null || value === undefined ? '' : String(value).trim();
};

export const parseMutationPdf = async (file) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (pdf.numPages > 250) {
    await pdf.destroy();
    throw new Error('PDF maksimal 250 halaman per rekonsiliasi.');
  }

  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = new Map();
      content.items.forEach((item) => {
        if (!item.str?.trim()) return;
        const x = item.transform?.[4] || 0;
        const y = Math.round((item.transform?.[5] || 0) * 2) / 2;
        const line = lines.get(y) || [];
        line.push({ x, text: item.str });
        lines.set(y, line);
      });
      pages.push(
        [...lines.entries()]
          .sort(([firstY], [secondY]) => secondY - firstY)
          .map(([, line]) => line.sort((first, second) => first.x - second.x).map((item) => item.text).join(' '))
          .join('\n')
      );
    }
    return parseMutationPdfText(pages.join('\n'));
  } finally {
    await pdf.destroy();
  }
};
