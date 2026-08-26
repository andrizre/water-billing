import { storage } from './storage';
import { mockApiService } from './mockApiService';
import { supabaseApiService } from './supabaseApiService';
import { isSupabaseConfigured } from './supabaseClient';

export type BackendType = 'supabase' | 'sqlite' | 'gas' | 'mock';

const GAS_API_URL = import.meta.env.VITE_GAS_API_URL || '';
const SQLITE_API_URL = import.meta.env.VITE_SQLITE_API_URL || 'http://localhost:3001';

/**
 * Returns the currently active backend type (checks localStorage first, then .env, with safe mock fallback)
 */
export function getActiveBackend(): BackendType {
  const saved = storage.getActiveBackend() as BackendType | null;
  if (saved && (saved === 'supabase' || saved === 'sqlite' || saved === 'gas' || saved === 'mock')) {
    return saved;
  }
  const envBackend = (import.meta.env.VITE_ACTIVE_BACKEND as BackendType) || 'supabase';
  if (envBackend === 'supabase' && !isSupabaseConfigured()) {
    return 'mock';
  }
  return envBackend;
}

/**
 * Dynamically switch the active database backend
 */
export function setActiveBackend(backend: BackendType): void {
  storage.setActiveBackend(backend);
}

/**
 * Helper to wrap any async operation with a strict timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 6000, errorMsg: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Universal Multi-Backend API Requester
 * Directed by localStorage selection or VITE_ACTIVE_BACKEND in .env (Default: supabase/mock).
 * Uses strict timeout to prevent website freezing on offline or slow backends.
 */
async function callApi<T = any>(action: string, data: any = {}): Promise<T> {
  const backend = getActiveBackend();

  switch (backend) {
    case 'supabase': {
      if (!isSupabaseConfigured()) {
        throw new Error(
          'Supabase belum dikonfigurasi di .env. Anda dapat beralih ke Mode SQLite atau Mode Simulasi Browser di Pengaturan.'
        );
      }
      try {
        return await withTimeout<T>(
          handleSupabaseCall<T>(action, data),
          7000,
          'Koneksi ke Supabase Cloud timeout (melebihi batas waktu). Periksa koneksi internet Anda atau beralih ke backend lain.'
        );
      } catch (err: any) {
        if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
          throw new Error('Gagal menghubungi Supabase Cloud. Periksa URL/Key di .env atau beralih ke Mode SQLite / Mock.');
        }
        throw err;
      }
    }

    case 'sqlite': {
      const token = storage.getToken() || '';
      try {
        const response = await withTimeout<Response>(
          fetch(SQLITE_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ action: normalizeActionForServer(action), ...data })
          }),
          5000,
          `Server SQLite lokal (${SQLITE_API_URL}) tidak merespons (timeout). Pastikan terminal 'npm run server' sudah dijalankan.`
        );

        if (!response.ok) {
          throw new Error(`Server SQLite merespons dengan status ${response.status}.`);
        }

        const result = await response.json();
        if (result.success === false) {
          throw new Error(result.error || 'Permintaan gagal pada server SQLite.');
        }
        return unwrapServerResponse(action, result) as T;
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('timeout')) {
          throw new Error(
            `Server SQLite lokal (${SQLITE_API_URL}) tidak berjalan atau timeout. Silakan jalankan 'npm run server' di terminal atau pilih backend lain.`
          );
        }
        throw err;
      }
    }

    case 'gas': {
      if (!GAS_API_URL || GAS_API_URL.trim() === '') {
        throw new Error(
          'Google Apps Script dipilih sebagai backend aktif, tetapi VITE_GAS_API_URL belum diisi di .env.'
        );
      }
      const token = storage.getToken() || '';
      const payload = { action, token, data };

      try {
        const response = await withTimeout<Response>(
          fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          }),
          8000,
          'Koneksi Google Apps Script timeout (melebihi batas waktu 8 detik).'
        );

        if (!response.ok) {
          throw new Error(`Server Google Apps Script merespons dengan status ${response.status}.`);
        }

        const result = await response.json();
        if (result.success || result.status === 200 || result.status === 201) {
          return (result.data || result) as T;
        }
        throw new Error(result.message || result.error || 'Permintaan gagal diproses pada GAS.');
      } catch (err: any) {
        if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
          throw new Error('Gagal menghubungi Google Apps Script. Periksa URL Web App di .env.');
        }
        throw err;
      }
    }

    case 'mock':
    default:
      return handleMockCall<T>(action, data);
  }
}

