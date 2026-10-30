import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePanoramaxItem,
  findStreetImageryNear,
  PANORAMAX_ATTRIBUTION,
} from './client.js';

test('normalizePanoramaxItem: correctly detects 360° equirectangular panorama', () => {
  const item = {
    id: 'pano-12345',
    geometry: {
      type: 'Point',
      coordinates: [77.6066, 12.9756],
    },
    properties: {
      datetime: '2024-08-15T10:30:00Z',
      'pers:projection_type': 'equirectangular',
      'view:azimuth': 184.2,
      'camera:make': 'GoPro',
      'camera:model': 'MAX',
    },
    assets: {
      thumb: { href: 'https://panoramax.xyz/api/pictures/pano-12345/thumb.jpg' },
      hd: { href: 'https://panoramax.xyz/api/pictures/pano-12345/hd.jpg' },
    },
  };

  const normalized = normalizePanoramaxItem(item);
  assert.ok(normalized);
  assert.equal(normalized.id, 'pano-12345');
  assert.equal(normalized.is360Panorama, true);
  assert.equal(normalized.headingDeg, 184);
  assert.equal(normalized.captureDate, '2024-08-15T10:30:00Z');
  assert.equal(normalized.cameraModel, 'GoPro MAX');
  assert.equal(normalized.attribution, PANORAMAX_ATTRIBUTION);
  assert.equal(normalized.thumbUrl, 'https://panoramax.xyz/api/pictures/pano-12345/thumb.jpg');
});

test('normalizePanoramaxItem: correctly classifies flat street photos and missing fields', () => {
  const item = {
    id: 'flat-67890',
    geometry: {
      type: 'Point',
      coordinates: [-0.1281, 51.508],
    },
    properties: {
      date: '2023-05-01',
      field_of_view: 78,
    },
    assets: {
      sd: { href: 'https://panoramax.xyz/api/pictures/flat-67890/sd.jpg' },
    },
  };

  const normalized = normalizePanoramaxItem(item);
  assert.ok(normalized);
  assert.equal(normalized.id, 'flat-67890');
  assert.equal(normalized.is360Panorama, false);
  assert.equal(normalized.headingDeg, null);
  assert.equal(normalized.thumbUrl, 'https://panoramax.xyz/api/pictures/flat-67890/sd.jpg');
});

test('normalizePanoramaxItem: drops invalid items without crashing', () => {
  assert.equal(normalizePanoramaxItem(null), null);
  assert.equal(normalizePanoramaxItem({}), null);
  assert.equal(normalizePanoramaxItem({ id: 'abc', geometry: null }), null);
  assert.equal(normalizePanoramaxItem({ id: 'abc', geometry: { coordinates: ['invalid', 'coords'] } }), null);
});

test('findStreetImageryNear: handles empty results cleanly as NO_IMAGERY_FOUND without fabricating pictures', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ features: [] }), { status: 200 });

  const result = await findStreetImageryNear(12.9756, 77.6066, { fetchImpl: fakeFetch });
  assert.equal(result.ok, true);
  assert.equal(result.hasImagery, false);
  assert.equal(result.status, 'NO_IMAGERY_FOUND');
  assert.equal(result.images.length, 0);
  assert.match(result.message, /No street-level imagery currently available/);
});

test('findStreetImageryNear: rejects invalid or out-of-range coordinates without querying', async () => {
  const result1 = await findStreetImageryNear(NaN, 77.6066);
  assert.equal(result1.ok, false);
  assert.equal(result1.status, 'ERROR');

  const result2 = await findStreetImageryNear(95.0, 77.6066);
  assert.equal(result2.ok, false);
  assert.equal(result2.status, 'ERROR');
});

test('findStreetImageryNear: handles network error gracefully', async () => {
  const failingFetch = async () => {
    throw new Error('Connection refused');
  };

  const result = await findStreetImageryNear(12.9756, 77.6066, { fetchImpl: failingFetch });
  assert.equal(result.ok, false);
  assert.equal(result.hasImagery, false);
  assert.equal(result.status, 'ERROR');
  assert.match(result.message, /could not be reached|connection/i);
});
