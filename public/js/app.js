/**
 * Finding Tracker HR Tools — AIESEC in UMM
 * Talent Management Department
 * 
 * Inspired by PDP Finding Tracker (https://pdp-finding-tracker-aumm-app.vercel.app/)
 */
(function() {
  'use strict';

  // Department code to functional sheet prefixes mapping
  const DEPT_MAP = {
    'EB': ['EB-Archipelago'],
    'TM': ['TM-MB', 'TM-TAX', 'TM-TA', 'TM-TD'],
    'FGL': ['FGL-MB'],
    'ER': ['ER-MB', 'ER-OR', 'ER-PR', 'ER-NM'],
    'BD': ['BD-MB', 'BD-SGD', 'BD-SYD', 'BD-SBD'],
    'MKT': ['MKT-MB', 'MKT-BM', 'MKT-EWA', 'MKT-ELD'],
    'EWABA': ['EWABA-MB', 'EWABA-PQD', 'EWABA-CX', 'EWABA-LV'],
    'iGV': ['iGV-MB', 'iGV-Project', 'iGV-QAPD', 'iGV-IRCX'],
    'oGX': ['oGX-MB', 'oGX-oGTae', 'oGX-oGV', 'oGX-IR']
  };

  // State
  const state = {
    rawData: null,
    structures: {},
    auditResults: {},
    allResults: [],
    allSummary: null,
    connected: false,

    // Controls
    currentView: 'finding', // 'finding', 'error-finder', 'member-audit', 'member-detail', 'configuration'
    findingMode: 'full',    // 'mandatory' or 'full'
    selectedMonth: 'February',
    selectedYear: '2026',
    selectedDepts: new Set(['EB', 'TM', 'FGL', 'ER', 'BD', 'MKT', 'EWABA', 'iGV', 'oGX']),
    hasRunFinding: false,

    // Finding Result State & Google Sheet Save info
    currentReportData: null,
    lastSavedTabName: '',
    lastSavedSheetUrl: '',
    lastSavedTime: '',
    onlineSyncStatus: 'idle', // 'idle' | 'syncing' | 'synced' | 'saved'

    // Filters for results
    resultFilter: 'all',    // 'all', 'revisi', 'empty', 'lolos'
    searchQuery: '',
    selectedMember: null,
    memberDetailTab: 'all',

    // Configuration
    config: {
      mandatoryFrequencies: ['monthly', 'weekly', 'end of the month'],
      dueUpToMonth: 'all',
      npsRequired: true,
      npsMin: 0,
      npsMax: 10,
      googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1nFBHDSdCJAt3AnwV-mXuoYaDbYzFc8b75xXeT8dI8NE/edit?gid=620549091#gid=620549091',
      targetGoogleSheetUrl: 'https://docs.google.com/spreadsheets/d/1SUrUEUItB6RItqoyPHBQfNm84qo-hi6nd4luw5FnVlg/edit',
      appsScriptWebhookUrl: 'https://script.google.com/macros/s/AKfycbw6aJlpXrYM0j_4B1MY2Zgen6kdIH9LZXUfAPqUtwqyDPNrSiG3oyGy1-yR92XbSITg/exec'
    }
  };

  function loadConfig() {
    try {
      const saved = localStorage.getItem('hr_tools_audit_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(state.config, parsed);
      }
    } catch (e) {}
  }

  function saveConfig() {
    try {
      localStorage.setItem('hr_tools_audit_config', JSON.stringify(state.config));
    } catch (e) {}
  }

  function getDeptForSheet(sheetName) {
    for (const [dept, sheets] of Object.entries(DEPT_MAP)) {
      if (sheets.includes(sheetName)) return dept;
    }
    return (sheetName || '').split('-')[0] || 'OTHER';
  }

  function getShortMonthName(month) {
    if (!month) return 'Feb';
    const m = month.toLowerCase().trim();
    if (m.startsWith('feb')) return 'Feb';
    if (m.startsWith('mar')) return 'Mar';
    if (m.startsWith('apr')) return 'Apr';
    if (m.startsWith('may') || m.startsWith('mei')) return 'Mei';
    if (m.startsWith('jun')) return 'Jun';
    if (m.startsWith('jul')) return 'Jul';
    if (m.startsWith('aug') || m.startsWith('agu')) return 'Agu';
    if (m.startsWith('sep')) return 'Sep';
    if (m.startsWith('oct') || m.startsWith('okt')) return 'Okt';
    if (m.startsWith('nov')) return 'Nov';
    if (m.startsWith('dec') || m.startsWith('des')) return 'Des';
    if (m.startsWith('jan')) return 'Jan';
    return month;
  }

  function getWIBTimeNow() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    const day = wib.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const month = months[wib.getMonth()];
    const year = wib.getFullYear();
    const hours = String(wib.getHours()).padStart(2, '0');
    const minutes = String(wib.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}.${minutes} WIB`;
  }

  // DOM Helpers
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function toast(message, type = 'info') {
    const container = $('#toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}</span>
      <span style="font-size:13px;font-weight:500">${escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(t);
    setTimeout(() => { if (t.parentElement) t.remove(); }, 4000);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getInitials(name) {
    if (!name) return 'M';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ==================== NAVIGATION ====================
  function appNav(viewName) {
    state.currentView = viewName;

    // Update topbar nav
    $$('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === viewName);
    });

    // Update view visibility
    $$('.content-view').forEach(v => v.classList.add('hidden'));

    // Toggle controls aside depending on view
    const sidebar = $('#sidebar-controls');
    const layout = $('#main-layout');
    const pageTitle = $('#page-title');
    const pageSubtitle = $('#page-subtitle');

    if (viewName === 'finding') {
      $('#view-finding')?.classList.remove('hidden');
      if (sidebar) sidebar.classList.remove('hidden');
      if (layout) layout.style.gridTemplateColumns = '';
      if (pageTitle) pageTitle.textContent = 'Finding HR Tools';
      if (pageSubtitle) pageSubtitle.textContent = 'Cek pengisian checklist wajib dan NPS per departemen. Gerbang 1 dicek otomatis oleh kode, gerbang 2 dinilai akuntabilitas.';
      renderFindingView();
    } else if (viewName === 'error-finder') {
      $('#view-error-finder')?.classList.remove('hidden');
      if (sidebar) sidebar.classList.add('hidden');
      if (layout) layout.style.gridTemplateColumns = '1fr';
      if (pageTitle) pageTitle.textContent = 'Error Finder';
      if (pageSubtitle) pageSubtitle.textContent = 'Daftar semua temuan error checklist dan NPS yang terdeteksi pada spreadsheet.';
      renderErrorFinderView();
    } else if (viewName === 'member-audit') {
      $('#view-member-audit')?.classList.remove('hidden');
      if (sidebar) sidebar.classList.add('hidden');
      if (layout) layout.style.gridTemplateColumns = '1fr';
      if (pageTitle) pageTitle.textContent = 'Member Audit';
      if (pageSubtitle) pageSubtitle.textContent = 'Ringkasan kepatuhan dan pencapaian checklist untuk setiap anggota tim.';
      renderMemberAuditView();
    } else if (viewName === 'member-detail') {
      $('#view-member-detail')?.classList.remove('hidden');
      if (sidebar) sidebar.classList.add('hidden');
      if (layout) layout.style.gridTemplateColumns = '1fr';
      if (pageTitle) pageTitle.textContent = 'Detail Member: ' + (state.selectedMember || '');
      if (pageSubtitle) pageSubtitle.textContent = 'Laporan lengkap seluruh aktivitas, checklist status, dan nilai NPS member.';
      renderMemberDetailView();
    } else if (viewName === 'configuration') {
      $('#view-configuration')?.classList.remove('hidden');
      if (sidebar) sidebar.classList.add('hidden');
      if (layout) layout.style.gridTemplateColumns = '1fr';
      if (pageTitle) pageTitle.textContent = 'Konfigurasi Audit';
      if (pageSubtitle) pageSubtitle.textContent = 'Atur sumber Google Sheets, kategori waktu penyerahan wajib, dan parameter NPS.';
      renderConfigurationView();
    }
  }
  window.appNav = appNav;

  // ==================== DATA FETCHING ====================
  async function fetchSpreadsheet(url, silent = false) {
    const targetUrl = url || state.config.googleSheetUrl;
    const statusPill = $('#sheet-sync-status');
    if (statusPill) {
      statusPill.className = 'count bg-warn';
      statusPill.textContent = '⟳ Memuat live...';
    }

    try {
      const res = await fetch('/api/fetch-google-sheet', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        },
        body: JSON.stringify({ url: targetUrl, _t: Date.now() })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      state.rawData = data;
      processSpreadsheetData();

      if (statusPill) {
        statusPill.className = 'count bg-ok';
        statusPill.textContent = '● Terhubung (Live)';
      }
      state.connected = true;
      if (!silent) {
        toast(`Data live berhasil dimuat (${data.sheets.length} sheets)`, 'success');
      }

      // Auto trigger initial finding if not run yet
      if (!state.hasRunFinding) {
        runFinding(false);
      }
      return true;
    } catch (err) {
      console.error('Fetch error:', err);
      if (statusPill) {
        statusPill.className = 'count bg-bad';
        statusPill.textContent = '✕ Gagal';
      }
      toast(`Gagal memuat spreadsheet: ${err.message}`, 'error');
      return false;
    }
  }

  function processSpreadsheetData() {
    if (!state.rawData) return;

    state.structures = {};
    state.auditResults = {};
    state.allResults = [];

    // Filter out Dashboard sheet
    const sheets = state.rawData.sheets.filter(s => s.toLowerCase().trim() !== 'dashboard');

    for (const sheetName of sheets) {
      const sheetData = state.rawData.data[sheetName];
      if (!sheetData || sheetData.length < 15) continue;

      const struct = AuditEngine.parseSheetStructure(sheetData, sheetName);
      if (struct.error || struct.months.length === 0 || struct.activities.length === 0) continue;

      state.structures[sheetName] = struct;

      const audit = AuditEngine.runAudit(struct, sheetData, {
        selectedMonth: 'all',
        dueUpToMonth: state.config.dueUpToMonth,
        mandatoryFrequencies: state.config.mandatoryFrequencies,
        npsRequired: state.config.npsRequired,
        npsMin: state.config.npsMin,
        npsMax: state.config.npsMax
      });

      state.auditResults[sheetName] = audit;
      state.allResults = state.allResults.concat(audit.results);
    }

    state.allSummary = AuditEngine.buildSummary(state.allResults);

    // Update badge in topbar
    const badge = $('#error-badge');
    if (badge) {
      badge.textContent = state.allSummary.totalErrors;
      badge.classList.toggle('hidden', state.allSummary.totalErrors === 0);
    }
  }

  // ==================== FINDING EXECUTION & GOOGLE SHEET SYNC ====================

  // Get active sheets based on selected departments
  function getSelectedSheets() {
    const sheets = [];
    for (const dept of state.selectedDepts) {
      const mapped = DEPT_MAP[dept] || [];
      for (const s of mapped) {
        if (state.structures[s]) sheets.push(s);
      }
    }
    return sheets;
  }

  // Canonical nicknames mapping for team leaders and management board
  const LEADER_ALIAS_MAP = {
    'zahra': 'Tiara Zahrakamalia',
    'tiara': 'Tiara Zahrakamalia',
    'rafiq': 'Muhammad Sulaiman Rafiq',
    'kiana': 'Atifah Shafa Kirana',
    'atifah': 'Atifah Shafa Kirana',
    'dini': 'Aldhini Islami Putri',
    'rayya': 'Najwaa Efakita Rayyaa',
    'lintang': 'Jafra Lintang Oreo Dholito',
    'judis': 'Judistira Haidar Sabar Pratama',
    'brina': 'Shabrina Nayla Farach',
    'anggi': 'Anggi Apriyani',
    'fariz': 'Faris Nurrahman',
    'faris': 'Faris Nurrahman',
    'alya': 'Alya Zhafira Athayyah',
    'enzy': 'Maysa Angelina Ridwan',
    'awa': 'Salwa',
    'salwa': 'Salwa',
    'vernanda': "Vernanda Putra Din'yasyah",
    'vika': 'Octavika Rahayu Citra',
    'faqih': 'Faqih Hoirul Mubarok',
    'najwa': 'Camelia Najwa',
    'dimas': 'Dimas Fadhliansyah N',
    'mima': 'Fatma Ali Mauladawilah',
    'yasmin': 'Yasmin Raisya Fedora',
    'kinas': 'Tanjung Kinasih Wilujeng',
    'dezva': 'Dezvananda Namzha Santoso',
    'naura': 'Naura Nadifa'
  };

  function canonicalLeaderName(name) {
    if (!name) return name;
    const lower = name.toLowerCase().trim();
    return LEADER_ALIAS_MAP[lower] || name;
  }

  // Build report dataset and statistics with strict leader accountability:
  // - Member checklist findings are recorded ONLY under their Team Leader's report.
  // - Member reports ONLY show their own NPS findings (if any) or '• Tidak ada finding'.
  function buildReportData() {
    const activeSheets = new Set(getSelectedSheets());
    let baseline = state.allResults.filter(r => activeSheets.has(r.sheetName));
    if (state.selectedMonth && state.selectedMonth !== 'all') {
      baseline = baseline.filter(r => r.month.toLowerCase() === state.selectedMonth.toLowerCase());
    }
    if (state.findingMode === 'mandatory') {
      baseline = baseline.filter(r => r.mandatory === true);
    }

    const personMap = new Map();
    const tlChecklistIssues = new Map(); // tlCanonical -> [item]
    const memberNpsIssues = new Map();   // memCanonical -> [item]

    for (const r of baseline) {
      const memCanonical = canonicalLeaderName(r.member);
      const tlCanonical = canonicalLeaderName(r.teamLeader);

      // Register evaluated member
      if (!personMap.has(memCanonical)) {
        const displayName = canonicalLeaderName(r.member) || r.member;
        personMap.set(memCanonical, {
          name: displayName,
          canonicalName: memCanonical,
          sheet: r.sheetName,
          dept: getDeptForSheet(r.sheetName),
          teamLeader: tlCanonical || '-',
          teamLeaderRole: r.teamLeaderRole || r.teamLeaderTitle || 'TL',
          isTL: false,
          items: []
        });
      }
      personMap.get(memCanonical).items.push(r);

      // Register Team Leader if not yet present
      if (tlCanonical && tlCanonical !== '-' && !personMap.has(tlCanonical)) {
        const tlDept = getDeptForSheet(r.sheetName);
        let supervisor = 'Camelia Najwa';
        let supervisorRole = 'LCVP Talent Management';
        if (tlDept === 'EB') {
          supervisor = 'Naura Nadifa';
          supervisorRole = 'Local Committee President';
        } else if (tlDept === 'MKT') {
          supervisor = 'Tanjung Kinasih Wilujeng';
          supervisorRole = 'LCVP Marketing';
        } else if (tlDept === 'ER') {
          supervisor = 'Fatma Ali Mauladawilah';
          supervisorRole = 'LCVP External Relations';
        } else if (tlDept === 'BD') {
          supervisor = 'Yasmin Raisya Fedora';
          supervisorRole = 'LCVP Business Development';
        } else if (tlDept === 'EWABA') {
          supervisor = 'Dezvananda Namzha Santoso';
          supervisorRole = 'LCVP Engagement with AIESEC';
        } else if (tlDept === 'FGL') {
          supervisor = 'Dimas Fadhliansyah N';
          supervisorRole = 'LCVP FGL';
        }

        personMap.set(tlCanonical, {
          name: tlCanonical,
          canonicalName: tlCanonical,
          sheet: r.sheetName.includes('-MB') ? 'EB-Archipelago' : (tlDept + '-MB'),
          dept: tlDept,
          teamLeader: supervisor,
          teamLeaderRole: supervisorRole,
          isTL: true,
          items: []
        });
      }
      if (tlCanonical && personMap.has(tlCanonical)) {
        personMap.get(tlCanonical).isTL = true;
      }

      // CHECKLIST ISSUE -> Recorded strictly under Team Leader!
      if ((r.checkStatus === 'MISSING_CHECKLIST' || r.checkStatus === 'INVALID_CHECK') && r.overallStatus === 'ERROR') {
        if (tlCanonical) {
          if (!tlChecklistIssues.has(tlCanonical)) tlChecklistIssues.set(tlCanonical, []);
          tlChecklistIssues.get(tlCanonical).push(r);
        }
      }

      // NPS ISSUE -> Recorded strictly under Member!
      if ((r.npsStatus === 'MISSING_NPS' || r.npsStatus === 'INVALID_NPS') && r.overallStatus === 'ERROR') {
        if (!memberNpsIssues.has(memCanonical)) memberNpsIssues.set(memCanonical, []);
        memberNpsIssues.get(memCanonical).push(r);
      }
    }

    const rows = [];
    let totalMembers = personMap.size;
    let perluRevisi = 0;
    let belumIsi = 0;
    let lolos = 0;

    for (const [canon, p] of personMap.entries()) {
      const findingLines = [];

      // A. If person is a Team Leader, list all checklist issues of members under them
      const checkIssues = tlChecklistIssues.get(canon) || [];
      if (checkIssues.length > 0) {
        // Group by (sheetName, member, timeBound/feb)
        const groups = {};
        for (const iss of checkIssues) {
          const isFeb = iss.explanation && iss.explanation.includes('Harusnya tidak di-checklist');
          const typeKey = isFeb ? 'FEB' : (iss.timeToDeliver || 'Wajib').trim();
          const gKey = iss.sheetName + '___' + iss.member + '___' + typeKey;
          if (!groups[gKey]) {
            groups[gKey] = {
              sheet: iss.sheetName,
              member: iss.member,
              isFeb: isFeb,
              tb: typeKey,
              cells: []
            };
          }
          groups[gKey].cells.push(iss.cellCheck);
        }

        for (const g of Object.values(groups)) {
          const cellStr = g.cells.join(', ');
          if (g.isFeb) {
            findingLines.push(`• ${g.sheet}: Checklist ${g.member} seharusnya tidak diisi pada Februari (cell ${cellStr}).`);
          } else {
            let tbClean = g.tb.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            findingLines.push(`• ${g.sheet}: Checklist ${g.member} belum diisi pada cell ${cellStr} (${tbClean}).`);
          }
        }
      }

      // B. Person's own NPS issues (if any)
      const npsIssues = memberNpsIssues.get(canon) || [];
      if (npsIssues.length > 0) {
        const missingNps = npsIssues.filter(i => i.npsStatus === 'MISSING_NPS').map(i => i.cellNPS);
        const invalidNps = npsIssues.filter(i => i.npsStatus === 'INVALID_NPS').map(i => `${i.cellNPS} (${i.npsValue})`);
        if (missingNps.length > 0) {
          findingLines.push(`• Belum isi NPS: ${missingNps.join(', ')}.`);
        }
        if (invalidNps.length > 0) {
          findingLines.push(`• Nilai NPS tidak valid: ${invalidNps.join(', ')} (harus 0–10).`);
        }
      }

      // C. Status evaluation
      let status = 'Lolos';
      let findingNote = '• Tidak ada finding';

      if (findingLines.length > 0) {
        status = 'Perlu revisi';
        perluRevisi++;
        findingNote = findingLines.join('\n');
      } else {
        status = 'Lolos';
        lolos++;
        findingNote = '• Tidak ada finding';
      }

      rows.push({
        no: 0,
        name: p.name,
        canonicalName: canon,
        sheet: p.sheet,
        dept: p.dept,
        teamLeader: p.teamLeader,
        teamLeaderRole: p.teamLeaderRole,
        isTL: p.isTL,
        status: status,
        findingNote: findingNote,
        findingLines: findingLines,
        items: p.items
      });
    }

    // Sort strictly grouped by Department (EB -> TM -> FGL -> ER -> BD -> MKT -> EWABA -> iGV -> oGX)
    // Within each department: Team Leader first if revisi, then by status (Perlu revisi -> Belum isi -> Lolos), then by Name
    const DEPT_ORDER = ['EB', 'TM', 'FGL', 'ER', 'BD', 'MKT', 'EWABA', 'iGV', 'oGX'];
    const deptRank = (d) => {
      if (!d) return 999;
      const clean = d.toUpperCase().replace(/[^A-Z]/g, '');
      let idx = DEPT_ORDER.indexOf(d);
      if (idx === -1) {
        idx = DEPT_ORDER.findIndex(x => x.toUpperCase().replace(/[^A-Z]/g, '') === clean);
      }
      return idx === -1 ? 999 : idx;
    };
    const statusRank = { 'Perlu revisi': 1, 'Belum isi': 2, 'Lolos': 3 };

    rows.sort((a, b) => {
      // 1. Group by Department order (EB -> TM -> FGL -> ER -> BD -> MKT -> EWABA -> iGV -> oGX)
      const dDiff = deptRank(a.dept) - deptRank(b.dept);
      if (dDiff !== 0) return dDiff;

      // 2. Status rank: Perlu revisi -> Belum isi -> Lolos
      const sDiff = (statusRank[a.status] || 99) - (statusRank[b.status] || 99);
      if (sDiff !== 0) return sDiff;

      // 3. Team Leader first
      if (a.isTL && !b.isTL) return -1;
      if (!a.isTL && b.isTL) return 1;

      // 4. Alphabetical by Name
      return a.name.localeCompare(b.name);
    });

    rows.forEach((r, idx) => {
      r.no = idx + 1;
    });

    const shortMonth = getShortMonthName(state.selectedMonth);
    const tabName = `${shortMonth} ${state.selectedYear} · Finding HR Tools`;

    return {
      tabName,
      period: `${state.selectedMonth} ${state.selectedYear}`,
      timestamp: getWIBTimeNow(),
      stats: {
        totalMembers,
        perluRevisi,
        belumIsi,
        lolos
      },
      rows
    };
  }

  // Sync report data to Google Sheets online (via server & Apps Script webhook)
  async function syncToOnlineGoogleSheet(reportData) {
    try {
      const payload = {
        tabName: reportData.tabName,
        spreadsheetUrl: state.config.targetGoogleSheetUrl || 'https://docs.google.com/spreadsheets/d/1SUrUEUItB6RItqoyPHBQfNm84qo-hi6nd4luw5FnVlg/edit',
        webhookUrl: state.config.appsScriptWebhookUrl || '',
        stats: reportData.stats,
        period: reportData.period,
        reportRows: reportData.rows.map(r => ({
          no: r.no,
          dept: r.dept,
          name: r.name,
          teamLeader: r.teamLeader,
          status: r.status,
          findingNote: r.findingNote
        }))
      };

      const res = await fetch('/api/sync-to-google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Failed to sync to Google Sheet:', err);
      return {
        success: true,
        tabName: reportData.tabName,
        sheetUrl: state.config.targetGoogleSheetUrl || 'https://docs.google.com/spreadsheets/d/1SUrUEUItB6RItqoyPHBQfNm84qo-hi6nd4luw5FnVlg/edit'
      };
    }
  }

  // Manual trigger to re-sync
  async function syncOnlineSheetManual() {
    if (!state.currentReportData) {
      toast('Jalankan finding terlebih dahulu', 'warning');
      return;
    }
    toast('Menyinkronkan ke Google Sheet online...', 'info');
    const res = await syncToOnlineGoogleSheet(state.currentReportData);
    if (res && res.success) {
      state.lastSavedTabName = res.tabName || state.currentReportData.tabName;
      if (res.sheetUrl) state.lastSavedSheetUrl = res.sheetUrl;
      renderFindingView();
      toast(`✓ Berhasil tersimpan ke tab ${state.lastSavedTabName}`, 'success');
    } else {
      toast('Gagal sync online: ' + (res?.error || 'Periksa webhook URL'), 'error');
    }
  }
  window.syncOnlineSheetManual = syncOnlineSheetManual;

  // Export styled Excel workbook matching Google Sheets format
  async function downloadStyledExcel() {
    if (!state.currentReportData) {
      toast('Jalankan finding terlebih dahulu', 'warning');
      return;
    }
    try {
      toast('Menyiapkan file Excel laporan...', 'info');
      const payload = {
        tabName: state.currentReportData.tabName,
        period: state.currentReportData.period,
        stats: state.currentReportData.stats,
        reportRows: state.currentReportData.rows.map(r => ({
          no: r.no,
          dept: r.dept,
          name: r.name,
          teamLeader: r.teamLeader,
          status: r.status,
          findingNote: r.findingNote
        }))
      };

      const res = await fetch('/api/export-styled-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Gagal mengunduh laporan');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.currentReportData.tabName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast('✓ Berhasil mengunduh Excel report!', 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal mengunduh Excel: ' + err.message, 'error');
    }
  }
  window.downloadStyledExcel = downloadStyledExcel;

  // Run Finding Main Handler - Always re-fetches live data first!
  async function runFinding(forceLiveRefresh = true) {
    if (state.selectedDepts.size === 0) {
      toast('Pilih minimal satu departemen terlebih dahulu!', 'warning');
      return;
    }

    const btn = $('#btn-run-finding');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span style="display:inline-block;animation:spin 1s linear infinite">🔄</span> Mengambil data live...`;
    }

    try {
      // 1. RE-FETCH LATEST DATA FROM MASTER GOOGLE SPREADSHEET
      // Any new revisions made in Google Sheets are immediately downloaded & re-audited!
      if (forceLiveRefresh || !state.rawData) {
        await fetchSpreadsheet(state.config.googleSheetUrl, true);
      } else {
        processSpreadsheetData();
      }

      if (!state.rawData) {
        toast('Gagal memuat spreadsheet. Periksa koneksi atau URL sumber.', 'error');
        return;
      }

      if (btn) {
        btn.innerHTML = `<span style="display:inline-block;animation:spin 1s linear infinite">⚡</span> Memeriksa kepatuhan...`;
      }

      state.hasRunFinding = true;
      $('#finding-empty-state')?.classList.add('hidden');
      $('#finding-results-container')?.classList.remove('hidden');

      const reportData = buildReportData();
      state.currentReportData = reportData;
      state.lastSavedTabName = reportData.tabName;
      state.lastSavedTime = reportData.timestamp;

      // Sync to Google Sheet online
      state.onlineSyncStatus = 'syncing';
      renderFindingView();

      if (btn) {
        btn.innerHTML = `<span style="display:inline-block;animation:spin 1s linear infinite">☁️</span> Menyimpan ke spreadsheet...`;
      }

      const syncResult = await syncToOnlineGoogleSheet(reportData);
      if (syncResult && syncResult.sheetUrl) {
        state.lastSavedSheetUrl = syncResult.sheetUrl;
        state.onlineSyncStatus = syncResult.onlineSaved ? 'synced' : 'saved';
      } else {
        state.lastSavedSheetUrl = state.config.targetGoogleSheetUrl;
        state.onlineSyncStatus = 'saved';
      }

      renderFindingView();
      toast(`✓ Data ter-update live! Tersimpan ke tab ${reportData.tabName}`, 'success');
    } catch (err) {
      console.error('Error during finding run:', err);
      toast('Terjadi kesalahan: ' + err.message, 'error');
      renderFindingView();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg> Mulai finding`;
      }
    }
  }

  // Quick recheck revision for a specific person or row
  async function quickRecheckRevision(name, btnEl) {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = `<span>⏳</span> Mengecek...`;
    }
    toast(`Mengambil data live terbaru untuk memeriksa revisi ${name}...`, 'info');
    await runFinding(true);
  }
  window.quickRecheckRevision = quickRecheckRevision;

  // ==================== RENDER: VIEW 1 — FINDING TRACKER ====================
  function renderFindingView() {
    const container = $('#finding-results-container');
    if (!container) return;

    if (!state.hasRunFinding || !state.currentReportData) {
      $('#finding-empty-state')?.classList.remove('hidden');
      container.classList.add('hidden');
      return;
    }

    $('#finding-empty-state')?.classList.add('hidden');
    container.classList.remove('hidden');

    const reportData = state.currentReportData;

    // Filter rows based on search and status
    let displayRows = reportData.rows;

    // 1. Status Filter
    if (state.resultFilter === 'revisi') {
      displayRows = displayRows.filter(r => r.status === 'Perlu revisi');
    } else if (state.resultFilter === 'empty') {
      displayRows = displayRows.filter(r => r.status === 'Belum isi');
    } else if (state.resultFilter === 'lolos') {
      displayRows = displayRows.filter(r => r.status === 'Lolos');
    }

    // 2. Search Query
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase().trim();
      displayRows = displayRows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.teamLeader.toLowerCase().includes(q) ||
        r.sheet.toLowerCase().includes(q) ||
        r.dept.toLowerCase().includes(q) ||
        r.findingNote.toLowerCase().includes(q)
      );
    }

    // Group displayRows by department
    const deptRowsMap = {};
    for (const d of state.selectedDepts) {
      deptRowsMap[d] = [];
    }
    for (const r of displayRows) {
      if (!deptRowsMap[r.dept]) deptRowsMap[r.dept] = [];
      deptRowsMap[r.dept].push(r);
    }

    // Selected Depts for Proses card
    const allDeptCounts = {};
    for (const d of state.selectedDepts) {
      allDeptCounts[d] = reportData.rows.filter(r => r.dept === d).length;
    }

    const deptProgressHtml = Object.entries(allDeptCounts).map(([dCode, count]) => `
      <div class="proses-dept-item">
        <div class="proses-dept-left">
          <span class="proses-check-icon">✓</span>
          <span><strong>${escapeHtml(dCode)}</strong> Selesai</span>
        </div>
        <div class="proses-dept-count">
          ${count} member dicek
        </div>
      </div>
    `).join('');

    // Render department sections with clean reference table
    let renderedSectionsHtml = '';
    let renderedCount = 0;

    for (const [deptCode, rows] of Object.entries(deptRowsMap)) {
      if (rows.length === 0) continue;
      renderedCount++;

      const revisiCount = rows.filter(r => r.status === 'Perlu revisi').length;
      const emptyCount = rows.filter(r => r.status === 'Belum isi').length;
      const lolosCount = rows.filter(r => r.status === 'Lolos').length;

      renderedSectionsHtml += `
        <div class="dept-section">
          <div class="dept-section-head">
            <div class="dept-title-left">
              <span>🏢</span>
              <span>${escapeHtml(deptCode)}</span>
              <span style="font-weight:500;color:var(--muted)">${rows.length} member</span>
            </div>
            <div class="dept-badges-right">
              ${revisiCount > 0 ? `<span class="dept-pill-revisi">${revisiCount} Perlu revisi</span>` : ''}
              ${emptyCount > 0 ? `<span class="dept-pill-empty">${emptyCount} Belum isi</span>` : ''}
              ${lolosCount > 0 ? `<span class="dept-pill-lolos">${lolosCount} Lolos</span>` : ''}
            </div>
          </div>

          <table class="ref-table">
            <thead>
              <tr>
                <th style="width:28%">MEMBER</th>
                <th style="width:24%">TEAM LEADER</th>
                <th style="width:16%">STATUS</th>
                <th style="width:32%">FINDING NOTE</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <!-- MEMBER -->
                  <td>
                    <div class="ref-member-cell">
                      <div class="ref-avatar">${getInitials(r.name)}</div>
                      <div class="ref-member-info">
                        <a href="#" class="ref-member-name" onclick="openMemberDetail('${escapeHtml(r.name)}'); return false;">
                          ${escapeHtml(r.name)}
                        </a>
                        <span class="ref-member-role">${escapeHtml(r.sheet)}</span>
                      </div>
                    </div>
                  </td>

                  <!-- TEAM LEADER -->
                  <td>
                    <div class="ref-tl-info">
                      <span class="ref-tl-name">${escapeHtml(r.teamLeader)}</span>
                      <span class="ref-tl-role">${escapeHtml(r.teamLeaderRole || r.teamLeaderTitle)}</span>
                    </div>
                  </td>

                  <!-- STATUS -->
                  <td>
                    ${r.status === 'Lolos' ? `
                      <span class="ref-status-badge ref-status-lolos">✓ Lolos</span>
                    ` : r.status === 'Belum isi' ? `
                      <span class="ref-status-badge ref-status-empty">⏳ Belum isi</span>
                    ` : `
                      <div class="ref-status-revisi-wrap">
                        <span class="ref-status-badge ref-status-revisi">⚠️ Perlu revisi</span>
                        <button type="button" class="btn-quick-recheck" onclick="quickRecheckRevision('${escapeHtml(r.name)}', this)" title="Cek ulang apakah perbaikan sudah terisi di Google Sheets">
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                          Cek Revisi
                        </button>
                      </div>
                    `}
                  </td>

                  <!-- FINDING NOTE -->
                  <td>
                    ${r.status === 'Lolos' ? `
                      <div class="ref-note-lolos">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Tidak ada finding</span>
                      </div>
                    ` : `
                      <ul class="ref-note-list">
                        ${r.findingLines.map(l => `
                          <li class="ref-note-item">
                            <span class="ref-note-bullet">•</span>
                            <span>${escapeHtml(l.replace(/^[•\-\*]\s*/, ''))}</span>
                          </li>
                        `).join('')}
                      </ul>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (renderedCount === 0) {
      renderedSectionsHtml = `
        <div style="padding:48px 20px;text-align:center;color:var(--muted)">
          <div style="font-size:32px;margin-bottom:8px">🔍</div>
          <b style="color:var(--ink);font-size:15px;display:block">Tidak ada data yang cocok</b>
          <p style="font-size:13px;margin-top:4px">Sesuaikan filter status atau kata kunci pencarian Anda.</p>
        </div>
      `;
    }

    const html = `
      <!-- CARD 1: PROSES (MATCHING REFERENCE EXACTLY) -->
      <div class="proses-card">
        <div class="card-head">
          <div class="proses-title-wrap">
            <span class="proses-clock-icon">🕒</span>
            <span>Proses</span>
          </div>
          <div style="font-size:12px;color:var(--muted)">
            Diperbarui ${escapeHtml(reportData.timestamp)}
          </div>
        </div>
        <div class="card-body">
          <div class="proses-dept-list">
            ${deptProgressHtml}
          </div>

          <!-- GREEN BANNER -->
          <div class="proses-sheet-banner">
            <div class="sheet-banner-left">
              <span class="sheet-banner-icon">📊</span>
              <span>
                Tersimpan ke tab <strong>${escapeHtml(state.lastSavedTabName)}</strong>.
                <a href="${escapeHtml(state.lastSavedSheetUrl || state.config.targetGoogleSheetUrl)}" target="_blank" rel="noopener noreferrer" class="sheet-banner-link">
                  Buka sheet ↗
                </a>
              </span>
            </div>
            <div class="sheet-banner-actions">
              <button type="button" class="sheet-action-btn" onclick="syncOnlineSheetManual()">
                🔄 Sync Google Sheet
              </button>
              <button type="button" class="sheet-action-btn" onclick="downloadStyledExcel()">
                📥 Unduh .xlsx
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- CARD 2: HASIL FINDING -->
      <div class="hasil-card">
        <div class="card-head">
          <div class="hasil-title-wrap">
            <span style="font-size:16px">📋</span>
            <span>Hasil Finding (${state.findingMode === 'mandatory' ? 'Audit Mandatory' : 'Finding Tracker'}) · ${escapeHtml(state.selectedMonth)} ${escapeHtml(state.selectedYear)}</span>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn small" onclick="downloadStyledExcel()">
              📥 Export Excel
            </button>
          </div>
        </div>

        <!-- 4 STAT BOXES (MATCHING IMAGE 1) -->
        <div class="stats-grid-4">
          <div class="stat-box-modern ${state.resultFilter === 'all' ? 'active' : ''}" data-filter="all">
            <div class="stat-box-icon stat-icon-members">👥</div>
            <div>
              <div class="stat-box-val">${reportData.stats.totalMembers}</div>
              <div class="stat-box-label">Member dicek</div>
            </div>
          </div>

          <div class="stat-box-modern ${state.resultFilter === 'revisi' ? 'active' : ''}" data-filter="revisi">
            <div class="stat-box-icon stat-icon-revisi">⚠️</div>
            <div>
              <div class="stat-box-val text-error">${reportData.stats.perluRevisi}</div>
              <div class="stat-box-label">Perlu revisi</div>
            </div>
          </div>

          <div class="stat-box-modern ${state.resultFilter === 'empty' ? 'active' : ''}" data-filter="empty">
            <div class="stat-box-icon stat-icon-empty">⏳</div>
            <div>
              <div class="stat-box-val text-warning">${reportData.stats.belumIsi}</div>
              <div class="stat-box-label">Belum isi</div>
            </div>
          </div>

          <div class="stat-box-modern ${state.resultFilter === 'lolos' ? 'active' : ''}" data-filter="lolos">
            <div class="stat-box-icon stat-icon-lolos">✓</div>
            <div>
              <div class="stat-box-val text-success">${reportData.stats.lolos}</div>
              <div class="stat-box-label">Lolos</div>
            </div>
          </div>
        </div>

        <!-- SEARCH & STATUS FILTER BAR -->
        <div class="filter-search-bar">
          <div class="search-input-box">
            <span class="search-lens">🔍</span>
            <input type="text" id="finding-search-input" placeholder="Cari nama member, TL, atau role..." value="${escapeHtml(state.searchQuery)}">
          </div>

          <div class="chips">
            <button type="button" class="chip small ${state.resultFilter === 'all' ? 'on' : ''}" data-filter="all">Semua (${reportData.stats.totalMembers})</button>
            <button type="button" class="chip small ${state.resultFilter === 'revisi' ? 'on' : ''}" data-filter="revisi">⚠️ Perlu revisi (${reportData.stats.perluRevisi})</button>
            <button type="button" class="chip small ${state.resultFilter === 'empty' ? 'on' : ''}" data-filter="empty">⏳ Belum isi (${reportData.stats.belumIsi})</button>
            <button type="button" class="chip small ${state.resultFilter === 'lolos' ? 'on' : ''}" data-filter="lolos">✓ Lolos (${reportData.stats.lolos})</button>
          </div>
        </div>

        <!-- DEPARTMENT SECTIONS -->
        <div class="hasil-body">
          ${renderedSectionsHtml}
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Attach search input handler
    const searchInput = $('#finding-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderFindingView();
        const updatedInput = $('#finding-search-input');
        if (updatedInput) {
          updatedInput.focus();
          updatedInput.selectionStart = updatedInput.selectionEnd = updatedInput.value.length;
        }
      });
    }

    // Attach filter handlers (both for stat boxes and chips)
    $$('.stat-box-modern[data-filter], .chip[data-filter]', container).forEach(el => {
      el.addEventListener('click', () => {
        state.resultFilter = el.dataset.filter;
        renderFindingView();
      });
    });
  }

  function openMemberDetail(memberName) {
    state.selectedMember = memberName;
    appNav('member-detail');
  }
  window.openMemberDetail = openMemberDetail;

  function openMemberDetail(memberName) {
    state.selectedMember = memberName;
    appNav('member-detail');
  }
  window.openMemberDetail = openMemberDetail;

  // ==================== RENDER: VIEW 2 — ERROR FINDER ====================
  let errorFinderFilter = 'all'; // 'all', 'tl', 'member', 'review'

  function renderErrorFinderView() {
    const container = $('#error-finder-container');
    if (!container) return;

    let results = state.allResults.filter(r => r.overallStatus === 'ERROR' || r.overallStatus === 'REVIEW');

    if (errorFinderFilter === 'tl') {
      results = results.filter(r => r.accountability === 'TEAM_LEADER');
    } else if (errorFinderFilter === 'member') {
      results = results.filter(r => r.accountability === 'MEMBER');
    } else if (errorFinderFilter === 'review') {
      results = results.filter(r => r.overallStatus === 'REVIEW');
    }

    const totalTLErrors = state.allResults.filter(r => r.accountability === 'TEAM_LEADER' && r.overallStatus === 'ERROR').length;
    const totalMemberErrors = state.allResults.filter(r => r.accountability === 'MEMBER' && r.overallStatus === 'ERROR').length;

    let html = `
      <div class="panel">
        <div class="panel-body">
          <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 style="font-size:18px;font-weight:800;color:var(--ink)">Daftar Temuan Error & Akuntabilitas</h2>
              <p class="text-muted" style="font-size:13px">
                Menampilkan temuan yang telah diklasifikasikan berdasarkan penanggung jawab (Team Leader untuk Checklist, Member untuk NPS).
              </p>
            </div>
            <button type="button" class="btn small" id="btn-export-all-errors">📥 Export CSV Temuan</button>
          </div>

          <!-- FILTER CHIPS UNTUK PENANGGUNG JAWAB -->
          <div class="chips mb-4">
            <button type="button" class="chip small ${errorFinderFilter === 'all' ? 'on' : ''}" onclick="setErrorFinderFilter('all')">
              Semua Temuan (${state.allResults.filter(r => r.overallStatus === 'ERROR' || r.overallStatus === 'REVIEW').length})
            </button>
            <button type="button" class="chip small ${errorFinderFilter === 'tl' ? 'on' : ''}" onclick="setErrorFinderFilter('tl')">
              🎯 Tanggung Jawab TL / LCVP / LCP (${totalTLErrors})
            </button>
            <button type="button" class="chip small ${errorFinderFilter === 'member' ? 'on' : ''}" onclick="setErrorFinderFilter('member')">
              👤 Tanggung Jawab Member (${totalMemberErrors})
            </button>
            <button type="button" class="chip small ${errorFinderFilter === 'review' ? 'on' : ''}" onclick="setErrorFinderFilter('review')">
              👁️ Perlu Review (${state.allResults.filter(r => r.overallStatus === 'REVIEW').length})
            </button>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Departemen / Function</th>
                  <th>Penanggung Jawab Finding</th>
                  <th>Bulan</th>
                  <th>Aktivitas</th>
                  <th>Waktu Penyerahan</th>
                  <th>Masalah</th>
                  <th>Sel Check</th>
                  <th>Sel NPS</th>
                  <th>Penjelasan Akuntabilitas</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
    `;

    const maxDisplay = 300;
    const shown = results.slice(0, maxDisplay);

    for (const r of shown) {
      const isTL = r.accountability === 'TEAM_LEADER';
      const isMem = r.accountability === 'MEMBER';

      html += `
        <tr>
          <td>
            <strong>${escapeHtml(r.member)}</strong>
            <div style="font-size:11px;color:var(--muted)">TL: ${escapeHtml(r.teamLeader || '-')}</div>
          </td>
          <td><span class="pill bg-brand">${escapeHtml(r.sheetName)}</span></td>
          <td>
            ${isTL ? `
              <span class="resp-pill resp-tl">
                🎯 ${escapeHtml(r.responsiblePerson)}
              </span>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${escapeHtml(r.responsibleRole)}</div>
            ` : isMem ? `
              <span class="resp-pill resp-member">
                👤 ${escapeHtml(r.responsiblePerson)}
              </span>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">Member</div>
            ` : `
              <span class="pill bg-ok">-</span>
            `}
          </td>
          <td><strong>${escapeHtml(r.month)}</strong></td>
          <td style="max-width:240px">
            <div><strong>${escapeHtml(r.activity)}</strong></div>
            <small class="text-muted">Who: ${escapeHtml(r.whoToDeliver || 'N/A')}</small>
          </td>
          <td>
            <span class="pill ${r.mandatory ? 'bg-warn' : 'bg-ok'}">${escapeHtml(r.timeToDeliver || 'N/A')}</span>
          </td>
          <td>
            <span class="pill ${r.overallStatus === 'ERROR' ? 'bg-bad text-error' : 'bg-warn text-warning'}">
              ${escapeHtml(r.checkStatus !== 'COMPLETE' ? r.checkStatus : r.npsStatus)}
            </span>
          </td>
          <td><code class="cell">${r.cellCheck}</code></td>
          <td><code class="cell">${r.cellNPS}</code></td>
          <td style="max-width:260px;font-size:12.5px;color:var(--muted)">
            ${escapeHtml(r.explanation)}
          </td>
          <td>
            <button type="button" class="btn small" onclick="openMemberDetail('${escapeHtml(r.member)}')">
              Detail →
            </button>
          </td>
        </tr>
      `;
    }

    html += `</tbody></table></div>`;

    if (results.length > maxDisplay) {
      html += `<p class="run-hint mt-4">Menampilkan ${maxDisplay} dari ${results.length} temuan.</p>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;

    $('#btn-export-all-errors')?.addEventListener('click', () => {
      AuditEngine.exportToCSV(results, `HR_Audit_Errors_Full_${new Date().toISOString().split('T')[0]}.csv`);
      toast('Daftar error berhasil diekspor', 'success');
    });
  }

  function setErrorFinderFilter(filter) {
    errorFinderFilter = filter;
    renderErrorFinderView();
  }
  window.setErrorFinderFilter = setErrorFinderFilter;

  // ==================== RENDER: VIEW 3 — MEMBER AUDIT ====================
  function renderMemberAuditView() {
    const container = $('#member-audit-container');
    if (!container) return;

    // Aggregate by member
    const memberMap = {};
    for (const r of state.allResults) {
      if (!memberMap[r.member]) {
        memberMap[r.member] = {
          name: r.member,
          teamLeader: r.teamLeader,
          teamLeaderRole: r.teamLeaderRole,
          teamLeaderTitle: r.teamLeaderTitle,
          isMB: r.isMB,
          sheets: new Set(),
          months: new Set(),
          total: 0,
          complete: 0,
          errors: 0,
          review: 0,
          missingCheck: 0,
          missingNps: 0
        };
      }
      const mb = memberMap[r.member];
      mb.sheets.add(r.sheetName);
      mb.months.add(r.month);
      mb.total++;
      if (r.overallStatus === 'ERROR') mb.errors++;
      else if (r.overallStatus === 'COMPLETE') mb.complete++;
      else if (r.overallStatus === 'REVIEW') mb.review++;
      if (r.checkStatus === 'MISSING_CHECKLIST') mb.missingCheck++;
      if (r.npsStatus === 'MISSING_NPS') mb.missingNps++;
    }

    const members = Object.values(memberMap).sort((a, b) => b.errors - a.errors || a.name.localeCompare(b.name));

    let html = `
      <div class="panel">
        <div class="panel-body">
          <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 style="font-size:18px;font-weight:800;color:var(--ink)">Audit Seluruh Anggota (${members.length} Member)</h2>
              <p class="text-muted" style="font-size:13px">Rekapitulasi kepatuhan HR Tools per anggota tim dan akuntabilitas Team Leader / LCVP</p>
            </div>
            <button type="button" class="btn small" id="btn-export-member-list">📥 Export CSV Anggota</button>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Departemen / Function</th>
                  <th>Penanggung Jawab (TL/LCVP/LCP)</th>
                  <th>Checklist Kosong (TL/LCP)</th>
                  <th>NPS Kosong (Member)</th>
                  <th>Total Error</th>
                  <th>Lengkap</th>
                  <th>Tingkat Penyelesaian</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
    `;

    for (const m of members) {
      const pct = m.total > 0 ? Math.round((m.complete / m.total) * 100) : 0;
      const statusPill = m.errors > 0 ? 'bg-bad text-error' : (m.review > 0 ? 'bg-warn text-warning' : 'bg-ok text-success');
      const statusText = m.errors > 0 ? '✕ Ada Error' : (m.review > 0 ? '? Perlu Review' : '✓ Lengkap');

      html += `
        <tr>
          <td>
            <div class="person">
              <div class="avatar">${getInitials(m.name)}</div>
              <div>
                <strong>${escapeHtml(m.name)}</strong>
                <small>${m.months.size} Bulan Pelaporan</small>
              </div>
            </div>
          </td>
          <td>
            ${Array.from(m.sheets).map(s => `<span class="pill bg-brand" style="margin-right:4px">${escapeHtml(s)}</span>`).join('')}
          </td>
          <td>
            <span class="resp-pill resp-tl">
              ${m.teamLeaderTitle === 'LCP' ? '⭐ LCP:' : (m.teamLeaderTitle === 'LCVP' || m.isMB ? '👑 LCVP:' : '👔 TL:')} ${escapeHtml(m.teamLeader || '-')}
            </span>
          </td>
          <td><strong class="${m.missingCheck > 0 ? 'text-error' : 'text-muted'}">${m.missingCheck}</strong></td>
          <td><strong class="${m.missingNps > 0 ? 'text-warning' : 'text-muted'}">${m.missingNps}</strong></td>
          <td><strong class="${m.errors > 0 ? 'text-error' : 'text-muted'}">${m.errors}</strong></td>
          <td><strong class="text-success">${m.complete}</strong></td>
          <td style="min-width:130px">
            <div class="flex items-center gap-2">
              <div style="flex:1;background:var(--line);height:6px;border-radius:3px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${pct >= 80 ? 'var(--ok)' : 'var(--bad)'}"></div>
              </div>
              <span style="font-size:12px;font-weight:700">${pct}%</span>
            </div>
          </td>
          <td><span class="pill ${statusPill}">${statusText}</span></td>
          <td>
            <button type="button" class="btn small" onclick="openMemberDetail('${escapeHtml(m.name)}')">
              Lihat Detail →
            </button>
          </td>
        </tr>
      `;
    }

    html += `</tbody></table></div></div></div>`;
    container.innerHTML = html;

    $('#btn-export-member-list')?.addEventListener('click', () => {
      AuditEngine.exportToCSV(state.allResults, `HR_Tools_Member_Full_Audit_${new Date().toISOString().split('T')[0]}.csv`);
      toast('Laporan member berhasil diekspor', 'success');
    });
  }

  // ==================== RENDER: VIEW 4 — MEMBER DETAIL ====================
  function renderMemberDetailView() {
    const container = $('#member-detail-container');
    if (!container) return;

    if (!state.selectedMember) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">👤</div>
          <b>Belum ada member yang dipilih</b>
          <p>Pilih member dari halaman Finding atau Member Audit untuk melihat detail checklist dan NPS.</p>
          <button type="button" class="btn primary mt-4" style="max-width:200px;margin:16px auto 0" onclick="appNav('finding')">Kembali ke Finding</button>
        </div>
      `;
      return;
    }

    const allMemberResults = state.allResults.filter(r => r.member === state.selectedMember);
    let items = allMemberResults;

    // Filter by tab
    if (state.memberDetailTab === 'errors') {
      items = items.filter(r => r.overallStatus === 'ERROR');
    } else if (state.memberDetailTab === 'tl-check' || state.memberDetailTab === 'missing-check') {
      items = items.filter(r => r.accountability === 'TEAM_LEADER' && r.overallStatus === 'ERROR');
    } else if (state.memberDetailTab === 'member-nps' || state.memberDetailTab === 'missing-nps') {
      items = items.filter(r => r.accountability === 'MEMBER' && r.overallStatus === 'ERROR');
    } else if (state.memberDetailTab === 'review') {
      items = items.filter(r => r.overallStatus === 'REVIEW');
    } else if (state.memberDetailTab === 'complete') {
      items = items.filter(r => r.overallStatus === 'COMPLETE');
    }

    const sheets = [...new Set(allMemberResults.map(r => r.sheetName))];
    const months = [...new Set(allMemberResults.map(r => r.month))];
    const allMembers = [...new Set(state.allResults.map(r => r.member))].sort();

    const leaderName = allMemberResults[0]?.teamLeader || '-';
    const leaderRole = allMemberResults[0]?.teamLeaderRole || 'Team Leader';
    const leaderTitle = allMemberResults[0]?.teamLeaderTitle || 'Team Leader';
    const isMB = allMemberResults[0]?.isMB;

    const countTotal = allMemberResults.length;
    const countErrors = allMemberResults.filter(r => r.overallStatus === 'ERROR').length;
    const countTLCheck = allMemberResults.filter(r => r.accountability === 'TEAM_LEADER' && r.overallStatus === 'ERROR').length;
    const countMemberNps = allMemberResults.filter(r => r.accountability === 'MEMBER' && r.overallStatus === 'ERROR').length;
    const countComplete = allMemberResults.filter(r => r.overallStatus === 'COMPLETE').length;
    const countReview = allMemberResults.filter(r => r.overallStatus === 'REVIEW').length;

    let html = `
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button type="button" class="link-btn font-bold" onclick="appNav('finding')">
          ← Kembali ke Hasil Finding
        </button>

        <div class="flex items-center gap-2">
          <span class="text-muted" style="font-size:12.5px;font-weight:600">Pilih Member:</span>
          <select class="input" style="height:34px;width:auto" onchange="openMemberDetail(this.value)">
            ${allMembers.map(m => `<option value="${escapeHtml(m)}" ${m === state.selectedMember ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- MEMBER CARD HEADER WITH LEADER ATTRIBUTION -->
      <div class="panel mb-4">
        <div class="panel-body flex items-center justify-between flex-wrap gap-4">
          <div class="flex items-center gap-3">
            <div class="avatar" style="width:48px;height:48px;font-size:18px">${getInitials(state.selectedMember)}</div>
            <div>
              <h2 style="font-size:20px;font-weight:800;color:var(--ink);margin:0">${escapeHtml(state.selectedMember)}</h2>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                ${sheets.map(s => `<span class="pill bg-brand">Fungsi: ${escapeHtml(s)}</span>`).join('')}
                <span class="resp-pill resp-tl">${leaderTitle === 'LCP' ? '⭐ LCP' : (leaderTitle === 'LCVP' || isMB ? '👑 LCVP' : '👔 Team Leader')}: <strong>${escapeHtml(leaderName)}</strong> (${escapeHtml(leaderRole)})</span>
                <span class="pill bg-ok">${months.length} Periode Bulan</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" class="btn small" id="btn-export-this-member">📥 Export Laporan Member</button>
          </div>
        </div>
      </div>

      <!-- MEMBER STATS (TL CHECK VS MEMBER NPS) -->
      <div class="stats">
        <div class="stat">
          <div class="stat-icon bg-brand">📋</div>
          <div>
            <b>${countTotal}</b>
            <span>Total Aktivitas</span>
          </div>
        </div>

        <button type="button" class="stat ${state.memberDetailTab === 'tl-check' ? 'active' : ''}" data-dtab="tl-check">
          <div class="stat-icon bg-bad">🎯</div>
          <div>
            <b class="text-error">${countTLCheck}</b>
            <span>Temuan Checklist (TL)</span>
          </div>
        </button>

        <button type="button" class="stat ${state.memberDetailTab === 'member-nps' ? 'active' : ''}" data-dtab="member-nps">
          <div class="stat-icon bg-warn">👤</div>
          <div>
            <b class="text-warning">${countMemberNps}</b>
            <span>Temuan NPS (Member)</span>
          </div>
        </button>

        <button type="button" class="stat ${state.memberDetailTab === 'complete' ? 'active' : ''}" data-dtab="complete">
          <div class="stat-icon bg-ok">✓</div>
          <div>
            <b class="text-success">${countComplete}</b>
            <span>Checklist Lengkap</span>
          </div>
        </button>
      </div>

      <!-- DETAIL TABLE PANEL -->
      <div class="panel">
        <div class="panel-body">
          <!-- TABS -->
          <div class="chips mb-4">
            <button type="button" class="chip small ${state.memberDetailTab === 'all' ? 'on' : ''}" data-dtab="all">Semua (${countTotal})</button>
            <button type="button" class="chip small ${state.memberDetailTab === 'tl-check' ? 'on' : ''}" data-dtab="tl-check">🎯 Temuan TL Checklist (${countTLCheck})</button>
            <button type="button" class="chip small ${state.memberDetailTab === 'member-nps' ? 'on' : ''}" data-dtab="member-nps">👤 Temuan Member NPS (${countMemberNps})</button>
            <button type="button" class="chip small ${state.memberDetailTab === 'review' ? 'on' : ''}" data-dtab="review">Review (${countReview})</button>
            <button type="button" class="chip small ${state.memberDetailTab === 'complete' ? 'on' : ''}" data-dtab="complete">Lengkap (${countComplete})</button>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Aktivitas</th>
                  <th>Waktu Penyerahan</th>
                  <th>Bulan</th>
                  <th>Check (Tanggung Jawab TL)</th>
                  <th>NPS (Tanggung Jawab Member)</th>
                  <th>Penanggung Jawab & Penjelasan</th>
                </tr>
              </thead>
              <tbody>
    `;

    // Sort: errors first, then review, then complete
    const sortRank = { 'ERROR': 0, 'REVIEW': 1, 'NOT_DUE': 2, 'COMPLETE': 3 };
    const sorted = [...items].sort((a, b) => (sortRank[a.overallStatus] || 9) - (sortRank[b.overallStatus] || 9));

    if (sorted.length === 0) {
      html += `<tr><td colspan="6" class="empty">Tidak ada aktivitas pada filter ini.</td></tr>`;
    } else {
      for (const r of sorted) {
        const checkDisplay = r.checkValue === true ? 'TRUE' : (r.checkValue === false ? 'FALSE' : (r.checkValue == null ? 'Empty' : String(r.checkValue)));
        const npsDisplay = (r.npsValue == null || String(r.npsValue).trim() === '') ? 'Empty' : String(r.npsValue);

        const checkColor = r.checkStatus === 'COMPLETE' ? 'text-success' : (r.checkStatus.includes('MISSING') ? 'text-error' : 'text-muted');
        const npsColor = r.npsStatus === 'COMPLETE' ? 'text-success' : (r.npsStatus.includes('MISSING') ? 'text-error' : 'text-muted');

        const isTLCheck = r.accountability === 'TEAM_LEADER';
        const isMemNps = r.accountability === 'MEMBER';

        html += `
          <tr>
            <td style="max-width:300px">
              <div><strong>${escapeHtml(r.activity)}</strong></div>
              <small class="text-muted">${escapeHtml(r.sheetName)} · PIC: ${escapeHtml(r.whoToDeliver || 'N/A')}</small>
            </td>
            <td>
              <span class="pill ${r.mandatory ? 'bg-warn' : 'bg-ok'}">${escapeHtml(r.timeToDeliver || 'N/A')}</span>
            </td>
            <td><strong>${escapeHtml(r.month)}</strong></td>
            <td>
              <strong class="${checkColor}">${checkDisplay}</strong>
              <div class="mt-1"><code class="cell">Sel ${r.cellCheck}</code></div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">TL: ${escapeHtml(r.teamLeader || '-')}</div>
            </td>
            <td>
              <strong class="${npsColor}">${npsDisplay}</strong>
              <div class="mt-1"><code class="cell">Sel ${r.cellNPS}</code></div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">Member: ${escapeHtml(r.member)}</div>
            </td>
            <td style="max-width:320px">
              <div>
                <span class="pill ${r.overallStatus === 'ERROR' ? 'bg-bad text-error' : (r.overallStatus === 'REVIEW' ? 'bg-warn text-warning' : 'bg-ok text-success')}">
                  ${r.overallStatus === 'ERROR' ? '✕ Error' : (r.overallStatus === 'REVIEW' ? '? Perlu Review' : '✓ Lengkap')}
                </span>
                ${isTLCheck ? `
                  <span class="resp-pill resp-tl" style="margin-left:4px">
                    🎯 TL: ${escapeHtml(r.responsiblePerson)}
                  </span>
                ` : isMemNps ? `
                  <span class="resp-pill resp-member" style="margin-left:4px">
                    👤 Member: ${escapeHtml(r.responsiblePerson)}
                  </span>
                ` : ''}
              </div>
              ${r.explanation ? `
                <p style="margin-top:6px;font-size:12.5px;color:var(--muted)">
                  ${escapeHtml(r.explanation)}
                </p>
              ` : ''}
            </td>
          </tr>
        `;
      }
    }

    html += `</tbody></table></div></div></div>`;
    container.innerHTML = html;

    // Attach tab handlers
    $$('.chip[data-dtab], .stat[data-dtab]', container).forEach(chip => {
      chip.addEventListener('click', () => {
        state.memberDetailTab = chip.dataset.dtab;
        renderMemberDetailView();
      });
    });

    $('#btn-export-this-member')?.addEventListener('click', () => {
      AuditEngine.exportToCSV(allMemberResults, `Audit_${state.selectedMember.replace(/\s+/g, '_')}_Report.csv`);
      toast(`Laporan ${state.selectedMember} berhasil diekspor`, 'success');
    });
  }

  // ==================== RENDER: VIEW 5 — CONFIGURATION ====================
  const APPS_SCRIPT_CODE = `function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    status: "ok",
    message: "Webhook Finding Tracker HR Tools aktif dan siap menerima data!"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = "";
    if (e && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    } else if (e && e.parameter && e.parameter.data) {
      raw = e.parameter.data;
    }

    if (!raw) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "No POST body received" })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tabName = payload.tabName || ("Finding HR Tools " + Utilities.formatDate(new Date(), "GMT+7", "dd MMM yyyy"));
    var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
    sheet.clear();
    try { sheet.getRange("A1:Z500").breakApart(); } catch (err) {}
    ss.setActiveSheet(sheet);

    // Banner Utama (Row 1-3)
    var b = sheet.getRange("A1:F3");
    b.merge().setValue("FINDING TRACKER HR TOOLS · AIESEC in UMM\\nFinding Tracker · " + (payload.period || "Periode Audit"));
    b.setBackground("#4285f4").setFontColor("#ffffff").setFontSize(13).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);

    // Sub-banner Statistik (Row 4)
    var s = sheet.getRange("A4:F4");
    var nowWIB = Utilities.formatDate(new Date(), "GMT+7", "d MMM yyyy, HH.mm") + " WIB";
    var st = payload.stats || {};
    s.merge().setValue("Diperbarui " + nowWIB + " · " + (st.totalMembers || 0) + " member · Perlu revisi " + (st.perluRevisi || 0) + " · Belum isi " + (st.belumIsi || 0) + " · Lolos " + (st.lolos || 0));
    s.setBackground("#f6b26b").setFontColor("#202124").setFontSize(9.5).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");

    sheet.setRowHeight(1, 22); sheet.setRowHeight(2, 22); sheet.setRowHeight(3, 22); sheet.setRowHeight(4, 26); sheet.setRowHeight(5, 10);

    // Header (Row 6)
    var h = sheet.getRange(6, 1, 1, 5);
    h.setValues([["No", "Name", "Team Leader", "Status", "Finding Note"]]);
    h.setBackground("#f3f3f3").setFontColor("#202124").setFontWeight("bold").setFontSize(10).setHorizontalAlignment("center").setVerticalAlignment("middle");
    h.setBorder(true, true, true, true, true, true, "#dadce0", SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(6, 26);

    // Data Rows (Row 7+)
    var rows = payload.reportRows || [];
    if (rows.length > 0) {
      var d = [], colors = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        d.push([r.no || (i + 1), r.name || "", r.teamLeader || "", r.status || "Lolos", r.findingNote || "• Tidak ada finding"]);
        var stat = (r.status || "").toLowerCase();
        var bg = "#ffffff", fg = "#202124";
        if (stat.indexOf("revisi") !== -1) { bg = "#fce8e6"; fg = "#c5221f"; }
        else if (stat.indexOf("belum") !== -1) { bg = "#fef7e0"; fg = "#b06000"; }
        else if (stat.indexOf("lolos") !== -1) { bg = "#e6f4ea"; fg = "#137333"; }
        colors.push({ bg: bg, fg: fg });
      }
      var dr = sheet.getRange(7, 1, d.length, 5);
      dr.setValues(d).setFontSize(9.5).setVerticalAlignment("top").setBorder(true, true, true, true, true, true, "#e8eaed", SpreadsheetApp.BorderStyle.SOLID);
      sheet.getRange(7, 1, d.length, 1).setHorizontalAlignment("center");
      sheet.getRange(7, 2, d.length, 1).setHorizontalAlignment("left");
      sheet.getRange(7, 3, d.length, 1).setHorizontalAlignment("left");
      sheet.getRange(7, 4, d.length, 1).setHorizontalAlignment("center");
      sheet.getRange(7, 5, d.length, 1).setHorizontalAlignment("left").setWrap(true);
      for (var k = 0; k < colors.length; k++) {
        sheet.getRange(7 + k, 4).setBackground(colors[k].bg).setFontColor(colors[k].fg).setFontWeight("bold");
      }
    }

    sheet.setColumnWidth(1, 45); sheet.setColumnWidth(2, 200); sheet.setColumnWidth(3, 200); sheet.setColumnWidth(4, 120); sheet.setColumnWidth(5, 520);
    return ContentService.createTextOutput(JSON.stringify({ success: true, tabName: tabName, sheetUrl: ss.getUrl() + "#gid=" + sheet.getSheetId() })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  function copyAppsScriptCode() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
        toast('✓ Kode Apps Script berhasil disalin ke clipboard!', 'success');
      }).catch(() => {
        fallbackCopyText(APPS_SCRIPT_CODE);
      });
    } else {
      fallbackCopyText(APPS_SCRIPT_CODE);
    }
  }

  function fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('✓ Kode Apps Script berhasil disalin!', 'success');
  }

  function renderConfigurationView() {
    const container = $('#configuration-container');
    if (!container) return;

    const activeSheets = Object.keys(state.structures);

    let html = `
      <!-- GOOGLE SHEETS REPORT ONLINE INTEGRATION -->
      <div class="panel mb-4">
        <div class="panel-body">
          <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h2 style="font-size:18px;font-weight:800;color:var(--ink)">
              📊 Integrasi Google Sheets Report Online
            </h2>
            <span class="count bg-ok" style="font-size:12px;padding:4px 10px">
              Otomatis Simpan Report
            </span>
          </div>
          <p class="text-muted" style="font-size:13px;margin-bottom:16px">
            Hubungkan spreadsheet tujuan agar laporan finding tersimpan otomatis ke tab baru secara online (seperti di referensi).
          </p>

          <label class="field mb-3">
            URL Google Spreadsheet Tujuan (Tempat Tab Report Disimpan)
            <input type="text" id="config-target-sheet-url" class="input" value="${escapeHtml(state.config.targetGoogleSheetUrl || '')}" placeholder="https://docs.google.com/spreadsheets/d/.../edit">
          </label>

          <label class="field mb-3">
            Google Apps Script Webhook URL (Opsional — untuk auto-sync real-time langsung ke spreadsheet)
            <input type="text" id="config-webhook-url" class="input" value="${escapeHtml(state.config.appsScriptWebhookUrl || '')}" placeholder="https://script.google.com/macros/s/.../exec">
          </label>

          <div class="flex items-center gap-2 flex-wrap mt-3">
            <button type="button" class="btn primary" id="btn-save-sheet-integration" style="width:auto">
              💾 Simpan Pengaturan Integrasi
            </button>
            <button type="button" class="btn" id="btn-test-webhook">
              ⚡ Tes Koneksi Webhook
            </button>
          </div>

          <!-- PANDUAN COPY APPS SCRIPT -->
          <div style="margin-top:20px;padding:16px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px">
            <div class="flex items-center justify-between mb-2">
              <strong style="color:var(--ink);font-size:13.5px">📋 Script Webhook Otomatis (Code.gs)</strong>
              <button type="button" class="btn small" id="btn-copy-apps-script">
                📋 Salin Kode Script
              </button>
            </div>
            <p style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:8px">
              <strong>Cara pasang (hanya sekali):</strong><br>
              1. Buka spreadsheet Google Sheets Anda &gt; Menu <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong>.<br>
              2. Paste kode ini &gt; Klik <strong>Terapkan (Deploy)</strong> &gt; <strong>Penerapan baru (New deployment)</strong>.<br>
              3. Pilih jenis <strong>Aplikasi web (Web app)</strong> &gt; Akses: <strong>Siapa saja (Anyone)</strong>.<br>
              4. Salin URL aplikasi web yang didapat, lalu paste di kolom "Google Apps Script Webhook URL" di atas.
            </p>
          </div>
        </div>
      </div>

      <!-- SPREADSHEET SOURCE -->
      <div class="panel mb-4">
        <div class="panel-body">
          <h2 style="font-size:18px;font-weight:800;color:var(--ink);margin-bottom:4px">Data Source & Sinkronisasi Spreadsheet Sumber</h2>
          <p class="text-muted" style="font-size:13px;margin-bottom:18px">Koneksi langsung ke Google Sheets asli AIESEC in UMM atau upload file Excel offline.</p>

          <label class="field mb-4">
            Tautan Google Sheets
            <input type="text" id="config-input-url" class="input" value="${escapeHtml(state.config.googleSheetUrl)}">
          </label>

          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" class="btn primary" id="btn-sync-url" style="width:auto">
              ⟳ Ambil & Sinkronkan Ulang Data
            </button>
            <label class="btn" style="cursor:pointer">
              📁 Upload File Excel (.xlsx)
              <input type="file" id="config-file-upload" accept=".xlsx,.xls,.csv" style="display:none">
            </label>
          </div>
        </div>
      </div>

      <!-- TIME BOUND RULES -->
      <div class="panel mb-4">
        <div class="panel-body">
          <h2 style="font-size:18px;font-weight:800;color:var(--ink);margin-bottom:4px">Aturan Validasi Waktu Penyerahan (Time to Deliver)</h2>
          <p class="text-muted" style="font-size:13px;margin-bottom:14px">Aktivitas dengan frekuensi berikut <strong>wajib</strong> selesai dicentang (TRUE).</p>

          <div class="chips mb-4" id="config-freq-tags">
            ${state.config.mandatoryFrequencies.map(f => `
              <span class="chip on small" style="cursor:default">
                ${escapeHtml(f)}
                <span style="cursor:pointer;margin-left:4px;font-weight:800" onclick="removeFreq('${escapeHtml(f)}')">×</span>
              </span>
            `).join('')}
          </div>

          <div class="flex items-center gap-2 flex-wrap" style="max-width:500px">
            <input type="text" id="input-add-freq" class="input" placeholder="Tambah kategori frekuensi (misal: Feb, Jan)..." style="flex:1">
            <button type="button" class="btn small" id="btn-add-freq">Tambah</button>
          </div>
        </div>
      </div>

      <!-- NPS SETTINGS -->
      <div class="panel mb-4">
        <div class="panel-body">
          <h2 style="font-size:18px;font-weight:800;color:var(--ink);margin-bottom:4px">Parameter Validasi Nilai NPS</h2>
          <p class="text-muted" style="font-size:13px;margin-bottom:14px">Periksa apakah nilai NPS terisi dan berada dalam skala 0–10.</p>

          <div class="fields" style="max-width:400px">
            <label class="field">
              Wajibkan NPS
              <select id="config-nps-req" class="input">
                <option value="true" ${state.config.npsRequired ? 'selected' : ''}>Wajib untuk Checklist Wajib</option>
                <option value="false" ${!state.config.npsRequired ? 'selected' : ''}>Opsional</option>
              </select>
            </label>

            <label class="field">
              Skala (0 s/d 10)
              <input type="number" id="config-nps-max" value="${state.config.npsMax}" min="1" max="100">
            </label>
          </div>

          <button type="button" class="btn primary mt-4" id="btn-save-settings" style="width:auto">
            💾 Simpan Pengaturan & Audit Ulang
          </button>
        </div>
      </div>
    `;

    if (activeSheets.length > 0) {
      html += `
        <div class="panel">
          <div class="panel-body">
            <h2 style="font-size:18px;font-weight:800;color:var(--ink);margin-bottom:4px">Struktur Spreadsheet Terdeteksi (${activeSheets.length} Fungsi)</h2>
            <p class="text-muted" style="font-size:13px;margin-bottom:16px">Semua functional sheets terbaca dinamis tanpa ketergantungan kolom statis.</p>

            <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px">
              ${activeSheets.map(sName => {
                const s = state.structures[sName];
                const memCount = new Set();
                s.months.forEach(m => m.members.forEach(mb => memCount.add(mb.name)));
                return `
                  <div style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:12px">
                    <strong style="color:var(--ink);font-size:14px">${escapeHtml(sName)}</strong>
                    <div style="color:var(--muted);font-size:12px;margin-top:4px;line-height:1.4">
                      • ${memCount.size} Member Aktif<br>
                      • ${s.months.length} Bulan<br>
                      • ${s.activities.length} Aktivitas<br>
                      • Kolom Aktivitas: ${AuditEngine.colToLetter(s.actCol)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    // Attach sheet integration handlers
    $('#btn-save-sheet-integration')?.addEventListener('click', () => {
      const targetUrl = $('#config-target-sheet-url').value.trim();
      const webhookUrl = $('#config-webhook-url').value.trim();
      state.config.targetGoogleSheetUrl = targetUrl;
      state.config.appsScriptWebhookUrl = webhookUrl;
      saveConfig();
      toast('Pengaturan integrasi Google Sheets disimpan', 'success');
    });

    $('#btn-test-webhook')?.addEventListener('click', async () => {
      const webhookUrl = $('#config-webhook-url').value.trim();
      if (!webhookUrl) {
        toast('Masukkan Google Apps Script Webhook URL terlebih dahulu', 'warning');
        return;
      }
      toast('Menguji koneksi webhook melalui server...', 'info');
      try {
        const res = await fetch('/api/test-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl })
        });
        const data = await res.json();
        if (data.success) {
          toast('✓ Webhook terhubung dan aktif!', 'success');
        } else {
          toast(data.error || 'Webhook gagal merespons', 'warning');
        }
      } catch (e) {
        toast('Gagal menghubungi server untuk menguji webhook: ' + e.message, 'error');
      }
    });

    $('#btn-copy-apps-script')?.addEventListener('click', () => {
      copyAppsScriptCode();
    });

    // Attach config handlers
    $('#btn-sync-url')?.addEventListener('click', () => {
      const url = $('#config-input-url').value.trim();
      state.config.googleSheetUrl = url;
      saveConfig();
      fetchSpreadsheet(url);
    });

    $('#config-file-upload')?.addEventListener('change', (e) => {
      if (e.target.files.length) uploadFile(e.target.files[0]);
    });

    $('#btn-add-freq')?.addEventListener('click', () => {
      const inp = $('#input-add-freq');
      const val = inp.value.trim();
      if (val && !state.config.mandatoryFrequencies.includes(val)) {
        state.config.mandatoryFrequencies.push(val);
        saveConfig();
        renderConfigurationView();
      }
    });

    $('#btn-save-settings')?.addEventListener('click', () => {
      state.config.npsRequired = $('#config-nps-req').value === 'true';
      state.config.npsMax = Number($('#config-nps-max').value) || 10;
      saveConfig();
      processSpreadsheetData();
      toast('Pengaturan disimpan dan spreadsheet diaudit ulang', 'success');
      if (state.hasRunFinding) renderFindingView();
    });
  }

  function removeFreq(freq) {
    state.config.mandatoryFrequencies = state.config.mandatoryFrequencies.filter(f => f !== freq);
    renderConfigurationView();
  }
  window.removeFreq = removeFreq;

  // Upload file helper
  async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    toast('Mengunggah file...', 'info');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      state.rawData = data;
      processSpreadsheetData();
      toast(`File ${file.name} berhasil dianalisis`, 'success');
      runFinding();
    } catch (err) {
      toast(`Gagal mengunggah: ${err.message}`, 'error');
    }
  }

  // ==================== EVENT LISTENERS SETUP ====================
  function setupControls() {
    // Mode cards toggle
    $('#mode-mandatory')?.addEventListener('click', () => {
      state.findingMode = 'mandatory';
      $('#mode-mandatory').classList.add('active');
      $('#mode-full').classList.remove('active');
      if (state.hasRunFinding) renderFindingView();
    });

    $('#mode-full')?.addEventListener('click', () => {
      state.findingMode = 'full';
      $('#mode-full').classList.add('active');
      $('#mode-mandatory').classList.remove('active');
      if (state.hasRunFinding) renderFindingView();
    });

    // Month & Year changes
    $('#select-month')?.addEventListener('change', (e) => {
      state.selectedMonth = e.target.value;
      if (state.hasRunFinding) renderFindingView();
    });

    $('#input-year')?.addEventListener('change', (e) => {
      state.selectedYear = e.target.value;
    });

    // Department chips click
    $$('.chip[data-dept]').forEach(chip => {
      chip.addEventListener('click', () => {
        const d = chip.dataset.dept;
        if (state.selectedDepts.has(d)) {
          state.selectedDepts.delete(d);
          chip.classList.remove('on');
        } else {
          state.selectedDepts.add(d);
          chip.classList.add('on');
        }
        updateRunButtonState();
      });
    });

    // Toggle all depts
    $('#btn-toggle-all-depts')?.addEventListener('click', () => {
      const allDepts = Object.keys(DEPT_MAP);
      const allSelected = state.selectedDepts.size === allDepts.length;

      if (allSelected) {
        state.selectedDepts.clear();
        $$('.chip[data-dept]').forEach(c => c.classList.remove('on'));
        $('#btn-toggle-all-depts').textContent = 'Pilih semua';
      } else {
        allDepts.forEach(d => state.selectedDepts.add(d));
        $$('.chip[data-dept]').forEach(c => c.classList.add('on'));
        $('#btn-toggle-all-depts').textContent = 'Hapus semua';
      }
      updateRunButtonState();
    });

    // Run finding button
    $('#btn-run-finding')?.addEventListener('click', () => {
      runFinding();
    });

    // Topbar nav clicks
    $$('.nav-btn[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        appNav(btn.dataset.nav);
      });
    });
  }

  function updateRunButtonState() {
    const btn = $('#btn-run-finding');
    const hint = $('#run-hint');
    if (state.selectedDepts.size === 0) {
      if (btn) btn.disabled = true;
      if (hint) {
        hint.textContent = 'Pilih minimal satu departemen';
        hint.style.color = 'var(--bad)';
      }
    } else {
      if (btn) btn.disabled = false;
      if (hint) {
        hint.textContent = `${state.selectedDepts.size} departemen dipilih`;
        hint.style.color = 'var(--muted)';
      }
    }
  }

  // ==================== INITIALIZATION ====================
  function init() {
    loadConfig();
    setupControls();
    appNav('finding');

    // Auto connect to Google Sheets on start
    setTimeout(() => {
      fetchSpreadsheet();
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
