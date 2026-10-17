import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import {
  getAdminGameplayAssetPairForLevel,
  uploadAndRegisterGameplayAssetPairForLevel,
  type AdminGameplayAssetPair,
  type PairUploadStage,
} from '../../services/levelAssets';

type Props = {
  levelId: string;
  levelTitle: string;
  levelStatus: string;
};

const stageLabels: Record<PairUploadStage, string> = {
  validating: 'Checking both images...',
  uploading_original: 'Uploading Original...',
  uploading_comparison: 'Uploading Comparison...',
  registering_pair: 'Registering the image pair...',
};

export default function LevelAssetPairEditor({ levelId, levelTitle, levelStatus }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [assetPair, setAssetPair] = useState<AdminGameplayAssetPair>({ original: null, comparison: null });
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [comparisonFile, setComparisonFile] = useState<File | null>(null);
  const [stage, setStage] = useState<PairUploadStage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const isDraft = levelStatus === 'draft';

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    void getAdminGameplayAssetPairForLevel(levelId)
      .then((pair) => {
        if (isMounted) setAssetPair(pair);
      })
      .catch(() => {
        if (isMounted) setError('Could not load private image previews. Verify Storage read permissions.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, levelId, revision]);

  const handleUpload = async () => {
    if (!isDraft || !originalFile || !comparisonFile || stage) return;
    setError(null);
    try {
      await uploadAndRegisterGameplayAssetPairForLevel(levelId, originalFile, comparisonFile, setStage);
      setOriginalFile(null);
      setComparisonFile(null);
      setRevision((current) => current + 1);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'The image pair could not be saved.');
    } finally {
      setStage(null);
    }
  };

  return (
    <details
      className="mt-3 rounded-lg border border-outline-variant/60 p-3"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-label-md text-on-surface">Manage image pair · {levelTitle}</summary>
      {isLoading ? <p role="status" className="mt-3 text-body-sm text-on-surface-variant">Loading image pair...</p> : null}
      {error ? <p role="alert" className="mt-3 break-words text-body-sm text-error">{error}</p> : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <figure className="space-y-1">
          <figcaption className="text-label-sm text-on-surface-variant">Original image</figcaption>
          {assetPair.original ? (
            <img src={assetPair.original.signed_url} alt={`${levelTitle} original`} className="aspect-square w-full rounded-md bg-surface-container-low object-contain" />
          ) : <div role="img" aria-label="Original image missing" className="flex aspect-square items-center justify-center rounded-md bg-surface-container-low p-4 text-center text-body-sm text-on-surface-variant">No registered Original image</div>}
        </figure>
        <figure className="space-y-1">
          <figcaption className="text-label-sm text-on-surface-variant">Comparison image · place spots on this image</figcaption>
          {assetPair.comparison ? (
            <img src={assetPair.comparison.signed_url} alt={`${levelTitle} comparison`} className="aspect-square w-full rounded-md bg-surface-container-low object-contain" />
          ) : <div role="img" aria-label="Comparison image missing" className="flex aspect-square items-center justify-center rounded-md bg-surface-container-low p-4 text-center text-body-sm text-on-surface-variant">No registered Comparison image</div>}
        </figure>
      </div>

      {isDraft ? (
        <div className="mt-4 space-y-3">
          <p className="text-body-sm text-on-surface-variant">Choose both files together. The current pair stays active unless both uploads and pair registration succeed. Uploaded objects from a failed attempt are retained for later cleanup.</p>
          <label className="block text-label-sm text-on-surface-variant">
            Original · PNG, JPEG, or WebP · maximum 5 MB
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={stage !== null} onChange={(event) => setOriginalFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-body-sm" />
          </label>
          <label className="block text-label-sm text-on-surface-variant">
            Comparison · PNG, JPEG, or WebP · maximum 5 MB
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={stage !== null} onChange={(event) => setComparisonFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-body-sm" />
          </label>
          {stage ? <p role="status" className="text-body-sm text-on-surface-variant">{stageLabels[stage]}</p> : null}
          <Button type="button" variant="primary" disabled={!originalFile || !comparisonFile || stage !== null} onClick={() => void handleUpload()}>
            {stage ? 'Saving pair...' : 'Upload image pair'}
          </Button>
        </div>
      ) : (
        <p role="status" className="mt-3 text-body-sm text-on-surface-variant">Unpublish this level before replacing its image pair.</p>
      )}
    </details>
  );
}
