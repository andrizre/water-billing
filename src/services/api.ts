import { storage } from './storage';
import { mockApiService } from './mockApiService';

const GAS_API_URL = import.meta.env.VITE_GAS_API_URL || '';
const SQLITE_API_URL = import.meta.env.VITE_SQLITE_API_URL || 'http://localhost:3001';
const FORCE_MOCK = import.meta.env.VITE_ENABLE_MOCK_MODE === 'true';

let isSqliteAvailable: boolean | null = null;

/**
 * Check if the local SQLite API server is running
 */
async function checkSqliteServer(): Promise<boolean> {
  if (isSqliteAvailable !== null) return isSqliteAvailable;
  try {
    const res = await fetch(`${SQLITE_API_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(1200) // fast timeout
    });
    isSqliteAvailable = res.ok;
  } catch {
    isSqliteAvailable = false;
  }
  return isSqliteAvailable;
}

/**
 * Universal GAS / SQLite / Mock API Requester
 */
async function callApi<T = any>(action: string, data: any = {}): Promise<T> {
  // If Force Mock mode is explicitly true, use Mock immediately
  if (FORCE_MOCK) {
    return handleMockCall<T>(action, data);
  }

  // 1. Check Google Apps Script Web App
  if (GAS_API_URL && GAS_API_URL.trim() !== '') {
    const token = storage.getToken() || '';
    const payload = { action, token, data };

    try {
      const response = await fetch(GAS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success || result.status === 200 || result.status === 201) {
          return (result.data || result) as T;
        }
        throw new Error(result.message || result.error || 'Permintaan gagal diproses.');
      }
    } catch (error: any) {
      console.warn(`GAS API call failed for action "${action}", falling back...`, error.message);
    }
  }

  // 2. Check Local SQLite Server
  const hasSqlite = await checkSqliteServer();
  if (hasSqlite) {
    try {
      const token = storage.getToken() || '';
      const response = await fetch(SQLITE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ action: normalizeActionForServer(action), ...data })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success !== false) {
          return unwrapServerResponse(action, result) as T;
        }
        throw new Error(result.error || 'Permintaan gagal pada server SQLite.');
      }
    } catch (err: any) {
      console.warn(`SQLite server call failed for "${action}", falling back to mock:`, err.message);
      isSqliteAvailable = false; // Disable until reload
    }
  }

  // 3. Fallback to In-Browser Simulated Storage
  return handleMockCall<T>(action, data);
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
    'audit_list': 'getAuditLogs'
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
      return (await mockApiService.resetUserPassword(data.id)) as T;

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
      return (await mockApiService.getAuditLogs()) as T;

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

  // Reset demo
  resetMockData: () => mockApiService.resetToDefault()
};