/**
 * Route actions to Supabase service
 */
async function handleSupabaseCall<T = any>(action: string, data: any): Promise<T> {
  const token = storage.getToken() || '';

  switch (action) {
    case 'auth_login':
      return (await supabaseApiService.login(data.username, data.password)) as T;
    case 'auth_verify':
      return (await supabaseApiService.verifyAuth(token)) as T;
    case 'auth_change_password':
      return (await supabaseApiService.changePassword(data.old_password, data.new_password)) as T;
    case 'public_check_bill':
      return (await supabaseApiService.publicCheckBill(data.customer_no)) as T;

    case 'users_list':
      return (await supabaseApiService.getUsers(data)) as T;
    case 'users_create':
      return (await supabaseApiService.createUser(data)) as T;
    case 'users_update':
      return (await supabaseApiService.updateUser(data)) as T;
    case 'users_delete':
      return (await supabaseApiService.deleteUser(data.id)) as T;
    case 'users_reset_password':
      return (await supabaseApiService.resetUserPassword(data.id, data.new_password)) as T;

    case 'customers_list':
      return (await supabaseApiService.getCustomers(data)) as T;
    case 'customers_get':
      return (await supabaseApiService.getCustomerById(data.id || data.customer_id)) as T;
    case 'customers_create':
      return (await supabaseApiService.createCustomer(data)) as T;
    case 'customers_update':
      return (await supabaseApiService.updateCustomer(data)) as T;
    case 'customers_delete':
      return (await supabaseApiService.deleteCustomer(data.id)) as T;

    case 'meters_list':
      return (await supabaseApiService.getMeters(data)) as T;
    case 'meters_create':
      return (await supabaseApiService.createMeter(data)) as T;
    case 'meters_update':
      return (await supabaseApiService.updateMeter(data)) as T;
    case 'meters_delete':
      return (await supabaseApiService.deleteMeter(data.id)) as T;

    case 'readings_list':
      return (await supabaseApiService.getReadings(data)) as T;
    case 'readings_get_prev':
      return (await supabaseApiService.getPrevReading(data.customer_id)) as T;
    case 'readings_record':
      return (await supabaseApiService.recordReading(data)) as T;

    case 'tariffs_list':
      return (await supabaseApiService.getTariffs()) as T;
    case 'tariffs_create':
      return (await supabaseApiService.createTariff(data)) as T;
    case 'tariffs_update':
      return (await supabaseApiService.updateTariff(data)) as T;

    case 'bills_list':
      return (await supabaseApiService.getBills(data)) as T;
    case 'bills_get':
      return (await supabaseApiService.getBillById(data.id || data.bill_id)) as T;
    case 'bills_generate_batch':
      return (await supabaseApiService.generateBatchBills(data.period_month, data.period_year)) as T;
    case 'bills_update_status':
      return (await supabaseApiService.updateBillStatus(data.id, data.status)) as T;

    case 'payments_list':
      return (await supabaseApiService.getPayments(data)) as T;
    case 'payments_record':
      return (await supabaseApiService.recordPayment(data)) as T;
    case 'payments_receipt':
      return (await supabaseApiService.getPaymentReceipt(data.id || data.payment_id)) as T;

    case 'reports_summary': {
      const user = storage.getUser();
      return (await supabaseApiService.getDashboardSummary(user?.role || 'admin', user?.customerId)) as T;
    }
    case 'reports_billing':
      return (await supabaseApiService.getReports('billing', data)) as T;
    case 'reports_payment':
      return (await supabaseApiService.getReports('payment', data)) as T;
    case 'reports_arrears':
      return (await supabaseApiService.getReports('arrears', data)) as T;
    case 'reports_usage':
      return (await supabaseApiService.getReports('usage', data)) as T;

    case 'settings_get':
      return (await supabaseApiService.getSettings()) as T;
    case 'settings_update':
      return (await supabaseApiService.updateSettings(data)) as T;

    case 'audit_list':
      return (await supabaseApiService.getAuditLogs(data)) as T;

    // Announcements
    case 'announcements_list':
      return (await supabaseApiService.getAnnouncements(data)) as T;
    case 'announcements_create':
      return (await supabaseApiService.createAnnouncement(data)) as T;
    case 'announcements_update':
      return (await supabaseApiService.updateAnnouncement(data)) as T;
    case 'announcements_delete':
      return (await supabaseApiService.deleteAnnouncement(data.id)) as T;

    // Complaints
    case 'complaints_list':
      return (await supabaseApiService.getComplaints(data)) as T;
    case 'complaints_create':
      return (await supabaseApiService.createComplaint(data)) as T;
    case 'complaints_update_status':
      return (await supabaseApiService.updateComplaintStatus(data.id, data.status, data.response_notes)) as T;

    // Subscription Requests
    case 'subscription_requests_list':
      return (await supabaseApiService.getSubscriptionRequests(data)) as T;
    case 'subscription_requests_create':
      return (await supabaseApiService.createSubscriptionRequest(data)) as T;
    case 'subscription_requests_update_status':
      return (await supabaseApiService.updateSubscriptionRequestStatus(data.id, data.status, data.response_notes)) as T;

    // Registration Tokens & Register
    case 'tokens_list':
      return (await supabaseApiService.getRegistrationTokens()) as T;
    case 'tokens_create':
      return (await supabaseApiService.createRegistrationToken(data)) as T;
    case 'tokens_delete':
      return (await supabaseApiService.deleteRegistrationToken(data.id)) as T;
    case 'tokens_verify':
      return (await supabaseApiService.verifyRegistrationToken(data.token, data.expectedType)) as T;
    case 'auth_register':
      return (await supabaseApiService.registerWithToken(data)) as T;
    case 'auth_forgot_reset':
      return (await supabaseApiService.forgotResetPassword(data)) as T;

    // Maintenance Expenses
    case 'maintenance_list':
      return (await supabaseApiService.getMaintenanceExpenses(data)) as T;
    case 'maintenance_create':
      return (await supabaseApiService.createMaintenanceExpense(data)) as T;
    case 'maintenance_delete':
      return (await supabaseApiService.deleteMaintenanceExpense(data.id)) as T;

    default:
      throw new Error(`Aksi "${action}" tidak didukung pada Supabase.`);
  }
}

