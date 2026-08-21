import React, { useState, useEffect } from 'react';
import { Megaphone, AlertTriangle, X, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { Announcement } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const AnnouncementBanner: React.FC = () => {
  const { role } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await api.getAnnouncements({
          target_audience: role || 'all',
          active_only: true
        });
        setAnnouncements(res || []);
      } catch (err) {
        console.warn('Failed to load announcements banner:', err);
      }
    };
    fetchAnnouncements();
  }, [role]);

  const visibleAnnouncements = announcements.filter((a) => !closedIds.has(a.id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      {visibleAnnouncements.slice(0, 2).map((a) => {
        const isUrgent = a.priority === 'urgent';
        return (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isUrgent ? 'var(--danger-50)' : 'var(--primary-50)',
              border: `1px solid ${isUrgent ? 'rgba(239, 68, 68, 0.3)' : 'var(--primary-200)'}`,
              color: isUrgent ? 'var(--danger-800)' : 'var(--primary-900)',
              boxShadow: 'var(--shadow-sm)',
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
              <div style={{ marginTop: 2, color: isUrgent ? 'var(--danger-600)' : 'var(--primary-600)' }}>
                {isUrgent ? <AlertTriangle size={18} /> : <Megaphone size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isUrgent && (
                    <span style={{ fontSize: 10, backgroundColor: 'var(--danger-600)', color: '#fff', padding: '1px 6px', borderRadius: 3 }}>
                      PENTING
                    </span>
                  )}
                  {a.title}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--slate-700)', marginTop: 2, lineHeight: 1.4 }}>
                  {a.content}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setClosedIds((prev) => new Set([...prev, a.id]))}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--slate-400)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Tutup pengumuman ini"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
