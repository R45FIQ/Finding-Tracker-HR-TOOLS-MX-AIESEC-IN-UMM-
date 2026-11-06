/**
 * GOOGLE APPS SCRIPT FOR FINDING TRACKER HR TOOLS
 * AIESEC in UMM — Talent Management Department
 * 
 * CARA PEMASANGAN (HANYA SEKALI):
 * 1. Buka spreadsheet Google Sheets Anda (misal: spreadsheet Finding Tracker).
 * 2. Di menu atas, klik: Ekstensi (Extensions) > Apps Script.
 * 3. Hapus kode yang ada, lalu Paste seluruh isi file ini ke editor Apps Script.
 * 4. Klik ikon "Simpan" (Ctrl+S / Cmd+S).
 * 5. Di kanan atas, klik tombol biru "Terapkan" (Deploy) > "Penerapan baru" (New deployment).
 * 6. Pilih jenis: "Aplikasi web" (Web app).
 * 7. Konfigurasi:
 *    - Deskripsi: Finding Tracker HR Tools Webhook
 *    - Jalankan sebagai (Execute as): Saya (Me / email Anda)
 *    - Siapa yang memiliki akses (Who has access): Siapa saja (Anyone) -> PENTING!
 * 8. Klik "Terapkan" (Deploy), lalu izinkan akses Google jika diminta.
 * 9. Salin URL Aplikasi Web yang muncul (berakhiran /exec).
 * 10. Buka tab Konfigurasi di aplikasi Finding Tracker HR Tools, paste URL tersebut di kolom "Google Apps Script Webhook URL", lalu klik Simpan.
 * 
 * SETELAH ITU: Setiap kali Anda klik "Mulai finding", hasil audit akan otomatis tersimpan langsung ke Google Spreadsheet online dalam format report resmi!
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "No POST body received"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Tentukan nama tab
    var tabName = payload.tabName || ("Finding HR Tools " + Utilities.formatDate(new Date(), "GMT+7", "dd MMM yyyy"));
    
    // 2. Cari tab atau buat tab baru
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    } else {
      sheet.clear();
      // Unmerge previous ranges if any
      try {
        sheet.getRange("A1:Z500").breakApart();
      } catch (eMerge) {}
    }

    ss.setActiveSheet(sheet);

    // 3. BANNER UTAMA (Row 1-3 Merged A1:F3, Background Biru)
    var bannerRange = sheet.getRange("A1:F3");
    bannerRange.merge();
    var periodTitle = payload.period || "Periode Audit";
    bannerRange.setValue("FINDING TRACKER HR TOOLS · AIESEC in UMM\nFinding Tracker · " + periodTitle);
    bannerRange.setBackground("#4285f4"); // Royal blue
    bannerRange.setFontColor("#ffffff");
    bannerRange.setFontSize(13);
    bannerRange.setFontWeight("bold");
    bannerRange.setHorizontalAlignment("center");
    bannerRange.setVerticalAlignment("middle");
    bannerRange.setWrap(true);

    // 4. SUB-BANNER STATISTIK (Row 4 Merged A4:F4, Background Kuning/Gold)
    var statsRange = sheet.getRange("A4:F4");
    statsRange.merge();
    var nowWIB = Utilities.formatDate(new Date(), "GMT+7", "d MMM yyyy, HH.mm") + " WIB";
    var stats = payload.stats || {};
    var statsText = "Diperbarui " + nowWIB + " · " + 
      (stats.totalMembers || 0) + " member · " +
      "Perlu revisi " + (stats.perluRevisi || 0) + " · " +
      "Belum isi " + (stats.belumIsi || 0) + " · " +
      "Lolos " + (stats.lolos || 0);
    statsRange.setValue(statsText);
    statsRange.setBackground("#f6b26b"); // Warm gold/orange
    statsRange.setFontColor("#202124");
    statsRange.setFontSize(9.5);
    statsRange.setFontWeight("bold");
    statsRange.setHorizontalAlignment("center");
    statsRange.setVerticalAlignment("middle");

    // Row 5 kosong (spacer)
    sheet.setRowHeight(1, 24);
    sheet.setRowHeight(2, 24);
    sheet.setRowHeight(3, 24);
    sheet.setRowHeight(4, 26);
    sheet.setRowHeight(5, 10);

    // 5. TABLE HEADER (Row 6)
    var headers = ["No", "Name", "Team Leader", "Status", "Finding Note"];
    var headerRange = sheet.getRange(6, 1, 1, 5);
    headerRange.setValues([headers]);
    headerRange.setBackground("#f3f3f3");
    headerRange.setFontColor("#202124");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(10);
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    headerRange.setBorder(true, true, true, true, true, true, "#dadce0", SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(6, 26);

    // 6. ISI DATA ROW (Row 7 dst)
    var rows = payload.reportRows || [];
    if (rows.length > 0) {
      var dataValues = [];
      var statusStyles = [];

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        dataValues.push([
          r.no || (i + 1),
          r.name || "",
          r.teamLeader || "",
          r.status || "Lolos",
          r.findingNote || "• Tidak ada finding"
        ]);

        var st = (r.status || "").toLowerCase();
        var bg = "#ffffff";
        var fg = "#202124";

        if (st.indexOf("revisi") !== -1) {
          bg = "#fce8e6"; // Soft red
          fg = "#c5221f";
        } else if (st.indexOf("belum") !== -1) {
          bg = "#fef7e0"; // Soft amber
          fg = "#b06000";
        } else if (st.indexOf("lolos") !== -1) {
          bg = "#e6f4ea"; // Soft green
          fg = "#137333";
        }

        statusStyles.push({ bg: bg, fg: fg });
      }

      var dataRange = sheet.getRange(7, 1, dataValues.length, 5);
      dataRange.setValues(dataValues);
      dataRange.setFontSize(9.5);
      dataRange.setVerticalAlignment("top");
      dataRange.setBorder(true, true, true, true, true, true, "#e8eaed", SpreadsheetApp.BorderStyle.SOLID);

      // Alignment per kolom
      sheet.getRange(7, 1, dataValues.length, 1).setHorizontalAlignment("center"); // No
      sheet.getRange(7, 2, dataValues.length, 1).setHorizontalAlignment("left");   // Name
      sheet.getRange(7, 3, dataValues.length, 1).setHorizontalAlignment("left");   // Team Leader
      sheet.getRange(7, 4, dataValues.length, 1).setHorizontalAlignment("center"); // Status
      sheet.getRange(7, 5, dataValues.length, 1).setHorizontalAlignment("left").setWrap(true); // Finding Note

      // Warnai kolom status (Kolom D)
      for (var k = 0; k < statusStyles.length; k++) {
        var statusCell = sheet.getRange(7 + k, 4);
        statusCell.setBackground(statusStyles[k].bg);
        statusCell.setFontColor(statusStyles[k].fg);
        statusCell.setFontWeight("bold");
      }
    }

    // 7. LEBAR KOLOM (Auto set pixel widths)
    sheet.setColumnWidth(1, 45);  // No
    sheet.setColumnWidth(2, 200); // Name
    sheet.setColumnWidth(3, 200); // Team Leader
    sheet.setColumnWidth(4, 120); // Status
    sheet.setColumnWidth(5, 520); // Finding Note
    sheet.setColumnWidth(6, 60);

    // Selesai & kembalikan response
    var sheetUrl = ss.getUrl() + "#gid=" + sheet.getSheetId();
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      tabName: tabName,
      sheetUrl: sheetUrl,
      message: "Laporan berhasil disimpan ke tab " + tabName
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "Finding Tracker HR Tools Webhook",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

