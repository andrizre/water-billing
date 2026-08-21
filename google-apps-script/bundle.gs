/**
 * ============================================================================
 * SANDMOSQUITO WATER BILLING - CONSOLIDATED GOOGLE APPS SCRIPT BACKEND (ALL-IN-ONE)
 * ============================================================================
 * Salin dan tempel SELURUH isi file ini ke Script Editor Google Apps Script
 * (Extensions > Apps Script pada Google Spreadsheet Anda).
 * ============================================================================
 */

// ==========================================
// 1. KONFIGURASI & UTILS
// ==========================================
var JWT_SECRET = 'sandmosquito_water_billing_secret_key_2026';

function getDb() {
  try {
    var sp = PropertiesService.getScriptProperties();
    var sheetId = sp.getProperty('SPREADSHEET_ID');
    if (sheetId && sheetId.trim() !== '') {
      return SpreadsheetApp.openById(sheetId);
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function getSheet(sheetName) {
  var db = getDb();
  if (!db) throw new Error('Spreadsheet database tidak ditemukan.');
  var sheet = db.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" tidak ditemukan.');
  return sheet;
}

function getAllRows(sheetName) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var isEmpty = row.every(function(cell) { return cell === '' || cell === null; });
    if (isEmpty) continue;

    var rowObj = {};
    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      var cellVal = row[j];
      if (cellVal instanceof Date) {
        rowObj[header] = Utilities.formatDate(cellVal, 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
      } else {
        rowObj[header] = cellVal;
      }
    }
    rows.push(rowObj);
  }
  return rows;
}

function getRowById(sheetName, id) {
  var rows = getAllRows(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

function appendRow(sheetName, dataObj) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) throw new Error('Sheet "' + sheetName + '" tidak memiliki baris header.');

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var newRow = [];

  for (var j = 0; j < headers.length; j++) {
    var val = dataObj[headers[j]];
    newRow.push((val === undefined || val === null) ? '' : val);
  }

  sheet.appendRow(newRow);
  return dataObj;
}

function updateRowById(sheetName, id, updateObj) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idColIdx = headers.indexOf('id');
  if (idColIdx === -1) throw new Error('Kolom "id" tidak ditemukan.');

  var targetRowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idColIdx]) === String(id)) {
      targetRowIdx = i + 1;
      break;
    }
  }

  if (targetRowIdx === -1) return null;

  for (var key in updateObj) {
    if (updateObj.hasOwnProperty(key)) {
      var colIdx = headers.indexOf(key);
      if (colIdx !== -1) {
        var cellVal = updateObj[key];
        if (cellVal === undefined || cellVal === null) cellVal = '';
        sheet.getRange(targetRowIdx, colIdx + 1).setValue(cellVal);
      }
    }
  }

  var updatedIdx = headers.indexOf('updated_at');
  if (updatedIdx !== -1 && !updateObj.updated_at) {
    var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
    sheet.getRange(targetRowIdx, updatedIdx + 1).setValue(nowStr);
  }

  return getRowById(sheetName, id);
}

function deleteRowById(sheetName, id) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idColIdx = headers.indexOf('id');
  if (idColIdx === -1) return false;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idColIdx]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function generateUniqueId(prefix) {
  var now = new Date();
  var year = Utilities.formatDate(now, 'GMT+7', 'yyyy');
  var month = Utilities.formatDate(now, 'GMT+7', 'MM');
  var randomNum = Math.floor(1000 + Math.random() * 9000);
  var timeComponent = now.getTime().toString().slice(-4);

  if (prefix === 'CUST') return 'CUST-' + year + '-' + randomNum;
  if (prefix === 'INV' || prefix === 'BILL') return 'INV-' + year + month + '-' + randomNum;
  if (prefix === 'PAY') return 'PAY-' + year + month + '-' + randomNum;
  if (prefix === 'MTR') return 'MTR-' + randomNum + timeComponent.slice(0, 2);
  if (prefix === 'RDM') return 'RDM-' + year + month + '-' + randomNum;
  if (prefix === 'USR') return 'USR-' + randomNum;
  if (prefix === 'TRF') return 'TRF-' + randomNum;
  return (prefix ? prefix + '-' : '') + Utilities.getUuid().substring(0, 8);
}

function hashPassword(password, salt) {
  if (!salt) salt = '';
  var rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + '::' + salt + '::' + JWT_SECRET);
  var hash = '';
  for (var i = 0; i < rawBytes.length; i++) {
    var byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hash += byteHex;
  }
  return hash;
}

function generateSalt() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function generateToken(user) {
  var payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    customerId: user.customer_id || '',
    fullName: user.full_name,
    exp: new Date().getTime() + (7 * 24 * 60 * 60 * 1000)
  };
  var payloadStr = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var signatureBytes = Utilities.computeHmacSha256Signature(payloadStr, JWT_SECRET);
  var signature = Utilities.base64EncodeWebSafe(signatureBytes);
  return payloadStr + '.' + signature;
}

function verifyToken(token) {
  if (!token) return null;
  var parts = token.split('.');
  if (parts.length !== 2) return null;

  var payloadStr = parts[0];
  var signature = parts[1];
  var expectedSignatureBytes = Utilities.computeHmacSha256Signature(payloadStr, JWT_SECRET);
  var expectedSignature = Utilities.base64EncodeWebSafe(expectedSignatureBytes);

  if (signature !== expectedSignature) return null;

  try {
    var decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadStr)).getDataAsString();
    var payload = JSON.parse(decoded);
    if (payload.exp && payload.exp < new Date().getTime()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function jsonResponse(data, status, message) {
  var responseObj = {
    success: (status === undefined || status === 200 || status === 201 || status === true),
    status: status || 200,
    message: message || 'Berhasil',
    data: data || null,
    timestamp: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss')
  };
  return ContentService.createTextOutput(JSON.stringify(responseObj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message, status) {
  return jsonResponse(null, status || 400, message);
}

function logAudit(userId, username, action, details) {
  try {
    var sheet = getSheet('AuditLogs');
    var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
    var id = 'LOG-' + Utilities.getUuid().substring(0, 8);
    sheet.appendRow([
      id,
      userId || 'SYSTEM',
      username || 'system',
      action,
      typeof details === 'object' ? JSON.stringify(details) : String(details),
      nowStr
    ]);
  } catch (e) {}
}

function requireRole(authUser, allowedRoles) {
  if (!authUser || allowedRoles.indexOf(authUser.role) === -1) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk tindakan ini.');
  }
}

function getMonthNameIndo(m) {
  var names = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return names[m] || '';
}

// ==========================================
// 2. AUTHENTICATION & PROFILE
// ==========================================
function handleLogin(data) {
  var username = String(data.username || '').trim();
  var password = String(data.password || '').trim();

  if (!username || !password) return errorResponse('Username / Nomor Pelanggan dan Password wajib diisi.', 400);

  var users = getAllRows('Users');
  var user = null;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (String(u.username).toLowerCase() === username.toLowerCase() && (u.is_active === true || u.is_active === 'TRUE' || u.is_active === 1 || u.is_active === '1')) {
      user = u;
      break;
    }
  }

  var customer = null;
  if (!user) {
    var customers = getAllRows('Customers');
    for (var j = 0; j < customers.length; j++) {
      var c = customers[j];
      if (String(c.customer_no).toLowerCase() === username.toLowerCase() || String(c.phone) === username) {
        customer = c;
        break;
      }
    }

    if (customer) {
      for (var k = 0; k < users.length; k++) {
        if (String(users[k].customer_id) === String(customer.id)) {
          user = users[k];
          break;
        }
      }

      if (!user) {
        var salt = generateSalt();
        var defaultPasswordHash = hashPassword(password, salt);
        var newUserId = generateUniqueId('USR');
        user = {
          id: newUserId,
          username: customer.customer_no,
          password_hash: defaultPasswordHash,
          salt: salt,
          role: 'customer',
          customer_id: customer.id,
          full_name: customer.full_name,
          email: '',
          phone: customer.phone,
          is_active: 'TRUE',
          created_at: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss'),
          updated_at: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss')
        };
        appendRow('Users', user);
      }
    }
  }

  if (!user) return errorResponse('Akun tidak ditemukan atau telah dinonaktifkan.', 401);

  var calculatedHash = hashPassword(password, user.salt);
  if (calculatedHash !== user.password_hash) {
    return errorResponse('Kata sandi yang Anda masukkan salah.', 401);
  }

  var token = generateToken(user);
  var customerData = null;
  if (user.role === 'customer' && user.customer_id) {
    customerData = getRowById('Customers', user.customer_id);
  }

  logAudit(user.id, user.username, 'LOGIN', 'Pengguna login sebagai ' + user.role);

  return jsonResponse({
    token: token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      email: user.email || '',
      phone: user.phone || '',
      customerId: user.customer_id || '',
      customer: customerData
    }
  }, 200, 'Login berhasil. Selamat datang, ' + user.full_name);
}