/**
 * Normalizes action name from frontend to server format
 */
function normalizeActionForServer(action: string): string {
  const map: Record<string, string> = {
    'auth_login': 'login',
    'auth_verify': 'verifyToken',
    'auth_change_password': 'changePassword',
    'public_check_bill': 'publicCheckBill',
    'users_list': 'getUsers',
    'users_create': 'createUser',
    'users_update': 'updateUser',
    'users_delete': 'deleteUser',
    'users_reset_password': 'resetUserPassword',
    'customers_list': 'getCustomers',
    'customers_get': 'getCustomerById',
    'customers_create': 'createCustomer',
    'customers_update': 'updateCustomer',
    'customers_delete': 'deleteCustomer',
    'meters_list': 'getMeters',
    'meters_create': 'createMeter',
    'meters_update': 'updateMeter',
    'meters_delete': 'deleteMeter',
    'readings_list': 'getReadings',
    'readings_get_prev': 'getPrevReading',
    'readings_record': 'recordReading',
    'tariffs_list': 'getTariffs',
    'tariffs_create': 'createTariff',
    'tariffs_update': 'updateTariff',
    'bills_list': 'getBills',
    'bills_get': 'getBillById',
    'bills_generate_batch': 'generateBatchBills',
    'bills_update_status': 'updateBillStatus',
    'payments_list': 'getPayments',
    'payments_record': 'recordPayment',
    'payments_receipt': 'getPaymentById',
    'reports_summary': 'getDashboardSummary',
    'reports_billing': 'getBillingReport',
    'reports_payment': 'getPaymentReport',
    'reports_arrears': 'getArrearsReport',
    'reports_usage': 'getUsageReport',
    'settings_get': 'getSettings',
    'settings_update': 'updateSettings',
    'audit_list': 'getAuditLogs',
    'announcements_list': 'getAnnouncements',
    'announcements_create': 'createAnnouncement',
    'announcements_update': 'updateAnnouncement',
    'announcements_delete': 'deleteAnnouncement',
    'complaints_list': 'getComplaints',
    'complaints_create': 'createComplaint',
    'complaints_update_status': 'updateComplaintStatus',
    'subscription_requests_list': 'getSubscriptionRequests',
    'subscription_requests_create': 'createSubscriptionRequest',
    'subscription_requests_update_status': 'updateSubscriptionRequestStatus',
    'tokens_list': 'getRegistrationTokens',
    'tokens_create': 'createRegistrationToken',
    'tokens_delete': 'deleteRegistrationToken',
    'tokens_verify': 'verifyRegistrationToken',
    'auth_register': 'registerWithToken',
    'auth_forgot_reset': 'forgotPasswordReset',
    'maintenance_create': 'createMaintenanceExpense',
    'maintenance_delete': 'deleteMaintenanceExpense'
  };
  return map[action] || action;
}

