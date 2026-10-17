export const GAMEPLAY_ASSET_BUCKET = 'gameplay-assets';
export const MAX_GAMEPLAY_IMAGE_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_SECONDS = 3600;
const PREVIEW_URL_CACHE_MILLISECONDS = (SIGNED_URL_SECONDS - 300) * 1000;
const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
const extensionByMimeType: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const assetPathPattern = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(original|comparison)\.(png|jpg|jpeg|webp)$/i;

export type GameplayImageRole = 'original' | 'comparison';
export type ImageDimensions = { width: number; height: number };

export type GameplayAssetReference = {
  id: string;
  bucket_name: typeof GAMEPLAY_ASSET_BUCKET;
  storage_path: string;
  mime_type: string;
  width: number;
  height: number;
  file_size_bytes: number;
};

export type SignedGameplayAsset = GameplayAssetReference & { signed_url: string };
type GameplayPreviewTransform = { width: number; height: number; resize: 'cover'; quality: number };
export type GameplayPreviewResolution = 'thumbnail' | 'full';
const thumbnailTransform: GameplayPreviewTransform = { width: 320, height: 240, resize: 'cover', quality: 70 };
type CachedGameplayPreview = { promise: Promise<SignedGameplayAsset>; expiresAt: number | null };
const gameplayPreviewCache = new WeakMap<GameplayAssetClient, Map<string, CachedGameplayPreview>>();
type CachedGameplayPreviewPair = { promise: Promise<PublishedGameplayAssetPreviewPair>; expiresAt: number | null };
const gameplayPreviewPairCache = new WeakMap<GameplayAssetClient, Map<string, CachedGameplayPreviewPair>>();
export type PublishedGameplayAssetPair = {
  level_id: string;
  rule_version_id: string;
  original: SignedGameplayAsset;
  comparison: SignedGameplayAsset;
};
export type PublishedGameplayAssetPreviewPair = Pick<PublishedGameplayAssetPair, 'original' | 'comparison'>;
type AdminGameplayAssetReferences = {
  original: GameplayAssetReference | null;
  comparison: GameplayAssetReference | null;
};

export type AdminGameplayAssetPair = {
  original: SignedGameplayAsset | null;
  comparison: SignedGameplayAsset | null;
};

export type PairUploadStage = 'validating' | 'uploading_original' | 'uploading_comparison' | 'registering_pair';

type StorageResponse = { data: unknown; error: { message: string } | null };

export type GameplayAssetClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: File,
        options: { contentType: string; upsert: false; metadata: { width: number; height: number } },
      ) => PromiseLike<StorageResponse>;
      createSignedUrl: (path: string, expiresIn: number, options?: { transform?: GameplayPreviewTransform }) => PromiseLike<{
        data: { signedUrl: string } | null;
        error: { message: string } | null;
      }>;
    };
  };
  rpc: (
    name: 'register_level_asset_pair' | 'read_published_level_asset_pair',
    args: Record<string, unknown>,
  ) => PromiseLike<StorageResponse>;
  from: (table: 'level_assets') => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        in: (column: string, values: string[]) => {
          eq: (column: string, value: unknown) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
};

function throwUnavailable(): never {
  throw new Error('Artwork is missing, invalid, or unavailable.');
}

function isSafeSignedUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateGameplayImageMetadata(
  file: Pick<File, 'type' | 'size'> | Pick<GameplayAssetReference, 'mime_type' | 'file_size_bytes'>,
  dimensions: ImageDimensions,
): ImageDimensions {
  const mimeType = 'type' in file ? file.type : file.mime_type;
  const fileSize = 'size' in file ? file.size : file.file_size_bytes;
  if (!allowedMimeTypes.includes(mimeType)) throw new Error('Use a PNG, JPEG, or WebP image.');
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_GAMEPLAY_IMAGE_BYTES) {
    throw new Error('Each image must be smaller than or equal to 5 MB.');
  }
  if (!Number.isSafeInteger(dimensions.width) || dimensions.width <= 0
    || !Number.isSafeInteger(dimensions.height) || dimensions.height <= 0) {
    throw new Error('The image dimensions could not be verified.');
  }
  return dimensions;
}

