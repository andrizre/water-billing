/**
 * Sandmosquito Water Billing - Google Apps Script Customers Module
 * Customer CRUD, search, filter, and backend data isolation.
 */

function handleGetCustomers(params) {
  var customers = getAllRows('Customers');
  var meters = getAllRows('Meters');
  var tariffs = getAllRows('Tariffs');

  // Build lookup maps for efficient join
  var meterMap = {};
  for (var m = 0; m < meters.length; m++) {
    meterMap[meters[m].id] = meters[m];
  }

  var tariffMap = {};
  for (var t = 0; t < tariffs.length; t++) {
    tariffMap[tariffs[t].id] = tariffs[t];
  }

  var search = String(params.search || '').toLowerCase();
  var statusFilter = params.status || '';
  var rtrwFilter = params.rt_rw || '';
  var tariffFilter = params.tariff_id || '';

  var filtered = customers.filter(function(c) {
    if (statusFilter && c.status !== statusFilter) return false;
    if (rtrwFilter && c.rt_rw !== rtrwFilter) return false;
    if (tariffFilter && c.tariff_id !== tariffFilter) return false;
    if (search) {
      var matchNo = String(c.customer_no || '').toLowerCase().indexOf(search) !== -1;
      var matchName = String(c.full_name || '').toLowerCase().indexOf(search) !== -1;
      var matchPhone = String(c.phone || '').indexOf(search) !== -1;
      var matchNik = String(c.nik || '').indexOf(search) !== -1;
      var matchAddr = String(c.address || '').toLowerCase().indexOf(search) !== -1;
      return matchNo || matchName || matchPhone || matchNik || matchAddr;
    }
    return true;
  });

  // Enrich customer with joined meter & tariff objects
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

  return jsonResponse(enriched, 200, 'Daftar pelanggan berhasil dimuat.');
}

function handleGetCustomerById(authUser, data) {
  var id = data.id || data.customer_id;
  if (!id) return errorResponse('ID Pelanggan wajib diisi.', 400);

  // Security Check: Customer role cannot view other customers
  if (authUser.role === 'customer') {
    if (String(authUser.customerId) !== String(id)) {
      return errorResponse('Akses ditolak: Anda hanya dapat mengakses data pelanggan milik Anda sendiri.', 403);
    }
  }

  var customer = getRowById('Customers', id);
  if (!customer) return errorResponse('Data pelanggan tidak ditemukan.', 404);

  var meter = customer.meter_id ? getRowById('Meters', customer.meter_id) : null;
  var tariff = customer.tariff_id ? getRowById('Tariffs', customer.tariff_id) : null;

  return jsonResponse({
    customer: customer,
    meter: meter,
    tariff: tariff
  }, 200, 'Data pelanggan ditemukan.');
}

function handleCreateCustomer(authUser, data) {
  var fullName = String(data.full_name || '').trim();
  var nik = String(data.nik || '').trim();
  var phone = String(data.phone || '').trim();
  var address = String(data.address || '').trim();
  var rtRw = String(data.rt_rw || '').trim();
  var tariffId = String(data.tariff_id || '').trim();
  var initialReading = Number(data.initial_reading || 0);

  if (!fullName) {
    return errorResponse('Nama lengkap pelanggan wajib diisi.', 400);
  }

  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  var customerId = generateUniqueId('CUST_ID');
  var customerNo = data.customer_no ? String(data.customer_no).trim().toUpperCase() : generateUniqueId('CUST');

  // Check unique customer_no
  var existingCustomers = getAllRows('Customers');
  for (var i = 0; i < existingCustomers.length; i++) {
    if (String(existingCustomers[i].customer_no).toUpperCase() === customerNo) {
      return errorResponse('Nomor Pelanggan "' + customerNo + '" sudah terdaftar.', 400);
    }
  }

  var meterId = data.meter_id || '';

  // If new meter requested or specified meter number
  if (!meterId && (data.meter_no || data.create_meter)) {
    meterId = generateUniqueId('MTR_ID');
    var meterNo = data.meter_no ? String(data.meter_no).trim().toUpperCase() : generateUniqueId('MTR');
    var newMeter = {
      id: meterId,
      meter_no: meterNo,
      customer_id: customerId,
      installation_date: data.installation_date || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd'),
      brand: data.meter_brand || 'Standard SNI',
      initial_reading: initialReading,
      current_reading: initialReading,
      status: 'Aktif',
      created_at: nowStr
    };
    appendRow('Meters', newMeter);
  }

  var newCustomer = {
    id: customerId,
    customer_no: customerNo,
    full_name: fullName,
    nik: nik,
    phone: phone,
    address: address,
    rt_rw: rtRw,
    meter_id: meterId,
    tariff_id: tariffId || 'TRF-01',
    status: data.status || 'Aktif',
    created_at: nowStr,
    updated_at: nowStr
  };

  appendRow('Customers', newCustomer);

  // Automatically create a user login for customer (default password: customer_no or phone)
  var defaultSalt = generateSalt();
  var defaultPass = customerNo.toLowerCase();
  var newUserId = generateUniqueId('USR');
  var newCustomerUser = {
    id: newUserId,
    username: customerNo,
    password_hash: hashPassword(defaultPass, defaultSalt),
    salt: defaultSalt,
    role: 'customer',
    customer_id: customerId,
    full_name: fullName,
    email: '',
    phone: phone,
    is_active: 'TRUE',
    created_at: nowStr,
    updated_at: nowStr
  };
  appendRow('Users', newCustomerUser);

  logAudit(authUser.userId, authUser.username, 'CREATE_CUSTOMER', 'Menambahkan pelanggan: ' + fullName + ' (' + customerNo + ')');

  return jsonResponse({
    customer: newCustomer,
    default_login_user: customerNo,
    default_login_pass: defaultPass
  }, 201, 'Pelanggan berhasil didaftarkan. Akun login otomatis dibuat.');
}

