/** Exports an HTML <table> element to an .xlsx file (loads SheetJS on demand). */
export async function exportTableToExcel(table, filename, sheetName = 'Report') {
  if (!table) return;
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(table, { raw: true });
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
