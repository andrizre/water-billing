/**
 * Sandmosquito Water Billing - Google Spreadsheet Database Setup & Seed
 * Run setupDatabase() once from Google Apps Script Editor to create all sheets with headers and initial data.
 */

var SCHEMA_DEFINITIONS = {
  Users: [
    'id', 'username', 'password_hash', 'salt', 'role', 'customer_id', 'full_name', 'email', 'phone', 'is_active', 'created_at', 'updated_at'
  ],
  Customers: [
    'id', 'customer_no', 'full_name', 'nik', 'phone', 'address', 'rt_rw', 'meter_id', 'tariff_id', 'status', 'created_at', 'updated_at'
  ],
  Meters: [
    'id', 'meter_no', 'customer_id', 'installation_date', 'brand', 'initial_reading', 'current_reading', 'status', 'created_at'
  ],
  MeterReadings: [
    'id', 'reading_no', 'customer_id', 'meter_id', 'period_month', 'period_year', 'prev_reading', 'current_reading', 'usage_m3', 'reading_date', 'reader_id', 'notes', 'photo_url', 'created_at'
  ],
  Tariffs: [
    'id', 'code', 'name', 'category', 'base_fee', 'tier1_max', 'tier1_rate', 'tier2_max', 'tier2_rate', 'tier3_rate', 'late_fee', 'is_active', 'description', 'created_at'
  ],
  Bills: [
    'id', 'bill_no', 'customer_id', 'reading_id', 'period_month', 'period_year', 'prev_reading', 'current_reading', 'usage_m3', 'base_amount', 'usage_amount', 'late_fee', 'total_amount', 'paid_amount', 'balance_due', 'due_date', 'status', 'created_at', 'updated_at'
  ],
  Payments: [
    'id', 'payment_no', 'bill_id', 'customer_id', 'payment_date', 'amount_paid', 'payment_method', 'cashier_id', 'notes', 'created_at'
  ],
  Settings: [
    'key', 'value', 'description', 'updated_at'
  ],
  AuditLogs: [
    'id', 'user_id', 'username', 'action', 'details', 'created_at'
  ]
};

/**
 * Main Setup function: Creates all 9 tables/sheets and creates default Admin & Settings
 */
