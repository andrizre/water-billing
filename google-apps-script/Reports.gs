/**
 * Sandmosquito Water Billing - Google Apps Script Reports Module
 * Financial statistics, billing summaries, water usage analysis, and arrears tracking.
 */

function handleGetDashboardSummary(authUser, params) {
  var now = new Date();
  var currentMonth = parseInt(Utilities.formatDate(now, 'GMT+7', 'MM'));
  var currentYear = parseInt(Utilities.formatDate(now, 'GMT+7', 'yyyy'));

  var bills = getAllRows('Bills');
  var payments = getAllRows('Payments');
  var customers = getAllRows('Customers');
  var readings = getAllRows('MeterReadings');
  var meters = getAllRows('Meters');

  // CUSTOMER DASHBOARD
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
      var b = custBills[i];
      if (b.status !== 'Lunas') {
        totalUnpaid += Number(b.balance_due || b.total_amount || 0);
      }
      if (parseInt(b.period_month) === currentMonth && parseInt(b.period_year) === currentYear) {
        activeBill = b;
      }
    }

    // Usage last 6 months
    var usageHistory = [];
    for (var m = 5; m >= 0; m--) {
      var d = new Date(currentYear, currentMonth - 1 - m, 1);
      var mon = d.getMonth() + 1;
      var yr = d.getFullYear();
      var r = custReadings.find(function(rd) { return parseInt(rd.period_month) === mon && parseInt(rd.period_year) === yr; });
      usageHistory.push({
        month: mon,
        year: yr,
        period_name: getMonthNameIndo(mon) + ' ' + yr,
        usage_m3: r ? Number(r.usage_m3 || 0) : 0
      });
    }

    return jsonResponse({
      customer: custObj,
      meter: meterObj,
      total_unpaid: totalUnpaid,
      active_bill: activeBill,
      recent_payments: custPayments.slice(-5).reverse(),
      usage_history: usageHistory
    }, 200, 'Ringkasan dashboard pelanggan.');
  }

  // ADMIN & OPERATOR DASHBOARD
  var totalCustomers = customers.length;
  var activeCustomers = customers.filter(function(c) { return c.status === 'Aktif'; }).length;
  var totalMeters = meters.length;

  var currentMonthBills = bills.filter(function(b) {
    return parseInt(b.period_month) === currentMonth && parseInt(b.period_year) === currentYear;
  });

  var totalBilledThisMonth = 0;
  var totalUsageThisMonth = 0;
  for (var j = 0; j < currentMonthBills.length; j++) {
    totalBilledThisMonth += Number(currentMonthBills[j].total_amount || 0);
    totalUsageThisMonth += Number(currentMonthBills[j].usage_m3 || 0);
  }

  // Total collected this month from payments
  var totalCollectedThisMonth = 0;
  var currentMonthStr = Utilities.formatDate(now, 'GMT+7', 'yyyy-MM');
  for (var k = 0; k < payments.length; k++) {
    if (payments[k].payment_date && String(payments[k].payment_date).indexOf(currentMonthStr) === 0) {
      totalCollectedThisMonth += Number(payments[k].amount_paid || 0);
    }
  }

  // Total Arrears (Tunggakan Keseluruhan)
  var totalArrears = 0;
  var totalUnpaidCount = 0;
  for (var l = 0; l < bills.length; l++) {
    if (bills[l].status !== 'Lunas') {
      totalArrears += Number(bills[l].balance_due || bills[l].total_amount || 0);
      totalUnpaidCount++;
    }
  }

  // Trends last 6 months
  var monthlyTrends = [];
  for (var idx = 5; idx >= 0; idx--) {
    var dt = new Date(currentYear, currentMonth - 1 - idx, 1);
    var tMonth = dt.getMonth() + 1;
    var tYear = dt.getFullYear();
    var tPrefix = Utilities.formatDate(dt, 'GMT+7', 'yyyy-MM');

    var mBills = bills.filter(function(b) { return parseInt(b.period_month) === tMonth && parseInt(b.period_year) === tYear; });
    var mBilled = mBills.reduce(function(acc, b) { return acc + Number(b.total_amount || 0); }, 0);
    var mUsage = mBills.reduce(function(acc, b) { return acc + Number(b.usage_m3 || 0); }, 0);

    var mPaid = payments
      .filter(function(p) { return p.payment_date && String(p.payment_date).indexOf(tPrefix) === 0; })
      .reduce(function(acc, p) { return acc + Number(p.amount_paid || 0); }, 0);

    monthlyTrends.push({
      month: tMonth,
      year: tYear,
      period_name: getMonthNameIndo(tMonth) + ' ' + tYear,
      billed_amount: mBilled,
      collected_amount: mPaid,
      usage_m3: mUsage
    });
  }

  return jsonResponse({
    stats: {
      total_customers: totalCustomers,
      active_customers: activeCustomers,
      total_meters: totalMeters,
      total_billed_this_month: totalBilledThisMonth,
      total_collected_this_month: totalCollectedThisMonth,
      total_usage_this_month: totalUsageThisMonth,
      total_arrears: totalArrears,
      total_unpaid_bills: totalUnpaidCount
    },
    monthly_trends: monthlyTrends,
    recent_payments: payments.slice(-8).reverse(),
    recent_readings: readings.slice(-8).reverse()
  }, 200, 'Ringkasan dashboard admin berhasil dimuat.');
}

