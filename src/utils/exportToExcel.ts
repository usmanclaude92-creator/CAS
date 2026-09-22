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

function buildWorksheet(
  optionsOrFilename: string | ExportToExcelOptions,
  sheetNameParam?: string,
  columnsParam?: ExcelColumn[],
  dataParam?: any[]
): { worksheet: XLSX.WorkSheet; filename: string; sheetName: string } {
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

  if (!rawData || rawData.length === 0) {
    if (columns && columns.length > 0) {
      const emptyRow: Record<string, any> = {};
      columns.forEach((c) => { emptyRow[c.header] = ''; });
      worksheet = XLSX.utils.json_to_sheet([emptyRow]);
    } else {
      worksheet = XLSX.utils.aoa_to_sheet([['No records available for the selected filter criteria']]);
    }
    return { worksheet, filename, sheetName };
  }

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

  return { worksheet, filename, sheetName };
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
  const { worksheet, filename, sheetName } = buildWorksheet(
    optionsOrFilename,
    sheetNameParam,
    columnsParam,
    dataParam
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Report');

  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename, { bookType: 'xlsx' });
}

/**
 * Export structured data to an Excel-compatible CSV (.csv) file
 * Utilizes SheetJS (XLSX) to format and generate proper CSV encoding with UTF-8 BOM
 */
export function exportToCsv(
  optionsOrFilename: string | ExportToExcelOptions,
  sheetNameParam?: string,
  columnsParam?: ExcelColumn[],
  dataParam?: any[]
) {
  const { worksheet, filename, sheetName } = buildWorksheet(
    optionsOrFilename,
    sheetNameParam,
    columnsParam,
    dataParam
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Report');

  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  XLSX.writeFile(workbook, cleanFilename, { bookType: 'csv' });
}

export interface SheetDefinition {
  sheetName: string;
  data: any[];
  columns?: ExcelColumn[];
}

export interface MultiSheetExportOptions {
  filename: string;
  sheets: SheetDefinition[];
}

/**
 * Export multiple financial report tables into a single consolidated multi-sheet Excel workbook (.xlsx)
 */
export function exportMultiSheetExcel(options: MultiSheetExportOptions) {
  const workbook = XLSX.utils.book_new();

  options.sheets.forEach((sheetDef) => {
    const { worksheet } = buildWorksheet({
      filename: options.filename,
      sheetName: sheetDef.sheetName,
      columns: sheetDef.columns,
      data: sheetDef.data,
    });
    // Excel worksheet names must be <= 31 characters and free of invalid chars : \ / ? * [ ]
    const safeSheetName = sheetDef.sheetName.replace(/[:\\/?*[\]]/g, '').substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName || 'Sheet');
  });

  const cleanFilename = options.filename.endsWith('.xlsx') ? options.filename : `${options.filename}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename, { bookType: 'xlsx' });
}

export default exportToExcel;
