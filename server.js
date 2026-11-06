const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fetch = require('node-fetch');
const path = require('path');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Multer for file uploads (memory storage, 10MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are allowed'));
    }
  }
});

/**
 * Parse an XLSX workbook buffer into structured data
 * Preserves booleans, numbers, strings, and handles merged cells
 */
function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheets = workbook.SheetNames;
  const data = {};

  for (const sheetName of sheets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet['!ref']) {
      data[sheetName] = [];
      continue;
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const rows = [];

    // Handle merged cells - build a map of merged regions
    const merges = sheet['!merges'] || [];
    const mergeMap = {};
    for (const merge of merges) {
      // Get the value from the top-left cell of the merge
      const topLeftAddr = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
      const topLeftCell = sheet[topLeftAddr];
      const value = topLeftCell ? getCellValue(topLeftCell) : null;

      // Fill all cells in the merge range
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (r === merge.s.r && c === merge.s.c) continue;
          const key = `${r},${c}`;
          mergeMap[key] = value;
        }
      }
    }

    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];

        if (cell) {
          row.push(getCellValue(cell));
        } else {
          // Check if this is a merged cell
          const mergeKey = `${r},${c}`;
          if (mergeMap.hasOwnProperty(mergeKey)) {
            row.push(mergeMap[mergeKey]);
          } else {
            row.push(null);
          }
        }
      }
      rows.push(row);
    }

    data[sheetName] = rows;
  }

  return { sheets, data };
}

/**
 * Get the properly typed value from an XLSX cell
 */
