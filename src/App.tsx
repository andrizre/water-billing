import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoadingSpinner } from './components/common/LoadingSpinner';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { PublicBillCheckPage } from './pages/public/PublicBillCheckPage';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CustomerManagement } from './pages/admin/CustomerManagement';
import { MeterManagement } from './pages/admin/MeterManagement';
import { TariffManagement } from './pages/admin/TariffManagement';
import { BillManagement } from './pages/admin/BillManagement';
import { PaymentManagement } from './pages/admin/PaymentManagement';
import { OperatorManagement } from './pages/admin/OperatorManagement';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { AnnouncementsPage } from './pages/admin/AnnouncementsPage';
import { ComplaintsManagementPage } from './pages/admin/ComplaintsManagementPage';
import { SubscriptionRequestsPage } from './pages/admin/SubscriptionRequestsPage';

// Operator Pages
import { OperatorDashboard } from './pages/operator/OperatorDashboard';
import { RecordReadingPage } from './pages/operator/RecordReadingPage';
import { BillGeneratePage } from './pages/operator/BillGeneratePage';
import { PaymentEntryPage } from './pages/operator/PaymentEntryPage';
import { CustomerList } from './pages/operator/CustomerList';
import { OperatorReportsPage } from './pages/operator/OperatorReportsPage';

// Customer Pages
import { CustomerDashboard } from './pages/customer/CustomerDashboard';
import { CustomerUsagePage } from './pages/customer/CustomerUsagePage';
import { CustomerBillsPage } from './pages/customer/CustomerBillsPage';
import { CustomerPaymentHistoryPage } from './pages/customer/CustomerPaymentHistoryPage';
import { CustomerProfilePage } from './pages/customer/CustomerProfilePage';
import { CustomerComplaintsPage } from './pages/customer/CustomerComplaintsPage';
import { CustomerSubscriptionRequestPage } from './pages/customer/CustomerSubscriptionRequestPage';

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
    // If user has role but tried to access an unallowed route, redirect to their home
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
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
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
    </BrowserRouter>
  );
};
