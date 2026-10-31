export const FRAME_CSS = `
  .resume-print-frame, .resume-print-frame > thead, .resume-print-frame > tbody,
  .resume-print-frame > tfoot, .resume-print-frame tr, .resume-print-frame td {
    display: block; width: 100%; border: 0; padding: 0; margin: 0;
  }
  .resume-page-spacer { height: 0; }
  @media print {
    @page { size: A4; margin: 0; }
    .resume-print-frame { display: table !important; table-layout: fixed; }
    .resume-print-frame > thead { display: table-header-group !important; }
    .resume-print-frame > tbody { display: table-row-group !important; }
    .resume-print-frame > tfoot { display: table-footer-group !important; }
    .resume-print-frame tr { display: table-row !important; }
    .resume-print-frame td { display: table-cell !important; }
    .resume-page-spacer { height: 16mm; }
    .resume-sheet, .resume-ats { padding: 0 16mm !important; box-shadow: none !important; border: 0 !important; }
    .resume-sheet h2 { break-after: avoid; page-break-after: avoid; }
    .resume-sheet li, .resume-ats section > div { break-inside: avoid; page-break-inside: avoid; }
    .resume-sheet p { orphans: 2; widows: 2; }
  }
`;
