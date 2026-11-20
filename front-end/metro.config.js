const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 8000;

/**
 * Proxy /api/* through Metro (8081) to FastAPI (8000).
 * Phones can already reach Metro on Public Wi‑Fi; Windows often blocks
 * inbound python.exe on Public networks even when a port-8000 allow rule exists.
 */
function proxyToBackend(req, res) {
  const headers = { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` };

  const proxyReq = http.request(
    {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (error) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        detail: `MediScan Metro proxy could not reach backend at http://${BACKEND_HOST}:${BACKEND_PORT} (${error.message}).`,
      }),
    );
  });

  req.pipe(proxyReq);
}

const config = getDefaultConfig(__dirname);

const previousEnhance = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = previousEnhance ? previousEnhance(middleware, server) : middleware;
    return (req, res, next) => {
      if (typeof req.url === 'string' && req.url.startsWith('/api/')) {
        return proxyToBackend(req, res);
      }
      return base(req, res, next);
    };
  },
};

module.exports = config;
