/**
 * Sandmosquito Water Billing - Google Apps Script Meters Module
 * Water meter management, status tracking, and customer association.
 */

function handleGetMeters(params) {
  var meters = getAllRows('Meters');
  var customers = getAllRows('Customers');

  var custMap = {};
  for (var c = 0; c < customers.length; c++) {
    custMap[customers[c].id] = customers[c];
  }

  var statusFilter = params.status || '';
  var search = String(params.search || '').toLowerCase();

  var filtered = meters.filter(function(m) {
    if (statusFilter && m.status !== statusFilter) return false;
    if (search) {
      var matchMeterNo = String(m.meter_no || '').toLowerCase().indexOf(search) !== -1;
      var cust = custMap[m.customer_id];
      var matchCustName = cust ? String(cust.full_name || '').toLowerCase().indexOf(search) !== -1 : false;
      var matchCustNo = cust ? String(cust.customer_no || '').toLowerCase().indexOf(search) !== -1 : false;
      return matchMeterNo || matchCustName || matchCustNo;
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

  return jsonResponse(enriched, 200, 'Daftar meter air berhasil dimuat.');
}

function handleCreateMeter(authUser, data) {
  var meterNo = data.meter_no ? String(data.meter_no).trim().toUpperCase() : generateUniqueId('MTR');
  var customerId = data.customer_id || '';
  var brand = data.brand || 'Standard SNI';
  var initialReading = Number(data.initial_reading || 0);

  // Check unique meter_no
  var existingMeters = getAllRows('Meters');
  for (var i = 0; i < existingMeters.length; i++) {
    if (String(existingMeters[i].meter_no).toUpperCase() === meterNo) {
      return errorResponse('Nomor Meter "' + meterNo + '" sudah terdaftar.', 400);
    }
  }

  var id = generateUniqueId('MTR_ID');
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');

  var newMeter = {
    id: id,
    meter_no: meterNo,
    customer_id: customerId,
    installation_date: data.installation_date || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd'),
    brand: brand,
    initial_reading: initialReading,
    current_reading: initialReading,
    status: data.status || 'Aktif',
    created_at: nowStr
  };

  appendRow('Meters', newMeter);

  // If customer_id provided, link to customer
  if (customerId) {
    updateRowById('Customers', customerId, { meter_id: id });
  }

  logAudit(authUser.userId, authUser.username, 'CREATE_METER', 'Menambahkan meter baru: ' + meterNo);

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
    status: data.status !== undefined ? data.status : existing.status
  };

  // If customer assignment changed
  if (data.customer_id !== undefined && data.customer_id !== existing.customer_id) {
    // Unlink old customer
    if (existing.customer_id) {
      updateRowById('Customers', existing.customer_id, { meter_id: '' });
    }
    // Link new customer
    if (data.customer_id) {
      updateRowById('Customers', data.customer_id, { meter_id: id });
    }
    updateObj.customer_id = data.customer_id;
  }

  updateRowById('Meters', id, updateObj);
  logAudit(authUser.userId, authUser.username, 'UPDATE_METER', 'Memperbarui data meter: ' + existing.meter_no);

  return jsonResponse(null, 200, 'Data meter berhasil diperbarui.');
}

function handleDeleteMeter(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Meter wajib diisi.', 400);

  var existing = getRowById('Meters', id);
  if (!existing) return errorResponse('Meter tidak ditemukan.', 404);

  // Unlink from customer
  if (existing.customer_id) {
    updateRowById('Customers', existing.customer_id, { meter_id: '' });
  }

  deleteRowById('Meters', id);
  logAudit(authUser.userId, authUser.username, 'DELETE_METER', 'Menghapus meter: ' + existing.meter_no);

  return jsonResponse(null, 200, 'Meter berhasil dihapus.');
}