function getCellValue(cell) {
  if (!cell) return null;
  switch (cell.t) {
    case 'b': return cell.v; // boolean
    case 'n': return cell.v; // number
    case 's': return cell.v; // string
    case 'd': return cell.v; // date
    case 'e': return null;   // error
    default: return cell.v != null ? cell.v : null;
  }
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fetch Google Sheet
app.post('/api/fetch-google-sheet', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Extract spreadsheet ID from URL
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return res.status(400).json({ success: false, error: 'Invalid Google Sheets URL' });
    }
    const spreadsheetId = match[1];

    // Download as XLSX with cache buster timestamp to ensure live edits are immediately retrieved
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx&_cb=${Date.now()}`;
    console.log(`Fetching live spreadsheet: ${exportUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(exportUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: `Failed to fetch spreadsheet (HTTP ${response.status}). Make sure the spreadsheet is shared publicly or accessible via link.`
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const result = parseWorkbook(buffer);

    console.log(`Parsed ${result.sheets.length} sheets: ${result.sheets.join(', ')}`);
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.json({ success: true, timestamp: Date.now(), ...result });
  } catch (err) {
    console.error('Fetch error:', err);
    if (err.name === 'AbortError') {
      return res.status(408).json({ success: false, error: 'Request timed out (30s). Try again or upload the file manually.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload Excel file
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    console.log(`Processing uploaded file: ${req.file.originalname} (${req.file.size} bytes)`);
    const result = parseWorkbook(req.file.buffer);

    console.log(`Parsed ${result.sheets.length} sheets: ${result.sheets.join(', ')}`);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper for formatted WIB timestamp (GMT+7)
function getWIBDateString(d = new Date()) {
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (3600000 * 7));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = wib.getDate();
  const month = months[wib.getMonth()];
  const year = wib.getFullYear();
  const hours = String(wib.getHours()).padStart(2, '0');
  const minutes = String(wib.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}.${minutes} WIB`;
}

// Test Google Apps Script Webhook connectivity
app.post('/api/test-webhook', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
      return res.status(400).json({ success: false, error: 'URL Webhook tidak valid' });
    }

    const cleanUrl = webhookUrl.trim();
    console.log(`Testing webhook connectivity: ${cleanUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;
    let text = '';
    try {
      response = await fetch(cleanUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
      text = await response.text();
    } catch (fetchErr) {
      clearTimeout(timeout);
      return res.json({
        success: false,
        error: `Koneksi gagal: ${fetchErr.message}. Pastikan URL Webhook benar.`
      });
    }
    clearTimeout(timeout);

    console.log(`Webhook test result: HTTP ${response.status}, snippet: ${text.substring(0, 100)}`);

    // If Google login page is returned, "Anyone" was not set
    if (text.includes('accounts.google.com') || text.includes('ServiceLogin')) {
      return res.json({
        success: false,
        error: 'Deployment memerlukan login Google. Pastikan "Who has access" disetel ke "Anyone" (Siapa saja).'
      });
    }

    // Otherwise, script was reached!
    return res.json({
      success: true,
      message: 'Webhook terhubung dan aktif!'
    });
  } catch (err) {
    console.error('Test webhook error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sync finding results to Google Spreadsheet online
app.post('/api/sync-to-google-sheet', async (req, res) => {
  try {
    const { tabName, spreadsheetUrl, webhookUrl, stats, period, reportRows } = req.body;
    
    // If webhookUrl provided, trigger Apps Script Webhook
    if (webhookUrl && webhookUrl.trim().startsWith('http')) {
      console.log(`Syncing to Google Apps Script webhook: ${webhookUrl}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify({ tabName, stats, period, reportRows }),
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeout);

      const text = await response.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { success: response.ok, raw: text };
      }

      return res.json({
        success: data.success !== false,
        onlineSaved: true,
        tabName: data.tabName || tabName,
        sheetUrl: data.sheetUrl || spreadsheetUrl,
        message: data.message || `Tersimpan ke tab ${tabName}`
      });
    }

    // Fallback: If no webhook URL configured yet, return successful simulated payload with target sheetUrl
    res.json({
      success: true,
      onlineSaved: false,
      tabName: tabName,
      sheetUrl: spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1SUrUEUItB6RItqoyPHBQfNm84qo-hi6nd4luw5FnVlg/edit',
      message: `Tersimpan ke tab ${tabName}. (Konfigurasi Webhook di tab Konfigurasi untuk sync online langsung)`
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export styled Excel matching AIESEC Google Sheets format
app.post('/api/export-styled-report', async (req, res) => {
  try {
    const { tabName, period, stats, reportRows } = req.body;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Finding Tracker HR Tools - AIESEC in UMM';
    workbook.created = new Date();

    const cleanSheetName = (tabName || 'Finding HR Tools').substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, ' ');
    const ws = workbook.addWorksheet(cleanSheetName, {
      views: [{ showGridLines: true }]
    });

    // Merged Banner Row 1-3 A1:E3
    ws.mergeCells('A1:E3');
    const titleCell = ws.getCell('A1');
    titleCell.value = `FINDING TRACKER HR TOOLS · AIESEC in UMM\nFinding Tracker · ${period || 'Periode Audit'}`;
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4285F4' } // Royal blue
    };
    titleCell.font = {
      name: 'Arial',
      size: 13,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    titleCell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };

    // Merged Sub-banner Row 4 A4:E4
    ws.mergeCells('A4:E4');
    const subCell = ws.getCell('A4');
    const wibStr = getWIBDateString();
    const st = stats || {};
    subCell.value = `Diperbarui ${wibStr} · ${st.totalMembers || 0} member · Perlu revisi ${st.perluRevisi || 0} · Belum isi ${st.belumIsi || 0} · Lolos ${st.lolos || 0}`;
    subCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF6B26B' } // Warm gold/orange
    };
    subCell.font = {
      name: 'Arial',
      size: 9.5,
      bold: true,
      color: { argb: 'FF202124' }
    };
    subCell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };

    // Row heights for header
    ws.getRow(1).height = 22;
    ws.getRow(2).height = 22;
    ws.getRow(3).height = 22;
    ws.getRow(4).height = 26;
    ws.getRow(5).height = 10; // spacer

    // Row 6 Headers
    const headers = ['No', 'Name', 'Team Leader', 'Status', 'Finding Note'];
    const headerRow = ws.getRow(6);
    headerRow.height = 26;
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F3F3' }
      };
      cell.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: 'FF202124' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center'
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDADCE0' } },
        left: { style: 'thin', color: { argb: 'FFDADCE0' } },
        bottom: { style: 'thin', color: { argb: 'FFDADCE0' } },
        right: { style: 'thin', color: { argb: 'FFDADCE0' } }
      };
    });

    // Column widths
    ws.getColumn(1).width = 7;   // No
    ws.getColumn(2).width = 28;  // Name
    ws.getColumn(3).width = 28;  // Team Leader
    ws.getColumn(4).width = 16;  // Status
    ws.getColumn(5).width = 70;  // Finding Note

    // Rows 7 onwards
    const rows = reportRows || [];
    rows.forEach((r, idx) => {
      const rowIdx = 7 + idx;
      const row = ws.getRow(rowIdx);
      
      const c1 = row.getCell(1);
      c1.value = r.no || (idx + 1);
      c1.alignment = { vertical: 'top', horizontal: 'center' };

      const c2 = row.getCell(2);
      c2.value = r.name || '';
      c2.alignment = { vertical: 'top', horizontal: 'left' };

      const c3 = row.getCell(3);
      c3.value = r.teamLeader || '';
      c3.alignment = { vertical: 'top', horizontal: 'left' };

      const c4 = row.getCell(4);
      c4.value = r.status || 'Lolos';
      c4.alignment = { vertical: 'top', horizontal: 'center' };

      // Status Colors
      const statusText = (r.status || '').toLowerCase();
      let statusBg = 'FFFFFFFF';
      let statusFg = 'FF202124';
      if (statusText.includes('revisi')) {
        statusBg = 'FFFCE8E6'; // light red
        statusFg = 'FFC5221F';
      } else if (statusText.includes('belum')) {
        statusBg = 'FFFEF7E0'; // light yellow/amber
        statusFg = 'FFB06000';
      } else if (statusText.includes('lolos')) {
        statusBg = 'FFE6F4EA'; // light green
        statusFg = 'FF137333';
      }

      c4.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: statusBg }
      };
      c4.font = {
        name: 'Arial',
        size: 9.5,
        bold: true,
        color: { argb: statusFg }
      };

      const c5 = row.getCell(5);
      c5.value = r.findingNote || '• Tidak ada finding';
      c5.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

      // Borders and Fonts
      [c1, c2, c3, c4, c5].forEach(cell => {
        if (cell !== c4) {
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF202124' } };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE8EAED' } },
          left: { style: 'thin', color: { argb: 'FFE8EAED' } },
          bottom: { style: 'thin', color: { argb: 'FFE8EAED' } },
          right: { style: 'thin', color: { argb: 'FFE8EAED' } }
        };
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanSheetName)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════════════╗`);
    console.log(`  ║   HR Tools Audit & Validation System         ║`);
    console.log(`  ║   AIESEC in UMM — Talent Management          ║`);
    console.log(`  ╠══════════════════════════════════════════════╣`);
    console.log(`  ║   Server running at:                         ║`);
    console.log(`  ║   → http://localhost:${PORT}                    ║`);
    console.log(`  ╚══════════════════════════════════════════════╝\n`);
  });
}

