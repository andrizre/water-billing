/**
 * Sandmosquito Water Billing - Google Apps Script Bills Module
 * Bill generation, tiered calculation, due date & status tracking.
 */

function handleGetBills(authUser, params) {
  var bills = getAllRows('Bills');
  var customers = getAllRows('Customers');
  var tariffs = getAllRows('Tariffs');

  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];

  var tariffMap = {};
  for (var t = 0; t < tariffs.length; t++) tariffMap[tariffs[t].id] = tariffs[t];

  var monthFilter = params.period_month ? parseInt(params.period_month) : null;
  var yearFilter = params.period_year ? parseInt(params.period_year) : null;
  var statusFilter = params.status || '';
  var customerIdFilter = params.customer_id || '';
  var search = String(params.search || '').toLowerCase();

  // Role Security Check
  if (authUser.role === 'customer') {
    customerIdFilter = authUser.customerId;
  }

  var todayStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');

  var filtered = bills.filter(function(b) {
    if (customerIdFilter && String(b.customer_id) !== String(customerIdFilter)) return false;
    if (monthFilter && parseInt(b.period_month) !== monthFilter) return false;
    if (yearFilter && parseInt(b.period_year) !== yearFilter) return false;
    if (statusFilter && b.status !== statusFilter) return false;
    if (search) {
      var cust = custMap[b.customer_id];
      var matchBillNo = String(b.bill_no || '').toLowerCase().indexOf(search) !== -1;
      var matchCustName = cust ? String(cust.full_name || '').toLowerCase().indexOf(search) !== -1 : false;
      var matchCustNo = cust ? String(cust.customer_no || '').toLowerCase().indexOf(search) !== -1 : false;
      return matchBillNo || matchCustName || matchCustNo;
    }
    return true;
  });

  // Sort descending by period and created_at
  filtered.sort(function(a, b) {
    var keyA = parseInt(a.period_year) * 100 + parseInt(a.period_month);
    var keyB = parseInt(b.period_year) * 100 + parseInt(b.period_month);
    return keyB - keyA;
  });

  var enriched = filtered.map(function(b) {
    var cust = custMap[b.customer_id];
    var status = b.status || 'Belum Dibayar';

    // Auto-detect Overdue / Jatuh Tempo if unpaid and past due date
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
      phone: cust ? cust.phone : '-',
      reading_id: b.reading_id || '',
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
      created_at: b.created_at,
      updated_at: b.updated_at
    };
  });

  return jsonResponse(enriched, 200, 'Daftar tagihan berhasil dimuat.');
}

function handleGetBillById(authUser, data) {
  var id = data.id || data.bill_id;
  if (!id) return errorResponse('ID Tagihan wajib diisi.', 400);

  var bill = getRowById('Bills', id);
  if (!bill) return errorResponse('Tagihan tidak ditemukan.', 404);

  // Security Check: Customer cannot view other's bill
  if (authUser.role === 'customer') {
    if (String(bill.customer_id) !== String(authUser.customerId)) {
      return errorResponse('Akses ditolak: Anda tidak memiliki akses ke tagihan ini.', 403);
    }
  }

  var customer = getRowById('Customers', bill.customer_id);
  var tariff = customer && customer.tariff_id ? getRowById('Tariffs', customer.tariff_id) : null;
  var meter = customer && customer.meter_id ? getRowById('Meters', customer.meter_id) : null;
  var reading = bill.reading_id ? getRowById('MeterReadings', bill.reading_id) : null;

  // Get payments for this bill
  var payments = getAllRows('Payments').filter(function(p) {
    return String(p.bill_id) === String(bill.id);
  });

  // Calculate detailed tier breakdown
  var tariffObj = tariff || { base_fee: 5000, tier1_max: 10, tier1_rate: 2000, tier2_max: 20, tier2_rate: 3000, tier3_rate: 5000 };
  var breakdown = calculateWaterBill(bill.usage_m3, tariffObj);

  return jsonResponse({
    bill: bill,
    customer: customer,
    tariff: tariff,
    meter: meter,
    reading: reading,
    payments: payments,
    breakdown: breakdown
  }, 200, 'Data detail tagihan ditemukan.');
}