export function validateGameplayImagePair(
  original: ImageDimensions,
  comparison: ImageDimensions,
) {
  if (original.width !== comparison.width || original.height !== comparison.height) {
    throw new Error('Original and Comparison images must have matching dimensions.');
  }
}

async function decodeImage(file: File): Promise<ImageDimensions> {
  if (typeof createImageBitmap !== 'function') throw new Error('Image decoding is unavailable in this browser.');
  const bitmap = await createImageBitmap(file);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

function getFileExtension(mimeType: string) {
  const extension = extensionByMimeType[mimeType];
  if (!extension) throw new Error('Use a PNG, JPEG, or WebP image.');
  return extension;
}

async function addSignedUrl(
  client: GameplayAssetClient,
  asset: GameplayAssetReference,
  transform?: GameplayPreviewTransform,
): Promise<SignedGameplayAsset> {
  const { data, error } = await client.storage.from(asset.bucket_name).createSignedUrl(
    asset.storage_path,
    SIGNED_URL_SECONDS,
    transform ? { transform } : undefined,
  );
  if (error || !data || !isSafeSignedUrl(data.signedUrl)) return throwUnavailable();
  return { ...asset, signed_url: data.signedUrl };
}

function parseAssetReference(value: unknown, levelId: string, role: GameplayImageRole): GameplayAssetReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return throwUnavailable();
  const asset = value as Record<string, unknown>;
  const path = typeof asset.storage_path === 'string' ? asset.storage_path : '';
  const match = assetPathPattern.exec(path);
  if (
    typeof asset.id !== 'string' || !uuidPattern.test(asset.id)
    || asset.bucket_name !== GAMEPLAY_ASSET_BUCKET
    || !match || match[1].toLowerCase() !== levelId.toLowerCase() || match[3] !== role
    || typeof asset.mime_type !== 'string' || !allowedMimeTypes.includes(asset.mime_type)
    || !Number.isSafeInteger(asset.width) || (asset.width as number) <= 0
    || !Number.isSafeInteger(asset.height) || (asset.height as number) <= 0
    || !Number.isSafeInteger(asset.file_size_bytes) || (asset.file_size_bytes as number) <= 0
    || (asset.file_size_bytes as number) > MAX_GAMEPLAY_IMAGE_BYTES
    || (asset.mime_type === 'image/png' && match[4] !== 'png')
    || (asset.mime_type === 'image/jpeg' && !['jpg', 'jpeg'].includes(match[4]))
    || (asset.mime_type === 'image/webp' && match[4] !== 'webp')
  ) return throwUnavailable();

  return {
    id: asset.id,
    bucket_name: GAMEPLAY_ASSET_BUCKET,
    storage_path: path,
    mime_type: asset.mime_type,
    width: asset.width as number,
    height: asset.height as number,
    file_size_bytes: asset.file_size_bytes as number,
  };
}

export function parsePublishedGameplayAssetPair(value: unknown, expectedLevelId: string) {
  if (!uuidPattern.test(expectedLevelId) || !value || typeof value !== 'object' || Array.isArray(value)) return throwUnavailable();
  const pair = value as Record<string, unknown>;
  if (pair.level_id !== expectedLevelId || typeof pair.rule_version_id !== 'string' || !uuidPattern.test(pair.rule_version_id)) {
    return throwUnavailable();
  }
  const original = parseAssetReference(pair.original, expectedLevelId, 'original');
  const comparison = parseAssetReference(pair.comparison, expectedLevelId, 'comparison');
  validateGameplayImagePair(original, comparison);
  return { level_id: expectedLevelId, rule_version_id: pair.rule_version_id, original, comparison };
}

