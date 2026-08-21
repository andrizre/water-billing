/**
 * Sandmosquito Water Billing - Google Apps Script Settings Module
 * System settings and village institutional profile.
 */

function handleGetSettings() {
  var settingsRows = getAllRows('Settings');
  var settingsMap = {};

  for (var i = 0; i < settingsRows.length; i++) {
    settingsMap[settingsRows[i].key] = settingsRows[i].value;
  }

  // Ensure default fallback values
  var defaults = {
    app_name: 'Sandmosquito Water Billing',
    village_name: 'Desa Sandmosquito',
    organization_name: 'BUMDes Tirta Lestari',
    village_address: 'Jl. Raya Desa No. 12, Kec. Alam Indah',
    contact_phone: '0812-3456-7890',
    contact_email: 'bumdes.sandmosquito@desa.id',
    bank_account_info: 'Bank BRI: 1234-01-000123-53-0 a.n BUMDes Tirta Lestari',
    qris_info: 'Tersedia di loket kantor desa atau transfer bank resmi',
    due_day_of_month: '20',
    late_fee_flat: '5000',
    bill_footer_notes: 'Harap membayar sebelum tanggal jatuh tempo. Air adalah sumber kehidupan, gunakan secara bijak.'
  };

  for (var key in defaults) {
    if (settingsMap[key] === undefined) {
      settingsMap[key] = defaults[key];
    }
  }

  return jsonResponse(settingsMap, 200, 'Pengaturan sistem berhasil dimuat.');
}

function handleUpdateSettings(authUser, data) {
  var settingsObj = data.settings || data;
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  var existing = getAllRows('Settings');
  var existingMap = {};
  for (var i = 0; i < existing.length; i++) {
    existingMap[existing[i].key] = existing[i];
  }

  for (var key in settingsObj) {
    if (settingsObj.hasOwnProperty(key)) {
      var val = String(settingsObj[key]);
      if (existingMap[key]) {
        // Update existing row
        var sheet = getSheet('Settings');
        var dataRange = sheet.getDataRange().getValues();
        for (var r = 1; r < dataRange.length; r++) {
          if (dataRange[r][0] === key) {
            sheet.getRange(r + 1, 2).setValue(val);
            sheet.getRange(r + 1, 4).setValue(nowStr);
            break;
          }
        }
      } else {
        // Append new setting
        appendRow('Settings', {
          key: key,
          value: val,
          description: '',
          updated_at: nowStr
        });
      }
    }
  }

  logAudit(authUser.userId, authUser.username, 'UPDATE_SETTINGS', 'Memperbarui pengaturan sistem');

  return jsonResponse(settingsObj, 200, 'Pengaturan sistem berhasil disimpan.');
}
