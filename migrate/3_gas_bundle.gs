/**
 * ============================================================================
 * SANDMOSQUITO WATER BILLING - GOOGLE APPS SCRIPT (GAS) BACKEND
 * ============================================================================
 * Petunjuk Instalasi:
 * 1. Buka Google Spreadsheet baru (https://sheets.new)
 * 2. Klik Extensions -> Apps Script
 * 3. Hapus kode bawaan, lalu copy-paste SELURUH isi file ini
 * 4. Klik menu dropdown 'run' -> pilih 'setupDatabase' lalu klik 'Run' (sekali saja)
 * 5. Klik Deploy -> New deployment -> Select type 'Web app'
 *    - Description: Sandmosquito Water Billing API
 *    - Execute as: Me (email Anda)
 *    - Who has access: Anyone (Siapa saja)
 * 6. Klik 'Deploy', lalu salin Web App URL ke file .env:
 *    VITE_GAS_API_URL=https://script.google.com/macros/s/.../exec
 *    VITE_ACTIVE_BACKEND=gas
 * ============================================================================
 */

function doPost(e) {
  try {
    const raw = e.postData.contents;
    const body = JSON.parse(raw);
    const action = body.action;
    const data = body.data || body;

    const result = handleAction(action, data);
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    message: 'Sandmosquito Water Billing Google Apps Script API Server'
  })).setMimeType(ContentService.MimeType.JSON);
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [
    'users', 'tariffs', 'customers', 'meters', 'meter_readings',
    'bills', 'payments', 'settings', 'audit_logs', 'announcements',
    'complaints', 'subscription_requests', 'registration_tokens', 'maintenance_expenses'
  ];

  sheets.forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
  });

  // Init settings
  const settingsSheet = ss.getSheetByName('settings');
  if (settingsSheet.getLastRow() === 0) {
    settingsSheet.appendRow(['key', 'value', 'updated_at']);
    settingsSheet.appendRow(['app_name', 'Sandmosquito Water Billing', new Date().toISOString()]);
    settingsSheet.appendRow(['village_name', 'Desa Sandmosquito', new Date().toISOString()]);
    settingsSheet.appendRow(['organization_name', 'BUMDes Tirta Sandmosquito', new Date().toISOString()]);
    settingsSheet.appendRow(['village_address', 'Jl. Melati No. 07, RT 02 / RW 01', new Date().toISOString()]);
    settingsSheet.appendRow(['contact_phone', '0812-3456-7890', new Date().toISOString()]);
    settingsSheet.appendRow(['bank_account_info', 'Bank BRI: 1234-01-000123-53-0 a.n BUMDes Tirta Sandmosquito', new Date().toISOString()]);
    settingsSheet.appendRow(['due_day_of_month', '20', new Date().toISOString()]);
    settingsSheet.appendRow(['late_fee_flat', '5000', new Date().toISOString()]);
    settingsSheet.appendRow(['admin_fee_flat', '2500', new Date().toISOString()]);
  }
}

function handleAction(action, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  switch (action) {
    case 'auth_login':
    case 'login': {
      const users = getSheetData(ss, 'users');
      const user = users.find(u => u.username.toLowerCase() === data.username.toLowerCase());
      if (!user) throw new Error('Pengguna tidak ditemukan.');
      return {
        token: 'gas_token_' + user.id + '_' + Date.now(),
        user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role, assigned_rt: user.assigned_rt, phone: user.phone }
      };
    }

    case 'customers_list':
    case 'getCustomers':
      return getSheetData(ss, 'customers');

    case 'meters_list':
    case 'getMeters':
      return getSheetData(ss, 'meters');

    case 'tariffs_list':
    case 'getTariffs':
      return getSheetData(ss, 'tariffs');

    case 'bills_list':
    case 'getBills':
      return getSheetData(ss, 'bills');

    case 'payments_list':
    case 'getPayments':
      return getSheetData(ss, 'payments');

    case 'announcements_list':
    case 'getAnnouncements':
      return getSheetData(ss, 'announcements');

    case 'complaints_list':
    case 'getComplaints':
      return getSheetData(ss, 'complaints');

    case 'subscription_requests_list':
    case 'getSubscriptionRequests':
      return getSheetData(ss, 'subscription_requests');

    case 'tokens_list':
    case 'getRegistrationTokens':
      return getSheetData(ss, 'registration_tokens');

    case 'maintenance_expenses_list':
    case 'getMaintenanceExpenses':
      return getSheetData(ss, 'maintenance_expenses');

    case 'settings_get':
    case 'getSettings': {
      const rows = getSheetData(ss, 'settings');
      const obj = {};
      rows.forEach(r => { obj[r.key] = r.value; });
      return obj;
    }

    default:
      return { message: 'Action ' + action + ' received' };
  }
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j];
    }
    rows.push(row);
  }
  return rows;
}
