/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_CLIENT_ID: string
  readonly VITE_APP_LINK_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
