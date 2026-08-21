/**
 * Sandmosquito Water Billing - Google Apps Script Payments Module
 * Payment processing, balance tracking, status updating, and receipt generation.
 */

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

  var customerIdFilter = params.customer_id || '';
  var startDate = params.start_date || '';
  var endDate = params.end_date || '';
  var methodFilter = params.payment_method || '';
  var search = String(params.search || '').toLowerCase();

  // Role Security Check
  if (authUser.role === 'customer') {
    customerIdFilter = authUser.customerId;
  }

  var filtered = payments.filter(function(p) {
    if (customerIdFilter && String(p.customer_id) !== String(customerIdFilter)) return false;
    if (methodFilter && p.payment_method !== methodFilter) return false;
    if (startDate && p.payment_date && p.payment_date < startDate) return false;
    if (endDate && p.payment_date && p.payment_date > (endDate + ' 23:59:59')) return false;
    if (search) {
      var cust = custMap[p.customer_id];
      var bill = billMap[p.bill_id];
      var matchPayNo = String(p.payment_no || '').toLowerCase().indexOf(search) !== -1;
      var matchCustName = cust ? String(cust.full_name || '').toLowerCase().indexOf(search) !== -1 : false;
      var matchCustNo = cust ? String(cust.customer_no || '').toLowerCase().indexOf(search) !== -1 : false;
      var matchBillNo = bill ? String(bill.bill_no || '').toLowerCase().indexOf(search) !== -1 : false;
      return matchPayNo || matchCustName || matchCustNo || matchBillNo;
    }
    return true;
  });

  // Sort descending by created_at
  filtered.sort(function(a, b) {
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

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
      cashier_id: p.cashier_id || '',
      cashier_name: cashier ? cashier.full_name : 'Petugas Kasir',
      notes: p.notes || '',
      created_at: p.created_at
    };
  });

  return jsonResponse(enriched, 200, 'Daftar pembayaran berhasil dimuat.');
}

function handleRecordPayment(authUser, data) {
  var billId = data.bill_id;
  var amountPaid = Number(data.amount_paid || 0);
  var paymentMethod = data.payment_method || 'Tunai';
  var notes = String(data.notes || '').trim();
  var paymentDate = data.payment_date || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');

  if (!billId || amountPaid <= 0) {
    return errorResponse('ID Tagihan dan Jumlah Pembayaran valid (> 0) wajib diisi.', 400);
  }

  var bill = getRowById('Bills', billId);
  if (!bill) return errorResponse('Tagihan tidak ditemukan.', 404);

  var customer = getRowById('Customers', bill.customer_id);
  var prevPaid = Number(bill.paid_amount || 0);
  var totalAmount = Number(bill.total_amount || 0);
  var currentBalance = Number(bill.balance_due || (totalAmount - prevPaid));

  if (currentBalance <= 0) {
    return errorResponse('Tagihan ini sudah berstatus Lunas.', 400);
  }

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
    payment_date: paymentDate,
    amount_paid: amountPaid,
    payment_method: paymentMethod,
    cashier_id: authUser.userId,
    notes: notes,
    created_at: nowStr
  };

  appendRow('Payments', newPayment);

  // Update Bill record
  updateRowById('Bills', billId, {
    paid_amount: newPaidTotal,
    balance_due: newBalance,
    status: newStatus,
    updated_at: nowStr
  });

  logAudit(authUser.userId, authUser.username, 'RECORD_PAYMENT', 'Penerimaan pembayaran ' + paymentNo + ' untuk tagihan ' + bill.bill_no + ' sebesar Rp ' + amountPaid + ' (' + newStatus + ')');

  return jsonResponse({
    payment: newPayment,
    bill: {
      id: bill.id,
      bill_no: bill.bill_no,
      total_amount: totalAmount,
      paid_amount: newPaidTotal,
      balance_due: newBalance,
      status: newStatus
    },
    customer: customer
  }, 201, 'Pembayaran berhasil dicatat. Status tagihan: ' + newStatus);
}

function handleGetPaymentReceipt(authUser, data) {
  var id = data.id || data.payment_id;
  if (!id) return errorResponse('ID Pembayaran wajib diisi.', 400);

  var payment = getRowById('Payments', id);
  if (!payment) return errorResponse('Data transaksi pembayaran tidak ditemukan.', 404);

  // Role Security Check
  if (authUser.role === 'customer') {
    if (String(payment.customer_id) !== String(authUser.customerId)) {
      return errorResponse('Akses ditolak: Anda tidak memiliki akses ke kuitansi ini.', 403);
    }
  }

  var bill = getRowById('Bills', payment.bill_id);
  var customer = getRowById('Customers', payment.customer_id);
  var meter = customer && customer.meter_id ? getRowById('Meters', customer.meter_id) : null;
  var cashier = payment.cashier_id ? getRowById('Users', payment.cashier_id) : null;
  var settings = getAllRows('Settings');

  var settingsMap = {};
  for (var s = 0; s < settings.length; s++) {
    settingsMap[settings[s].key] = settings[s].value;
  }

  return jsonResponse({
    payment: payment,
    bill: bill,
    customer: customer,
    meter: meter,
    cashier_name: cashier ? cashier.full_name : 'Kasir',
    village_info: {
      village_name: settingsMap['village_name'] || 'Desa Sandmosquito',
      organization_name: settingsMap['organization_name'] || 'BUMDes Tirta Lestari',
      address: settingsMap['village_address'] || 'Jl. Raya Desa No. 01',
      phone: settingsMap['contact_phone'] || '081234567890'
    }
  }, 200, 'Data kuitansi pembayaran berhasil diambil.');
}
