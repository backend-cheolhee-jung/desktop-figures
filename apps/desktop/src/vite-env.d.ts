/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_SERVER_URL: string;
  readonly VITE_SOCKET_SERVER_URL: string;
  readonly VITE_VERTEX_AI_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
