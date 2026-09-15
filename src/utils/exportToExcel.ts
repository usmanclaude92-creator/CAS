import * as XLSX from 'xlsx';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  format?: (value: any, row: any) => string | number;
}

export interface ExportToExcelOptions {
  filename: string;
  sheetName?: string;
  title?: string;
  companyName?: string;
  currency?: string;
  data: any[];
  columns?: ExcelColumn[];
}

/**
 * Export structured data to a professional Excel (.xlsx) file
 * Supports both options object and positional arguments
 */
export function exportToExcel(
  optionsOrFilename: string | ExportToExcelOptions,
  sheetNameParam?: string,
  columnsParam?: ExcelColumn[],
  dataParam?: any[]
) {
  let filename = '';
  let sheetName = 'Report';
  let columns: ExcelColumn[] | undefined;
  let rawData: any[] = [];

  if (typeof optionsOrFilename === 'string') {
    filename = optionsOrFilename;
    sheetName = sheetNameParam || 'Report';
    columns = columnsParam;
    rawData = dataParam || [];
  } else if (optionsOrFilename && typeof optionsOrFilename === 'object') {
    filename = optionsOrFilename.filename;
    sheetName = optionsOrFilename.sheetName || 'Report';
    columns = optionsOrFilename.columns;
    rawData = optionsOrFilename.data || [];
  }

  let worksheet: XLSX.WorkSheet;

  if (columns && columns.length > 0) {
    const rows = rawData.map((item) => {
      const rowObj: Record<string, any> = {};
      columns!.forEach((col) => {
        const rawVal = item[col.key];
        rowObj[col.header] = col.format ? col.format(rawVal, item) : rawVal ?? '';
      });
      return rowObj;
    });
    worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = columns.map((col) => ({
      wch: col.width || Math.max(col.header.length + 4, 15),
    }));
  } else {
    worksheet = XLSX.utils.json_to_sheet(rawData);
    // Auto calculate column widths from keys
    if (rawData.length > 0) {
      const sample = rawData[0];
      const keys = Object.keys(sample);
      worksheet['!cols'] = keys.map((key) => {
        let maxLen = key.length;
        for (let i = 0; i < Math.min(rawData.length, 50); i++) {
          const val = rawData[i][key];
          if (val !== undefined && val !== null) {
            maxLen = Math.max(maxLen, String(val).length);
          }
        }
        return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
      });
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Report');

  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename);
}