function internalGenerateBill(authUser, params) {
  var customerId = params.customer_id;
  var periodMonth = parseInt(params.period_month);
  var periodYear = parseInt(params.period_year);
  var readingId = params.reading_id || '';
  var prevReading = Number(params.prev_reading || 0);
  var currentReading = Number(params.current_reading || 0);
  var usageM3 = Number(params.usage_m3 || (currentReading - prevReading));

  var customer = getRowById('Customers', customerId);
  if (!customer) return null;

  var tariff = customer.tariff_id ? getRowById('Tariffs', customer.tariff_id) : null;
  if (!tariff) {
    tariff = { base_fee: 5000, tier1_max: 10, tier1_rate: 2000, tier2_max: 20, tier2_rate: 3000, tier3_rate: 5000, late_fee: 5000 };
  }

  var breakdown = calculateWaterBill(usageM3, tariff);
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  var billId = generateUniqueId('BILL_ID');
  var billNo = generateUniqueId('INV');

  // Default due date: tanggal 20 bulan berjalan / berikutnya
  var dueDateObj = new Date(periodYear, periodMonth - 1, 20);
  var dueDateStr = Utilities.formatDate(dueDateObj, 'GMT+7', 'yyyy-MM-dd');

  var newBill = {
    id: billId,
    bill_no: billNo,
    customer_id: customerId,
    reading_id: readingId,
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
  logAudit(authUser.userId, authUser.username, 'GENERATE_BILL', 'Membuat tagihan ' + billNo + ' untuk ' + customer.full_name + ' (Rp ' + breakdown.total_amount + ')');

  return newBill;
}

function handleGenerateBill(authUser, data) {
  var customerId = data.customer_id;
  var periodMonth = parseInt(data.period_month);
  var periodYear = parseInt(data.period_year);

  if (!customerId || !periodMonth || !periodYear) {
    return errorResponse('Customer dan Periode wajib diisi.', 400);
  }

  // Check if bill for this period already exists
  var existingBills = getAllRows('Bills');
  var exists = existingBills.some(function(b) {
    return String(b.customer_id) === String(customerId) &&
           parseInt(b.period_month) === periodMonth &&
           parseInt(b.period_year) === periodYear;
  });

  if (exists) {
    return errorResponse('Tagihan untuk pelanggan ini pada periode ' + periodMonth + '/' + periodYear + ' sudah pernah dibuat.', 400);
  }

  // Find reading for this customer & period
  var readings = getAllRows('MeterReadings').filter(function(r) {
    return String(r.customer_id) === String(customerId) &&
           parseInt(r.period_month) === periodMonth &&
           parseInt(r.period_year) === periodYear;
  });

  var reading = readings.length > 0 ? readings[0] : null;
  var prevReading = reading ? Number(reading.prev_reading) : Number(data.prev_reading || 0);
  var currentReading = reading ? Number(reading.current_reading) : Number(data.current_reading || 0);
  var usageM3 = reading ? Number(reading.usage_m3) : (currentReading - prevReading);

  var newBill = internalGenerateBill(authUser, {
    customer_id: customerId,
    reading_id: reading ? reading.id : '',
    period_month: periodMonth,
    period_year: periodYear,
    prev_reading: prevReading,
    current_reading: currentReading,
    usage_m3: usageM3
  });

  if (!newBill) {
    return errorResponse('Gagal membuat tagihan.', 500);
  }

  return jsonResponse(newBill, 201, 'Tagihan ' + newBill.bill_no + ' berhasil dibuat.');
}

function handleGenerateBatchBills(authUser, data) {
  var periodMonth = parseInt(data.period_month);
  var periodYear = parseInt(data.period_year);

  if (!periodMonth || !periodYear) {
    return errorResponse('Periode Bulan dan Tahun wajib diisi.', 400);
  }

  var customers = getAllRows('Customers').filter(function(c) { return c.status === 'Aktif'; });
  var readings = getAllRows('MeterReadings').filter(function(r) {
    return parseInt(r.period_month) === periodMonth && parseInt(r.period_year) === periodYear;
  });
  var existingBills = getAllRows('Bills').filter(function(b) {
    return parseInt(b.period_month) === periodMonth && parseInt(b.period_year) === periodYear;
  });

  var readingCustMap = {};
  for (var r = 0; r < readings.length; r++) {
    readingCustMap[readings[r].customer_id] = readings[r];
  }

  var existingBillCustSet = {};
  for (var eb = 0; eb < existingBills.length; eb++) {
    existingBillCustSet[existingBills[eb].customer_id] = true;
  }

  var generatedCount = 0;
  var skippedCount = 0;
  var noReadingCount = 0;

  for (var c = 0; c < customers.length; c++) {
    var cust = customers[c];
    if (existingBillCustSet[cust.id]) {
      skippedCount++;
      continue;
    }

    var reading = readingCustMap[cust.id];
    if (!reading) {
      noReadingCount++;
      continue;
    }

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

  logAudit(authUser.userId, authUser.username, 'GENERATE_BATCH_BILLS', 'Generate massal periode ' + periodMonth + '/' + periodYear + ': ' + generatedCount + ' tagihan dibuat');

  return jsonResponse({
    period_month: periodMonth,
    period_year: periodYear,
    generated_count: generatedCount,
    already_existed_count: skippedCount,
    no_reading_count: noReadingCount
  }, 200, 'Generate massal selesai: ' + generatedCount + ' tagihan baru berhasil dibuat.');
}

function handleUpdateBillStatus(authUser, data) {
  var id = data.id;
  var status = data.status;
  if (!id || !status) return errorResponse('ID Tagihan dan Status baru wajib diisi.', 400);

  var existing = getRowById('Bills', id);
  if (!existing) return errorResponse('Tagihan tidak ditemukan.', 404);

  updateRowById('Bills', id, {
    status: status,
    updated_at: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss')
  });

  logAudit(authUser.userId, authUser.username, 'UPDATE_BILL_STATUS', 'Ubah status tagihan ' + existing.bill_no + ' menjadi ' + status);

  return jsonResponse(null, 200, 'Status tagihan berhasil diubah.');
}
