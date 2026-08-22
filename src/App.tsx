import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoadingSpinner } from './components/common/LoadingSpinner';

// Lazy Loaded Public Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const PublicBillCheckPage = lazy(() => import('./pages/public/PublicBillCheckPage').then(m => ({ default: m.PublicBillCheckPage })));

// Lazy Loaded Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const CustomerManagement = lazy(() => import('./pages/admin/CustomerManagement').then(m => ({ default: m.CustomerManagement })));
const MeterManagement = lazy(() => import('./pages/admin/MeterManagement').then(m => ({ default: m.MeterManagement })));
const TariffManagement = lazy(() => import('./pages/admin/TariffManagement').then(m => ({ default: m.TariffManagement })));
const BillManagement = lazy(() => import('./pages/admin/BillManagement').then(m => ({ default: m.BillManagement })));
const PaymentManagement = lazy(() => import('./pages/admin/PaymentManagement').then(m => ({ default: m.PaymentManagement })));
const OperatorManagement = lazy(() => import('./pages/admin/OperatorManagement').then(m => ({ default: m.OperatorManagement })));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const AnnouncementsPage = lazy(() => import('./pages/admin/AnnouncementsPage').then(m => ({ default: m.AnnouncementsPage })));
const ComplaintsManagementPage = lazy(() => import('./pages/admin/ComplaintsManagementPage').then(m => ({ default: m.ComplaintsManagementPage })));
const SubscriptionRequestsPage = lazy(() => import('./pages/admin/SubscriptionRequestsPage').then(m => ({ default: m.SubscriptionRequestsPage })));
const TokensManagementPage = lazy(() => import('./pages/admin/TokensManagementPage').then(m => ({ default: m.TokensManagementPage })));

// Lazy Loaded Operator Pages
const OperatorDashboard = lazy(() => import('./pages/operator/OperatorDashboard').then(m => ({ default: m.OperatorDashboard })));
const RecordReadingPage = lazy(() => import('./pages/operator/RecordReadingPage').then(m => ({ default: m.RecordReadingPage })));
const BillGeneratePage = lazy(() => import('./pages/operator/BillGeneratePage').then(m => ({ default: m.BillGeneratePage })));
const PaymentEntryPage = lazy(() => import('./pages/operator/PaymentEntryPage').then(m => ({ default: m.PaymentEntryPage })));
const CustomerList = lazy(() => import('./pages/operator/CustomerList').then(m => ({ default: m.CustomerList })));
const OperatorReportsPage = lazy(() => import('./pages/operator/OperatorReportsPage').then(m => ({ default: m.OperatorReportsPage })));

// Lazy Loaded Customer Pages
const CustomerDashboard = lazy(() => import('./pages/customer/CustomerDashboard').then(m => ({ default: m.CustomerDashboard })));
const CustomerUsagePage = lazy(() => import('./pages/customer/CustomerUsagePage').then(m => ({ default: m.CustomerUsagePage })));
const CustomerBillsPage = lazy(() => import('./pages/customer/CustomerBillsPage').then(m => ({ default: m.CustomerBillsPage })));
const CustomerPaymentHistoryPage = lazy(() => import('./pages/customer/CustomerPaymentHistoryPage').then(m => ({ default: m.CustomerPaymentHistoryPage })));
const CustomerProfilePage = lazy(() => import('./pages/customer/CustomerProfilePage').then(m => ({ default: m.CustomerProfilePage })));
const CustomerComplaintsPage = lazy(() => import('./pages/customer/CustomerComplaintsPage').then(m => ({ default: m.CustomerComplaintsPage })));
const CustomerSubscriptionRequestPage = lazy(() => import('./pages/customer/CustomerSubscriptionRequestPage').then(m => ({ default: m.CustomerSubscriptionRequestPage })));

// Protected Route Guard
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'operator' | 'customer')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Memeriksa otorisasi sesi..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const redirectPath =
      role === 'customer'
        ? '/customer/dashboard'
        : role === 'operator'
        ? '/operator/dashboard'
        : '/admin/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

// Root Redirector based on Role
const HomeRedirect: React.FC = () => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'customer') return <Navigate to="/customer/dashboard" replace />;
  if (role === 'operator') return <Navigate to="/operator/dashboard" replace />;
  return <Navigate to="/admin/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingSpinner text="Memuat halaman..." />
          </div>
        }
      >
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/cek-tagihan" element={<PublicBillCheckPage />} />

          {/* Protected App Routes inside MainLayout */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Default Root */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/announcements"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AnnouncementsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operator']}>
                  <ComplaintsManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/subscription-requests"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operator']}>
                  <SubscriptionRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tokens"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <TokensManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/customers"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CustomerManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/meters"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <MeterManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tariffs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <TariffManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/bills"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <BillManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/payments"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PaymentManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <OperatorManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />

            {/* Operator Routes */}
            <Route
              path="/operator/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operator']}>
                  <OperatorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator/readings"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operator']}>
                  <RecordReadingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator/bills"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operator']}>
                  <BillGeneratePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator/payments"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operator']}>
                  <PaymentEntryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator/customers"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operator']}>
                  <CustomerList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator/complaints"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operator']}>
                  <ComplaintsManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator/subscription-requests"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operator']}>
                  <SubscriptionRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator/reports"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operator']}>
                  <OperatorReportsPage />
                </ProtectedRoute>
              }
            />

            {/* Customer Routes */}
            <Route
              path="/customer/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin', 'customer']}>
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/usage"
              element={
                <ProtectedRoute allowedRoles={['admin', 'customer']}>
                  <CustomerUsagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/bills"
              element={
                <ProtectedRoute allowedRoles={['admin', 'customer']}>
                  <CustomerBillsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/payments"
              element={
                <ProtectedRoute allowedRoles={['admin', 'customer']}>
                  <CustomerPaymentHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/complaints"
              element={
                <ProtectedRoute allowedRoles={['admin', 'customer']}>
                  <CustomerComplaintsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/subscription-request"
              element={
                <ProtectedRoute allowedRoles={['admin', 'customer']}>
                  <CustomerSubscriptionRequestPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/profile"
              element={
                <ProtectedRoute allowedRoles={['admin', 'customer']}>
                  <CustomerProfilePage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all 404 */}
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
