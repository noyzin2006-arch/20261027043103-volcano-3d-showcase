#!/usr/bin/env node
/**
 * serve-dist —— dist/ 的极简静态服务器
 *
 * 约束：
 *   · 只绑定 127.0.0.1，绝不监听 0.0.0.0；
 *   · 默认端口 4173，可用 --port <n> 或 PORT 环境变量覆盖；
 *   · 路径穿越防护：解析后的绝对路径必须仍在 dist/ 内；
 *   · 同时提供 startServer({root, port}) 供 scripts/smoke-cdp.mjs 进程内调用，
 *     被 import 时不会自动启动服务。
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_ROOT = join(REPO_ROOT, 'dist');
const DEFAULT_PORT = 4173;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
};

const contentTypeOf = (file) => MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';

/**
 * 启动静态服务器。
 * @param {{root?: string, port?: number, host?: string, quiet?: boolean}} options
 * @returns {Promise<{url: string, port: number, root: string, close: () => Promise<void>}>}
 */
export async function startServer({ root = DEFAULT_ROOT, port = DEFAULT_PORT, host = HOST, quiet = false } = {}) {
  const absRoot = resolve(root);
  if (!existsSync(absRoot) || !statSync(absRoot).isDirectory()) {
    throw new Error(`目录不存在：${absRoot}（先运行 npm run build）`);
  }

  const server = createServer((req, res) => {
    const send = (status, body, headers = {}) => {
      res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        ...headers,
      });
      res.end(body);
      if (!quiet) console.log(`[serve] ${req.method} ${req.url} -> ${status}`);
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(405, '仅支持 GET / HEAD\n');
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
    } catch {
      send(400, '无法解析的请求路径\n');
      return;
    }
    if (pathname.includes('\0')) {
      send(400, '非法路径\n');
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';

    // 路径穿越防护：解析后必须仍在 absRoot 之内
    const filePath = resolve(absRoot, `.${pathname.startsWith('/') ? pathname : `/${pathname}`}`);
    if (filePath !== absRoot && !filePath.startsWith(absRoot + sep)) {
      send(403, '禁止访问该路径\n');
      return;
    }

    let target = filePath;
    if (!existsSync(target)) {
      send(404, `未找到：${pathname}\n`);
      return;
    }
    if (statSync(target).isDirectory()) {
      target = join(target, 'index.html');
      if (!existsSync(target)) {
        send(404, `未找到：${pathname}\n`);
        return;
      }
    }

    const stat = statSync(target);
    res.writeHead(200, {
      'Content-Type': contentTypeOf(target),
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
    });
    if (!quiet) console.log(`[serve] ${req.method} ${pathname} -> 200`);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(target).pipe(res);
  });

  await new Promise((resolvePromise, rejectPromise) => {
    const onError = (err) => rejectPromise(err);
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolvePromise();
    });
  });

  const actualPort = server.address().port;
  return {
    url: `http://${host}:${actualPort}/`,
    port: actualPort,
    root: absRoot,
    close: () => new Promise((done) => {
      server.close(() => done());
      server.closeAllConnections?.();
    }),
  };
}

function usage() {
  console.log(`用法：node scripts/serve-dist.mjs [选项]

选项：
  --port <n>    监听端口（默认 ${DEFAULT_PORT}；也可用 PORT 环境变量）
  --root <目录> 站点根目录（默认：仓库根目录下的 dist/）
  -h, --help    显示本帮助并退出

说明：
  · 只绑定 ${HOST}，不会对外网开放；
  · 目录缺失时会报错退出（先运行 npm run build）。`);
}

function parseArgs(argv) {
  const out = { port: Number(process.env.PORT) || DEFAULT_PORT, root: DEFAULT_ROOT, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--port') out.port = Number(argv[++i]);
    else if (a.startsWith('--port=')) out.port = Number(a.slice(7));
    else if (a === '--root') out.root = resolve(argv[++i] ?? DEFAULT_ROOT);
    else if (a.startsWith('--root=')) out.root = resolve(a.slice(7));
  }
  if (!Number.isInteger(out.port) || out.port < 0 || out.port > 65535) {
    throw new Error(`端口无效：${out.port}`);
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }

  if (options.help) {
    usage();
    process.exit(0);
  }

  if (!existsSync(options.root) || !statSync(options.root).isDirectory()) {
    console.error(`✗ 未找到静态目录：${options.root}`);
    console.error('  先运行 npm run build');
    process.exit(1);
  }

  try {
    const server = await startServer({ root: options.root, port: options.port });
    console.log(`静态服务器已启动：${server.url}`);
    console.log(`根目录：${server.root}`);
    console.log('仅监听 127.0.0.1，按 Ctrl+C 结束。');
    const shutdown = () => {
      console.log('\n[serve] 正在关闭…');
      server.close().then(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error(`✗ 启动失败：${err.message}`);
    process.exit(1);
  }
}
