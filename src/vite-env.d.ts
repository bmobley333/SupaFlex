/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
declare const __VERCEL_BUILD__: string;
declare const __GIT_COMMIT__: string;
declare const __BUILD_TIMESTAMP__: string;
