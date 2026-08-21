import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SystemSettings } from '../types';
import { api } from '../services/api';
import { initialSettings } from '../services/mockData';

interface SettingsContextType {
  settings: SystemSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(initialSettings);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      if (data) {
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.warn('Failed to load settings from API, using defaults:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    const updated = await api.updateSettings(newSettings);
    setSettings((prev) => ({ ...prev, ...updated }));
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