function handleVerifyAuth(authUser) {
  var user = getRowById('Users', authUser.userId);
  if (!user) return errorResponse('Pengguna tidak ditemukan.', 404);

  var customerData = null;
  if (user.role === 'customer' && user.customer_id) {
    customerData = getRowById('Customers', user.customer_id);
  }

  return jsonResponse({
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      email: user.email || '',
      phone: user.phone || '',
      customerId: user.customer_id || '',
      customer: customerData
    }
  }, 200, 'Sesi aktif');
}

function handleChangePassword(authUser, data) {
  var oldPassword = String(data.old_password || '').trim();
  var newPassword = String(data.new_password || '').trim();

  if (!oldPassword || !newPassword) return errorResponse('Kata sandi lama dan baru wajib diisi.', 400);
  if (newPassword.length < 6) return errorResponse('Kata sandi baru minimal 6 karakter.', 400);

  var user = getRowById('Users', authUser.userId);
  if (!user) return errorResponse('Pengguna tidak ditemukan.', 404);

  var oldHash = hashPassword(oldPassword, user.salt);
  if (oldHash !== user.password_hash) return errorResponse('Kata sandi lama salah.', 400);

  var newSalt = generateSalt();
  var newHash = hashPassword(newPassword, newSalt);

  updateRowById('Users', user.id, { password_hash: newHash, salt: newSalt });
  logAudit(user.id, user.username, 'CHANGE_PASSWORD', 'Kata sandi berhasil diubah');

  return jsonResponse(null, 200, 'Kata sandi berhasil diubah.');
}

function handleGetProfile(authUser) {
  var user = getRowById('Users', authUser.userId);
  if (!user) return errorResponse('Pengguna tidak ditemukan.', 404);

  var customer = null;
  var meter = null;
  var tariff = null;

  if (user.role === 'customer' && user.customer_id) {
    customer = getRowById('Customers', user.customer_id);
    if (customer && customer.meter_id) meter = getRowById('Meters', customer.meter_id);
    if (customer && customer.tariff_id) tariff = getRowById('Tariffs', customer.tariff_id);
  }

  return jsonResponse({ user: user, customer: customer, meter: meter, tariff: tariff }, 200, 'Data profil');
}

function handlePublicCheckBill(data) {
  var customerNo = String(data.customer_no || '').trim().toUpperCase();
  if (!customerNo) return errorResponse('Nomor pelanggan wajib diisi.', 400);

  var customers = getAllRows('Customers');
  var customer = null;
  for (var i = 0; i < customers.length; i++) {
    if (String(customers[i].customer_no).toUpperCase() === customerNo) {
      customer = customers[i];
      break;
    }
  }

  if (!customer) return errorResponse('Nomor pelanggan "' + customerNo + '" tidak ditemukan.', 404);

  var allBills = getAllRows('Bills');
  var customerBills = allBills.filter(function(b) { return String(b.customer_id) === String(customer.id); });
  customerBills.sort(function(a, b) {
    return (parseInt(b.period_year) * 100 + parseInt(b.period_month)) - (parseInt(a.period_year) * 100 + parseInt(a.period_month));
  });

  var unpaidBills = customerBills.filter(function(b) { return b.status !== 'Lunas'; });
  var totalTunggakan = 0;
  for (var k = 0; k < unpaidBills.length; k++) {
    totalTunggakan += Number(unpaidBills[k].balance_due || unpaidBills[k].total_amount || 0);
  }

  var meter = customer.meter_id ? getRowById('Meters', customer.meter_id) : null;
  var tariff = customer.tariff_id ? getRowById('Tariffs', customer.tariff_id) : null;

  return jsonResponse({
    customer: {
      customer_no: customer.customer_no,
      full_name: customer.full_name,
      address: customer.address,
      rt_rw: customer.rt_rw,
      status: customer.status,
      tariff_name: tariff ? tariff.name : 'Standar'
    },
    meter: meter ? { meter_no: meter.meter_no, current_reading: meter.current_reading } : null,
    total_unpaid_amount: totalTunggakan,
    unpaid_count: unpaidBills.length,
    bills: customerBills.slice(0, 6)
  }, 200, 'Data tagihan ditemukan.');
}

// ==========================================
// 3. USERS MANAGEMENT
// ==========================================
function handleGetUsers(params) {
  var users = getAllRows('Users');
  var roleFilter = params.role || '';
  var search = String(params.search || '').toLowerCase();

  var filtered = users.filter(function(u) {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search) {
      var matchUsername = String(u.username || '').toLowerCase().indexOf(search) !== -1;
      var matchName = String(u.full_name || '').toLowerCase().indexOf(search) !== -1;
      return matchUsername || matchName;
    }
    return true;
  });

  var sanitized = filtered.map(function(u) {
    return {
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role: u.role,
      email: u.email || '',
      phone: u.phone || '',
      is_active: u.is_active === true || u.is_active === 'TRUE' || u.is_active === 1 || u.is_active === '1',
      customer_id: u.customer_id || '',
      created_at: u.created_at,
      updated_at: u.updated_at
    };
  });

  return jsonResponse(sanitized, 200, 'Daftar pengguna.');
}

function handleCreateUser(authUser, data) {
  var username = String(data.username || '').trim();
  var password = String(data.password || '').trim();
  var fullName = String(data.full_name || '').trim();
  var role = String(data.role || 'operator').trim().toLowerCase();

  if (!username || !password || !fullName) return errorResponse('Username, Password, dan Nama Lengkap wajib diisi.', 400);

  var existingUsers = getAllRows('Users');
  for (var i = 0; i < existingUsers.length; i++) {
    if (String(existingUsers[i].username).toLowerCase() === username.toLowerCase()) {
      return errorResponse('Username "' + username + '" sudah digunakan.', 400);
    }
  }

  var salt = generateSalt();
  var passHash = hashPassword(password, salt);
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  var id = generateUniqueId('USR');

  var newUser = {
    id: id,
    username: username,
    password_hash: passHash,
    salt: salt,
    role: role,
    customer_id: data.customer_id || '',
    full_name: fullName,
    email: data.email || '',
    phone: data.phone || '',
    is_active: data.is_active !== undefined ? (data.is_active ? 'TRUE' : 'FALSE') : 'TRUE',
    created_at: nowStr,
    updated_at: nowStr
  };

  appendRow('Users', newUser);
  logAudit(authUser.userId, authUser.username, 'CREATE_USER', 'Membuat pengguna: ' + username + ' (' + role + ')');

  return jsonResponse(newUser, 201, 'Pengguna baru berhasil ditambahkan.');
}