function setupDatabase() {
  var ss = getDb();
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');

  for (var sheetName in SCHEMA_DEFINITIONS) {
    var sheet = ss.getSheetByName(sheetName);
    var headers = SCHEMA_DEFINITIONS[sheetName];

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // Set headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0284c7');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  }

  // Remove default "Sheet1" if exists and not needed
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  // Ensure Default Admin User
  var usersSheet = ss.getSheetByName('Users');
  var usersData = usersSheet.getDataRange().getValues();
  var hasAdmin = false;

  for (var i = 1; i < usersData.length; i++) {
    if (usersData[i][1] === 'admin') {
      hasAdmin = true;
      break;
    }
  }

  if (!hasAdmin) {
    var adminSalt = generateSalt();
    var adminPassHash = hashPassword('admin123', adminSalt);
    appendRow('Users', {
      id: 'USR-0001',
      username: 'admin',
      password_hash: adminPassHash,
      salt: adminSalt,
      role: 'admin',
      customer_id: '',
      full_name: 'Administrator Utama',
      email: 'admin@sandmosquito.desa.id',
      phone: '081234567890',
      is_active: 'TRUE',
      created_at: nowStr,
      updated_at: nowStr
    });

    var opSalt = generateSalt();
    var opPassHash = hashPassword('operator123', opSalt);
    appendRow('Users', {
      id: 'USR-0002',
      username: 'operator',
      password_hash: opPassHash,
      salt: opSalt,
      role: 'operator',
      customer_id: '',
      full_name: 'Petugas Lapangan',
      email: 'operator@sandmosquito.desa.id',
      phone: '081298765432',
      is_active: 'TRUE',
      created_at: nowStr,
      updated_at: nowStr
    });
  }

  // Ensure Default Tariffs
  var tariffs = getAllRows('Tariffs');
  if (tariffs.length === 0) {
    appendRow('Tariffs', {
      id: 'TRF-01',
      code: 'R1-DESA',
      name: 'Rumah Tangga Standar',
      category: 'Rumah Tangga',
      base_fee: 5000,
      tier1_max: 10,
      tier1_rate: 2000,
      tier2_max: 20,
      tier2_rate: 3000,
      tier3_rate: 5000,
      late_fee: 5000,
      is_active: 'TRUE',
      description: 'Tarif untuk rumah tangga umum warga desa',
      created_at: nowStr
    });

    appendRow('Tariffs', {
      id: 'TRF-02',
      code: 'N1-DESA',
      name: 'Niaga & UMKM Desa',
      category: 'Niaga',
      base_fee: 15000,
      tier1_max: 10,
      tier1_rate: 3500,
      tier2_max: 20,
      tier2_rate: 5000,
      tier3_rate: 7500,
      late_fee: 10000,
      is_active: 'TRUE',
      description: 'Tarif untuk toko, ruko, bengkel, dan usaha warga',
      created_at: nowStr
    });

    appendRow('Tariffs', {
      id: 'TRF-03',
      code: 'S1-DESA',
      name: 'Sosial & Tempat Ibadah',
      category: 'Sosial',
      base_fee: 0,
      tier1_max: 10,
      tier1_rate: 1000,
      tier2_max: 20,
      tier2_rate: 1500,
      tier3_rate: 2000,
      late_fee: 0,
      is_active: 'TRUE',
      description: 'Tarif subsidi untuk masjid, musholla, gereja, dan posyandu',
      created_at: nowStr
    });
  }

  // Ensure Default Settings
  var settings = getAllRows('Settings');
  if (settings.length === 0) {
    var defaultSettings = [
      { key: 'app_name', value: 'Sandmosquito Water Billing', description: 'Nama Aplikasi' },
      { key: 'village_name', value: 'Desa Sandmosquito', description: 'Nama Desa' },
      { key: 'organization_name', value: 'BUMDes Tirta Sandmosquito', description: 'Nama Pengelola Air / BUMDes' },
      { key: 'village_address', value: 'Jl. Melati No. 07, RT 02 / RW 01, Desa Sandmosquito', description: 'Alamat Kantor' },
      { key: 'contact_phone', value: '0812-3456-7890', description: 'Nomor Kontak Layanan' },
      { key: 'contact_email', value: 'bumdes.sandmosquito@desa.id', description: 'Email Resmi' },
      { key: 'bank_account_info', value: 'Bank BRI: 1234-01-000123-53-0 a.n BUMDes Tirta Sandmosquito', description: 'Rekening Pembayaran' },
      { key: 'due_day_of_month', value: '20', description: 'Tanggal Jatuh Tempo Setiap Bulan' },
      { key: 'late_fee_flat', value: '5000', description: 'Nominal Denda Keterlambatan (Rp)' },
      { key: 'bill_footer_notes', value: 'Harap membayar tagihan tepat waktu sebelum tanggal 20. Terima kasih atas partisipasi Anda membangun desa.', description: 'Catatan Kaki Struk Tagihan' }
    ];

    for (var s = 0; s < defaultSettings.length; s++) {
      appendRow('Settings', {
        key: defaultSettings[s].key,
        value: defaultSettings[s].value,
        description: defaultSettings[s].description,
        updated_at: nowStr
      });
    }
  }

  Logger.log('Setup Database Sandmosquito Water Billing berhasil!');
  return 'Database dan seluruh tabel berhasil dibuat.';
}

/**
 * Seed realistic demo data for initial demonstration
 */
function seedDemoData() {
  setupDatabase();
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  var customers = getAllRows('Customers');

  if (customers.length > 0) {
    Logger.log('Data pelanggan sudah ada, lewati penambahan seed.');
    return 'Data pelanggan sudah ada.';
  }

  var demoCustomers = [
    { no: 'CUST-2026-0001', name: 'Bpk. Budi Santoso', nik: '3201012345670001', phone: '081234567801', addr: 'RT 01 / RW 01 Dusun Krajan', rtrw: 'RT 01 / RW 01', mtr: 'MTR-8801', trf: 'TRF-01', init: 120, cur: 142 },
    { no: 'CUST-2026-0002', name: 'Ibu Siti Aminah', nik: '3201012345670002', phone: '081234567802', addr: 'RT 01 / RW 01 Dusun Krajan', rtrw: 'RT 01 / RW 01', mtr: 'MTR-8802', trf: 'TRF-01', init: 95, cur: 111 },
    { no: 'CUST-2026-0003', name: 'Bpk. Slamet Riyadi', nik: '3201012345670003', phone: '081234567803', addr: 'RT 02 / RW 01 Dusun Sukamaju', rtrw: 'RT 02 / RW 01', mtr: 'MTR-8803', trf: 'TRF-01', init: 210, cur: 235 },
    { no: 'CUST-2026-0004', name: 'Warung Makan Bu Joko', nik: '3201012345670004', phone: '081234567804', addr: 'Jl. Pasar Desa RT 03 / RW 01', rtrw: 'RT 03 / RW 01', mtr: 'MTR-8804', trf: 'TRF-02', init: 310, cur: 348 },
    { no: 'CUST-2026-0005', name: 'Masjid Jami Al-Ikhlas', nik: '3201012345670005', phone: '081234567805', addr: 'Alun-alun Desa RT 01 / RW 02', rtrw: 'RT 01 / RW 02', mtr: 'MTR-8805', trf: 'TRF-03', init: 540, cur: 585 }
  ];

  for (var i = 0; i < demoCustomers.length; i++) {
    var dc = demoCustomers[i];
    var cId = 'CUST-ID-00' + (i + 1);
    var mId = 'MTR-ID-00' + (i + 1);

    // Append Meter
    appendRow('Meters', {
      id: mId,
      meter_no: dc.mtr,
      customer_id: cId,
      installation_date: '2026-01-10',
      brand: 'Onda SNI 1/2"',
      initial_reading: dc.init,
      current_reading: dc.cur,
      status: 'Aktif',
      created_at: nowStr
    });

    // Append Customer
    appendRow('Customers', {
      id: cId,
      customer_no: dc.no,
      full_name: dc.name,
      nik: dc.nik,
      phone: dc.phone,
      address: dc.addr,
      rt_rw: dc.rtrw,
      meter_id: mId,
      tariff_id: dc.trf,
      status: 'Aktif',
      created_at: nowStr,
      updated_at: nowStr
    });

    // Append Customer User Account (password: 123456 or customer_no lowercase)
    var cSalt = generateSalt();
    appendRow('Users', {
      id: 'USR-CUST-00' + (i + 1),
      username: dc.no.toLowerCase(),
      password_hash: hashPassword('warga123', cSalt),
      salt: cSalt,
      role: 'customer',
      customer_id: cId,
      full_name: dc.name,
      email: '',
      phone: dc.phone,
      is_active: 'TRUE',
      created_at: nowStr,
      updated_at: nowStr
    });

    // Record August Reading & Bill
    var usage = dc.cur - dc.init;
    var readingId = 'RDM-202608-00' + (i + 1);
    appendRow('MeterReadings', {
      id: readingId,
      reading_no: 'RDM-202608-00' + (i + 1),
      customer_id: cId,
      meter_id: mId,
      period_month: 8,
      period_year: 2026,
      prev_reading: dc.init,
      current_reading: dc.cur,
      usage_m3: usage,
      reading_date: '2026-08-05',
      reader_id: 'USR-0002',
      notes: 'Pencatatan rutin bulanan',
      photo_url: '',
      created_at: nowStr
    });

    // Generate Bill
    var billId = 'BILL-202608-00' + (i + 1);
    var billNo = 'INV-202608-00' + (i + 1);
    var tariff = getRowById('Tariffs', dc.trf);
    var calc = calculateWaterBill(usage, tariff);
    var isPaid = (i % 2 === 0); // 1st, 3rd, 5th are paid, others unpaid

    appendRow('Bills', {
      id: billId,
      bill_no: billNo,
      customer_id: cId,
      reading_id: readingId,
      period_month: 8,
      period_year: 2026,
      prev_reading: dc.init,
      current_reading: dc.cur,
      usage_m3: usage,
      base_amount: calc.base_fee,
      usage_amount: calc.usage_amount,
      late_fee: 0,
      total_amount: calc.total_amount,
      paid_amount: isPaid ? calc.total_amount : 0,
      balance_due: isPaid ? 0 : calc.total_amount,
      due_date: '2026-08-20',
      status: isPaid ? 'Lunas' : 'Belum Dibayar',
      created_at: nowStr,
      updated_at: nowStr
    });

    // If paid, create payment record
    if (isPaid) {
      appendRow('Payments', {
        id: 'PAY-202608-00' + (i + 1),
        payment_no: 'PAY-202608-00' + (i + 1),
        bill_id: billId,
        customer_id: cId,
        payment_date: '2026-08-10 10:30:00',
        amount_paid: calc.total_amount,
        payment_method: 'Tunai',
        cashier_id: 'USR-0002',
        notes: 'Pembayaran lunas di loket desa',
        created_at: nowStr
      });
    }
  }

  Logger.log('Seed data demo berhasil ditambahkan!');
  return 'Data demo berhasil ditambahkan!';
}

function handleSetupDatabase(data) {
  var result = setupDatabase();
  return jsonResponse({ result: result }, 200, 'Database berhasil diinisialisasi.');
}

function handleSeedDemoData(data) {
  var result = seedDemoData();
  return jsonResponse({ result: result }, 200, 'Data demo berhasil ditambahkan ke database.');
}
