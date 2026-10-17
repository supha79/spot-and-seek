import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MAX_GAMEPLAY_IMAGE_BYTES,
  decodeSignedGameplayAssetPair,
  getAdminGameplayAssetPreview,
  getPublishedGameplayAssetPreview,
  getPublishedGameplayAssetPreviewPair,
  getPublishedGameplayAssetPair,
  parsePublishedGameplayAssetPair,
  uploadAndRegisterGameplayAssetPair,
  validateGameplayImageMetadata,
  validateGameplayImagePair,
} from '../../src/services/levelAssets.ts';

const levelId = '11111111-1111-4111-8111-111111111111';
const uploadId = '22222222-2222-4222-8222-222222222222';
const originalId = '33333333-3333-4333-8333-333333333333';
const comparisonId = '44444444-4444-4444-8444-444444444444';
const ruleVersionId = '55555555-5555-4555-8555-555555555555';
const dimensions = { width: 640, height: 480 };

const publishedPair = {
  level_id: levelId,
  rule_version_id: ruleVersionId,
  original: {
    id: originalId,
    bucket_name: 'gameplay-assets',
    storage_path: `${levelId}/${uploadId}/original.png`,
    mime_type: 'image/png',
    ...dimensions,
    file_size_bytes: 5000,
  },
  comparison: {
    id: comparisonId,
    bucket_name: 'gameplay-assets',
    storage_path: `${levelId}/${uploadId}/comparison.webp`,
    mime_type: 'image/webp',
    ...dimensions,
    file_size_bytes: 7000,
  },
};

test('accepts supported image MIME types and enforces the 5 MB/dimension contract', () => {
  assert.deepEqual(validateGameplayImageMetadata({ type: 'image/png', size: MAX_GAMEPLAY_IMAGE_BYTES }, dimensions), dimensions);
  assert.deepEqual(validateGameplayImageMetadata({ type: 'image/jpeg', size: 1024 }, dimensions), dimensions);
  assert.deepEqual(validateGameplayImageMetadata({ type: 'image/webp', size: 1024 }, dimensions), dimensions);
  assert.throws(() => validateGameplayImageMetadata({ type: 'image/gif', size: 1024 }, dimensions), /PNG, JPEG, or WebP/);
  assert.throws(() => validateGameplayImageMetadata({ type: 'image/png', size: MAX_GAMEPLAY_IMAGE_BYTES + 1 }, dimensions), /5 MB/);
  assert.throws(() => validateGameplayImageMetadata({ type: 'image/png', size: 10 }, { width: 0, height: 10 }), /dimensions/);
  assert.throws(() => validateGameplayImagePair(dimensions, { width: 640, height: 479 }), /matching dimensions/);
});

test('parses the two role-specific assets pinned to a published rule version', () => {
  const pair = parsePublishedGameplayAssetPair(publishedPair, levelId);
  assert.equal(pair.original.id, originalId);
  assert.equal(pair.comparison.id, comparisonId);
  assert.equal(pair.rule_version_id, ruleVersionId);
});

test('parses .jpeg Original and Comparison assets with image/jpeg metadata', () => {
  const jpegPair = {
    ...publishedPair,
    original: {
      ...publishedPair.original,
      storage_path: `${levelId}/${uploadId}/original.jpeg`,
      mime_type: 'image/jpeg',
    },
    comparison: {
      ...publishedPair.comparison,
      storage_path: `${levelId}/${uploadId}/comparison.jpeg`,
      mime_type: 'image/jpeg',
    },
  };

  const parsed = parsePublishedGameplayAssetPair(jpegPair, levelId);
  assert.match(parsed.original.storage_path, /\/original\.jpeg$/);
  assert.match(parsed.comparison.storage_path, /\/comparison\.jpeg$/);

  const jpgPair = {
    ...jpegPair,
    original: { ...jpegPair.original, storage_path: `${levelId}/${uploadId}/original.jpg` },
    comparison: { ...jpegPair.comparison, storage_path: `${levelId}/${uploadId}/comparison.jpg` },
  };
  assert.doesNotThrow(() => parsePublishedGameplayAssetPair(jpgPair, levelId));
});

