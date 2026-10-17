$validatorPath = Join-Path $PSScriptRoot '..\validate-legacy-gameplay-assets.ps1'
. $validatorPath

Describe 'Legacy gameplay manifest validation' {
  It 'keeps the validator spot inventory aligned with the baseline migration' {
    $migrationPath = Join-Path $PSScriptRoot '..\..\supabase\migrations\20261004010000_phase_2b_game_runs.sql'
    $migration = Get-Content -LiteralPath $migrationPath -Raw
    foreach ($levelId in $script:LegacySpotIdsByLevel.Keys) {
      $pattern = "\('$([regex]::Escape($levelId))',\s*\d+,\s*ARRAY\[(?<spots>[^\]]+)\]::text\[\]\)"
      $match = [regex]::Match($migration, $pattern)
      $match.Success | Should Be $true
      $migrationSpots = @([regex]::Matches($match.Groups['spots'].Value, "'([^']+)'") | ForEach-Object { $_.Groups[1].Value } | Sort-Object)
      $validatorSpots = @(Get-LegacyExpectedSpotIds -LevelId $levelId | Sort-Object)
      ($migrationSpots -join ',') | Should Be ($validatorSpots -join ',')
    }
  }

  It 'decodes a local PNG byte fixture and reports actual MIME dimensions and hash' {
    $png = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=')
    $info = Get-LegacyImageInfoFromBytes -Bytes $png -DeclaredMime 'image/png'
    $info.MimeType | Should Be 'image/png'
    $info.Width | Should Be 1
    $info.Height | Should Be 1
    $info.Sha256.Length | Should Be 64
  }

  It 'rejects content whose bytes do not match the declared MIME or cannot decode' {
    $png = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=')
    { Get-LegacyImageInfoFromBytes -Bytes $png -DeclaredMime 'image/jpeg' } | Should Throw
    { Get-LegacyImageInfoFromBytes -Bytes ([byte[]](1, 2, 3)) -DeclaredMime 'image/png' } | Should Throw
  }

  It 'rejects an image larger than the Dynamic client 5 MiB limit' {
    $png = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=')
    $oversized = [Array]::CreateInstance([byte], 5MB + 1)
    [Array]::Copy($png, $oversized, $png.Length)
    { Get-LegacyImageInfoFromBytes -Bytes $oversized -DeclaredMime 'image/png' } | Should Throw
  }

  It 'requires equal decoded dimensions for an Original/Comparison pair' {
    $original = [pscustomobject]@{ Width = 640; Height = 480 }
    $matching = [pscustomobject]@{ Width = 640; Height = 480 }
    $mismatched = [pscustomobject]@{ Width = 640; Height = 479 }
    @(Get-LegacyPairDimensionIssues -Original $original -Comparison $matching).Count | Should Be 0
    @(Get-LegacyPairDimensionIssues -Original $original -Comparison $mismatched).Count | Should Be 1
  }

  It 'accepts normalized circle and rectangle geometry without claiming visual correctness' {
    $circle = [pscustomobject]@{ spot_id = 'flower'; geometry = [pscustomobject]@{ shape = 'circle'; x_norm = 0.5; y_norm = 0.5; radius_norm = 0.1 } }
    $rectangle = [pscustomobject]@{ spot_id = 'bench'; geometry = [pscustomobject]@{ shape = 'rectangle'; x_norm = 0.4; y_norm = 0.6; width_norm = 0.2; height_norm = 0.1 } }
    @(Get-LegacyGeometryIssues -Spot $circle).Count | Should Be 0
    @(Get-LegacyGeometryIssues -Spot $rectangle).Count | Should Be 0
  }

  It 'allows image pixel dimensions above one while requiring positive integers' {
    (Test-LegacyPositiveInteger -Value 640) | Should Be $true
    (Test-LegacyPositiveInteger -Value 480) | Should Be $true
    (Test-LegacyPositiveInteger -Value 0) | Should Be $false
    (Test-LegacyPositiveInteger -Value 1.5) | Should Be $false
    (Test-LegacyPositiveInteger -Value '640') | Should Be $false
  }

  It 'rejects string, non-finite-range, and incomplete geometry values' {
    $bad = [pscustomobject]@{ spot_id = 'flower'; geometry = [pscustomobject]@{ shape = 'circle'; x_norm = '0.5'; y_norm = 1.2; radius_norm = 0 } }
    @(Get-LegacyGeometryIssues -Spot $bad).Count | Should Be 3
  }

  It 'rejects a valid-range target whose circle or rectangle extends outside the image' {
    $circle = [pscustomobject]@{ spot_id = 'circle-edge'; geometry = [pscustomobject]@{ shape = 'circle'; x_norm = 0.05; y_norm = 0.5; radius_norm = 0.1 } }
    $rectangle = [pscustomobject]@{ spot_id = 'rectangle-edge'; geometry = [pscustomobject]@{ shape = 'rectangle'; x_norm = 0.05; y_norm = 0.5; width_norm = 0.2; height_norm = 0.2 } }
    ($((Get-LegacyGeometryIssues -Spot $circle) -join "`n")) | Should Match 'extends outside'
    ($((Get-LegacyGeometryIssues -Spot $rectangle) -join "`n")) | Should Match 'extends outside'
  }

  It 'rejects duplicate, missing, and unexpected spot IDs' {
    $spots = @(
      [pscustomobject]@{ spot_id = 'window' },
      [pscustomobject]@{ spot_id = 'window' },
      [pscustomobject]@{ spot_id = 'extra' }
    )
    $issues = @(Get-LegacySpotSetIssues -LevelId 'cozy-cat-corner' -Spots $spots)
    ($issues -join "`n") | Should Match 'Duplicate spot_id'
    ($issues -join "`n") | Should Match 'Unexpected spot_id'
    ($issues -join "`n") | Should Match 'Required spot_id'
  }

  It 'requires a local readable annotation reference tied to both exact asset hashes' {
    $annotation = [pscustomobject]@{
      spot_id = 'window'
      path = 'missing-annotation.png'
      original_sha256 = ('a' * 64)
      comparison_sha256 = ('b' * 64)
      reviewer = 'Reviewer Name'
      reviewed_at = '2026-10-12T12:00:00Z'
    }
    $issues = @(Get-LegacyAnnotationIssues -Annotation $annotation -SpotId 'window' -Root $PSScriptRoot -OriginalSha256 ('a' * 64) -ComparisonSha256 ('b' * 64))
    ($issues -join "`n") | Should Match 'missing or unreadable'
  }

  It 'fails closed when the manifest has no local asset records' {
    $manifest = [pscustomobject]@{
      schema_version = 1
      level_id = 'cozy-cat-corner'
      assets = [pscustomobject]@{ original = $null; comparison = $null }
      spots = @(
        [pscustomobject]@{ spot_id = 'window'; answer_description = 'TBD'; geometry = $null; annotation = $null },
        [pscustomobject]@{ spot_id = 'plant'; answer_description = 'TBD'; geometry = $null; annotation = $null },
        [pscustomobject]@{ spot_id = 'teapot'; answer_description = 'TBD'; geometry = $null; annotation = $null }
      )
    }
    $result = Invoke-LegacyManifestValidation -Manifest $manifest -ManifestDirectory $PSScriptRoot
    $result.IsValid | Should Be $false
    ($result.Issues -join "`n") | Should Match 'Missing original asset record'
    ($result.Issues -join "`n") | Should Match 'Missing comparison asset record'
  }
}