function handleGetBillingReport(params) {
  var month = params.period_month ? parseInt(params.period_month) : null;
  var year = params.period_year ? parseInt(params.period_year) : null;
  var rtrw = params.rt_rw || '';
  var status = params.status || '';

  var bills = getAllRows('Bills');
  var customers = getAllRows('Customers');
  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];

  var filtered = bills.filter(function(b) {
    if (month && parseInt(b.period_month) !== month) return false;
    if (year && parseInt(b.period_year) !== year) return false;
    if (status && b.status !== status) return false;
    if (rtrw) {
      var cust = custMap[b.customer_id];
      if (!cust || cust.rt_rw !== rtrw) return false;
    }
    return true;
  });

  var totalBilled = 0;
  var totalPaid = 0;
  var totalBalance = 0;
  var totalUsage = 0;

  var items = filtered.map(function(b) {
    var cust = custMap[b.customer_id];
    var tot = Number(b.total_amount || 0);
    var pd = Number(b.paid_amount || 0);
    var bal = Number(b.balance_due || (tot - pd));
    var usg = Number(b.usage_m3 || 0);

    totalBilled += tot;
    totalPaid += pd;
    totalBalance += bal;
    totalUsage += usg;

    return {
      id: b.id,
      bill_no: b.bill_no,
      customer_no: cust ? cust.customer_no : '-',
      customer_name: cust ? cust.full_name : '-',
      rt_rw: cust ? cust.rt_rw : '-',
      period: b.period_month + '/' + b.period_year,
      usage_m3: usg,
      base_amount: Number(b.base_amount || 0),
      usage_amount: Number(b.usage_amount || 0),
      late_fee: Number(b.late_fee || 0),
      total_amount: tot,
      paid_amount: pd,
      balance_due: bal,
      status: b.status || 'Belum Dibayar',
      due_date: b.due_date
    };
  });

  return jsonResponse({
    summary: {
      total_bills: items.length,
      total_billed: totalBilled,
      total_paid: totalPaid,
      total_balance_due: totalBalance,
      total_usage_m3: totalUsage
    },
    items: items
  }, 200, 'Laporan tagihan berhasil dimuat.');
}

function handleGetPaymentReport(params) {
  var startDate = params.start_date || '';
  var endDate = params.end_date || '';
  var method = params.payment_method || '';

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

  var filtered = payments.filter(function(p) {
    if (method && p.payment_method !== method) return false;
    if (startDate && p.payment_date && p.payment_date < startDate) return false;
    if (endDate && p.payment_date && p.payment_date > (endDate + ' 23:59:59')) return false;
    return true;
  });

  var totalRevenue = 0;
  var methodBreakdown = {};

  var items = filtered.map(function(p) {
    var cust = custMap[p.customer_id];
    var bill = billMap[p.bill_id];
    var cashier = userMap[p.cashier_id];
    var amount = Number(p.amount_paid || 0);

    totalRevenue += amount;
    var m = p.payment_method || 'Tunai';
    methodBreakdown[m] = (methodBreakdown[m] || 0) + amount;

    return {
      payment_no: p.payment_no,
      payment_date: p.payment_date,
      bill_no: bill ? bill.bill_no : '-',
      customer_no: cust ? cust.customer_no : '-',
      customer_name: cust ? cust.full_name : '-',
      amount_paid: amount,
      payment_method: m,
      cashier_name: cashier ? cashier.full_name : 'Kasir'
    };
  });

  return jsonResponse({
    summary: {
      total_transactions: items.length,
      total_revenue: totalRevenue,
      method_breakdown: methodBreakdown
    },
    items: items
  }, 200, 'Laporan penerimaan pembayaran berhasil dimuat.');
}

