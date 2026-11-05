import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';

/**
 * Terminates TLS in front of the production build, for CI only.
 *
 * A production build mints its cookies `Secure`, and WebKit on Linux does not keep them
 * over plain http://localhost the way Chromium and Firefox do. Relaxing the attribute
 * would test something other than what ships, so the suite gets real HTTPS instead.
 *
 * Usage: node scripts/https-proxy.mjs <key.pem> <cert.pem>
 */
const LISTEN_PORT = 3443;
const TARGET_PORT = 3000;

const [keyPath, certPath] = process.argv.slice(2);
if (!keyPath || !certPath) {
  console.error('Usage: node scripts/https-proxy.mjs <key.pem> <cert.pem>');
  process.exit(2);
}

const options = { key: readFileSync(keyPath), cert: readFileSync(certPath) };

https
  .createServer(options, (request, response) => {
    const upstream = http.request(
      {
        host: 'localhost',
        port: TARGET_PORT,
        method: request.method,
        path: request.url,
        headers: { ...request.headers, 'x-forwarded-proto': 'https' },
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      },
    );

    upstream.on('error', () => {
      // Answers 502 until the application is up, which keeps Playwright's readiness
      // check waiting rather than treating the proxy as the finished server.
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });

    request.pipe(upstream);
  })
  .listen(LISTEN_PORT);
