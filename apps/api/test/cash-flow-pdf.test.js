const assert = require('node:assert/strict');
const cashFlowPdfService = require('../src/modules/cash-flow/cash-flow-pdf.service');

async function run() {
  const pdf = await cashFlowPdfService.generate({
    title: 'Laporan Arus Kas',
    subtitle: 'Periode 2026-11-01 sampai 2026-11-30',
    summary: [['Saldo kas tunai (Rp)', 15794600]],
    sections: [{
      title: 'Rincian mutasi',
      headers: ['Tanggal', 'Keterangan', 'Nominal (Rp)'],
      rows: [['2026-11-02', 'Belanja bahan', 250000]]
    }]
  });

  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.throws(
    () => cashFlowPdfService.generate({ title: '', sections: [], summary: [] }),
    /Format data laporan PDF tidak valid/
  );
  console.log('Cash-flow PDF export checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
