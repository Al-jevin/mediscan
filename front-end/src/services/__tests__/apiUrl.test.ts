/**
 * Test suite for API URL resolution and mobile host extraction.
 * Run with: npm --prefix front-end run test:api
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApiUrl,
  extractHostname,
  firstConfiguredApiUrl,
  isExpoTunnelHost,
  isLocalLanIpv4,
  normalizeApiUrl,
} from '../urlUtils.ts';

test('extractHostname correctly parses hostnames and IPs across Expo environments', () => {
  // Plain IP with port (standard hostUri)
  assert.equal(extractHostname('192.168.1.14:8081'), '192.168.1.14');

  // Scheme with IP and port (Expo Go experienceUrl / linkingUri)
  assert.equal(extractHostname('exp://192.168.1.14:8081'), '192.168.1.14');
  assert.equal(extractHostname('http://192.168.43.15:8000/api/v1'), '192.168.43.15');

  // Defense hotspot subnet (192.168.43.x)
  assert.equal(extractHostname('exp://192.168.43.100:8081/--/route'), '192.168.43.100');

  // Campus Wi-Fi 10.x.x.x or 172.x.x.x subnet
  assert.equal(extractHostname('exp://10.12.34.56:8081'), '10.12.34.56');

  // Localhost / loopback
  assert.equal(extractHostname('localhost:8081'), 'localhost');
  assert.equal(extractHostname('127.0.0.1:8081'), '127.0.0.1');

  // Edge cases and invalid values
  assert.equal(extractHostname(null), undefined);
  assert.equal(extractHostname(undefined), undefined);
  assert.equal(extractHostname(''), undefined);
  assert.equal(extractHostname('exp://'), undefined);
  assert.equal(extractHostname('exp'), undefined);
  assert.equal(extractHostname('http'), undefined);
});

test('extractHostname ignores query parameters and fragments', () => {
  assert.equal(extractHostname('exp://192.168.1.25:8081?release-channel=default'), '192.168.1.25');
  assert.equal(extractHostname('http://192.168.1.25:8081#fragment'), '192.168.1.25');
});

test('environment API URL takes precedence over USE_URL and ignores empty values', () => {
  assert.equal(
    firstConfiguredApiUrl('https://api.example.test/base', 'https://legacy.example.test'),
    'https://api.example.test/base',
  );
  assert.equal(firstConfiguredApiUrl('  ', 'https://legacy.example.test'), 'https://legacy.example.test');
  assert.equal(firstConfiguredApiUrl('', '  '), undefined);
});

test('Expo tunnel hostnames are detected without treating similar domains as tunnels', () => {
  assert.equal(isExpoTunnelHost('exp://mediscan.exp.direct:8081'), true);
  assert.equal(isExpoTunnelHost('https://mediscan.expo.app/path'), true);
  assert.equal(isExpoTunnelHost('https://mediscan.exp.direct.example.test'), false);
  assert.equal(isExpoTunnelHost('192.168.1.4:8081'), false);
});

test('dynamic API hosts are restricted to private LAN IPv4 addresses', () => {
  assert.equal(isLocalLanIpv4('10.2.3.4:8081'), true);
  assert.equal(isLocalLanIpv4('172.16.0.1'), true);
  assert.equal(isLocalLanIpv4('172.31.255.255'), true);
  assert.equal(isLocalLanIpv4('192.168.1.25'), true);
  assert.equal(isLocalLanIpv4('172.32.0.1'), false);
  assert.equal(isLocalLanIpv4('8.8.8.8'), false);
  assert.equal(isLocalLanIpv4('localhost:8081'), false);
  assert.equal(isLocalLanIpv4('256.1.1.1'), false);
});

test('normalizeApiUrl cleanly normalizes base URLs', () => {
  assert.equal(normalizeApiUrl('http://192.168.1.14:8000'), 'http://192.168.1.14:8000/api/v1');
  assert.equal(normalizeApiUrl('http://192.168.1.14:8000/api/v1'), 'http://192.168.1.14:8000/api/v1');
  assert.equal(normalizeApiUrl('http://192.168.1.14:8000/api/v1/'), 'http://192.168.1.14:8000/api/v1');
  assert.equal(normalizeApiUrl(undefined), undefined);
});

test('buildApiUrl creates correct endpoints', () => {
  assert.equal(buildApiUrl('192.168.43.100'), 'http://192.168.43.100:8000/api/v1');
  assert.equal(buildApiUrl('exp://192.168.43.100:8081'), 'http://192.168.43.100:8000/api/v1');
});
