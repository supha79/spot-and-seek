import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  getAdminGameplayAssetPreviewForLevel,
  getPublishedGameplayAssetPreviewForLevel,
  type GameplayPreviewResolution,
} from '../../services/levelAssets';
import PlaceholderIllustration from './PlaceholderIllustration';

type Props = {
  levelId: string;
  title: string;
  className?: string;
  children?: ReactNode;
  resolution?: GameplayPreviewResolution;
  loading?: 'eager' | 'lazy';
  access?: 'published' | 'admin';
};

export default function LevelArtwork({ levelId, title, className = '', children, resolution = 'thumbnail', loading = 'eager', access = 'published' }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasTriedFullResolution, setHasTriedFullResolution] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequestId = ++requestId.current;
    setImageUrl(null);
    setImageLoaded(false);
    setHasTriedFullResolution(false);

    const loadPreview = access === 'admin'
      ? getAdminGameplayAssetPreviewForLevel(levelId, resolution)
      : getPublishedGameplayAssetPreviewForLevel(levelId, resolution);

    void loadPreview
      .then((image) => {
        if (requestId.current === currentRequestId) setImageUrl(image?.signed_url ?? null);
      })
      .catch(() => {
        if (requestId.current === currentRequestId) setImageUrl(null);
      });

    return () => {
      if (requestId.current === currentRequestId) requestId.current += 1;
    };
  }, [access, levelId, resolution]);

  return (
    <div className={`relative overflow-hidden bg-surface-container ${className}`} aria-busy={!imageLoaded}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${title} level artwork`}
          loading={loading}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            if (resolution === 'thumbnail' && !hasTriedFullResolution) {
              const currentRequestId = requestId.current;
              setHasTriedFullResolution(true);
              const loadFullResolution = access === 'admin'
                ? getAdminGameplayAssetPreviewForLevel(levelId, 'full')
                : getPublishedGameplayAssetPreviewForLevel(levelId, 'full');

              void loadFullResolution
                .then((image) => {
                  if (requestId.current === currentRequestId) setImageUrl(image?.signed_url ?? null);
                })
                .catch(() => {
                  if (requestId.current === currentRequestId) setImageUrl(null);
                })
                .finally(() => {
                  if (requestId.current === currentRequestId) setImageLoaded(false);
                });
              return;
            }
            setImageUrl(null);
            setImageLoaded(false);
          }}
        />
      ) : null}
      {!imageLoaded ? (
        <div className="absolute inset-0">
          <PlaceholderIllustration className="h-full w-full" label={title} />
        </div>
      ) : null}
      {children}
    </div>
  );
}