function handleGetArrearsReport(params) {
  var rtrw = params.rt_rw || '';
  var bills = getAllRows('Bills');
  var customers = getAllRows('Customers');

  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];

  var unpaidBills = bills.filter(function(b) {
    return b.status !== 'Lunas';
  });

  var customerArrearsMap = {};
  for (var i = 0; i < unpaidBills.length; i++) {
    var b = unpaidBills[i];
    var cust = custMap[b.customer_id];
    if (rtrw && cust && cust.rt_rw !== rtrw) continue;

    var custId = b.customer_id;
    if (!customerArrearsMap[custId]) {
      customerArrearsMap[custId] = {
        customer_id: custId,
        customer_no: cust ? cust.customer_no : '-',
        customer_name: cust ? cust.full_name : '-',
        phone: cust ? cust.phone : '-',
        rt_rw: cust ? cust.rt_rw : '-',
        address: cust ? cust.address : '-',
        unpaid_months_count: 0,
        total_arrears: 0,
        unpaid_periods: []
      };
    }

    var due = Number(b.balance_due || b.total_amount || 0);
    customerArrearsMap[custId].unpaid_months_count++;
    customerArrearsMap[custId].total_arrears += due;
    customerArrearsMap[custId].unpaid_periods.push(b.period_month + '/' + b.period_year + ' (Rp ' + due + ')');
  }

  var list = Object.keys(customerArrearsMap).map(function(k) { return customerArrearsMap[k]; });
  list.sort(function(a, b) { return b.total_arrears - a.total_arrears; });

  var totalArrearsSum = list.reduce(function(acc, item) { return acc + item.total_arrears; }, 0);

  return jsonResponse({
    summary: {
      total_defaulters: list.length,
      total_arrears_amount: totalArrearsSum
    },
    items: list
  }, 200, 'Laporan tunggakan pelanggan berhasil dimuat.');
}

function handleGetUsageReport(params) {
  var month = params.period_month ? parseInt(params.period_month) : null;
  var year = params.period_year ? parseInt(params.period_year) : null;

  var readings = getAllRows('MeterReadings');
  var customers = getAllRows('Customers');
  var custMap = {};
  for (var c = 0; c < customers.length; c++) custMap[customers[c].id] = customers[c];

  var filtered = readings.filter(function(r) {
    if (month && parseInt(r.period_month) !== month) return false;
    if (year && parseInt(r.period_year) !== year) return false;
    return true;
  });

  var totalUsage = 0;
  var items = filtered.map(function(r) {
    var cust = custMap[r.customer_id];
    var usage = Number(r.usage_m3 || 0);
    totalUsage += usage;

    return {
      reading_no: r.reading_no,
      customer_no: cust ? cust.customer_no : '-',
      customer_name: cust ? cust.full_name : '-',
      rt_rw: cust ? cust.rt_rw : '-',
      period: r.period_month + '/' + r.period_year,
      prev_reading: Number(r.prev_reading || 0),
      current_reading: Number(r.current_reading || 0),
      usage_m3: usage,
      reading_date: r.reading_date
    };
  });

  items.sort(function(a, b) { return b.usage_m3 - a.usage_m3; });

  return jsonResponse({
    summary: {
      total_readings: items.length,
      total_usage_m3: totalUsage,
      avg_usage_m3: items.length > 0 ? (totalUsage / items.length).toFixed(2) : 0
    },
    top_consumers: items.slice(0, 10),
    items: items
  }, 200, 'Laporan pemakaian air berhasil dimuat.');
}

function getMonthNameIndo(m) {
  var names = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return names[m] || '';
}
