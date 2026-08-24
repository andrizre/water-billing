import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export interface NotificationCounts {
  pendingComplaints: number;
  pendingSubscriptionRequests: number;
  unpaidBills: number;
  overdueBills: number;
  unrecordedReadings: number;
  totalActionable: number;
}

export const notifyDataUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('app:data-updated'));
  }
};

/**
 * Custom hook to dynamically calculate and return actionable notification counts for sidebar badges
 */
export const useNotificationCounts = () => {
  const { user, role } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({
    pendingComplaints: 0,
    pendingSubscriptionRequests: 0,
    unpaidBills: 0,
    overdueBills: 0,
    unrecordedReadings: 0,
    totalActionable: 0
  });

  const fetchCounts = useCallback(async () => {
    if (!user || !role) return;

    try {
      if (role === 'admin') {
        const [complaints, subRequests, bills] = await Promise.all([
          api.getComplaints().catch(() => []),
          api.getSubscriptionRequests().catch(() => []),
          api.getBills().catch(() => [])
        ]);

        const pendingComplaints = Array.isArray(complaints)
          ? complaints.filter((c: any) => c.status === 'Menunggu').length
          : 0;

        const pendingSubscriptionRequests = Array.isArray(subRequests)
          ? subRequests.filter((r: any) => r.status === 'Menunggu').length
          : 0;

        const overdueBills = Array.isArray(bills)
          ? bills.filter((b: any) => b.status === 'Jatuh Tempo').length
          : 0;

        setCounts({
          pendingComplaints,
          pendingSubscriptionRequests,
          unpaidBills: 0,
          overdueBills,
          unrecordedReadings: 0,
          totalActionable: pendingComplaints + pendingSubscriptionRequests + overdueBills
        });
      } else if (role === 'operator') {
        const [complaints, subRequests, customers, readings] = await Promise.all([
          api.getComplaints().catch(() => []),
          api.getSubscriptionRequests().catch(() => []),
          api.getCustomers().catch(() => []),
          api.getReadings().catch(() => [])
        ]);

        const pendingComplaints = Array.isArray(complaints)
          ? complaints.filter((c: any) => c.status === 'Menunggu').length
          : 0;

        const pendingSubscriptionRequests = Array.isArray(subRequests)
          ? subRequests.filter((r: any) => r.status === 'Menunggu').length
          : 0;

        // Unrecorded readings for current month in assigned RT
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        let assignedCustomers = Array.isArray(customers) ? customers.filter((c: any) => c.status === 'Aktif') : [];
        if (user.assigned_rt) {
          const normAssigned = user.assigned_rt.toLowerCase().trim();
          assignedCustomers = assignedCustomers.filter((c: any) => {
            const normRt = (c.rt_rw || '').toLowerCase().trim();
            return normRt.includes(normAssigned) || normAssigned.includes(normRt);
          });
        }

        const currentReadings = Array.isArray(readings)
          ? readings.filter((r: any) => r.period_month === currentMonth && r.period_year === currentYear)
          : [];
        const recordedCustomerIds = new Set(currentReadings.map((r: any) => r.customer_id));
        const unrecordedCount = assignedCustomers.filter((c: any) => !recordedCustomerIds.has(c.id)).length;

        setCounts({
          pendingComplaints,
          pendingSubscriptionRequests,
          unpaidBills: 0,
          overdueBills: 0,
          unrecordedReadings: unrecordedCount,
          totalActionable: pendingComplaints + pendingSubscriptionRequests + unrecordedCount
        });
      } else if (role === 'customer') {
        const customerId = user.customerId;
        const [bills, complaints] = await Promise.all([
          api.getBills(customerId ? { customer_id: customerId } : undefined).catch(() => []),
          api.getComplaints(customerId ? { customer_id: customerId } : undefined).catch(() => [])
        ]);

        const myBills = Array.isArray(bills)
          ? (customerId ? bills.filter((b: any) => b.customer_id === customerId) : bills)
          : [];
        const unpaidBills = myBills.filter((b: any) => b.status === 'Belum Dibayar' || b.status === 'Jatuh Tempo').length;

        const myComplaints = Array.isArray(complaints)
          ? (customerId ? complaints.filter((c: any) => c.customer_id === customerId) : complaints)
          : [];
        const activeComplaints = myComplaints.filter((c: any) => c.status === 'Menunggu' || c.status === 'Diproses').length;

        setCounts({
          pendingComplaints: activeComplaints,
          pendingSubscriptionRequests: 0,
          unpaidBills,
          overdueBills: 0,
          unrecordedReadings: 0,
          totalActionable: unpaidBills + activeComplaints
        });
      }
    } catch {
      // ignore
    }
  }, [user, role]);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 12000);

    const handleFocus = () => fetchCounts();
    const handleDataUpdated = () => fetchCounts();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('app:data-updated', handleDataUpdated);
    window.addEventListener('storage', handleDataUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('app:data-updated', handleDataUpdated);
      window.removeEventListener('storage', handleDataUpdated);
    };
  }, [fetchCounts]);

  return { counts, refreshCounts: fetchCounts };
};
