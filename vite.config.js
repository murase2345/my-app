import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite設定（SPA + Vercel対応）
 * baseはルート固定（サブパスデプロイ時は変更）
 */
export default defineConfig({
  base: "/",
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: false },
});


