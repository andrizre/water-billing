/**
 * Sandmosquito Water Billing - Google Apps Script Backend Router
 * Web App entry point for handling POST and GET requests with authentication, authorization & error handling.
 */

/**
 * Handle HTTP POST requests (Main API Router)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return errorResponse('Permintaan tidak valid: body kosong.', 400);
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var data = payload.data || {};
    var token = payload.token || '';

    if (!action) {
      return errorResponse('Parameter "action" wajib disertakan.', 400);
    }

    // Public Actions (No Auth Required)
    if (action === 'auth_login') {
      return handleLogin(data);
    }
    if (action === 'public_check_bill') {
      return handlePublicCheckBill(data);
    }
    if (action === 'setup_database') {
      return handleSetupDatabase(data);
    }
    if (action === 'seed_demo_data') {
      return handleSeedDemoData(data);
    }

    // Authenticated Actions: Verify Token
    var authUser = verifyToken(token);
    if (!authUser) {
      return errorResponse('Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.', 401);
    }

    // Dispatch based on action & role authorization
    switch (action) {
      // Auth Actions
      case 'auth_verify':
        return handleVerifyAuth(authUser);
      case 'auth_change_password':
        return handleChangePassword(authUser, data);
      case 'auth_profile':
        return handleGetProfile(authUser);

      // User Management (Admin Only)
      case 'users_list':
        requireRole(authUser, ['admin']);
        return handleGetUsers(data);
      case 'users_create':
        requireRole(authUser, ['admin']);
        return handleCreateUser(authUser, data);
      case 'users_update':
        requireRole(authUser, ['admin']);
        return handleUpdateUser(authUser, data);
      case 'users_delete':
        requireRole(authUser, ['admin']);
        return handleDeleteUser(authUser, data);
      case 'users_reset_password':
        requireRole(authUser, ['admin']);
        return handleResetUserPassword(authUser, data);

      // Customer Management (Admin & Operator, Customer limited to self)
      case 'customers_list':
        requireRole(authUser, ['admin', 'operator']);
        return handleGetCustomers(data);
      case 'customers_get':
        return handleGetCustomerById(authUser, data);
      case 'customers_create':
        requireRole(authUser, ['admin', 'operator']);
        return handleCreateCustomer(authUser, data);
      case 'customers_update':
        requireRole(authUser, ['admin', 'operator']);
        return handleUpdateCustomer(authUser, data);
      case 'customers_delete':
        requireRole(authUser, ['admin']);
        return handleDeleteCustomer(authUser, data);

      // Meter Management (Admin & Operator)
      case 'meters_list':
        requireRole(authUser, ['admin', 'operator']);
        return handleGetMeters(data);
      case 'meters_create':
        requireRole(authUser, ['admin', 'operator']);
        return handleCreateMeter(authUser, data);
      case 'meters_update':
        requireRole(authUser, ['admin', 'operator']);
        return handleUpdateMeter(authUser, data);
      case 'meters_delete':
        requireRole(authUser, ['admin']);
        return handleDeleteMeter(authUser, data);

      // Meter Readings (Admin & Operator, Customer for self readings)
      case 'readings_list':
        return handleGetReadings(authUser, data);
      case 'readings_record':
        requireRole(authUser, ['admin', 'operator']);
        return handleRecordReading(authUser, data);
      case 'readings_get_prev':
        requireRole(authUser, ['admin', 'operator']);
        return handleGetPrevReading(data);

      // Tariffs (Admin manages, all can view)
      case 'tariffs_list':
        return handleGetTariffs();
      case 'tariffs_create':
        requireRole(authUser, ['admin']);
        return handleCreateTariff(authUser, data);
      case 'tariffs_update':
        requireRole(authUser, ['admin']);
        return handleUpdateTariff(authUser, data);

      // Bills (Admin & Operator full, Customer for self)
      case 'bills_list':
        return handleGetBills(authUser, data);
      case 'bills_get':
        return handleGetBillById(authUser, data);
      case 'bills_generate':
        requireRole(authUser, ['admin', 'operator']);
        return handleGenerateBill(authUser, data);
      case 'bills_generate_batch':
        requireRole(authUser, ['admin', 'operator']);
        return handleGenerateBatchBills(authUser, data);
      case 'bills_update_status':
        requireRole(authUser, ['admin', 'operator']);
        return handleUpdateBillStatus(authUser, data);

      // Payments (Admin & Operator record, Customer view self)
      case 'payments_list':
        return handleGetPayments(authUser, data);
      case 'payments_record':
        requireRole(authUser, ['admin', 'operator']);
        return handleRecordPayment(authUser, data);
      case 'payments_receipt':
        return handleGetPaymentReceipt(authUser, data);

      // Reports & Dashboard
      case 'reports_summary':
        return handleGetDashboardSummary(authUser, data);
      case 'reports_billing':
        requireRole(authUser, ['admin', 'operator']);
        return handleGetBillingReport(data);
      case 'reports_payment':
        requireRole(authUser, ['admin', 'operator']);
        return handleGetPaymentReport(data);
      case 'reports_usage':
        requireRole(authUser, ['admin', 'operator']);
        return handleGetUsageReport(data);
      case 'reports_arrears':
        requireRole(authUser, ['admin', 'operator']);
        return handleGetArrearsReport(data);

      // Settings (Admin manages, all can view basic)
      case 'settings_get':
        return handleGetSettings();
      case 'settings_update':
        requireRole(authUser, ['admin']);
        return handleUpdateSettings(authUser, data);

      // Audit Logs (Admin Only)
      case 'audit_list':
        requireRole(authUser, ['admin']);
        return handleGetAuditLogs(data);

      default:
        return errorResponse('Aksi "' + action + '" tidak dikenali.', 404);
    }
  } catch (err) {
    Logger.log('Error di doPost: ' + err.stack || err.message);
    return errorResponse('Terjadi kesalahan server: ' + err.message, 500);
  }
}

/**
 * Handle HTTP GET requests (Health Check & Info)
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';

  if (action === 'ping') {
    return jsonResponse({
      app: 'Sandmosquito Water Billing API',
      status: 'online',
      version: '1.0.0',
      timestamp: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss')
    }, 200, 'Sandmosquito Water Billing API siap digunakan.');
  }

  if (action === 'settings') {
    return handleGetSettings();
  }

  return jsonResponse({ status: 'ready' }, 200, 'API Aktif.');
}

/**
 * Helper to enforce role requirements
 */
function requireRole(authUser, allowedRoles) {
  if (!authUser || allowedRoles.indexOf(authUser.role) === -1) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk tindakan ini.');
  }
}
