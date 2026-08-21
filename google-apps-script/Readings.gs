/**
 * Sandmosquito Water Billing - Google Apps Script Meter Readings Module
 * Monthly meter recording, cubic meter usage calculation & validation.
 */

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
  var customerIdFilter = params.customer_id || '';
  var search = String(params.search || '').toLowerCase();

  // Role Security Check
  if (authUser.role === 'customer') {
    customerIdFilter = authUser.customerId;
  }

  var filtered = readings.filter(function(r) {
    if (customerIdFilter && String(r.customer_id) !== String(customerIdFilter)) return false;
    if (monthFilter && parseInt(r.period_month) !== monthFilter) return false;
    if (yearFilter && parseInt(r.period_year) !== yearFilter) return false;
    if (search) {
      var cust = custMap[r.customer_id];
      var meter = meterMap[r.meter_id];
      var matchCust = cust ? (String(cust.full_name || '').toLowerCase().indexOf(search) !== -1 || String(cust.customer_no || '').toLowerCase().indexOf(search) !== -1) : false;
      var matchMeter = meter ? String(meter.meter_no || '').toLowerCase().indexOf(search) !== -1 : false;
      var matchReadingNo = String(r.reading_no || '').toLowerCase().indexOf(search) !== -1;
      return matchCust || matchMeter || matchReadingNo;
    }
    return true;
  });

  // Sort descending by period_year and period_month
  filtered.sort(function(a, b) {
    var keyA = parseInt(a.period_year) * 100 + parseInt(a.period_month);
    var keyB = parseInt(b.period_year) * 100 + parseInt(b.period_month);
    return keyB - keyA;
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
      reader_id: r.reader_id || '',
      reader_name: reader ? reader.full_name : (authUser.fullName || 'Petugas'),
      notes: r.notes || '',
      photo_url: r.photo_url || '',
      created_at: r.created_at
    };
  });

  return jsonResponse(enriched, 200, 'Daftar pembacaan meter berhasil dimuat.');
}

function handleGetPrevReading(params) {
  var customerId = params.customer_id;
  var meterId = params.meter_id;
  var targetMonth = parseInt(params.period_month);
  var targetYear = parseInt(params.period_year);

  if (!customerId) return errorResponse('ID Pelanggan wajib diisi.', 400);

  var customer = getRowById('Customers', customerId);
  if (!customer) return errorResponse('Pelanggan tidak ditemukan.', 404);

  if (!meterId && customer.meter_id) {
    meterId = customer.meter_id;
  }

  var meter = meterId ? getRowById('Meters', meterId) : null;
  var initialReading = meter ? Number(meter.initial_reading || 0) : 0;
  var currentReading = meter ? Number(meter.current_reading || 0) : initialReading;

  // Search readings for this customer, sorted by period descending
  var readings = getAllRows('MeterReadings').filter(function(r) {
    return String(r.customer_id) === String(customerId);
  });

  readings.sort(function(a, b) {
    var keyA = parseInt(a.period_year) * 100 + parseInt(a.period_month);
    var keyB = parseInt(b.period_year) * 100 + parseInt(b.period_month);
    return keyB - keyA;
  });

  var prevReading = initialReading;
  var lastPeriod = null;

  if (readings.length > 0) {
    // Find the latest reading before target period or just the latest reading
    var targetKey = (targetYear && targetMonth) ? (targetYear * 100 + targetMonth) : 999999;
    var found = false;
    for (var i = 0; i < readings.length; i++) {
      var rKey = parseInt(readings[i].period_year) * 100 + parseInt(readings[i].period_month);
      if (rKey < targetKey) {
        prevReading = Number(readings[i].current_reading);
        lastPeriod = { month: parseInt(readings[i].period_month), year: parseInt(readings[i].period_year) };
        found = true;
        break;
      }
    }
    if (!found && readings.length > 0) {
      prevReading = Number(readings[0].current_reading);
      lastPeriod = { month: parseInt(readings[0].period_month), year: parseInt(readings[0].period_year) };
    }
  }

  return jsonResponse({
    customer_id: customerId,
    customer_no: customer.customer_no,
    customer_name: customer.full_name,
    meter_id: meterId,
    meter_no: meter ? meter.meter_no : '',
    prev_reading: prevReading,
    meter_current_reading: currentReading,
    last_period: lastPeriod
  }, 200, 'Data meter sebelumnya berhasil didapatkan.');
}

function handleRecordReading(authUser, data) {
  var customerId = data.customer_id;
  var meterId = data.meter_id;
  var periodMonth = parseInt(data.period_month);
  var periodYear = parseInt(data.period_year);
  var prevReading = Number(data.prev_reading || 0);
  var currentReading = Number(data.current_reading || 0);
  var readingDate = data.reading_date || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');
  var notes = String(data.notes || '').trim();
  var photoUrl = String(data.photo_url || '').trim();

  if (!customerId || !periodMonth || !periodYear || isNaN(currentReading)) {
    return errorResponse('Customer, Periode (Bulan & Tahun), dan Angka Meter Sekarang wajib diisi.', 400);
  }

  if (currentReading < prevReading) {
    return errorResponse('Angka meter sekarang (' + currentReading + ') tidak boleh lebih kecil dari meter sebelumnya (' + prevReading + ').', 400);
  }

  var customer = getRowById('Customers', customerId);
  if (!customer) return errorResponse('Pelanggan tidak ditemukan.', 404);

  if (!meterId) {
    meterId = customer.meter_id;
  }

  // Check if reading for this customer & period already exists
  var existingReadings = getAllRows('MeterReadings');
  var duplicate = existingReadings.some(function(r) {
    return String(r.customer_id) === String(customerId) &&
           parseInt(r.period_month) === periodMonth &&
           parseInt(r.period_year) === periodYear;
  });

  if (duplicate) {
    return errorResponse('Pembacaan meter untuk pelanggan ' + customer.full_name + ' pada periode ' + periodMonth + '/' + periodYear + ' sudah tercatat.', 400);
  }

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
    reading_date: readingDate,
    reader_id: authUser.userId,
    notes: notes,
    photo_url: photoUrl,
    created_at: nowStr
  };

  appendRow('MeterReadings', newReading);

  // Update current_reading on Meter
  if (meterId) {
    updateRowById('Meters', meterId, {
      current_reading: currentReading
    });
  }

  logAudit(authUser.userId, authUser.username, 'RECORD_READING', 'Pencatatan meter ' + customer.full_name + ' (' + periodMonth + '/' + periodYear + '): ' + usageM3 + ' m3');

  // Auto generate bill if requested
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

  return jsonResponse({
    reading: newReading,
    bill: generatedBill
  }, 201, 'Pencatatan meter berhasil disimpan. Penggunaan: ' + usageM3 + ' m³.');
}
