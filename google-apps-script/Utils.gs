/**
 * Sandmosquito Water Billing - Google Apps Script Utilities
 * Provides Database helpers, CORS handler, Auth Hashing, ID Generators, and Audit Logger
 */

// Secret key for HMAC token signing (can be customized via ScriptProperties)
var JWT_SECRET = 'sandmosquito_water_billing_secret_key_2026';

/**
 * Get active spreadsheet or open by configured ID
 */
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

/**
 * Get Sheet by Name
 */
function getSheet(sheetName) {
  var db = getDb();
  if (!db) {
    throw new Error('Spreadsheet database tidak ditemukan.');
  }
  var sheet = db.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" tidak ditemukan.');
  }
  return sheet;
}

/**
 * Convert sheet data to array of objects using headers
 */
function getAllRows(sheetName) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // Skip completely empty rows
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

/**
 * Find single row by ID
 */
function getRowById(sheetName, id) {
  var rows = getAllRows(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) {
      return rows[i];
    }
  }
  return null;
}

/**
 * Find rows by filter predicate function
 */
function findRows(sheetName, predicate) {
  var rows = getAllRows(sheetName);
  return rows.filter(predicate);
}

/**
 * Append a row object to sheet matching header columns
 */
function appendRow(sheetName, dataObj) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) {
    throw new Error('Sheet "' + sheetName + '" tidak memiliki baris header.');
  }

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var newRow = [];

  for (var j = 0; j < headers.length; j++) {
    var header = headers[j];
    var val = dataObj[header];
    if (val === undefined || val === null) {
      newRow.push('');
    } else {
      newRow.push(val);
    }
  }

  sheet.appendRow(newRow);
  return dataObj;
}

/**
 * Update row by ID
 */
function updateRowById(sheetName, id, updateObj) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idColIdx = headers.indexOf('id');
  if (idColIdx === -1) {
    throw new Error('Kolom "id" tidak ditemukan pada sheet "' + sheetName + '".');
  }

  var targetRowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idColIdx]) === String(id)) {
      targetRowIdx = i + 1; // 1-indexed for Sheet API
      break;
    }
  }

  if (targetRowIdx === -1) {
    return null; // Not found
  }

  // Update specific fields
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

  // Set updated_at if header exists and not provided
  var updatedIdx = headers.indexOf('updated_at');
  if (updatedIdx !== -1 && !updateObj.updated_at) {
    var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
    sheet.getRange(targetRowIdx, updatedIdx + 1).setValue(nowStr);
  }

  return getRowById(sheetName, id);
}

/**
 * Delete row by ID
 */
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

/**
 * Generate formatted IDs
 */
function generateUniqueId(prefix) {
  var now = new Date();
  var year = Utilities.formatDate(now, 'GMT+7', 'yyyy');
  var month = Utilities.formatDate(now, 'GMT+7', 'MM');
  var randomNum = Math.floor(1000 + Math.random() * 9000);
  var timeComponent = now.getTime().toString().slice(-4);

  if (prefix === 'CUST') {
    return 'CUST-' + year + '-' + randomNum;
  } else if (prefix === 'INV' || prefix === 'BILL') {
    return 'INV-' + year + month + '-' + randomNum;
  } else if (prefix === 'PAY') {
    return 'PAY-' + year + month + '-' + randomNum;
  } else if (prefix === 'MTR') {
    return 'MTR-' + randomNum + timeComponent.slice(0, 2);
  } else if (prefix === 'RDM') {
    return 'RDM-' + year + month + '-' + randomNum;
  } else if (prefix === 'USR') {
    return 'USR-' + randomNum;
  } else if (prefix === 'TRF') {
    return 'TRF-' + randomNum;
  }
  return (prefix ? prefix + '-' : '') + Utilities.getUuid().substring(0, 8);
}

/**
 * Hash password with SHA-256 and Salt
 */
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

/**
 * Generate random salt
 */
function generateSalt() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

/**
 * Generate Auth Token (Signed Payload with Expiration)
 */
function generateToken(user) {
  var payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    customerId: user.customer_id || '',
    fullName: user.full_name,
    exp: new Date().getTime() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };

  var payloadStr = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var signatureBytes = Utilities.computeHmacSha256Signature(payloadStr, JWT_SECRET);
  var signature = Utilities.base64EncodeWebSafe(signatureBytes);

  return payloadStr + '.' + signature;
}

/**
 * Verify and decode Auth Token
 */
function verifyToken(token) {
  if (!token) return null;
  var parts = token.split('.');
  if (parts.length !== 2) return null;

  var payloadStr = parts[0];
  var signature = parts[1];

  var expectedSignatureBytes = Utilities.computeHmacSha256Signature(payloadStr, JWT_SECRET);
  var expectedSignature = Utilities.base64EncodeWebSafe(expectedSignatureBytes);

  if (signature !== expectedSignature) {
    return null; // Invalid signature
  }

  try {
    var decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadStr)).getDataAsString();
    var payload = JSON.parse(decoded);

    // Check expiration
    if (payload.exp && payload.exp < new Date().getTime()) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Standard JSON Response Builder
 */
function jsonResponse(data, status, message) {
  var responseObj = {
    success: (status === undefined || status === 200 || status === true),
    status: status || 200,
    message: message || (status === 200 || status === true ? 'Berhasil' : 'Gagal'),
    data: data || null,
    timestamp: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss')
  };

  return ContentService.createTextOutput(JSON.stringify(responseObj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Error JSON Response Builder
 */
function errorResponse(message, status) {
  return jsonResponse(null, status || 400, message);
}

/**
 * Log action to AuditLogs sheet
 */
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
  } catch (e) {
    Logger.log('Gagal mencatat audit log: ' + e.message);
  }
}