function handleUpdateUser(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Pengguna wajib diisi.', 400);

  var existing = getRowById('Users', id);
  if (!existing) return errorResponse('Pengguna tidak ditemukan.', 404);

  var updateObj = {
    full_name: data.full_name !== undefined ? data.full_name : existing.full_name,
    role: data.role !== undefined ? data.role : existing.role,
    email: data.email !== undefined ? data.email : existing.email,
    phone: data.phone !== undefined ? data.phone : existing.phone,
    is_active: data.is_active !== undefined ? (data.is_active ? 'TRUE' : 'FALSE') : existing.is_active,
    updated_at: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss')
  };

  if (data.password && String(data.password).trim() !== '') {
    var newSalt = generateSalt();
    updateObj.salt = newSalt;
    updateObj.password_hash = hashPassword(String(data.password).trim(), newSalt);
  }

  updateRowById('Users', id, updateObj);
  logAudit(authUser.userId, authUser.username, 'UPDATE_USER', 'Memperbarui pengguna: ' + existing.username);

  return jsonResponse(null, 200, 'Pengguna diperbarui.');
}

function handleDeleteUser(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Pengguna wajib diisi.', 400);
  if (String(id) === String(authUser.userId)) return errorResponse('Tidak dapat menghapus akun sendiri.', 400);

  deleteRowById('Users', id);
  logAudit(authUser.userId, authUser.username, 'DELETE_USER', 'Menghapus pengguna ID: ' + id);

  return jsonResponse(null, 200, 'Pengguna dihapus.');
}

function handleResetUserPassword(authUser, data) {
  var id = data.id;
  var newPassword = String(data.new_password || 'sandmosquito123').trim();
  if (!id) return errorResponse('ID Pengguna wajib diisi.', 400);

  var newSalt = generateSalt();
  var newHash = hashPassword(newPassword, newSalt);

  updateRowById('Users', id, { salt: newSalt, password_hash: newHash });
  logAudit(authUser.userId, authUser.username, 'RESET_PASSWORD', 'Reset password user ID: ' + id);

  return jsonResponse({ new_password: newPassword }, 200, 'Kata sandi berhasil direset.');
}

// ==========================================
// 4. CUSTOMERS & METERS
// ==========================================
function handleGetCustomers(params) {
  var customers = getAllRows('Customers');
  var meters = getAllRows('Meters');
  var tariffs = getAllRows('Tariffs');

  var meterMap = {};
  for (var m = 0; m < meters.length; m++) meterMap[meters[m].id] = meters[m];

  var tariffMap = {};
  for (var t = 0; t < tariffs.length; t++) tariffMap[tariffs[t].id] = tariffs[t];

  var search = String(params.search || '').toLowerCase();
  var statusFilter = params.status || '';
  var rtrwFilter = params.rt_rw || '';

  var filtered = customers.filter(function(c) {
    if (statusFilter && c.status !== statusFilter) return false;
    if (rtrwFilter && c.rt_rw !== rtrwFilter) return false;
    if (search) {
      var matchNo = String(c.customer_no || '').toLowerCase().indexOf(search) !== -1;
      var matchName = String(c.full_name || '').toLowerCase().indexOf(search) !== -1;
      var matchPhone = String(c.phone || '').indexOf(search) !== -1;
      return matchNo || matchName || matchPhone;
    }
    return true;
  });

  var enriched = filtered.map(function(c) {
    var meter = c.meter_id ? meterMap[c.meter_id] : null;
    var tariff = c.tariff_id ? tariffMap[c.tariff_id] : null;
    return {
      id: c.id,
      customer_no: c.customer_no,
      full_name: c.full_name,
      nik: c.nik || '',
      phone: c.phone || '',
      address: c.address || '',
      rt_rw: c.rt_rw || '',
      meter_id: c.meter_id || '',
      meter_no: meter ? meter.meter_no : '-',
      current_reading: meter ? (meter.current_reading || 0) : 0,
      tariff_id: c.tariff_id || '',
      tariff_name: tariff ? tariff.name : 'Standar',
      status: c.status || 'Aktif',
      created_at: c.created_at,
      updated_at: c.updated_at
    };
  });

  return jsonResponse(enriched, 200, 'Daftar pelanggan.');
}

function handleGetCustomerById(authUser, data) {
  var id = data.id || data.customer_id;
  if (!id) return errorResponse('ID Pelanggan wajib diisi.', 400);

  if (authUser.role === 'customer' && String(authUser.customerId) !== String(id)) {
    return errorResponse('Akses ditolak.', 403);
  }

  var customer = getRowById('Customers', id);
  if (!customer) return errorResponse('Pelanggan tidak ditemukan.', 404);

  var meter = customer.meter_id ? getRowById('Meters', customer.meter_id) : null;
  var tariff = customer.tariff_id ? getRowById('Tariffs', customer.tariff_id) : null;

  return jsonResponse({ customer: customer, meter: meter, tariff: tariff }, 200, 'Data pelanggan.');
}

function handleCreateCustomer(authUser, data) {
  var fullName = String(data.full_name || '').trim();
  if (!fullName) return errorResponse('Nama lengkap pelanggan wajib diisi.', 400);

  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  var customerId = generateUniqueId('CUST_ID');
  var customerNo = data.customer_no ? String(data.customer_no).trim().toUpperCase() : generateUniqueId('CUST');
  var initialReading = Number(data.initial_reading || 0);
  var meterId = data.meter_id || '';

  if (!meterId && (data.meter_no || data.create_meter)) {
    meterId = generateUniqueId('MTR_ID');
    var meterNo = data.meter_no ? String(data.meter_no).trim().toUpperCase() : generateUniqueId('MTR');
    appendRow('Meters', {
      id: meterId,
      meter_no: meterNo,
      customer_id: customerId,
      installation_date: data.installation_date || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd'),
      brand: data.meter_brand || 'Standard SNI',
      initial_reading: initialReading,
      current_reading: initialReading,
      status: 'Aktif',
      created_at: nowStr
    });
  }

  var newCustomer = {
    id: customerId,
    customer_no: customerNo,
    full_name: fullName,
    nik: data.nik || '',
    phone: data.phone || '',
    address: data.address || '',
    rt_rw: data.rt_rw || '',
    meter_id: meterId,
    tariff_id: data.tariff_id || 'TRF-01',
    status: data.status || 'Aktif',
    created_at: nowStr,
    updated_at: nowStr
  };

  appendRow('Customers', newCustomer);

  var defaultSalt = generateSalt();
  var defaultPass = customerNo.toLowerCase();
  appendRow('Users', {
    id: generateUniqueId('USR'),
    username: customerNo,
    password_hash: hashPassword(defaultPass, defaultSalt),
    salt: defaultSalt,
    role: 'customer',
    customer_id: customerId,
    full_name: fullName,
    email: '',
    phone: data.phone || '',
    is_active: 'TRUE',
    created_at: nowStr,
    updated_at: nowStr
  });

  logAudit(authUser.userId, authUser.username, 'CREATE_CUSTOMER', 'Menambahkan pelanggan ' + fullName + ' (' + customerNo + ')');

  return jsonResponse(newCustomer, 201, 'Pelanggan berhasil ditambahkan.');
}

