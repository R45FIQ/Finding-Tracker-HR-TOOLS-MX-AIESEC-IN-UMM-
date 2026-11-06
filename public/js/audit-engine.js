/**
 * HR Tools Audit Engine
 * AIESEC in UMM — Talent Management Department
 * 
 * Dynamic detection and auditing of HR Tools spreadsheets.
 * Accurately detects sheet structures, member columns, Check/NPS pairs,
 * activity frequencies, and performs comprehensive validation according to audit rules.
 */
(function() {
  'use strict';

  // Standard AIESEC term months in chronological order
  const TERM_MONTHS = [
    'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December', 'January'
  ];

  /**
   * Complete Sheet-to-Leader Mapping
   * Includes LCVP for Management Board (-MB) and EB, and Team Leaders for functional teams.
   */
  const SHEET_LEADER_MAP = {
    // EB & FGL
    'EB-Archipelago': {
      name: 'Naura Nadifa',
      role: 'Local Committee President',
      title: 'LCP',
      dept: 'EB'
    },
    'FGL-MB': {
      name: 'Dimas Fadhliansyah N',
      role: 'LCVP Finance, Governance and Legality',
      title: 'LCVP',
      dept: 'FGL'
    },

    // Talent Management (TM)
    'TM-MB': {
      name: 'Camelia Najwa',
      role: 'LCVP Talent Management',
      title: 'LCVP',
      dept: 'TM'
    },
    'TM-TAX': {
      name: 'Tiara Zahrakamalia',
      role: 'Talent Acquisition & Experience Team Leader',
      title: 'Team Leader',
      dept: 'TM'
    },
    'TM-TA': {
      name: 'Muhammad Sulaiman Rafiq',
      role: 'Talent Analytics Team Leader',
      title: 'Team Leader',
      dept: 'TM'
    },
    'TM-TD': {
      name: 'Atifah Shafa Kirana',
      role: 'Talent Development Team Leader',
      title: 'Team Leader',
      dept: 'TM'
    },

    // Marketing (MKT)
    'MKT-MB': {
      name: 'Tanjung Kinasih Wilujeng',
      role: 'LCVP Marketing',
      title: 'LCVP',
      dept: 'MKT'
    },
    'MKT-BM': {
      name: 'Najwaa Efakita Rayyaa',
      role: 'Brand Management Team Leader',
      title: 'Team Leader',
      dept: 'MKT'
    },
    'MKT-EWA': {
      name: 'Aldhini Islami Putri',
      role: 'EwA Marketing Team Leader',
      title: 'Team Leader',
      dept: 'MKT'
    },
    'MKT-ELD': {
      name: 'Jafra Lintang Oreo Dholito',
      role: 'ELD Marketing Team Leader',
      title: 'Team Leader',
      dept: 'MKT'
    },

    // External Relations (ER)
    'ER-MB': {
      name: 'Fatma Ali Mauladawilah',
      role: 'LCVP External Relations',
      title: 'LCVP',
      dept: 'ER'
    },
    'ER-OR': {
      name: 'Shabrina Nayla Farach',
      role: 'Outreach Team Leader',
      title: 'Team Leader',
      dept: 'ER'
    },
    'ER-PR': {
      name: 'Anggi Apriyani',
      role: 'Public Relations Team Leader',
      title: 'Team Leader',
      dept: 'ER'
    },
    'ER-NM': {
      name: 'Judistira Haidar Sabar Pratama',
      role: 'Network Maintenance Team Leader',
      title: 'Team Leader',
      dept: 'ER'
    },

    // Business Development (BD)
    'BD-MB': {
      name: 'Yasmin Raisya Fedora',
      role: 'LCVP Business Development',
      title: 'LCVP',
      dept: 'BD'
    },
    'BD-SGD': {
      name: 'Maysa Angelina Ridwan',
      role: 'Strategic Global Development Team Leader',
      title: 'Team Leader',
      dept: 'BD'
    },
    'BD-SYD': {
      name: 'Faris Nurrahman',
      role: 'Strategic Youth Development Team Leader',
      title: 'Team Leader',
      dept: 'BD'
    },
    'BD-SBD': {
      name: 'Alya Zhafira Athayyah',
      role: 'Strategic Business Development Team Leader',
      title: 'Team Leader',
      dept: 'BD'
    },

    // Engagement with AIESEC / Brand Activation (EWABA)
    'EWABA-MB': {
      name: 'Dezvananda Namzha Santoso',
      role: 'LCVP Engagement with AIESEC',
      title: 'LCVP',
      dept: 'EWABA'
    },
    'EWABA-PQD': {
      name: 'Dezvananda Namzha Santoso',
      role: 'LCVP Engagement with AIESEC',
      title: 'LCVP',
      dept: 'EWABA'
    },
    'EWABA-CX': {
      name: 'Salwa',
      role: 'Customer Experience Team Leader',
      title: 'Team Leader',
      dept: 'EWABA'
    },
    'EWABA-LV': {
      name: 'Shava Anggita Pudianingsih',
      role: 'Local Volunteer Team Leader',
      title: 'Team Leader',
      dept: 'EWABA'
    },

    // Incoming Global Volunteer (iGV)
    'iGV-MB': {
      name: 'Azif',
      role: 'LCVP Incoming Global Volunteer',
      title: 'LCVP',
      dept: 'iGV'
    },
    'iGV-Project': {
      name: 'Madu',
      role: 'Project Team Leader (iGV)',
      title: 'Team Leader',
      dept: 'iGV'
    },
    'iGV-QAPD': {
      name: 'Adriyan',
      role: 'Quality Assurance & Product Development Team Leader (iGV)',
      title: 'Team Leader',
      dept: 'iGV'
    },
    'iGV-IRCX': {
      name: 'Aqila',
      role: 'IR & Customer Experience Team Leader (iGV)',
      title: 'Team Leader',
      dept: 'iGV'
    },

    // Outgoing Exchange (oGX)
    'oGX-MB': {
      name: 'LCVP oGX',
      role: 'LCVP Outgoing Exchange',
      title: 'LCVP',
      dept: 'oGX'
    },
    'oGX-oGTae': {
      name: 'Ica',
      role: 'Outgoing Global Teacher Team Leader (oGX)',
      title: 'Team Leader',
      dept: 'oGX'
    },
    'oGX-oGV': {
      name: 'Ayu',
      role: 'Outgoing Global Volunteer Team Leader (oGX)',
      title: 'Team Leader',
      dept: 'oGX'
    },
    'oGX-IR': {
      name: 'Anindya',
      role: 'International Relations Team Leader (oGX)',
      title: 'Team Leader',
      dept: 'oGX'
    }
  };

  /** Get leader info for a sheet */
  function getSheetLeader(sheetName) {
    if (!sheetName) sheetName = '';
    if (SHEET_LEADER_MAP[sheetName]) return SHEET_LEADER_MAP[sheetName];
    const isEB = sheetName.toUpperCase().includes('EB') || sheetName.toUpperCase().includes('ARCHIPELAGO');
    const isMB = sheetName.toUpperCase().includes('-MB');
    return {
      name: isEB ? 'Naura Nadifa' : (isMB ? 'LCVP' : 'Team Leader'),
      role: isEB ? 'Local Committee President' : (isMB ? `LCVP ${sheetName}` : `Team Leader ${sheetName}`),
      title: isEB ? 'LCP' : (isMB ? 'LCVP' : 'Team Leader'),
      dept: sheetName.split('-')[0] || 'DEPT'
    };
  }

  const MONTH_ALIASES = {
    'january': 'January', 'jan': 'January', 'januari': 'January',
    'february': 'February', 'feb': 'February', 'februari': 'February',
    'march': 'March', 'mar': 'March', 'maret': 'March',
    'april': 'April', 'apr': 'April',
    'may': 'May', 'mei': 'May',
    'june': 'June', 'jun': 'June', 'juni': 'June',
    'july': 'July', 'jul': 'July', 'juli': 'July',
    'august': 'August', 'aug': 'August', 'agustus': 'August',
    'september': 'September', 'sep': 'September', 'sept': 'September',
    'october': 'October', 'oct': 'October', 'oktober': 'October',
    'november': 'November', 'nov': 'November',
    'december': 'December', 'dec': 'December', 'desember': 'December'
  };

  /** Convert 0-indexed column number to Excel column letters (0=A, 25=Z, 26=AA, etc.) */
  function colToLetter(col) {
    let s = '';
    col++;
    while (col > 0) {
      col--;
      s = String.fromCharCode(65 + (col % 26)) + s;
      col = Math.floor(col / 26);
    }
    return s;
  }

  /** Convert 0-indexed col, row to Excel cell reference (e.g. 10, 14 -> "K15") */
  function cellRef(col, row) {
    return colToLetter(col) + (row + 1);
  }

  /** Normalize boolean values from Excel checkboxes */
  function normalizeBool(val) {
    if (val === true || val === 'TRUE' || val === 'true' || val === 'True') return true;
    if (val === false || val === 'FALSE' || val === 'false' || val === 'False') return false;
    if (val === 1) return true;
    if (val === 0) return false;
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
      const t = val.trim().toLowerCase();
      if (t === '') return null;
      if (t === 'true' || t === 'yes' || t === '1') return true;
      if (t === 'false' || t === 'no' || t === '0') return false;
    }
    return val; // Return original for INVALID_CHECK detection
  }

  /** Standardize month name */
  function normalizeMonth(str) {
    if (!str || typeof str !== 'string') return null;
    const clean = str.trim().toLowerCase().replace(/[^a-z]/g, '');
    return MONTH_ALIASES[clean] || null;
  }

  /** Check if a member name is a placeholder template slot rather than a real member */
  function isPlaceholderMember(name) {
    if (!name || typeof name !== 'string') return true;
    const trimmed = name.trim();
    if (!trimmed) return true;
    // Template names in brackets like [Name 4], [Name 5], [Name 3], [oGX]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) return true;
    if (/^\[?name\s*\d*\]?$/i.test(trimmed)) return true;
    if (trimmed.toLowerCase().includes('name 1') || trimmed.toLowerCase().includes('name 2') ||
        trimmed.toLowerCase().includes('name 3') || trimmed.toLowerCase().includes('name 4') ||
        trimmed.toLowerCase().includes('name 5')) return true;
    // Header labels or summary labels
    if (trimmed.includes('%') || trimmed.toLowerCase().includes('standards') ||
        trimmed.toLowerCase().includes('activity') || trimmed.toLowerCase().includes('time to deliver') ||
        trimmed.toLowerCase().includes('implementation')) return true;
    // Standalone month abbreviations
    if (MONTH_ALIASES[trimmed.toLowerCase()]) return true;
    return false;
  }

  /** Find the header rows and key columns in a sheet */
  function findSheetHeaders(sheetData) {
    let checkRow = -1;
    let actCol = -1, timeCol = -1, whoCol = -1;

    const maxScanRow = Math.min(18, sheetData.length);

    // 1. Find Check row (row containing "Check" and "NPS")
    for (let r = 8; r < maxScanRow; r++) {
      if (!sheetData[r]) continue;
      const checkCount = sheetData[r].filter(v => String(v || '').trim().toLowerCase() === 'check').length;
      if (checkCount >= 2) {
        checkRow = r;
        break;
      }
    }

    // 2. Find Activity, Time to deliver, Who to deliver columns
    for (let r = 8; r < maxScanRow; r++) {
      if (!sheetData[r]) continue;
      for (let c = 0; c < Math.min(15, sheetData[r].length); c++) {
        const val = String(sheetData[r][c] || '').trim().toLowerCase();
        if (val.includes('activity') && val.includes('deliver')) actCol = c;
        else if (actCol === -1 && (val === 'activity' || val === 'activity to deliver' || val === 'aktivitas')) actCol = c;

        if (val.includes('time') && val.includes('deliver')) timeCol = c;
        else if (timeCol === -1 && (val === 'time to deliver' || val === 'waktu')) timeCol = c;

        if (val.includes('who') && val.includes('deliver')) whoCol = c;
        else if (whoCol === -1 && (val === 'who to deliver' || val === 'siapa')) whoCol = c;
      }
    }

    // Heuristic fallbacks if not explicitly found
    if (checkRow === -1) checkRow = 12; // Row 13 (0-indexed 12)
    if (actCol === -1) actCol = 5;
    if (timeCol === -1) timeCol = 6;
    if (whoCol === -1) whoCol = 7;

    const memberRow = checkRow - 1; // Row 12 (0-indexed 11)
    const monthRow = checkRow - 2;  // Row 11 (0-indexed 10)

    return { checkRow, memberRow, monthRow, actCol, timeCol, whoCol };
  }

  /**
   * Dynamically parse sheet structure
   * Detects month blocks, member Check/NPS pairs, and activity checklist rows
   */
  function parseSheetStructure(sheetData, sheetName) {
    if (!sheetData || sheetData.length < 15) {
      return { sheetName, error: 'Sheet has insufficient data (less than 15 rows)', months: [], activities: [] };
    }

    const { checkRow, memberRow, monthRow, actCol, timeCol, whoCol } = findSheetHeaders(sheetData);

    const checkRowData = sheetData[checkRow] || [];
    const memberRowData = sheetData[memberRow] || [];
    const monthRowData = sheetData[monthRow] || [];

    // Map month names across columns
    const monthMap = {}; // { "February": { name, members: [] } }
    const pairs = [];
    let currentMonth = null;

    // Find all Check columns in checkRow
    for (let c = 0; c < checkRowData.length; c++) {
      // Track current month block (carries over across merged member columns)
      const monthRaw = String(monthRowData[c] || '').trim();
      const stdMonth = normalizeMonth(monthRaw);
      if (stdMonth) {
        currentMonth = stdMonth;
      }

      const chk = String(checkRowData[c] || '').trim().toLowerCase();
      if (chk === 'check') {
        const npsCol = c + 1;
        const memberRaw = String(memberRowData[c] || memberRowData[npsCol] || '').trim();

        // Skip template placeholders or non-members
        if (isPlaceholderMember(memberRaw)) continue;
        if (!currentMonth) continue;

        pairs.push({
          member: memberRaw,
          month: currentMonth,
          checkCol: c,
          npsCol: npsCol
        });

        if (!monthMap[currentMonth]) {
          monthMap[currentMonth] = {
            name: currentMonth,
            members: []
          };
        }

        // Add member to month if not already present
        const existingMember = monthMap[currentMonth].members.find(m => m.name === memberRaw);
        if (!existingMember) {
          monthMap[currentMonth].members.push({
            name: memberRaw,
            checkCol: c,
            npsCol: npsCol
          });
        }
      }
    }

    // Convert monthMap to ordered array following standard term sequence
    const months = [];
    for (const mName of TERM_MONTHS) {
      if (monthMap[mName]) {
        months.push(monthMap[mName]);
      }
    }
    // Also include any other months detected not in standard term
    for (const mName of Object.keys(monthMap)) {
      if (!TERM_MONTHS.includes(mName)) {
        months.push(monthMap[mName]);
      }
    }

    // Parse activities
    const activities = [];
    const activityStartRow = checkRow + 2; // e.g. Row 15 (0-indexed 14)

    for (let r = activityStartRow; r < sheetData.length; r++) {
      const row = sheetData[r];
      if (!row) continue;

      const actName = row[actCol];
      const timeToDeliver = row[timeCol];
      const whoToDeliver = row[whoCol];

      if (!actName || typeof actName !== 'string') continue;
      const actClean = actName.trim();
      if (!actClean) continue;

      // Exclude formula footer rows like "Monthly Implementation:"
      if (actClean.toLowerCase().includes('monthly implementation:') ||
          actClean.toLowerCase().includes('implementation:') ||
          actClean.toLowerCase().includes('% standards')) {
        continue;
      }

      activities.push({
        row: r,
        name: actClean,
        timeToDeliver: timeToDeliver ? String(timeToDeliver).trim() : '',
        whoToDeliver: whoToDeliver ? String(whoToDeliver).trim() : ''
      });
    }

    return {
      sheetName,
      checkRow,
      memberRow,
      monthRow,
      actCol,
      timeCol,
      whoCol,
      months,
      activities,
      error: months.length === 0 ? 'No active members detected in sheet' : null
    };
  }

  /** Check if a time-to-deliver is February specific */
  function isFebTimeBound(timeToDeliver) {
    if (!timeToDeliver) return false;
    const t = timeToDeliver.trim().toLowerCase();
    return t === 'feb' || t === 'februari' || t === 'february';
  }

  /** Check if an activity's frequency is mandatory */
  function isMandatory(timeToDeliver, mandatoryList) {
    if (!timeToDeliver) return false;
    const t = timeToDeliver.trim().toLowerCase();

    // Time bound Februari harus kosong / gak di-checklist (bukan mandatory)
    if (isFebTimeBound(timeToDeliver)) return false;

    // Check against configured mandatory list (case-insensitive, trims)
    for (const m of mandatoryList) {
      const mNorm = m.trim().toLowerCase();
      if (t === mNorm || t.includes(mNorm)) return true;
    }

    return false;
  }

  /** Check if a time-to-deliver is adjustable or review-required */
  function isAdjustable(timeToDeliver) {
    if (!timeToDeliver) return false;
    const t = timeToDeliver.trim().toLowerCase();
    return t === 'adjustable' || t === 'quarterly' || t === 'semesterly' || t === 'optional' || t === 'as needed';
  }

  /**
   * Determine if a reporting period is in the future relative to the audited period
   */
  function isPeriodFuture(monthName, dueUpToMonth) {
    if (!dueUpToMonth || dueUpToMonth === 'all') return false;

    const termOrder = {
      'February': 1, 'March': 2, 'April': 3, 'May': 4,
      'June': 5, 'July': 6, 'August': 7, 'September': 8,
      'October': 9, 'November': 10, 'December': 11, 'January': 12
    };

    const targetIdx = termOrder[monthName] || 0;
    const dueIdx = termOrder[dueUpToMonth] || 12;

    return targetIdx > dueIdx;
  }

  /**
   * Execute the full audit on a sheet's structure and cell data
   */
  function runAudit(structure, sheetData, config) {
    const cfg = Object.assign({
      selectedMonth: 'all',
      dueUpToMonth: 'all',
      mandatoryFrequencies: ['monthly', 'weekly', 'end of the month'],
      npsRequired: true,
      npsMin: 0,
      npsMax: 10
    }, config);

    const leaderInfo = getSheetLeader(structure.sheetName);
    const isMBSheet = structure.sheetName.toUpperCase().includes('-MB') || structure.sheetName.toUpperCase().includes('EB-');

    const results = [];
    const monthsToAudit = (cfg.selectedMonth === 'all' || !cfg.selectedMonth)
      ? structure.months
      : structure.months.filter(m => m.name.toLowerCase() === cfg.selectedMonth.toLowerCase());

    for (const month of monthsToAudit) {
      const isFuture = isPeriodFuture(month.name, cfg.dueUpToMonth);

      for (const member of month.members) {
        for (const activity of structure.activities) {
          const row = sheetData[activity.row];
          if (!row) continue;

          const rawCheck = row[member.checkCol] !== undefined ? row[member.checkCol] : null;
          const rawNPS = row[member.npsCol] !== undefined ? row[member.npsCol] : null;

          const checkNorm = normalizeBool(rawCheck);
          const isFeb = isFebTimeBound(activity.timeToDeliver);
          const mandatory = isMandatory(activity.timeToDeliver, cfg.mandatoryFrequencies);
          const adjustable = isAdjustable(activity.timeToDeliver);

          const cellCheckRef = cellRef(member.checkCol, activity.row);
          const cellNpsRef = cellRef(member.npsCol, activity.row);

          let checkStatus = 'COMPLETE';
          let npsStatus = 'COMPLETE';
          let overallStatus = 'COMPLETE';
          let accountability = 'NONE'; // 'TEAM_LEADER' | 'MEMBER' | 'NONE'
          let responsiblePerson = '-';
          let responsibleRole = '-';
          let findingType = 'NONE'; // 'TL_CHECKLIST' | 'MEMBER_NPS' | 'REVIEW' | 'NONE'
          const explanations = [];

          if (isFuture) {
            checkStatus = 'NOT_DUE';
            npsStatus = 'NOT_DUE';
            overallStatus = 'NOT_DUE';
            accountability = 'NONE';
            responsiblePerson = '-';
            responsibleRole = '-';
            findingType = 'NONE';
            explanations.push(`${month.name} adalah periode masa depan — belum jatuh tempo`);
          } else if (isFeb) {
            // === ATURAN TIME BOUND FEBRUARI: HARUS GAK DI-CHECKLIST (HARUS KOSONG) ===
            if (checkNorm === true) {
              checkStatus = 'INVALID_CHECK';
              overallStatus = 'ERROR';
              accountability = 'TEAM_LEADER';
              responsiblePerson = leaderInfo.name;
              responsibleRole = leaderInfo.role;
              findingType = 'TL_CHECKLIST';
              explanations.push(`Harusnya tidak di-checklist: ${cellCheckRef} (Februari).`);
            } else {
              // Jika kosong atau false -> COMPLETE (sesuai aturan, tidak ada error)
              checkStatus = 'COMPLETE';
              overallStatus = 'COMPLETE';
              accountability = 'NONE';
              responsiblePerson = '-';
              responsibleRole = '-';
              findingType = 'NONE';
            }
            npsStatus = 'NOT_REQUIRED';
          } else {
            // === 1. CHECK VALIDATION (Tanggung Jawab Team Leader / LCVP) ===
            if (checkNorm === true) {
              checkStatus = 'COMPLETE';
            } else if (checkNorm === false || checkNorm === null) {
              if (mandatory) {
                checkStatus = 'MISSING_CHECKLIST';
                overallStatus = 'ERROR';
                accountability = 'TEAM_LEADER';
                responsiblePerson = leaderInfo.name;
                responsibleRole = leaderInfo.role;
                findingType = 'TL_CHECKLIST';
                explanations.push(`Belum checklist ${cellCheckRef} (${activity.timeToDeliver || 'Wajib'}).`);
              } else {
                // Non-mandatory (Adjustable / sunnah dll) bisa diisi bisa tidak, tidak masuk ke finding
                checkStatus = 'COMPLETE';
                overallStatus = 'COMPLETE';
                accountability = 'NONE';
                responsiblePerson = '-';
                responsibleRole = '-';
                findingType = 'NONE';
              }
            } else {
              checkStatus = 'INVALID_CHECK';
              overallStatus = 'ERROR';
              accountability = 'TEAM_LEADER';
              responsiblePerson = leaderInfo.name;
              responsibleRole = leaderInfo.role;
              findingType = 'TL_CHECKLIST';
              explanations.push(`Checkbox tidak valid ${cellCheckRef}.`);
            }

            // === 2. NPS VALIDATION (Tanggung Jawab Member — HANYA BILA TL SUDAH CENTANG / Check=TRUE) ===
            if (mandatory && checkNorm === true) {
              if (cfg.npsRequired) {
                if (rawNPS === null || rawNPS === undefined || String(rawNPS).trim() === '') {
                  npsStatus = 'MISSING_NPS';
                  overallStatus = 'ERROR';
                  accountability = 'MEMBER';
                  responsiblePerson = member.name;
                  responsibleRole = 'Member';
                  findingType = 'MEMBER_NPS';
                  explanations.push(`Belum isi NPS: ${cellNpsRef}.`);
                } else {
                  const npsNum = Number(rawNPS);
                  if (isNaN(npsNum)) {
                    npsStatus = 'INVALID_NPS';
                    overallStatus = 'ERROR';
                    accountability = 'MEMBER';
                    responsiblePerson = member.name;
                    responsibleRole = 'Member';
                    findingType = 'MEMBER_NPS';
                    explanations.push(`NPS tidak valid: ${cellNpsRef} (${rawNPS}).`);
                  } else if (npsNum < cfg.npsMin || npsNum > cfg.npsMax) {
                    npsStatus = 'INVALID_NPS';
                    overallStatus = 'ERROR';
                    accountability = 'MEMBER';
                    responsiblePerson = member.name;
                    responsibleRole = 'Member';
                    findingType = 'MEMBER_NPS';
                    explanations.push(`NPS tidak valid: ${cellNpsRef} (${npsNum}).`);
                  } else {
                    npsStatus = 'COMPLETE';
                  }
                }
              } else {
                npsStatus = 'NOT_REQUIRED';
              }
            } else {
              // Jika bukan aktivitas wajib atau TL belum mencentang, Member TIDAK WAJIB mengisi NPS
              npsStatus = 'NOT_REQUIRED';
            }
          }

          results.push({
            member: member.name,
            month: month.name,
            sheetName: structure.sheetName,
            activity: activity.name,
            timeToDeliver: activity.timeToDeliver,
            whoToDeliver: activity.whoToDeliver,
            checkValue: rawCheck,
            npsValue: rawNPS,
            checkStatus,
            npsStatus,
            overallStatus,
            accountability,
            responsiblePerson,
            responsibleRole,
            findingType,
            teamLeader: leaderInfo.name,
            teamLeaderRole: leaderInfo.role,
            teamLeaderTitle: leaderInfo.title,
            isMB: isMBSheet,
            cellCheck: cellCheckRef,
            cellNPS: cellNpsRef,
            explanation: explanations.join('; '),
            mandatory
          });
        }
      }
    }

    const summary = buildSummary(results);
    return { results, summary };
  }

  /** Build comprehensive summary stats with Accountability Breakdown */
  function buildSummary(results) {
    const summary = {
      totalItems: results.length,
      totalErrors: 0,
      totalComplete: 0,
      totalReview: 0,
      totalNotDue: 0,
      totalTLChecklistErrors: 0,  // Errors belonging to Team Leader / LCVP
      totalMemberNPSErrors: 0,    // Errors belonging to Member
      byMember: {},
      byLeader: {},
      byMonth: {},
      byIssueType: {
        MISSING_CHECKLIST: 0,
        MISSING_NPS: 0,
        INVALID_NPS: 0,
        INVALID_CHECK: 0,
        NEEDS_REVIEW: 0,
        COMPLETE: 0,
        NOT_DUE: 0
      }
    };

    for (const r of results) {
      if (r.overallStatus === 'ERROR') {
        summary.totalErrors++;
        if (r.accountability === 'TEAM_LEADER') summary.totalTLChecklistErrors++;
        else if (r.accountability === 'MEMBER') summary.totalMemberNPSErrors++;
      }
      else if (r.overallStatus === 'COMPLETE') summary.totalComplete++;
      else if (r.overallStatus === 'REVIEW') summary.totalReview++;
      else if (r.overallStatus === 'NOT_DUE') summary.totalNotDue++;

      // Leader breakdown
      const leaderName = r.teamLeader || 'Unknown';
      if (!summary.byLeader[leaderName]) {
        summary.byLeader[leaderName] = {
          name: leaderName,
          role: r.teamLeaderRole || 'Team Leader',
          title: r.teamLeaderTitle || 'Team Leader',
          sheets: new Set(),
          members: new Set(),
          totalCheckErrors: 0,
          totalComplete: 0
        };
      }
      const lb = summary.byLeader[leaderName];
      lb.sheets.add(r.sheetName);
      lb.members.add(r.member);
      if (r.checkStatus === 'MISSING_CHECKLIST' || r.checkStatus === 'INVALID_CHECK') {
        lb.totalCheckErrors++;
      } else if (r.checkStatus === 'COMPLETE') {
        lb.totalComplete++;
      }

      // Member breakdown
      if (!summary.byMember[r.member]) {
        summary.byMember[r.member] = {
          name: r.member,
          teamLeader: r.teamLeader,
          teamLeaderRole: r.teamLeaderRole,
          sheets: new Set(),
          errors: 0, complete: 0, review: 0, notDue: 0, total: 0,
          missingCheck: 0, missingNps: 0, invalidNps: 0
        };
      }
      const mb = summary.byMember[r.member];
      mb.sheets.add(r.sheetName);
      mb.total++;
      if (r.overallStatus === 'ERROR') mb.errors++;
      else if (r.overallStatus === 'COMPLETE') mb.complete++;
      else if (r.overallStatus === 'REVIEW') mb.review++;
      else if (r.overallStatus === 'NOT_DUE') mb.notDue++;

      if (r.checkStatus === 'MISSING_CHECKLIST') mb.missingCheck++;
      if (r.npsStatus === 'MISSING_NPS') mb.missingNps++;
      if (r.npsStatus === 'INVALID_NPS') mb.invalidNps++;

      // Issue type counts
      if (r.checkStatus === 'MISSING_CHECKLIST') summary.byIssueType.MISSING_CHECKLIST++;
      if (r.checkStatus === 'INVALID_CHECK') summary.byIssueType.INVALID_CHECK++;
      if (r.npsStatus === 'MISSING_NPS') summary.byIssueType.MISSING_NPS++;
      if (r.npsStatus === 'INVALID_NPS') summary.byIssueType.INVALID_NPS++;
      if (r.overallStatus === 'REVIEW') summary.byIssueType.NEEDS_REVIEW++;
      if (r.overallStatus === 'COMPLETE') summary.byIssueType.COMPLETE++;
      if (r.overallStatus === 'NOT_DUE') summary.byIssueType.NOT_DUE++;
    }

    return summary;
  }

  /** Export results to clean CSV */
  function exportToCSV(results, filename) {
    const headers = [
      'Member', 'Function', 'Team Leader', 'Penanggung Jawab Finding', 'Peran Akuntabilitas', 'Month', 'Activity',
      'Time to Deliver', 'Who to Deliver',
      'Check Value', 'NPS Value',
      'Check Status', 'NPS Status', 'Overall Status',
      'Cell (Check)', 'Cell (NPS)', 'Explanation'
    ];

    const rows = results.map(r => [
      r.member,
      r.sheetName,
      `"${(r.teamLeader || '').replace(/"/g, '""')}"`,
      `"${(r.responsiblePerson || '').replace(/"/g, '""')}"`,
      r.accountability === 'TEAM_LEADER' ? (r.isMB ? 'LCVP (Checklist)' : 'Team Leader (Checklist)') : (r.accountability === 'MEMBER' ? 'Member (NPS)' : 'Lengkap'),
      r.month,
      `"${(r.activity || '').replace(/"/g, '""')}"`,
      r.timeToDeliver,
      r.whoToDeliver,
      r.checkValue === null ? 'Empty' : String(r.checkValue),
      r.npsValue === null ? 'Empty' : String(r.npsValue),
      r.checkStatus,
      r.npsStatus,
      r.overallStatus,
      r.cellCheck,
      r.cellNPS,
      `"${(r.explanation || '').replace(/"/g, '""')}"`
    ]);

    let csvContent = '\uFEFF' + headers.join(',') + '\n';
    for (const row of rows) {
      csvContent += row.join(',') + '\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || `HR_Audit_Report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  // Export globally
  const engineApi = {
    TERM_MONTHS,
    SHEET_LEADER_MAP,
    getSheetLeader,
    parseSheetStructure,
    runAudit,
    buildSummary,
    exportToCSV,
    cellRef,
    colToLetter,
    normalizeBool,
    normalizeMonth,
    isPlaceholderMember
  };

  if (typeof window !== 'undefined') {
    window.AuditEngine = engineApi;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engineApi;
  }
})();
