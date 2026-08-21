/**
 * Safe LocalStorage Wrapper for persistent state, tokens, and offline demo cache.
 */

const TOKEN_KEY = 'sandmosquito_auth_token';
const USER_KEY = 'sandmosquito_auth_user';
const MOCK_DB_KEY = 'sandmosquito_mock_database_v1';
const SETTINGS_KEY = 'sandmosquito_app_settings';

export const storage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      console.error('Failed to save token:', e);
    }
  },

  removeToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.error('Failed to remove token:', e);
    }
  },

  getUser(): any | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user: any): void {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save user:', e);
    }
  },

  removeUser(): void {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.error('Failed to remove user:', e);
    }
  },

  getMockDb(): any | null {
    try {
      const raw = localStorage.getItem(MOCK_DB_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setMockDb(data: any): void {
    try {
      localStorage.setItem(MOCK_DB_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save mock db:', e);
    }
  },

  getSettings(): any | null {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setSettings(settings: any): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },

  clearAll(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
  }
};