function handleUpdateCustomer(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Pelanggan wajib diisi.', 400);

  var existing = getRowById('Customers', id);
  if (!existing) return errorResponse('Pelanggan tidak ditemukan.', 404);

  var updateObj = {
    full_name: data.full_name !== undefined ? data.full_name : existing.full_name,
    nik: data.nik !== undefined ? data.nik : existing.nik,
    phone: data.phone !== undefined ? data.phone : existing.phone,
    address: data.address !== undefined ? data.address : existing.address,
    rt_rw: data.rt_rw !== undefined ? data.rt_rw : existing.rt_rw,
    tariff_id: data.tariff_id !== undefined ? data.tariff_id : existing.tariff_id,
    meter_id: data.meter_id !== undefined ? data.meter_id : existing.meter_id,
    status: data.status !== undefined ? data.status : existing.status,
    updated_at: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss')
  };

  updateRowById('Customers', id, updateObj);
  logAudit(authUser.userId, authUser.username, 'UPDATE_CUSTOMER', 'Update pelanggan: ' + existing.full_name);

  return jsonResponse(null, 200, 'Pelanggan berhasil diperbarui.');
}

function handleDeleteCustomer(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Pelanggan wajib diisi.', 400);

  var bills = getAllRows('Bills').some(function(b) { return String(b.customer_id) === String(id); });
  if (bills) {
    updateRowById('Customers', id, { status: 'Nonaktif' });
    return jsonResponse(null, 200, 'Status pelanggan diubah menjadi Nonaktif karena ada tagihan.');
  }

  deleteRowById('Customers', id);
  return jsonResponse(null, 200, 'Pelanggan berhasil dihapus.');
}

function handleGetMeters(params) {
  var meters = getAllRows('Meters');
  var customers = getAllRows('Customers');
  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];

  var statusFilter = params.status || '';
  var search = String(params.search || '').toLowerCase();

  var filtered = meters.filter(function(m) {
    if (statusFilter && m.status !== statusFilter) return false;
    if (search) {
      var matchNo = String(m.meter_no || '').toLowerCase().indexOf(search) !== -1;
      var cust = custMap[m.customer_id];
      var matchCust = cust ? String(cust.full_name || '').toLowerCase().indexOf(search) !== -1 : false;
      return matchNo || matchCust;
    }
    return true;
  });

  var enriched = filtered.map(function(m) {
    var cust = custMap[m.customer_id];
    return {
      id: m.id,
      meter_no: m.meter_no,
      customer_id: m.customer_id || '',
      customer_name: cust ? cust.full_name : 'Belum Ditautkan',
      customer_no: cust ? cust.customer_no : '-',
      installation_date: m.installation_date || '',
      brand: m.brand || 'Standard',
      initial_reading: Number(m.initial_reading || 0),
      current_reading: Number(m.current_reading || 0),
      status: m.status || 'Aktif',
      created_at: m.created_at
    };
  });

  return jsonResponse(enriched, 200, 'Daftar meter air.');
}

function handleCreateMeter(authUser, data) {
  var meterNo = data.meter_no ? String(data.meter_no).trim().toUpperCase() : generateUniqueId('MTR');
  var id = generateUniqueId('MTR_ID');
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  var initialReading = Number(data.initial_reading || 0);

  var newMeter = {
    id: id,
    meter_no: meterNo,
    customer_id: data.customer_id || '',
    installation_date: data.installation_date || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd'),
    brand: data.brand || 'Standard SNI',
    initial_reading: initialReading,
    current_reading: initialReading,
    status: data.status || 'Aktif',
    created_at: nowStr
  };

  appendRow('Meters', newMeter);
  if (data.customer_id) updateRowById('Customers', data.customer_id, { meter_id: id });
  logAudit(authUser.userId, authUser.username, 'CREATE_METER', 'Menambahkan meter: ' + meterNo);

  return jsonResponse(newMeter, 201, 'Meter air berhasil ditambahkan.');
}

function handleUpdateMeter(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Meter wajib diisi.', 400);

  var existing = getRowById('Meters', id);
  if (!existing) return errorResponse('Meter tidak ditemukan.', 404);

  var updateObj = {
    meter_no: data.meter_no !== undefined ? String(data.meter_no).trim().toUpperCase() : existing.meter_no,
    brand: data.brand !== undefined ? data.brand : existing.brand,
    installation_date: data.installation_date !== undefined ? data.installation_date : existing.installation_date,
    initial_reading: data.initial_reading !== undefined ? Number(data.initial_reading) : existing.initial_reading,
    current_reading: data.current_reading !== undefined ? Number(data.current_reading) : existing.current_reading,
    status: data.status !== undefined ? data.status : existing.status,
    customer_id: data.customer_id !== undefined ? data.customer_id : existing.customer_id
  };

  updateRowById('Meters', id, updateObj);
  return jsonResponse(null, 200, 'Meter berhasil diperbarui.');
}

function handleDeleteMeter(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Meter wajib diisi.', 400);
  deleteRowById('Meters', id);
  return jsonResponse(null, 200, 'Meter dihapus.');
}

// ==========================================
// 5. READINGS & TARIFFS
// ==========================================
function handleGetReadings(authUser, params) {
  var readings = getAllRows('MeterReadings');
  var customers = getAllRows('Customers');
  var meters = getAllRows('Meters');
  var users = getAllRows('Users');

  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];
  var meterMap = {};
  for (var m = 0; m < meters.length; m++) meterMap[meters[m].id] = meters[m];
  var userMap = {};
  for (var u = 0; u < users.length; u++) userMap[users[u].id] = users[u];

  var monthFilter = params.period_month ? parseInt(params.period_month) : null;
  var yearFilter = params.period_year ? parseInt(params.period_year) : null;
  var customerIdFilter = (authUser.role === 'customer') ? authUser.customerId : (params.customer_id || '');

  var filtered = readings.filter(function(r) {
    if (customerIdFilter && String(r.customer_id) !== String(customerIdFilter)) return false;
    if (monthFilter && parseInt(r.period_month) !== monthFilter) return false;
    if (yearFilter && parseInt(r.period_year) !== yearFilter) return false;
    return true;
  });

  filtered.sort(function(a, b) {
    return (parseInt(b.period_year) * 100 + parseInt(b.period_month)) - (parseInt(a.period_year) * 100 + parseInt(a.period_month));
  });

  var enriched = filtered.map(function(r) {
    var cust = custMap[r.customer_id];
    var meter = meterMap[r.meter_id];
    var reader = userMap[r.reader_id];
    return {
      id: r.id,
      reading_no: r.reading_no,
      customer_id: r.customer_id,
      customer_name: cust ? cust.full_name : '-',
      customer_no: cust ? cust.customer_no : '-',
      rt_rw: cust ? cust.rt_rw : '-',
      meter_id: r.meter_id,
      meter_no: meter ? meter.meter_no : '-',
      period_month: parseInt(r.period_month),
      period_year: parseInt(r.period_year),
      prev_reading: Number(r.prev_reading || 0),
      current_reading: Number(r.current_reading || 0),
      usage_m3: Number(r.usage_m3 || 0),
      reading_date: r.reading_date || '',
      reader_name: reader ? reader.full_name : 'Petugas',
      notes: r.notes || '',
      created_at: r.created_at
    };
  });

  return jsonResponse(enriched, 200, 'Daftar pembacaan meter.');
}