test('rejects MIME-extension mismatches and unsafe asset paths', () => {
  assert.throws(() => parsePublishedGameplayAssetPair({
    ...publishedPair,
    original: { ...publishedPair.original, storage_path: `${levelId}/${uploadId}/original.jpeg`, mime_type: 'image/png' },
  }, levelId), /unavailable/);
  assert.throws(() => parsePublishedGameplayAssetPair({
    ...publishedPair,
    comparison: { ...publishedPair.comparison, storage_path: `${levelId}/${uploadId}/comparison.webp`, mime_type: 'image/jpeg' },
  }, levelId), /unavailable/);
  assert.throws(() => parsePublishedGameplayAssetPair({
    ...publishedPair,
    original: { ...publishedPair.original, storage_path: `../${levelId}/${uploadId}/original.jpeg`, mime_type: 'image/jpeg' },
  }, levelId), /unavailable/);
  assert.throws(() => parsePublishedGameplayAssetPair({
    ...publishedPair,
    comparison: { ...publishedPair.comparison, storage_path: `https://assets.example/${levelId}/${uploadId}/comparison.jpeg`, mime_type: 'image/jpeg' },
  }, levelId), /unavailable/);
});

test('rejects missing, swapped, public-bucket, and oversized pinned assets', () => {
  assert.throws(() => parsePublishedGameplayAssetPair({ ...publishedPair, comparison: null }, levelId), /unavailable/);
  assert.throws(() => parsePublishedGameplayAssetPair({ ...publishedPair, comparison: { ...publishedPair.comparison, storage_path: `${levelId}/${uploadId}/original.webp` } }, levelId), /unavailable/);
  assert.throws(() => parsePublishedGameplayAssetPair({ ...publishedPair, original: { ...publishedPair.original, bucket_name: 'public-assets' } }, levelId), /unavailable/);
  assert.throws(() => parsePublishedGameplayAssetPair({ ...publishedPair, comparison: { ...publishedPair.comparison, file_size_bytes: MAX_GAMEPLAY_IMAGE_BYTES + 1 } }, levelId), /unavailable/);
});

test('decodes both signed images and rejects decode errors or dimension mismatches', async () => {
  const signedPair = {
    ...parsePublishedGameplayAssetPair(publishedPair, levelId),
    original: { ...publishedPair.original, signed_url: 'https://signed.example/original' },
    comparison: { ...publishedPair.comparison, signed_url: 'https://signed.example/comparison' },
  };
  const decoded = [];
  await decodeSignedGameplayAssetPair(signedPair, async (url) => {
    decoded.push(url);
    return dimensions;
  });
  assert.deepEqual(decoded, ['https://signed.example/original', 'https://signed.example/comparison']);
  let imageIndex = 0;
  await assert.rejects(decodeSignedGameplayAssetPair(signedPair, async () => {
    imageIndex += 1;
    return imageIndex === 1 ? dimensions : { width: 640, height: 479 };
  }), /dimensions/);
  await assert.rejects(decodeSignedGameplayAssetPair(signedPair, async () => { throw new Error('image decode failed'); }), /image decode failed/);
});

test('loads the rule-version-pinned private pair through the read RPC and signs both paths', async () => {
  const calls = [];
  const client = {
    async rpc(...args) {
      calls.push(args);
      return { data: publishedPair, error: null };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'gameplay-assets');
        return {
          async createSignedUrl(path, _expiresIn, options) {
            calls.push(['sign', path, options]);
            return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
          },
        };
      },
    },
  };
  const pair = await getPublishedGameplayAssetPair(client, levelId, async () => dimensions);

  assert.equal(pair.rule_version_id, ruleVersionId);
  assert.match(pair.original.signed_url, /original\.png$/);
  assert.match(pair.comparison.signed_url, /comparison\.webp$/);
  assert.deepEqual(calls[0], ['read_published_level_asset_pair', { p_level_id: levelId }]);
});

