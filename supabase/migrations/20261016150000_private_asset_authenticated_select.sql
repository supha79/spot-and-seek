CREATE OR REPLACE FUNCTION public._can_select_gameplay_asset_object(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(original|comparison)\.(png|jpg|jpeg|webp)$'
    AND EXISTS (
      SELECT 1
      FROM storage.buckets AS bucket
      WHERE bucket.id = 'gameplay-assets'
        AND bucket.public IS FALSE
    )
    AND (
      (
        COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
        AND EXISTS (
          SELECT 1
          FROM public.level_assets AS asset
          WHERE asset.storage_path = p_name
            AND asset.bucket_name = 'gameplay-assets'
            AND asset.asset_type IN ('original', 'comparison')
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.levels AS level
        INNER JOIN public.games AS game
          ON game.id = level.game_id
        INNER JOIN public.game_run_rule_versions AS rule_version
          ON rule_version.content_level_id = level.id
        INNER JOIN public.level_assets AS asset
          ON asset.level_id = level.id
         AND asset.id IN (rule_version.original_asset_id, rule_version.comparison_asset_id)
        WHERE level.id = split_part(p_name, '/', 1)::uuid
          AND level.status = 'published'
          AND game.status = 'published'
          AND rule_version.id = (
            SELECT latest.id
            FROM public.game_run_rule_versions AS latest
            WHERE latest.content_level_id = level.id
            ORDER BY latest.version DESC
            LIMIT 1
          )
          AND asset.bucket_name = 'gameplay-assets'
          AND asset.storage_path = p_name
          AND asset.asset_type = split_part(split_part(p_name, '/', 3), '.', 1)
      )
    );
$$;

REVOKE ALL ON FUNCTION public._can_select_gameplay_asset_object(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._can_select_gameplay_asset_object(text) TO authenticated, anon;