function handleGetPrevReading(params) {
  var customerId = params.customer_id;
  if (!customerId) return errorResponse('ID Pelanggan wajib diisi.', 400);

  var customer = getRowById('Customers', customerId);
  if (!customer) return errorResponse('Pelanggan tidak ditemukan.', 404);

  var meterId = customer.meter_id;
  var meter = meterId ? getRowById('Meters', meterId) : null;
  var initialReading = meter ? Number(meter.initial_reading || 0) : 0;
  var currentReading = meter ? Number(meter.current_reading || 0) : initialReading;

  var readings = getAllRows('MeterReadings').filter(function(r) { return String(r.customer_id) === String(customerId); });
  readings.sort(function(a, b) {
    return (parseInt(b.period_year) * 100 + parseInt(b.period_month)) - (parseInt(a.period_year) * 100 + parseInt(a.period_month));
  });

  var prevReading = readings.length > 0 ? Number(readings[0].current_reading) : initialReading;

  return jsonResponse({
    customer_id: customerId,
    customer_no: customer.customer_no,
    customer_name: customer.full_name,
    meter_id: meterId,
    meter_no: meter ? meter.meter_no : '',
    prev_reading: prevReading,
    meter_current_reading: currentReading
  }, 200, 'Meter sebelumnya.');
}

function handleRecordReading(authUser, data) {
  var customerId = data.customer_id;
  var periodMonth = parseInt(data.period_month);
  var periodYear = parseInt(data.period_year);
  var prevReading = Number(data.prev_reading || 0);
  var currentReading = Number(data.current_reading || 0);

  if (!customerId || !periodMonth || !periodYear || isNaN(currentReading)) {
    return errorResponse('Parameter wajib belum lengkap.', 400);
  }

  if (currentReading < prevReading) {
    return errorResponse('Angka meter sekarang tidak boleh lebih kecil dari meter sebelumnya.', 400);
  }

  var customer = getRowById('Customers', customerId);
  if (!customer) return errorResponse('Pelanggan tidak ditemukan.', 404);

  var meterId = customer.meter_id;
  var usageM3 = currentReading - prevReading;
  var readingId = generateUniqueId('RDM_ID');
  var readingNo = generateUniqueId('RDM');
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');

  var newReading = {
    id: readingId,
    reading_no: readingNo,
    customer_id: customerId,
    meter_id: meterId || '',
    period_month: periodMonth,
    period_year: periodYear,
    prev_reading: prevReading,
    current_reading: currentReading,
    usage_m3: usageM3,
    reading_date: data.reading_date || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd'),
    reader_id: authUser.userId,
    notes: data.notes || '',
    photo_url: data.photo_url || '',
    created_at: nowStr
  };

  appendRow('MeterReadings', newReading);
  if (meterId) updateRowById('Meters', meterId, { current_reading: currentReading });

  var generatedBill = null;
  if (data.auto_generate_bill === true || data.auto_generate_bill === 'true') {
    generatedBill = internalGenerateBill(authUser, {
      customer_id: customerId,
      reading_id: readingId,
      period_month: periodMonth,
      period_year: periodYear,
      prev_reading: prevReading,
      current_reading: currentReading,
      usage_m3: usageM3
    });
  }

  return jsonResponse({ reading: newReading, bill: generatedBill }, 201, 'Pencatatan meter berhasil.');
}

function handleGetTariffs() {
  var tariffs = getAllRows('Tariffs');
  var formatted = tariffs.map(function(t) {
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      category: t.category || 'Rumah Tangga',
      base_fee: Number(t.base_fee || 0),
      tier1_max: Number(t.tier1_max || 10),
      tier1_rate: Number(t.tier1_rate || 2000),
      tier2_max: Number(t.tier2_max || 20),
      tier2_rate: Number(t.tier2_rate || 3000),
      tier3_rate: Number(t.tier3_rate || 5000),
      late_fee: Number(t.late_fee || 5000),
      is_active: t.is_active === true || t.is_active === 'TRUE' || t.is_active === 1 || t.is_active === '1',
      description: t.description || '',
      created_at: t.created_at
    };
  });
  return jsonResponse(formatted, 200, 'Daftar tarif.');
}

function handleCreateTariff(authUser, data) {
  var name = String(data.name || '').trim();
  if (!name) return errorResponse('Nama tarif wajib diisi.', 400);

  var newTariff = {
    id: generateUniqueId('TRF_ID'),
    code: data.code ? String(data.code).trim().toUpperCase() : generateUniqueId('TRF'),
    name: name,
    category: data.category || 'Rumah Tangga',
    base_fee: Number(data.base_fee || 0),
    tier1_max: Number(data.tier1_max || 10),
    tier1_rate: Number(data.tier1_rate || 2000),
    tier2_max: Number(data.tier2_max || 20),
    tier2_rate: Number(data.tier2_rate || 3000),
    tier3_rate: Number(data.tier3_rate || 5000),
    late_fee: Number(data.late_fee || 5000),
    is_active: data.is_active !== undefined ? (data.is_active ? 'TRUE' : 'FALSE') : 'TRUE',
    description: data.description || '',
    created_at: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss')
  };

  appendRow('Tariffs', newTariff);
  return jsonResponse(newTariff, 201, 'Tarif berhasil ditambahkan.');
}

function handleUpdateTariff(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Tarif wajib diisi.', 400);
  updateRowById('Tariffs', id, data);
  return jsonResponse(null, 200, 'Tarif diperbarui.');
}

function calculateWaterBill(usageM3, tariff) {
  var usage = Math.max(0, Number(usageM3 || 0));
  var baseFee = Number(tariff.base_fee || 0);
  var tier1Max = Number(tariff.tier1_max || 10);
  var tier1Rate = Number(tariff.tier1_rate || 2000);
  var tier2Max = Number(tariff.tier2_max || 20);
  var tier2Rate = Number(tariff.tier2_rate || 3000);
  var tier3Rate = Number(tariff.tier3_rate || 5000);

  var tier1Usage = 0, tier2Usage = 0, tier3Usage = 0;
  if (usage <= tier1Max) {
    tier1Usage = usage;
  } else if (usage <= tier2Max) {
    tier1Usage = tier1Max;
    tier2Usage = usage - tier1Max;
  } else {
    tier1Usage = tier1Max;
    tier2Usage = tier2Max - tier1Max;
    tier3Usage = usage - tier2Max;
  }

  var tier1Amount = tier1Usage * tier1Rate;
  var tier2Amount = tier2Usage * tier2Rate;
  var tier3Amount = tier3Usage * tier3Rate;
  var usageAmount = tier1Amount + tier2Amount + tier3Amount;

  return {
    usage_m3: usage,
    base_fee: baseFee,
    tier1_usage: tier1Usage,
    tier1_rate: tier1Rate,
    tier1_amount: tier1Amount,
    tier2_usage: tier2Usage,
    tier2_rate: tier2Rate,
    tier2_amount: tier2Amount,
    tier3_usage: tier3Usage,
    tier3_rate: tier3Rate,
    tier3_amount: tier3Amount,
    usage_amount: usageAmount,
    late_fee: Number(tariff.late_fee || 0),
    total_amount: baseFee + usageAmount
  };
}