async function decodeSignedImage(url: string): Promise<ImageDimensions> {
  if (typeof Image === 'undefined') throw new Error('Image decoding is unavailable in this browser.');
  const image = new Image();
  image.decoding = 'async';
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      new Promise<ImageDimensions>((resolve, reject) => {
        image.onload = () => {
          const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
          if (dimensions.width <= 0 || dimensions.height <= 0) {
            reject(new Error('Image dimensions are invalid.'));
            return;
          }
          resolve(dimensions);
        };
        image.onerror = () => reject(new Error('Image failed to load.'));
        image.src = url;
        if (image.complete && image.naturalWidth > 0) {
          image.onload(new Event('load'));
        }
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Image loading timed out.')), 30000);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    image.onload = null;
    image.onerror = null;
  }
}

export async function decodeSignedGameplayAssetPair(
  pair: PublishedGameplayAssetPair,
  decode: (url: string) => Promise<ImageDimensions> = decodeSignedImage,
) {
  const [original, comparison] = await Promise.all([
    decode(pair.original.signed_url),
    decode(pair.comparison.signed_url),
  ]);
  validateGameplayImageMetadata(pair.original, original);
  validateGameplayImageMetadata(pair.comparison, comparison);
  validateGameplayImagePair(original, comparison);
  return pair;
}

function parseAdminAssetRows(value: unknown, levelId: string): AdminGameplayAssetReferences {
  if (!Array.isArray(value)) return throwUnavailable();
  let original: GameplayAssetReference | null = null;
  let comparison: GameplayAssetReference | null = null;
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return throwUnavailable();
    const assetType = (row as Record<string, unknown>).asset_type;
    if (assetType !== 'original' && assetType !== 'comparison') continue;
    const asset = parseAssetReference(row, levelId, assetType);
    if (assetType === 'original') {
      if (original) return throwUnavailable();
      original = asset;
    } else {
      if (comparison) return throwUnavailable();
      comparison = asset;
    }
  }
  if (original && comparison) validateGameplayImagePair(original, comparison);
  return { original, comparison };
}

export async function getAdminGameplayAssetPair(
  client: GameplayAssetClient,
  levelId: string,
): Promise<AdminGameplayAssetPair> {
  if (!uuidPattern.test(levelId)) return throwUnavailable();
  const { data, error } = await client.from('level_assets')
    .select('id, level_id, asset_type, bucket_name, storage_path, mime_type, width, height, file_size_bytes, is_primary')
    .eq('level_id', levelId)
    .in('asset_type', ['original', 'comparison'])
    .eq('is_primary', true);
  if (error) return throwUnavailable();
  const pair = parseAdminAssetRows(data, levelId);
  const [original, comparison] = await Promise.all([
    pair.original ? addSignedUrl(client, pair.original) : null,
    pair.comparison ? addSignedUrl(client, pair.comparison) : null,
  ]);
  if (original && comparison) {
    const [originalDimensions, comparisonDimensions] = await Promise.all([
      decodeSignedImage(original.signed_url),
      decodeSignedImage(comparison.signed_url),
    ]);
    validateGameplayImageMetadata(original, originalDimensions);
    validateGameplayImageMetadata(comparison, comparisonDimensions);
    validateGameplayImagePair(originalDimensions, comparisonDimensions);
  }
  return { original, comparison };
}

export async function getAdminGameplayAssetPreview(
  client: GameplayAssetClient,
  levelId: string,
  resolution: GameplayPreviewResolution = 'thumbnail',
): Promise<SignedGameplayAsset | null> {
  if (!uuidPattern.test(levelId)) return throwUnavailable();
  const { data, error } = await client.from('level_assets')
    .select('id, level_id, asset_type, bucket_name, storage_path, mime_type, width, height, file_size_bytes, is_primary')
    .eq('level_id', levelId)
    .in('asset_type', ['original', 'comparison'])
    .eq('is_primary', true);
  if (error) return throwUnavailable();
  const pair = parseAdminAssetRows(data, levelId);
  if (!pair.comparison) return null;
  return addSignedUrl(client, pair.comparison, resolution === 'thumbnail' ? thumbnailTransform : undefined);
}

export async function getAdminGameplayAssetPairForLevel(levelId: string): Promise<AdminGameplayAssetPair> {
  const { supabase, supabaseConfigError } = await import('../supabaseClient');
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  return getAdminGameplayAssetPair(supabase as unknown as GameplayAssetClient, levelId);
}

export async function getAdminGameplayAssetPreviewForLevel(
  levelId: string,
  resolution: GameplayPreviewResolution = 'thumbnail',
): Promise<SignedGameplayAsset | null> {
  const { supabase, supabaseConfigError } = await import('../supabaseClient');
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  return getAdminGameplayAssetPreview(supabase as unknown as GameplayAssetClient, levelId, resolution);
}