/**
 * Unwraps server response according to frontend expectations
 */
function unwrapServerResponse(action: string, result: any): any {
  if (result.data !== undefined) return result.data;
  if (action === 'customers_list') return result.customers || [];
  if (action === 'meters_list') return result.meters || [];
  if (action === 'tariffs_list') return result.tariffs || [];
  if (action === 'bills_list') return result.bills || [];
  if (action === 'payments_list') return result.payments || [];
  if (action === 'readings_list') return result.readings || [];
  if (action === 'users_list') return result.users || [];
  if (action === 'audit_list') return result.logs || [];
  if (action === 'announcements_list') return result.announcements || [];
  if (action === 'complaints_list') return result.complaints || [];
  if (action === 'subscription_requests_list') return result.requests || [];
  if (action === 'tokens_list') return result.tokens || [];
  if (action === 'maintenance_list') return result.expenses || [];
  return result;
}

/**
 * Route actions to mock service
 */
async function handleMockCall<T = any>(action: string, data: any): Promise<T> {
  const token = storage.getToken() || '';

  switch (action) {
    case 'auth_login':
      return (await mockApiService.login(data.username, data.password)) as T;
    case 'auth_verify':
      return (await mockApiService.verifyAuth(token)) as T;
    case 'auth_change_password':
      return (await mockApiService.changePassword(data.old_password, data.new_password)) as T;
    case 'public_check_bill':
      return (await mockApiService.publicCheckBill(data.customer_no)) as T;

    case 'users_list':
      return (await mockApiService.getUsers(data)) as T;
    case 'users_create':
      return (await mockApiService.createUser(data)) as T;
    case 'users_update':
      return (await mockApiService.updateUser(data)) as T;
    case 'users_delete':
      return (await mockApiService.deleteUser(data.id)) as T;
    case 'users_reset_password':
      return (await mockApiService.resetUserPassword(data.id, data.new_password)) as T;

    case 'customers_list':
      return (await mockApiService.getCustomers(data)) as T;
    case 'customers_get':
      return (await mockApiService.getCustomerById(data.id || data.customer_id)) as T;
    case 'customers_create':
      return (await mockApiService.createCustomer(data)) as T;
    case 'customers_update':
      return (await mockApiService.updateCustomer(data)) as T;
    case 'customers_delete':
      return (await mockApiService.deleteCustomer(data.id)) as T;

    case 'meters_list':
      return (await mockApiService.getMeters(data)) as T;
    case 'meters_create':
      return (await mockApiService.createMeter(data)) as T;
    case 'meters_update':
      return (await mockApiService.updateMeter(data)) as T;
    case 'meters_delete':
      return (await mockApiService.deleteMeter(data.id)) as T;

    case 'readings_list':
      return (await mockApiService.getReadings(data)) as T;
    case 'readings_get_prev':
      return (await mockApiService.getPrevReading(data.customer_id)) as T;
    case 'readings_record':
      return (await mockApiService.recordReading(data)) as T;

    case 'tariffs_list':
      return (await mockApiService.getTariffs()) as T;
    case 'tariffs_create':
      return (await mockApiService.createTariff(data)) as T;
    case 'tariffs_update':
      return (await mockApiService.updateTariff(data)) as T;

    case 'bills_list':
      return (await mockApiService.getBills(data)) as T;
    case 'bills_get':
      return (await mockApiService.getBillById(data.id || data.bill_id)) as T;
    case 'bills_generate_batch':
      return (await mockApiService.generateBatchBills(data.period_month, data.period_year)) as T;
    case 'bills_update_status':
      return (await mockApiService.updateBillStatus(data.id, data.status)) as T;

    case 'payments_list':
      return (await mockApiService.getPayments(data)) as T;
    case 'payments_record':
      return (await mockApiService.recordPayment(data)) as T;
    case 'payments_receipt':
      return (await mockApiService.getPaymentReceipt(data.id || data.payment_id)) as T;

    case 'reports_summary': {
      const user = storage.getUser();
      return (await mockApiService.getDashboardSummary(user?.role || 'admin', user?.customerId)) as T;
    }
    case 'reports_billing':
      return (await mockApiService.getReports('billing', data)) as T;
    case 'reports_payment':
      return (await mockApiService.getReports('payment', data)) as T;
    case 'reports_arrears':
      return (await mockApiService.getReports('arrears', data)) as T;
    case 'reports_usage':
      return (await mockApiService.getReports('usage', data)) as T;

    case 'settings_get':
      return (await mockApiService.getSettings()) as T;
    case 'settings_update':
      return (await mockApiService.updateSettings(data)) as T;

    case 'audit_list':
      return (await mockApiService.getAuditLogs(data)) as T;

    // Announcements
    case 'announcements_list':
      return (await mockApiService.getAnnouncements(data)) as T;
    case 'announcements_create':
      return (await mockApiService.createAnnouncement(data)) as T;
    case 'announcements_update':
      return (await mockApiService.updateAnnouncement(data)) as T;
    case 'announcements_delete':
      return (await mockApiService.deleteAnnouncement(data.id)) as T;

    // Complaints
    case 'complaints_list':
      return (await mockApiService.getComplaints(data)) as T;
    case 'complaints_create':
      return (await mockApiService.createComplaint(data)) as T;
    case 'complaints_update_status':
      return (await mockApiService.updateComplaintStatus(data.id, data.status, data.response_notes)) as T;

    // Subscription Requests
    case 'subscription_requests_list':
      return (await mockApiService.getSubscriptionRequests(data)) as T;
    case 'subscription_requests_create':
      return (await mockApiService.createSubscriptionRequest(data)) as T;
    case 'subscription_requests_update_status':
      return (await mockApiService.updateSubscriptionRequestStatus(data.id, data.status, data.response_notes)) as T;

    // Registration Tokens & Register
    case 'tokens_list':
      return (await mockApiService.getRegistrationTokens()) as T;
    case 'tokens_create':
      return (await mockApiService.createRegistrationToken(data)) as T;
    case 'tokens_delete':
      return (await mockApiService.deleteRegistrationToken(data.id)) as T;
    case 'tokens_verify':
      return (await mockApiService.verifyRegistrationToken(data.token, data.expectedType)) as T;
    case 'auth_register':
      return (await mockApiService.registerWithToken(data)) as T;
    case 'auth_forgot_reset':
      return (await mockApiService.forgotResetPassword(data)) as T;

    // Maintenance Expenses
    case 'maintenance_list':
      return (await mockApiService.getMaintenanceExpenses(data)) as T;
    case 'maintenance_create':
      return (await mockApiService.createMaintenanceExpense(data)) as T;
    case 'maintenance_delete':
      return (await mockApiService.deleteMaintenanceExpense(data.id)) as T;

    default:
      throw new Error(`Aksi "${action}" tidak didukung.`);
  }
}

