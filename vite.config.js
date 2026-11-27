import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import {VitePWA} from 'vite-plugin-pwa';
const h={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'};
export default defineConfig({
  plugins:[react(),VitePWA({
    registerType:'autoUpdate',
    manifest:{name:'Board Games: Cờ tướng, Cờ úp, Cờ caro',short_name:'Board Games',description:'Xiangqi, hidden-piece xiangqi (cờ úp) and caro/gomoku against an engine or a friend. Works offline.',
      start_url:'/',scope:'/',display:'standalone',background_color:'#1d1a16',theme_color:'#1d1a16',
      icons:[{src:'pwa-192.png',sizes:'192x192',type:'image/png'},{src:'pwa-512.png',sizes:'512x512',type:'image/png'},{src:'pwa-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},
    workbox:{globPatterns:['**/*.{js,css,html,png,svg,webmanifest}'],navigateFallback:'/index.html',navigateFallbackDenylist:[/^\/api\//],cleanupOutdatedCaches:true}
  })],
  worker:{format:'es'},server:{headers:h},preview:{headers:h}});
