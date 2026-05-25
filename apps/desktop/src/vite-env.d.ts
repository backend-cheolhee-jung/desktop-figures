/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_SERVER_URL: string;
  readonly VITE_SOCKET_SERVER_URL: string;
  readonly VITE_VERTEX_AI_TOKEN: string;
  readonly VITE_VERTEX_PROJECT_ID: string;
  readonly VITE_VERTEX_LOCATION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