export async function getPublishedGameplayAssetPair(
  client: GameplayAssetClient,
  levelId: string,
  decode: (url: string) => Promise<ImageDimensions> = decodeSignedImage,
): Promise<PublishedGameplayAssetPair> {
  if (!uuidPattern.test(levelId)) return throwUnavailable();
  const { data, error } = await client.rpc('read_published_level_asset_pair', { p_level_id: levelId });
  if (error) return throwUnavailable();
  const pair = parsePublishedGameplayAssetPair(data, levelId);
  const [original, comparison] = await Promise.all([
    addSignedUrl(client, pair.original),
    addSignedUrl(client, pair.comparison),
  ]);
  return decodeSignedGameplayAssetPair({ ...pair, original, comparison }, decode);
}

export async function getPublishedGameplayAssetPreview(
  client: GameplayAssetClient,
  levelId: string,
  resolution: GameplayPreviewResolution = 'thumbnail',
): Promise<SignedGameplayAsset> {
  if (!uuidPattern.test(levelId)) return throwUnavailable();
  let clientCache = gameplayPreviewCache.get(client);
  if (!clientCache) {
    clientCache = new Map();
    gameplayPreviewCache.set(client, clientCache);
  }

  const cacheKey = `${levelId.toLowerCase()}:${resolution}`;
  const cached = clientCache.get(cacheKey);
  if (cached && (cached.expiresAt === null || cached.expiresAt > Date.now())) return cached.promise;

  const promise = Promise.resolve().then(async () => {
    const { data, error } = await client.rpc('read_published_level_asset_pair', { p_level_id: levelId });
    if (error) return throwUnavailable();
    const pair = parsePublishedGameplayAssetPair(data, levelId);
    return addSignedUrl(client, pair.comparison, resolution === 'thumbnail' ? thumbnailTransform : undefined);
  });
  const entry: CachedGameplayPreview = { promise, expiresAt: null };
  clientCache.set(cacheKey, entry);

  try {
    const preview = await promise;
    entry.expiresAt = Date.now() + PREVIEW_URL_CACHE_MILLISECONDS;
    return preview;
  } catch (error) {
    if (clientCache.get(cacheKey) === entry) clientCache.delete(cacheKey);
    throw error;
  }
}

export async function getPublishedGameplayAssetPreviewPair(
  client: GameplayAssetClient,
  levelId: string,
  resolution: GameplayPreviewResolution = 'thumbnail',
): Promise<PublishedGameplayAssetPreviewPair> {
  if (!uuidPattern.test(levelId)) return throwUnavailable();
  let clientCache = gameplayPreviewPairCache.get(client);
  if (!clientCache) {
    clientCache = new Map();
    gameplayPreviewPairCache.set(client, clientCache);
  }

  const cacheKey = `${levelId.toLowerCase()}:${resolution}`;
  const cached = clientCache.get(cacheKey);
  if (cached && (cached.expiresAt === null || cached.expiresAt > Date.now())) return cached.promise;

  const promise = Promise.resolve().then(async () => {
    const { data, error } = await client.rpc('read_published_level_asset_pair', { p_level_id: levelId });
    if (error) return throwUnavailable();
    const pair = parsePublishedGameplayAssetPair(data, levelId);
    const transform = resolution === 'thumbnail' ? thumbnailTransform : undefined;
    const [original, comparison] = await Promise.all([
      addSignedUrl(client, pair.original, transform),
      addSignedUrl(client, pair.comparison, transform),
    ]);
    return { original, comparison };
  });
  const entry: CachedGameplayPreviewPair = { promise, expiresAt: null };
  clientCache.set(cacheKey, entry);

  try {
    const previewPair = await promise;
    entry.expiresAt = Date.now() + PREVIEW_URL_CACHE_MILLISECONDS;
    return previewPair;
  } catch (error) {
    if (clientCache.get(cacheKey) === entry) clientCache.delete(cacheKey);
    throw error;
  }
}

export async function getPublishedGameplayAssetPairForLevel(levelId: string): Promise<PublishedGameplayAssetPair> {
  const { supabase, supabaseConfigError } = await import('../supabaseClient');
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  return getPublishedGameplayAssetPair(supabase as unknown as GameplayAssetClient, levelId);
}