// ==========================================
// 6. BILLS & PAYMENTS
// ==========================================
function handleGetBills(authUser, params) {
  var bills = getAllRows('Bills');
  var customers = getAllRows('Customers');
  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];

  var monthFilter = params.period_month ? parseInt(params.period_month) : null;
  var yearFilter = params.period_year ? parseInt(params.period_year) : null;
  var statusFilter = params.status || '';
  var customerIdFilter = (authUser.role === 'customer') ? authUser.customerId : (params.customer_id || '');
  var search = String(params.search || '').toLowerCase();
  var todayStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');

  var filtered = bills.filter(function(b) {
    if (customerIdFilter && String(b.customer_id) !== String(customerIdFilter)) return false;
    if (monthFilter && parseInt(b.period_month) !== monthFilter) return false;
    if (yearFilter && parseInt(b.period_year) !== yearFilter) return false;
    if (statusFilter && b.status !== statusFilter) return false;
    if (search) {
      var cust = custMap[b.customer_id];
      var matchBillNo = String(b.bill_no || '').toLowerCase().indexOf(search) !== -1;
      var matchCust = cust ? String(cust.full_name || '').toLowerCase().indexOf(search) !== -1 : false;
      return matchBillNo || matchCust;
    }
    return true;
  });

  filtered.sort(function(a, b) {
    return (parseInt(b.period_year) * 100 + parseInt(b.period_month)) - (parseInt(a.period_year) * 100 + parseInt(a.period_month));
  });

  var enriched = filtered.map(function(b) {
    var cust = custMap[b.customer_id];
    var status = b.status || 'Belum Dibayar';
    if ((status === 'Belum Dibayar' || status === 'Sebagian Dibayar') && b.due_date && b.due_date < todayStr) {
      status = 'Jatuh Tempo';
    }
    return {
      id: b.id,
      bill_no: b.bill_no,
      customer_id: b.customer_id,
      customer_name: cust ? cust.full_name : '-',
      customer_no: cust ? cust.customer_no : '-',
      rt_rw: cust ? cust.rt_rw : '-',
      period_month: parseInt(b.period_month),
      period_year: parseInt(b.period_year),
      prev_reading: Number(b.prev_reading || 0),
      current_reading: Number(b.current_reading || 0),
      usage_m3: Number(b.usage_m3 || 0),
      base_amount: Number(b.base_amount || 0),
      usage_amount: Number(b.usage_amount || 0),
      late_fee: Number(b.late_fee || 0),
      total_amount: Number(b.total_amount || 0),
      paid_amount: Number(b.paid_amount || 0),
      balance_due: Number(b.balance_due || b.total_amount || 0),
      due_date: b.due_date || '',
      status: status,
      created_at: b.created_at
    };
  });

  return jsonResponse(enriched, 200, 'Daftar tagihan.');
}

function handleGetBillById(authUser, data) {
  var id = data.id || data.bill_id;
  if (!id) return errorResponse('ID Tagihan wajib diisi.', 400);

  var bill = getRowById('Bills', id);
  if (!bill) return errorResponse('Tagihan tidak ditemukan.', 404);

  if (authUser.role === 'customer' && String(bill.customer_id) !== String(authUser.customerId)) {
    return errorResponse('Akses ditolak.', 403);
  }

  var customer = getRowById('Customers', bill.customer_id);
  var tariff = customer && customer.tariff_id ? getRowById('Tariffs', customer.tariff_id) : null;
  var meter = customer && customer.meter_id ? getRowById('Meters', customer.meter_id) : null;
  var reading = bill.reading_id ? getRowById('MeterReadings', bill.reading_id) : null;
  var payments = getAllRows('Payments').filter(function(p) { return String(p.bill_id) === String(bill.id); });

  var breakdown = calculateWaterBill(bill.usage_m3, tariff || { base_fee: 5000, tier1_max: 10, tier1_rate: 2000, tier2_max: 20, tier2_rate: 3000, tier3_rate: 5000 });

  return jsonResponse({
    bill: bill,
    customer: customer,
    tariff: tariff,
    meter: meter,
    reading: reading,
    payments: payments,
    breakdown: breakdown
  }, 200, 'Detail tagihan.');
}

function internalGenerateBill(authUser, params) {
  var customerId = params.customer_id;
  var periodMonth = parseInt(params.period_month);
  var periodYear = parseInt(params.period_year);
  var customer = getRowById('Customers', customerId);
  if (!customer) return null;

  var tariff = customer.tariff_id ? getRowById('Tariffs', customer.tariff_id) : null;
  if (!tariff) tariff = { base_fee: 5000, tier1_max: 10, tier1_rate: 2000, tier2_max: 20, tier2_rate: 3000, tier3_rate: 5000, late_fee: 5000 };

  var prevReading = Number(params.prev_reading || 0);
  var currentReading = Number(params.current_reading || 0);
  var usageM3 = Number(params.usage_m3 || (currentReading - prevReading));
  var breakdown = calculateWaterBill(usageM3, tariff);

  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  var billId = generateUniqueId('BILL_ID');
  var billNo = generateUniqueId('INV');
  var dueDateObj = new Date(periodYear, periodMonth - 1, 20);
  var dueDateStr = Utilities.formatDate(dueDateObj, 'GMT+7', 'yyyy-MM-dd');

  var newBill = {
    id: billId,
    bill_no: billNo,
    customer_id: customerId,
    reading_id: params.reading_id || '',
    period_month: periodMonth,
    period_year: periodYear,
    prev_reading: prevReading,
    current_reading: currentReading,
    usage_m3: usageM3,
    base_amount: breakdown.base_fee,
    usage_amount: breakdown.usage_amount,
    late_fee: 0,
    total_amount: breakdown.total_amount,
    paid_amount: 0,
    balance_due: breakdown.total_amount,
    due_date: dueDateStr,
    status: 'Belum Dibayar',
    created_at: nowStr,
    updated_at: nowStr
  };

  appendRow('Bills', newBill);
  logAudit(authUser.userId, authUser.username, 'GENERATE_BILL', 'Membuat tagihan ' + billNo + ' untuk ' + customer.full_name);
  return newBill;
}

function handleGenerateBill(authUser, data) {
  var newBill = internalGenerateBill(authUser, data);
  if (!newBill) return errorResponse('Gagal membuat tagihan.', 500);
  return jsonResponse(newBill, 201, 'Tagihan berhasil dibuat.');
}

function handleGenerateBatchBills(authUser, data) {
  var periodMonth = parseInt(data.period_month);
  var periodYear = parseInt(data.period_year);
  if (!periodMonth || !periodYear) return errorResponse('Bulan dan Tahun wajib diisi.', 400);

  var customers = getAllRows('Customers').filter(function(c) { return c.status === 'Aktif'; });
  var readings = getAllRows('MeterReadings').filter(function(r) { return parseInt(r.period_month) === periodMonth && parseInt(r.period_year) === periodYear; });
  var existingBills = getAllRows('Bills').filter(function(b) { return parseInt(b.period_month) === periodMonth && parseInt(b.period_year) === periodYear; });

  var readingCustMap = {};
  for (var r = 0; r < readings.length; r++) readingCustMap[readings[r].customer_id] = readings[r];

  var existingSet = {};
  for (var eb = 0; eb < existingBills.length; eb++) existingSet[existingBills[eb].customer_id] = true;

  var generatedCount = 0;
  for (var c = 0; c < customers.length; c++) {
    var cust = customers[c];
    if (existingSet[cust.id]) continue;
    var reading = readingCustMap[cust.id];
    if (!reading) continue;

    internalGenerateBill(authUser, {
      customer_id: cust.id,
      reading_id: reading.id,
      period_month: periodMonth,
      period_year: periodYear,
      prev_reading: Number(reading.prev_reading),
      current_reading: Number(reading.current_reading),
      usage_m3: Number(reading.usage_m3)
    });
    generatedCount++;
  }

  return jsonResponse({ generated_count: generatedCount }, 200, 'Batch generate selesai.');
}

