/**
 * Sandmosquito Water Billing - Google Apps Script Users Module
 * Admin-only management for system users (Admins & Operators).
 */

function handleGetUsers(params) {
  var users = getAllRows('Users');
  var roleFilter = params.role || '';
  var search = String(params.search || '').toLowerCase();

  var filtered = users.filter(function(u) {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search) {
      var matchUsername = String(u.username || '').toLowerCase().indexOf(search) !== -1;
      var matchName = String(u.full_name || '').toLowerCase().indexOf(search) !== -1;
      var matchEmail = String(u.email || '').toLowerCase().indexOf(search) !== -1;
      return matchUsername || matchName || matchEmail;
    }
    return true;
  });

  // Strip password_hash and salt from output for security
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

  return jsonResponse(sanitized, 200, 'Daftar pengguna berhasil dimuat.');
}

function handleCreateUser(authUser, data) {
  var username = String(data.username || '').trim();
  var password = String(data.password || '').trim();
  var fullName = String(data.full_name || '').trim();
  var role = String(data.role || 'operator').trim().toLowerCase();
  var email = String(data.email || '').trim();
  var phone = String(data.phone || '').trim();

  if (!username || !password || !fullName) {
    return errorResponse('Username, Password, dan Nama Lengkap wajib diisi.', 400);
  }

  // Check username uniqueness
  var existingUsers = getAllRows('Users');
  for (var i = 0; i < existingUsers.length; i++) {
    if (String(existingUsers[i].username).toLowerCase() === username.toLowerCase()) {
      return errorResponse('Username "' + username + '" sudah digunakan oleh pengguna lain.', 400);
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
    email: email,
    phone: phone,
    is_active: data.is_active !== undefined ? (data.is_active ? 'TRUE' : 'FALSE') : 'TRUE',
    created_at: nowStr,
    updated_at: nowStr
  };

  appendRow('Users', newUser);
  logAudit(authUser.userId, authUser.username, 'CREATE_USER', 'Membuat pengguna baru: ' + username + ' (' + role + ')');

  return jsonResponse({
    id: id,
    username: username,
    full_name: fullName,
    role: role,
    email: email,
    phone: phone,
    is_active: true
  }, 201, 'Pengguna baru berhasil ditambahkan.');
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

  // If password provided in update
  if (data.password && String(data.password).trim() !== '') {
    var newSalt = generateSalt();
    updateObj.salt = newSalt;
    updateObj.password_hash = hashPassword(String(data.password).trim(), newSalt);
  }

  updateRowById('Users', id, updateObj);
  logAudit(authUser.userId, authUser.username, 'UPDATE_USER', 'Memperbarui data pengguna: ' + existing.username);

  return jsonResponse(null, 200, 'Data pengguna berhasil diperbarui.');
}

function handleDeleteUser(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Pengguna wajib diisi.', 400);

  if (String(id) === String(authUser.userId)) {
    return errorResponse('Anda tidak dapat menghapus akun Anda sendiri.', 400);
  }

  var existing = getRowById('Users', id);
  if (!existing) return errorResponse('Pengguna tidak ditemukan.', 404);

  deleteRowById('Users', id);
  logAudit(authUser.userId, authUser.username, 'DELETE_USER', 'Menghapus pengguna: ' + existing.username);

  return jsonResponse(null, 200, 'Pengguna berhasil dihapus.');
}

function handleResetUserPassword(authUser, data) {
  var id = data.id;
  var newPassword = String(data.new_password || 'sandmosquito123').trim();
  if (!id) return errorResponse('ID Pengguna wajib diisi.', 400);

  var existing = getRowById('Users', id);
  if (!existing) return errorResponse('Pengguna tidak ditemukan.', 404);

  var newSalt = generateSalt();
  var newHash = hashPassword(newPassword, newSalt);

  updateRowById('Users', id, {
    salt: newSalt,
    password_hash: newHash,
    updated_at: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss')
  });

  logAudit(authUser.userId, authUser.username, 'RESET_PASSWORD', 'Reset kata sandi pengguna: ' + existing.username);

  return jsonResponse({
    new_password: newPassword
  }, 200, 'Kata sandi pengguna ' + existing.username + ' berhasil direset.');
}
