import { defineConfig } from 'vite';

// base: './' —— 产物使用相对路径，可放在任意静态目录（含子路径）下打开。
// build target es2022 —— 对应本机 Node 26 / Chrome 155 的能力下限。
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    host: '127.0.0.1',
  },
});
