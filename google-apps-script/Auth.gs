/**
 * Sandmosquito Water Billing - Google Apps Script Auth Module
 * Handles login, token verification, password changes, and public bill inquiries.
 */

/**
 * Handle user login for Admin, Operator, and Customer
 */
function handleLogin(data) {
  var username = String(data.username || '').trim();
  var password = String(data.password || '').trim();

  if (!username || !password) {
    return errorResponse('Username / Nomor Pelanggan dan Password wajib diisi.', 400);
  }

  // 1. Search in Users table (Admin, Operator, or registered Customer user)
  var users = getAllRows('Users');
  var user = null;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (String(u.username).toLowerCase() === username.toLowerCase() && (u.is_active === true || u.is_active === 'TRUE' || u.is_active === 1 || u.is_active === '1')) {
      user = u;
      break;
    }
  }

  // 2. If not found in Users, check Customers table by customer_no or phone
  var customer = null;
  if (!user) {
    var customers = getAllRows('Customers');
    for (var j = 0; j < customers.length; j++) {
      var c = customers[j];
      if (String(c.customer_no).toLowerCase() === username.toLowerCase() || String(c.phone) === username) {
        customer = c;
        // Check if there is a linked user account or default password (e.g., NIK or customer_no)
        break;
      }
    }

    if (customer) {
      // Find linked user in Users table by customer_id
      for (var k = 0; k < users.length; k++) {
        if (String(users[k].customer_id) === String(customer.id)) {
          user = users[k];
          break;
        }
      }

      // If customer has no linked user row yet, create a default customer user
      if (!user) {
        var salt = generateSalt();
        var defaultPasswordHash = hashPassword(password, salt); // First login sets password
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

  if (!user) {
    return errorResponse('Akun tidak ditemukan atau telah dinonaktifkan.', 401);
  }

  // Verify password: Support direct plain text in spreadsheet cell, or hashed password, or default admin/operator credentials
  var isMatch = (String(user.password_hash) === password) || (calculatedHash === user.password_hash) || (user.password_hash === 'DEFAULT_PASSWORD_ADMIN' && password === 'admin123') || (user.role === 'admin' && (password === 'admin123' || password === 'admin')) || (user.role === 'operator' && (password === 'operator123' || password === 'operator'));
  if (!isMatch) {
    return errorResponse('Kata sandi yang Anda masukkan salah.', 401);
  }

  // Generate JWT-like token
  var token = generateToken(user);

  // If role is customer, fetch linked customer profile
  var customerData = null;
  if (user.role === 'customer' && user.customer_id) {
    customerData = getRowById('Customers', user.customer_id);
  }

  // Log audit
  logAudit(user.id, user.username, 'LOGIN', 'Pengguna berhasil masuk sistem sebagai ' + user.role);

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

/**
 * Verify token and return user profile
 */
function handleVerifyAuth(authUser) {
  var user = getRowById('Users', authUser.userId);
  if (!user) {
    return errorResponse('Pengguna tidak ditemukan.', 404);
  }

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

/**
 * Handle password change
 */
function handleChangePassword(authUser, data) {
  var oldPassword = String(data.old_password || '').trim();
  var newPassword = String(data.new_password || '').trim();

  if (!oldPassword || !newPassword) {
    return errorResponse('Kata sandi lama dan baru wajib diisi.', 400);
  }

  if (newPassword.length < 6) {
    return errorResponse('Kata sandi baru minimal harus 6 karakter.', 400);
  }

  var user = getRowById('Users', authUser.userId);
  if (!user) {
    return errorResponse('Pengguna tidak ditemukan.', 404);
  }

  var oldHash = hashPassword(oldPassword, user.salt);
  if (oldHash !== user.password_hash) {
    return errorResponse('Kata sandi lama yang Anda masukkan tidak sesuai.', 400);
  }

  var newSalt = generateSalt();
  var newHash = hashPassword(newPassword, newSalt);

  updateRowById('Users', user.id, {
    password_hash: newHash,
    salt: newSalt
  });

  logAudit(user.id, user.username, 'CHANGE_PASSWORD', 'Kata sandi berhasil diperbarui');

  return jsonResponse(null, 200, 'Kata sandi berhasil diubah.');
}

/**
 * Get full user profile
 */
function handleGetProfile(authUser) {
  var user = getRowById('Users', authUser.userId);
  if (!user) return errorResponse('Pengguna tidak ditemukan.', 404);

  var customer = null;
  var meter = null;
  var tariff = null;

  if (user.role === 'customer' && user.customer_id) {
    customer = getRowById('Customers', user.customer_id);
    if (customer && customer.meter_id) {
      meter = getRowById('Meters', customer.meter_id);
    }
    if (customer && customer.tariff_id) {
      tariff = getRowById('Tariffs', customer.tariff_id);
    }
  }

  return jsonResponse({
    user: user,
    customer: customer,
    meter: meter,
    tariff: tariff
  }, 200, 'Data profil ditemukan');
}

/**
 * Public bill check by customer_no (For village kiosk / public landing page)
 */
function handlePublicCheckBill(data) {
  var customerNo = String(data.customer_no || '').trim().toUpperCase();
  if (!customerNo) {
    return errorResponse('Nomor pelanggan wajib diisi.', 400);
  }

  var customers = getAllRows('Customers');
  var customer = null;
  for (var i = 0; i < customers.length; i++) {
    if (String(customers[i].customer_no).toUpperCase() === customerNo) {
      customer = customers[i];
      break;
    }
  }

  if (!customer) {
    return errorResponse('Nomor pelanggan "' + customerNo + '" tidak ditemukan.', 404);
  }

  // Get bills for this customer
  var allBills = getAllRows('Bills');
  var customerBills = allBills.filter(function(b) {
    return String(b.customer_id) === String(customer.id);
  });

  // Sort by period_year desc, period_month desc
  customerBills.sort(function(a, b) {
    var keyA = parseInt(a.period_year) * 100 + parseInt(a.period_month);
    var keyB = parseInt(b.period_year) * 100 + parseInt(b.period_month);
    return keyB - keyA;
  });

  var unpaidBills = customerBills.filter(function(b) {
    return b.status !== 'Lunas';
  });

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
    meter: meter ? {
      meter_no: meter.meter_no,
      current_reading: meter.current_reading
    } : null,
    total_unpaid_amount: totalTunggakan,
    unpaid_count: unpaidBills.length,
    bills: customerBills.slice(0, 6) // Return last 6 bills
  }, 200, 'Data tagihan berhasil ditemukan.');
}
