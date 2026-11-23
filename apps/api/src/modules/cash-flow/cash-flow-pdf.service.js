const PDFDocument = require('pdfkit');

const MAX_ROWS = 5000;
const MAX_SECTIONS = 10;
const MAX_CELL_LENGTH = 1000;

const toPdfText = (value) => String(value ?? '')
  .replace(/[→⇄]/g, '-')
  .replace(/[^\x20-\xFF]/g, ' ');

const formatValue = (value, label = '') => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return toPdfText(value);
  }
  const formatted = value.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  return /rp|nominal|saldo|debit|kredit/i.test(label) ? `Rp ${formatted}` : formatted;
};

const getColumnWeight = (label) => {
  const value = label.toLowerCase();
  if (value.includes('keterangan') || value.includes('catatan')) return 1.8;
  if (value.includes('referensi')) return 1.15;
  if (value.includes('nominal') || value.includes('saldo') || value.includes('total')) return 1.2;
  if (value.includes('tanggal')) return 0.9;
  if (value.includes('kategori') || value.includes('akun')) return 1;
  return 0.85;
};

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' ||
    typeof payload.title !== 'string' || !payload.title.trim() ||
    !Array.isArray(payload.sections) || payload.sections.length > MAX_SECTIONS ||
    !Array.isArray(payload.summary || [])) {
    throw new TypeError('Format data laporan PDF tidak valid.');
  }

  const rowCount = payload.sections.reduce((total, section) => {
    if (!section || typeof section.title !== 'string' ||
      !Array.isArray(section.headers) || !section.headers.length ||
      !Array.isArray(section.rows) ||
      section.rows.some((row) => !Array.isArray(row))) {
      throw new TypeError('Format bagian laporan PDF tidak valid.');
    }
    return total + section.rows.length;
  }, 0);
  if (rowCount > MAX_ROWS) {
    throw new RangeError(`Laporan PDF maksimal berisi ${MAX_ROWS} baris.`);
  }

  const values = [
    payload.title,
    payload.subtitle || '',
    ...payload.summary.flatMap((item) => Array.isArray(item) ? item : []),
    ...payload.sections.flatMap((section) => [
      section.title,
      ...section.headers,
      ...section.rows.flat()
    ])
  ];
  if (values.some((value) =>
    (typeof value !== 'string' && typeof value !== 'number') ||
    String(value).length > MAX_CELL_LENGTH
  )) {
    throw new TypeError('Isi laporan PDF mengandung nilai yang tidak valid.');
  }
}

class CashFlowPdfService {
  generate(payload) {
    validatePayload(payload);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 34,
        bufferPages: false
      });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottom = () => doc.page.height - doc.page.margins.bottom;
      let y = doc.page.margins.top;

      const drawPageHeading = (continued = false) => {
        doc.font('Helvetica-Bold').fontSize(17).fillColor('#0f172a')
          .text(toPdfText(payload.title) + (continued ? ' (Lanjutan)' : ''), { lineBreak: false });
        y = doc.y + 5;
        if (payload.subtitle) {
          doc.font('Helvetica').fontSize(9).fillColor('#475569')
            .text(toPdfText(payload.subtitle), { lineBreak: false });
          y = doc.y + 13;
        }
      };

      const addPage = () => {
        doc.addPage();
        y = doc.page.margins.top;
        drawPageHeading(true);
      };

      const ensureSpace = (height) => {
        if (y + height > bottom()) addPage();
      };

      const summary = payload.summary || [];
      drawPageHeading();
      if (summary.length) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a')
          .text('RINGKASAN', doc.page.margins.left, y);
        y = doc.y + 5;
        const labelWidth = pageWidth() * 0.58;
        summary.forEach((item) => {
          if (!Array.isArray(item) || item.length < 2) return;
          ensureSpace(19);
          doc.font('Helvetica').fontSize(9).fillColor('#334155')
            .text(toPdfText(item[0]), doc.page.margins.left, y, { width: labelWidth });
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a')
            .text(formatValue(item[1], item[0]), doc.page.margins.left + labelWidth, y, {
              width: pageWidth() - labelWidth,
              align: 'right'
            });
          y += 18;
        });
        y += 8;
      }

      payload.sections.forEach((section) => {
        ensureSpace(56);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
          .text(toPdfText(section.title), doc.page.margins.left, y);
        y = doc.y + 6;

        const weights = section.headers.map((header) => getColumnWeight(String(header)));
        const weightTotal = weights.reduce((total, weight) => total + weight, 0);
        const widths = weights.map((weight) => pageWidth() * weight / weightTotal);
        const drawRow = (values, isHeader, rowY, rowIndex = 0) => {
          const rowHeight = isHeader ? 25 : 24;
          if (isHeader) {
            doc.rect(doc.page.margins.left, rowY, pageWidth(), rowHeight).fill('#e2e8f0');
          } else {
            doc.rect(doc.page.margins.left, rowY, pageWidth(), rowHeight)
              .fill(rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc');
          }
          let x = doc.page.margins.left;
          section.headers.forEach((column, index) => {
            const width = widths[index];
            const value = isHeader ? column : values[index];
            const isNumeric = typeof value === 'number';
            const align = isHeader
              ? (/nominal|saldo|debit|kredit|total/i.test(column) ? 'right' : 'left')
              : (isNumeric ? 'right' : 'left');
            doc.font(isHeader || isNumeric ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(isHeader ? 8 : 7.5)
              .fillColor(isHeader ? '#1e293b' : '#334155')
              .text(formatValue(value, column), x + 4, rowY + 7, {
                width: Math.max(1, width - 8),
                height: rowHeight - 8,
                ellipsis: true,
                lineBreak: false,
                align
              });
            x += width;
          });
          return rowHeight;
        };

        const drawSectionHeading = () => {
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
            .text(toPdfText(section.title), doc.page.margins.left, y);
          y = doc.y + 6;
        };
        const drawTableHeader = () => {
          y += drawRow(section.headers, true, y);
        };

        drawTableHeader();
        for (let index = 0; index < section.rows.length; index += 1) {
          if (y + 24 > bottom()) {
            addPage();
            drawSectionHeading();
            drawTableHeader();
          }
          y += drawRow(section.rows[index], false, y, index);
          doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y)
            .strokeColor('#e2e8f0').lineWidth(0.35).stroke();
        }
        y += 12;
      });

      doc.end();
    });
  }
}

module.exports = new CashFlowPdfService();
