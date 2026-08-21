import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole, AuthSession, Customer } from '../types';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { initialUsers, initialCustomers } from '../services/mockData';

interface AuthContextType {
  user: AuthSession['user'] | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (oldPass: string, newPass: string) => Promise<void>;
  switchRoleDemo: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthSession['user'] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize session on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = storage.getToken();
      const savedUser = storage.getUser();

      if (savedToken && savedUser) {
        setUser(savedUser);
      } else {
        // Default demo login as Admin for instant preview if desired, or null
        const defaultAdmin = initialUsers[0];
        setUser({
          id: defaultAdmin.id,
          username: defaultAdmin.username,
          fullName: defaultAdmin.full_name,
          role: defaultAdmin.role,
          email: defaultAdmin.email,
          phone: defaultAdmin.phone,
          customerId: ''
        });
        storage.setToken('demo_admin_token');
        storage.setUser({
          id: defaultAdmin.id,
          username: defaultAdmin.username,
          fullName: defaultAdmin.full_name,
          role: defaultAdmin.role,
          email: defaultAdmin.email,
          phone: defaultAdmin.phone,
          customerId: ''
        });
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.login(username, password);
      storage.setToken(res.token);
      storage.setUser(res.user);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    storage.removeToken();
    storage.removeUser();
    setUser(null);
  }, []);

  const changePassword = useCallback(async (oldPass: string, newPass: string) => {
    await api.changePassword(oldPass, newPass);
  }, []);

  // Quick Demo Role Switcher
  const switchRoleDemo = useCallback((targetRole: UserRole) => {
    let selectedUser: AuthSession['user'];

    if (targetRole === 'admin') {
      const admin = initialUsers.find((u) => u.role === 'admin') || initialUsers[0];
      selectedUser = {
        id: admin.id,
        username: admin.username,
        fullName: admin.full_name,
        role: 'admin',
        email: admin.email,
        phone: admin.phone
      };
    } else if (targetRole === 'operator') {
      const op = initialUsers.find((u) => u.role === 'operator') || initialUsers[1];
      selectedUser = {
        id: op.id,
        username: op.username,
        fullName: op.full_name,
        role: 'operator',
        email: op.email,
        phone: op.phone
      };
    } else {
      const custUser = initialUsers.find((u) => u.role === 'customer') || initialUsers[2];
      const customer = initialCustomers[0];
      selectedUser = {
        id: custUser.id,
        username: custUser.username,
        fullName: customer.full_name,
        role: 'customer',
        customerId: customer.id,
        customer: customer as Customer,
        phone: customer.phone
      };
    }

    storage.setToken(`demo_${targetRole}_token`);
    storage.setUser(selectedUser);
    setUser(selectedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user ? user.role : null,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        changePassword,
        switchRoleDemo
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