function handleUpdateCustomer(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Pelanggan wajib diisi.', 400);

  var existing = getRowById('Customers', id);
  if (!existing) return errorResponse('Data pelanggan tidak ditemukan.', 404);

  var updateObj = {
    full_name: data.full_name !== undefined ? data.full_name : existing.full_name,
    nik: data.nik !== undefined ? data.nik : existing.nik,
    phone: data.phone !== undefined ? data.phone : existing.phone,
    address: data.address !== undefined ? data.address : existing.address,
    rt_rw: data.rt_rw !== undefined ? data.rt_rw : existing.rt_rw,
    tariff_id: data.tariff_id !== undefined ? data.tariff_id : existing.tariff_id,
    status: data.status !== undefined ? data.status : existing.status,
    updated_at: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss')
  };

  // If meter_id updated
  if (data.meter_id !== undefined) {
    updateObj.meter_id = data.meter_id;
  }

  updateRowById('Customers', id, updateObj);

  // Sync full_name & phone in Users table if exists
  var users = getAllRows('Users');
  for (var u = 0; u < users.length; u++) {
    if (String(users[u].customer_id) === String(id)) {
      updateRowById('Users', users[u].id, {
        full_name: updateObj.full_name,
        phone: updateObj.phone
      });
      break;
    }
  }

  logAudit(authUser.userId, authUser.username, 'UPDATE_CUSTOMER', 'Memperbarui pelanggan: ' + existing.full_name + ' (' + existing.customer_no + ')');

  return jsonResponse(null, 200, 'Data pelanggan berhasil diperbarui.');
}

function handleDeleteCustomer(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Pelanggan wajib diisi.', 400);

  var existing = getRowById('Customers', id);
  if (!existing) return errorResponse('Data pelanggan tidak ditemukan.', 404);

  // Check if customer has bills
  var bills = getAllRows('Bills');
  var hasBills = bills.some(function(b) { return String(b.customer_id) === String(id); });
  if (hasBills) {
    // Instead of deleting history, soft delete by setting status to 'Nonaktif'
    updateRowById('Customers', id, { status: 'Nonaktif' });
    logAudit(authUser.userId, authUser.username, 'DEACTIVATE_CUSTOMER', 'Menonaktifkan pelanggan dengan riwayat tagihan: ' + existing.full_name);
    return jsonResponse(null, 200, 'Pelanggan memiliki riwayat tagihan, status diubah menjadi Nonaktif.');
  }

  deleteRowById('Customers', id);

  // Also delete meter and user account
  if (existing.meter_id) {
    deleteRowById('Meters', existing.meter_id);
  }

  var users = getAllRows('Users');
  for (var u = 0; u < users.length; u++) {
    if (String(users[u].customer_id) === String(id)) {
      deleteRowById('Users', users[u].id);
      break;
    }
  }

  logAudit(authUser.userId, authUser.username, 'DELETE_CUSTOMER', 'Menghapus pelanggan: ' + existing.full_name);

  return jsonResponse(null, 200, 'Pelanggan berhasil dihapus.');
}