export async function getPublishedGameplayAssetPreviewForLevel(
  levelId: string,
  resolution: GameplayPreviewResolution = 'thumbnail',
): Promise<SignedGameplayAsset> {
  const { supabase, supabaseConfigError } = await import('../supabaseClient');
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  return getPublishedGameplayAssetPreview(supabase as unknown as GameplayAssetClient, levelId, resolution);
}

export async function getPublishedGameplayAssetPreviewPairForLevel(
  levelId: string,
  resolution: GameplayPreviewResolution = 'thumbnail',
): Promise<PublishedGameplayAssetPreviewPair> {
  const { supabase, supabaseConfigError } = await import('../supabaseClient');
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  return getPublishedGameplayAssetPreviewPair(supabase as unknown as GameplayAssetClient, levelId, resolution);
}

export async function uploadAndRegisterGameplayAssetPair(
  client: GameplayAssetClient,
  levelId: string,
  originalFile: File,
  comparisonFile: File,
  onStage: (stage: PairUploadStage) => void = () => undefined,
): Promise<{ level_id: string; original_asset_id: string; comparison_asset_id: string }> {
  if (!uuidPattern.test(levelId)) return throwUnavailable();
  onStage('validating');
  const [originalDimensions, comparisonDimensions] = await Promise.all([
    decodeImage(originalFile),
    decodeImage(comparisonFile),
  ]);
  validateGameplayImageMetadata(originalFile, originalDimensions);
  validateGameplayImageMetadata(comparisonFile, comparisonDimensions);
  validateGameplayImagePair(originalDimensions, comparisonDimensions);

  const uploadId = globalThis.crypto.randomUUID();
  const originalPath = `${levelId}/${uploadId}/original.${getFileExtension(originalFile.type)}`;
  const comparisonPath = `${levelId}/${uploadId}/comparison.${getFileExtension(comparisonFile.type)}`;
  const storage = client.storage.from(GAMEPLAY_ASSET_BUCKET);

  onStage('uploading_original');
  const originalUpload = await storage.upload(originalPath, originalFile, {
    contentType: originalFile.type,
    upsert: false,
    metadata: originalDimensions,
  });
  if (originalUpload.error) throw new Error('Original image upload failed. Any uploaded object is left untouched.');

  onStage('uploading_comparison');
  const comparisonUpload = await storage.upload(comparisonPath, comparisonFile, {
    contentType: comparisonFile.type,
    upsert: false,
    metadata: comparisonDimensions,
  });
  if (comparisonUpload.error) throw new Error('Comparison image upload failed. Any uploaded object is left untouched.');

  onStage('registering_pair');
  const { data, error } = await client.rpc('register_level_asset_pair', {
    p_level_id: levelId,
    p_original_asset: {
      storage_path: originalPath,
      mime_type: originalFile.type,
      width: originalDimensions.width,
      height: originalDimensions.height,
      file_size_bytes: originalFile.size,
    },
    p_comparison_asset: {
      storage_path: comparisonPath,
      mime_type: comparisonFile.type,
      width: comparisonDimensions.width,
      height: comparisonDimensions.height,
      file_size_bytes: comparisonFile.size,
    },
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The image pair could not be registered. Existing artwork was not replaced.');
  }

  const registered = data as Record<string, unknown>;
  if (registered.level_id !== levelId
    || typeof registered.original_asset_id !== 'string' || !uuidPattern.test(registered.original_asset_id)
    || typeof registered.comparison_asset_id !== 'string' || !uuidPattern.test(registered.comparison_asset_id)) {
    throw new Error('The image pair registration response was invalid. Existing artwork was not replaced.');
  }
  return {
    level_id: levelId,
    original_asset_id: registered.original_asset_id,
    comparison_asset_id: registered.comparison_asset_id,
  };
}

export async function uploadAndRegisterGameplayAssetPairForLevel(
  levelId: string,
  originalFile: File,
  comparisonFile: File,
  onStage?: (stage: PairUploadStage) => void,
) {
  const { supabase, supabaseConfigError } = await import('../supabaseClient');
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  return uploadAndRegisterGameplayAssetPair(
    supabase as unknown as GameplayAssetClient,
    levelId,
    originalFile,
    comparisonFile,
    onStage,
  );
}