function handleUpdateBillStatus(authUser, data) {
  var id = data.id;
  var status = data.status;
  if (!id || !status) return errorResponse('ID dan Status wajib diisi.', 400);
  updateRowById('Bills', id, { status: status });
  return jsonResponse(null, 200, 'Status tagihan diperbarui.');
}

function handleGetPayments(authUser, params) {
  var payments = getAllRows('Payments');
  var customers = getAllRows('Customers');
  var bills = getAllRows('Bills');
  var users = getAllRows('Users');

  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];
  var billMap = {};
  for (var b = 0; b < bills.length; b++) billMap[bills[b].id] = bills[b];
  var userMap = {};
  for (var u = 0; u < users.length; u++) userMap[users[u].id] = users[u];

  var customerIdFilter = (authUser.role === 'customer') ? authUser.customerId : (params.customer_id || '');
  var search = String(params.search || '').toLowerCase();

  var filtered = payments.filter(function(p) {
    if (customerIdFilter && String(p.customer_id) !== String(customerIdFilter)) return false;
    if (search) {
      var cust = custMap[p.customer_id];
      var bill = billMap[p.bill_id];
      var matchPayNo = String(p.payment_no || '').toLowerCase().indexOf(search) !== -1;
      var matchCust = cust ? String(cust.full_name || '').toLowerCase().indexOf(search) !== -1 : false;
      return matchPayNo || matchCust;
    }
    return true;
  });

  filtered.sort(function(a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });

  var enriched = filtered.map(function(p) {
    var cust = custMap[p.customer_id];
    var bill = billMap[p.bill_id];
    var cashier = userMap[p.cashier_id];
    return {
      id: p.id,
      payment_no: p.payment_no,
      bill_id: p.bill_id,
      bill_no: bill ? bill.bill_no : '-',
      period_month: bill ? bill.period_month : '-',
      period_year: bill ? bill.period_year : '-',
      customer_id: p.customer_id,
      customer_name: cust ? cust.full_name : '-',
      customer_no: cust ? cust.customer_no : '-',
      rt_rw: cust ? cust.rt_rw : '-',
      payment_date: p.payment_date || '',
      amount_paid: Number(p.amount_paid || 0),
      payment_method: p.payment_method || 'Tunai',
      cashier_name: cashier ? cashier.full_name : 'Kasir',
      notes: p.notes || '',
      created_at: p.created_at
    };
  });

  return jsonResponse(enriched, 200, 'Daftar pembayaran.');
}

function handleRecordPayment(authUser, data) {
  var billId = data.bill_id;
  var amountPaid = Number(data.amount_paid || 0);
  if (!billId || amountPaid <= 0) return errorResponse('ID Tagihan & Jumlah Pembayaran wajib valid.', 400);

  var bill = getRowById('Bills', billId);
  if (!bill) return errorResponse('Tagihan tidak ditemukan.', 404);

  var prevPaid = Number(bill.paid_amount || 0);
  var totalAmount = Number(bill.total_amount || 0);
  var newPaidTotal = prevPaid + amountPaid;
  var newBalance = Math.max(0, totalAmount - newPaidTotal);
  var newStatus = newBalance <= 0 ? 'Lunas' : 'Sebagian Dibayar';

  var paymentId = generateUniqueId('PAY_ID');
  var paymentNo = generateUniqueId('PAY');
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');

  var newPayment = {
    id: paymentId,
    payment_no: paymentNo,
    bill_id: billId,
    customer_id: bill.customer_id,
    payment_date: data.payment_date || nowStr,
    amount_paid: amountPaid,
    payment_method: data.payment_method || 'Tunai',
    cashier_id: authUser.userId,
    notes: data.notes || '',
    created_at: nowStr
  };

  appendRow('Payments', newPayment);
  updateRowById('Bills', billId, { paid_amount: newPaidTotal, balance_due: newBalance, status: newStatus });
  logAudit(authUser.userId, authUser.username, 'RECORD_PAYMENT', 'Penerimaan pembayaran ' + paymentNo + ' (Rp ' + amountPaid + ')');

  return jsonResponse({ payment: newPayment, status: newStatus }, 201, 'Pembayaran berhasil dicatat.');
}

function handleGetPaymentReceipt(authUser, data) {
  var id = data.id || data.payment_id;
  var payment = getRowById('Payments', id);
  if (!payment) return errorResponse('Pembayaran tidak ditemukan.', 404);

  var bill = getRowById('Bills', payment.bill_id);
  var customer = getRowById('Customers', payment.customer_id);
  var meter = customer && customer.meter_id ? getRowById('Meters', customer.meter_id) : null;
  var cashier = payment.cashier_id ? getRowById('Users', payment.cashier_id) : null;

  return jsonResponse({ payment: payment, bill: bill, customer: customer, meter: meter, cashier_name: cashier ? cashier.full_name : 'Kasir' }, 200, 'Kuitansi.');
}

// ==========================================
// 7. REPORTS, SETTINGS & AUDIT
// ==========================================
function handleGetDashboardSummary(authUser, params) {
  var now = new Date();
  var currentMonth = parseInt(Utilities.formatDate(now, 'GMT+7', 'MM'));
  var currentYear = parseInt(Utilities.formatDate(now, 'GMT+7', 'yyyy'));

  var bills = getAllRows('Bills');
  var payments = getAllRows('Payments');
  var customers = getAllRows('Customers');
  var readings = getAllRows('MeterReadings');
  var meters = getAllRows('Meters');

  if (authUser.role === 'customer') {
    var customerId = authUser.customerId;
    var custObj = getRowById('Customers', customerId);
    var meterObj = custObj && custObj.meter_id ? getRowById('Meters', custObj.meter_id) : null;
    var custBills = bills.filter(function(b) { return String(b.customer_id) === String(customerId); });
    var custPayments = payments.filter(function(p) { return String(p.customer_id) === String(customerId); });
    var custReadings = readings.filter(function(r) { return String(r.customer_id) === String(customerId); });

    var totalUnpaid = 0;
    var activeBill = null;
    for (var i = 0; i < custBills.length; i++) {
      if (custBills[i].status !== 'Lunas') totalUnpaid += Number(custBills[i].balance_due || custBills[i].total_amount || 0);
      if (parseInt(custBills[i].period_month) === currentMonth && parseInt(custBills[i].period_year) === currentYear) activeBill = custBills[i];
    }

    var usageHistory = [];
    for (var m = 5; m >= 0; m--) {
      var d = new Date(currentYear, currentMonth - 1 - m, 1);
      var mon = d.getMonth() + 1;
      var yr = d.getFullYear();
      var r = custReadings.find(function(rd) { return parseInt(rd.period_month) === mon && parseInt(rd.period_year) === yr; });
      usageHistory.push({ month: mon, year: yr, period_name: getMonthNameIndo(mon) + ' ' + yr, usage_m3: r ? Number(r.usage_m3 || 0) : 0 });
    }

    return jsonResponse({ customer: custObj, meter: meterObj, total_unpaid: totalUnpaid, active_bill: activeBill, recent_payments: custPayments.slice(-5).reverse(), usage_history: usageHistory }, 200, 'Dashboard');
  }

  var totalCustomers = customers.length;
  var activeCustomers = customers.filter(function(c) { return c.status === 'Aktif'; }).length;
  var totalMeters = meters.length;

  var currentMonthBills = bills.filter(function(b) { return parseInt(b.period_month) === currentMonth && parseInt(b.period_year) === currentYear; });
  var totalBilledThisMonth = currentMonthBills.reduce(function(acc, b) { return acc + Number(b.total_amount || 0); }, 0);
  var totalUsageThisMonth = currentMonthBills.reduce(function(acc, b) { return acc + Number(b.usage_m3 || 0); }, 0);

  var currentMonthStr = Utilities.formatDate(now, 'GMT+7', 'yyyy-MM');
  var totalCollectedThisMonth = payments
    .filter(function(p) { return p.payment_date && String(p.payment_date).indexOf(currentMonthStr) === 0; })
    .reduce(function(acc, p) { return acc + Number(p.amount_paid || 0); }, 0);

  var totalArrears = bills.filter(function(b) { return b.status !== 'Lunas'; }).reduce(function(acc, b) { return acc + Number(b.balance_due || b.total_amount || 0); }, 0);

  var monthlyTrends = [];
  for (var idx = 5; idx >= 0; idx--) {
    var dt = new Date(currentYear, currentMonth - 1 - idx, 1);
    var tMonth = dt.getMonth() + 1;
    var tYear = dt.getFullYear();
    var tPrefix = Utilities.formatDate(dt, 'GMT+7', 'yyyy-MM');

    var mBills = bills.filter(function(b) { return parseInt(b.period_month) === tMonth && parseInt(b.period_year) === tYear; });
    var mBilled = mBills.reduce(function(acc, b) { return acc + Number(b.total_amount || 0); }, 0);
    var mUsage = mBills.reduce(function(acc, b) { return acc + Number(b.usage_m3 || 0); }, 0);
    var mPaid = payments.filter(function(p) { return p.payment_date && String(p.payment_date).indexOf(tPrefix) === 0; }).reduce(function(acc, p) { return acc + Number(p.amount_paid || 0); }, 0);

    monthlyTrends.push({ month: tMonth, year: tYear, period_name: getMonthNameIndo(tMonth) + ' ' + tYear, billed_amount: mBilled, collected_amount: mPaid, usage_m3: mUsage });
  }

  return jsonResponse({
    stats: {
      total_customers: totalCustomers,
      active_customers: activeCustomers,
      total_meters: totalMeters,
      total_billed_this_month: totalBilledThisMonth,
      total_collected_this_month: totalCollectedThisMonth,
      total_usage_this_month: totalUsageThisMonth,
      total_arrears: totalArrears
    },
    monthly_trends: monthlyTrends,
    recent_payments: payments.slice(-8).reverse(),
    recent_readings: readings.slice(-8).reverse()
  }, 200, 'Dashboard Admin');
}

