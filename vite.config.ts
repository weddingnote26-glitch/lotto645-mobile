import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// 정적 사이트 그대로 배포된다 (서버·DB·API 없음).
// 빌드 산출물은 dist/ — Vercel/Netlify 기본 설정과 동일하다.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // 서비스워커 등록 코드를 자동 주입한다 (별도 import 불필요).
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "로또 6/45 분석기",
        short_name: "Lotto Analyzer",
        description: "과거 당첨번호 통계 분석과 번호 생성. 계산은 모두 휴대폰 안에서 이뤄집니다.",
        lang: "ko",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f6f7f9",
        theme_color: "#2563eb",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // 앱 셸 + 내장 데이터까지 전부 캐시 → 첫 로드 이후 오프라인 사용 가능.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
      },
    }),
  ],
  server: {
    // `npm run dev -- --host` 로 같은 Wi-Fi의 휴대폰에서 접속 가능.
    port: 5173,
  },
  build: {
    outDir: "dist",
    target: "es2020",
  },
});
