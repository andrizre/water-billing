/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAS_API_URL: string;
  readonly VITE_ENABLE_MOCK_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
declare module 'lucide-react';