test('loads only the private Comparison image for a level preview', async () => {
  const calls = [];
  const client = {
    async rpc(...args) {
      calls.push(args);
      return { data: publishedPair, error: null };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'gameplay-assets');
        return {
          async createSignedUrl(path, _expiresIn, options) {
            calls.push(['sign', path, options]);
            return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
          },
        };
      },
    },
  };

  const preview = await getPublishedGameplayAssetPreview(client, levelId);

  assert.equal(preview.id, comparisonId);
  assert.match(preview.signed_url, /comparison\.webp$/);
  assert.deepEqual(calls, [
    ['read_published_level_asset_pair', { p_level_id: levelId }],
    ['sign', publishedPair.comparison.storage_path, { transform: { width: 320, height: 240, resize: 'cover', quality: 70 } }],
  ]);
});

test('loads an admin comparison thumbnail for draft-level previews without decoding full images', async () => {
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, 'level_assets');
      return {
        select() {
          return {
            eq() {
              return {
                in() {
                  return {
                    async eq() {
                      return {
                        data: [{
                          ...publishedPair.comparison,
                          level_id: levelId,
                          asset_type: 'comparison',
                          is_primary: true,
                        }],
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'gameplay-assets');
        return {
          async createSignedUrl(path, _expiresIn, options) {
            calls.push({ path, options });
            return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
          },
        };
      },
    },
  };

  const preview = await getAdminGameplayAssetPreview(client, levelId);

  assert.equal(preview.id, comparisonId);
  assert.deepEqual(calls, [{
    path: publishedPair.comparison.storage_path,
    options: { transform: { width: 320, height: 240, resize: 'cover', quality: 70 } },
  }]);
});

test('returns distinct cached Original and Comparison thumbnail URLs for a published level', async () => {
  const calls = [];
  const client = {
    async rpc(...args) {
      calls.push(['rpc', ...args]);
      return { data: publishedPair, error: null };
    },
    storage: {
      from() {
        return {
          async createSignedUrl(path, _expiresIn, options) {
            calls.push(['sign', path, options]);
            return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
          },
        };
      },
    },
  };

  const [firstPair, secondPair] = await Promise.all([
    getPublishedGameplayAssetPreviewPair(client, levelId),
    getPublishedGameplayAssetPreviewPair(client, levelId),
  ]);

  assert.equal(firstPair, secondPair);
  assert.notEqual(firstPair.original.signed_url, firstPair.comparison.signed_url);
  assert.match(firstPair.original.signed_url, /original\.png$/);
  assert.match(firstPair.comparison.signed_url, /comparison\.webp$/);
  assert.equal(calls.filter(([type]) => type === 'rpc').length, 1);
  assert.equal(calls.filter(([type]) => type === 'sign').length, 2);
});

test('reuses in-flight and cached previews per level and resolution', async () => {
  const calls = [];
  const client = {
    async rpc(...args) {
      calls.push(['rpc', ...args]);
      return { data: publishedPair, error: null };
    },
    storage: {
      from() {
        return {
          async createSignedUrl(path, _expiresIn, options) {
            calls.push(['sign', path, options]);
            return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
          },
        };
      },
    },
  };

  const [first, second] = await Promise.all([
    getPublishedGameplayAssetPreview(client, levelId),
    getPublishedGameplayAssetPreview(client, levelId),
  ]);
  assert.equal(first, second);
  assert.equal(calls.filter(([type]) => type === 'rpc').length, 1);
  assert.equal(calls.filter(([type]) => type === 'sign').length, 1);

  await getPublishedGameplayAssetPreview(client, levelId, 'full');
  assert.equal(calls.filter(([type]) => type === 'rpc').length, 2);
  assert.equal(calls.filter(([type]) => type === 'sign').length, 2);
});

test('uses the original Comparison dimensions for a full-resolution preview', async () => {
  let signedOptions;
  const client = {
    async rpc() {
      return { data: publishedPair, error: null };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'gameplay-assets');
        return {
          async createSignedUrl(_path, _expiresIn, options) {
            signedOptions = options;
            return { data: { signedUrl: 'https://signed.example/full-resolution.png' }, error: null };
          },
        };
      },
    },
  };

  const preview = await getPublishedGameplayAssetPreview(client, levelId, 'full');

  assert.equal(preview.width, dimensions.width);
  assert.equal(preview.height, dimensions.height);
  assert.equal(signedOptions, undefined);
});

test('migration pins both asset identities into the immutable published content hash and validates publication', () => {
  const migration = readFileSync(new URL('../../supabase/migrations/20261011110000_private_gameplay_asset_pairs.sql', import.meta.url), 'utf8');
  assert.match(migration, /asset_type IN \('original', 'comparison', 'thumbnail'\)/);
  assert.match(migration, /game_run_rule_versions_asset_pair_shape/);
  assert.match(migration, /original_asset_id, comparison_asset_id/);
  assert.match(migration, /'snapshot_schema_version', 2/);
  assert.match(migration, /'assets',[\s\S]*?'original',[\s\S]*?'comparison'/);
  assert.match(migration, /A valid private Original and Comparison image pair is required to publish/);
  assert.match(migration, /bucket\.public IS FALSE/);
  assert.match(migration, /file_size_bytes > 5242880/);
});

test('upload failure never calls the atomic metadata registration RPC', async () => {
  const previousCreateImageBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => ({ ...dimensions, close() {} });
  const uploads = [];
  const rpcCalls = [];
  const client = {
    storage: {
      from(bucket) {
        assert.equal(bucket, 'gameplay-assets');
        return {
          async upload(path, file, options) {
            uploads.push({ path, file, options });
            return uploads.length === 2 ? { data: null, error: { message: 'storage policy denied' } } : { data: {}, error: null };
          },
        };
      },
    },
    async rpc(...args) {
      rpcCalls.push(args);
      return { data: null, error: null };
    },
  };

  try {
    await assert.rejects(
      uploadAndRegisterGameplayAssetPair(
        client,
        levelId,
        { type: 'image/png', size: 1024, name: 'original.png' },
        { type: 'image/webp', size: 2048, name: 'comparison.webp' },
      ),
      /Comparison image upload failed/,
    );
    assert.equal(uploads.length, 2);
    assert.equal(rpcCalls.length, 0);
    assert.ok(uploads.every(({ options }) => options.upsert === false));
  } finally {
    if (previousCreateImageBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = previousCreateImageBitmap;
  }
});

test('successful pair upload registers metadata only after both private objects upload', async () => {
  const previousCreateImageBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => ({ ...dimensions, close() {} });
  const order = [];
  const rpcCalls = [];
  const client = {
    storage: {
      from(bucket) {
        assert.equal(bucket, 'gameplay-assets');
        return { async upload(path, _file, options) { order.push(path); return { data: {}, error: null }; } };
      },
    },
    async rpc(name, args) {
      order.push('register');
      rpcCalls.push({ name, args });
      return {
        data: { level_id: levelId, original_asset_id: originalId, comparison_asset_id: comparisonId },
        error: null,
      };
    },
  };

  try {
    const result = await uploadAndRegisterGameplayAssetPair(
      client,
      levelId,
      { type: 'image/png', size: 1024, name: 'original.png' },
      { type: 'image/jpeg', size: 2048, name: 'comparison.jpg' },
    );
    assert.equal(result.original_asset_id, originalId);
    assert.equal(result.comparison_asset_id, comparisonId);
    assert.equal(order.at(-1), 'register');
    assert.equal(rpcCalls[0].name, 'register_level_asset_pair');
    assert.equal(rpcCalls[0].args.p_original_asset.width, dimensions.width);
    assert.equal(rpcCalls[0].args.p_comparison_asset.height, dimensions.height);
  } finally {
    if (previousCreateImageBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = previousCreateImageBitmap;
  }
});