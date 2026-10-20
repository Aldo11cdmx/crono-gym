/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_EXERCISES_DATA_URL?: string;
  /** Where the local exercise catalog is fetched from. Defaults to the bundled asset. */
  readonly VITE_EXERCISES_CATALOG_URL?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  /** Injected by `vite.config.ts` from `package.json`. */
  readonly PACKAGE_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}