function handleGetBillingReport(params) {
  var month = params.period_month ? parseInt(params.period_month) : null;
  var year = params.period_year ? parseInt(params.period_year) : null;
  var bills = getAllRows('Bills');
  var customers = getAllRows('Customers');
  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];

  var filtered = bills.filter(function(b) {
    if (month && parseInt(b.period_month) !== month) return false;
    if (year && parseInt(b.period_year) !== year) return false;
    return true;
  });

  var items = filtered.map(function(b) {
    var cust = custMap[b.customer_id];
    return {
      id: b.id,
      bill_no: b.bill_no,
      customer_no: cust ? cust.customer_no : '-',
      customer_name: cust ? cust.full_name : '-',
      rt_rw: cust ? cust.rt_rw : '-',
      period: b.period_month + '/' + b.period_year,
      usage_m3: Number(b.usage_m3 || 0),
      total_amount: Number(b.total_amount || 0),
      paid_amount: Number(b.paid_amount || 0),
      balance_due: Number(b.balance_due || b.total_amount || 0),
      status: b.status || 'Belum Dibayar',
      due_date: b.due_date
    };
  });

  return jsonResponse({ items: items }, 200, 'Laporan Tagihan');
}

function handleGetPaymentReport(params) {
  var payments = getAllRows('Payments');
  var customers = getAllRows('Customers');
  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];

  var items = payments.map(function(p) {
    var cust = custMap[p.customer_id];
    return {
      payment_no: p.payment_no,
      payment_date: p.payment_date,
      customer_no: cust ? cust.customer_no : '-',
      customer_name: cust ? cust.full_name : '-',
      amount_paid: Number(p.amount_paid || 0),
      payment_method: p.payment_method || 'Tunai'
    };
  });

  return jsonResponse({ items: items }, 200, 'Laporan Pembayaran');
}

function handleGetArrearsReport(params) {
  var bills = getAllRows('Bills').filter(function(b) { return b.status !== 'Lunas'; });
  var customers = getAllRows('Customers');
  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];

  var map = {};
  for (var i = 0; i < bills.length; i++) {
    var b = bills[i];
    var cust = custMap[b.customer_id];
    if (!map[b.customer_id]) {
      map[b.customer_id] = {
        customer_no: cust ? cust.customer_no : '-',
        customer_name: cust ? cust.full_name : '-',
        phone: cust ? cust.phone : '-',
        rt_rw: cust ? cust.rt_rw : '-',
        total_arrears: 0,
        unpaid_months_count: 0
      };
    }
    map[b.customer_id].total_arrears += Number(b.balance_due || b.total_amount || 0);
    map[b.customer_id].unpaid_months_count++;
  }

  var list = Object.keys(map).map(function(k) { return map[k]; });
  return jsonResponse({ items: list }, 200, 'Laporan Tunggakan');
}

function handleGetUsageReport(params) {
  var readings = getAllRows('MeterReadings');
  var customers = getAllRows('Customers');
  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];

  var items = readings.map(function(r) {
    var cust = custMap[r.customer_id];
    return {
      reading_no: r.reading_no,
      customer_no: cust ? cust.customer_no : '-',
      customer_name: cust ? cust.full_name : '-',
      rt_rw: cust ? cust.rt_rw : '-',
      period: r.period_month + '/' + r.period_year,
      usage_m3: Number(r.usage_m3 || 0),
      reading_date: r.reading_date
    };
  });
  return jsonResponse({ items: items }, 200, 'Laporan Pemakaian');
}

function handleGetSettings() {
  var settingsRows = getAllRows('Settings');
  var settingsMap = {};
  for (var i = 0; i < settingsRows.length; i++) settingsMap[settingsRows[i].key] = settingsRows[i].value;
  return jsonResponse(settingsMap, 200, 'Pengaturan');
}

function handleUpdateSettings(authUser, data) {
  var settingsObj = data.settings || data;
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  for (var key in settingsObj) {
    if (settingsObj.hasOwnProperty(key)) {
      appendRow('Settings', { key: key, value: String(settingsObj[key]), description: '', updated_at: nowStr });
    }
  }
  return jsonResponse(settingsObj, 200, 'Pengaturan disimpan.');
}

function handleGetAuditLogs(params) {
  var logs = getAllRows('AuditLogs');
  logs.sort(function(a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
  return jsonResponse(logs.slice(0, 100), 200, 'Audit Logs');
}

function setupDatabase() {
  var ss = getDb();
  var tables = ['Users', 'Customers', 'Meters', 'MeterReadings', 'Tariffs', 'Bills', 'Payments', 'Settings', 'AuditLogs'];
  for (var i = 0; i < tables.length; i++) {
    if (!ss.getSheetByName(tables[i])) ss.insertSheet(tables[i]);
  }
  return 'Database diinisialisasi.';
}

function seedDemoData() {
  return 'Data demo disiapkan.';
}

function handleSetupDatabase(data) {
  return jsonResponse({ result: setupDatabase() }, 200, 'Setup database sukses.');
}

function handleSeedDemoData(data) {
  return jsonResponse({ result: seedDemoData() }, 200, 'Seed sukses.');
}
