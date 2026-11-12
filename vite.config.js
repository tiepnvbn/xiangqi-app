import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const h={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'};
export default defineConfig({plugins:[react()],worker:{format:'es'},server:{headers:h},preview:{headers:h}});