export const api = {
  // Auth
  login: (username: string, password: string) => callApi('auth_login', { username, password }),
  verifyAuth: () => callApi('auth_verify'),
  changePassword: (old_password: string, new_password: string) =>
    callApi('auth_change_password', { old_password, new_password }),
  publicCheckBill: (customer_no: string) => callApi('public_check_bill', { customer_no }),

  // Users
  getUsers: (params?: any) => callApi('users_list', params),
  createUser: (data: any) => callApi('users_create', data),
  updateUser: (data: any) => callApi('users_update', data),
  deleteUser: (id: string) => callApi('users_delete', { id }),
  resetUserPassword: (id: string, new_password?: string) =>
    callApi('users_reset_password', { id, new_password }),

  // Customers
  getCustomers: (params?: any) => callApi('customers_list', params),
  getCustomerById: (id: string) => callApi('customers_get', { id }),
  createCustomer: (data: any) => callApi('customers_create', data),
  updateCustomer: (data: any) => callApi('customers_update', data),
  deleteCustomer: (id: string) => callApi('customers_delete', { id }),

  // Meters
  getMeters: (params?: any) => callApi('meters_list', params),
  createMeter: (data: any) => callApi('meters_create', data),
  updateMeter: (data: any) => callApi('meters_update', data),
  deleteMeter: (id: string) => callApi('meters_delete', { id }),

  // Meter Readings
  getReadings: (params?: any) => callApi('readings_list', params),
  getPrevReading: (customer_id: string) => callApi('readings_get_prev', { customer_id }),
  recordReading: (data: any) => callApi('readings_record', data),

  // Tariffs
  getTariffs: () => callApi('tariffs_list'),
  createTariff: (data: any) => callApi('tariffs_create', data),
  updateTariff: (data: any) => callApi('tariffs_update', data),

  // Bills
  getBills: (params?: any) => callApi('bills_list', params),
  getBillById: (id: string) => callApi('bills_get', { id }),
  generateBatchBills: (period_month: number, period_year: number) =>
    callApi('bills_generate_batch', { period_month, period_year }),
  updateBillStatus: (id: string, status: string) =>
    callApi('bills_update_status', { id, status }),

  // Payments
  getPayments: (params?: any) => callApi('payments_list', params),
  recordPayment: (data: any) => callApi('payments_record', data),
  getPaymentReceipt: (id: string) => callApi('payments_receipt', { id }),

  // Reports
  getDashboardSummary: () => callApi('reports_summary'),
  getBillingReport: (params?: any) => callApi('reports_billing', params),
  getPaymentReport: (params?: any) => callApi('reports_payment', params),
  getArrearsReport: () => callApi('reports_arrears'),
  getUsageReport: (params?: any) => callApi('reports_usage', params),

  // Settings & Logs
  getSettings: () => callApi('settings_get'),
  updateSettings: (settings: any) => callApi('settings_update', settings),
  getAuditLogs: (params?: any) => callApi('audit_list', params),

  // Announcements
  getAnnouncements: (params?: any) => callApi('announcements_list', params),
  createAnnouncement: (data: any) => callApi('announcements_create', data),
  updateAnnouncement: (data: any) => callApi('announcements_update', data),
  deleteAnnouncement: (id: string) => callApi('announcements_delete', { id }),

  // Complaints
  getComplaints: (params?: any) => callApi('complaints_list', params),
  createComplaint: (data: any) => callApi('complaints_create', data),
  updateComplaintStatus: (id: string, status: string, response_notes?: string) =>
    callApi('complaints_update_status', { id, status, response_notes }),

  // Subscription Requests
  getSubscriptionRequests: (params?: any) => callApi('subscription_requests_list', params),
  createSubscriptionRequest: (data: any) => callApi('subscription_requests_create', data),
  updateSubscriptionRequestStatus: (id: string, status: string, response_notes?: string) =>
    callApi('subscription_requests_update_status', { id, status, response_notes }),

  // Registration Tokens & Register
  getRegistrationTokens: () => callApi('tokens_list'),
  createRegistrationToken: (data: any) => callApi('tokens_create', data),
  deleteRegistrationToken: (id: string) => callApi('tokens_delete', { id }),
  verifyRegistrationToken: (token: string, expectedType: string = 'registration') => callApi('tokens_verify', { token, expectedType }),
  registerWithToken: (data: any) => callApi('auth_register', data),
  forgotResetPassword: (data: { token: string; identifier: string; nik_last4?: string; rt_rw_answer?: string; new_password: string }) =>
    callApi('auth_forgot_reset', data),

  // Maintenance Expenses
  getMaintenanceExpenses: (params?: any) => callApi('maintenance_list', params),
  createMaintenanceExpense: (data: any) => callApi('maintenance_create', data),
  deleteMaintenanceExpense: (id: string) => callApi('maintenance_delete', { id }),

  // Reset demo
  resetMockData: () => mockApiService.resetToDefault(),

  // Active backend helpers
  getActiveBackend,
  setActiveBackend
};
