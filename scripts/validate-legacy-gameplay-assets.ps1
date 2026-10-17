param(
  [string]$ManifestPath
)

$script:LegacySpotIdsByLevel = @{
  'cozy-cat-corner' = @('window', 'plant', 'teapot')
  'sunny-picnic' = @('umbrella', 'flower', 'basket')
  'balloon-hills' = @('balloon', 'hill', 'kite')
  'greenhouse-garden' = @('window', 'plant', 'lamp', 'bench', 'vase')
  'bakery-breeze' = @('window', 'plant', 'lamp', 'bench', 'vase')
  'night-train' = @('window', 'plant', 'lamp', 'bench', 'vase')
  'stormy-shelf' = @('window', 'plant', 'lamp', 'book', 'frame', 'mug', 'chair')
  'forest-fable' = @('window', 'plant', 'lamp', 'book', 'frame', 'mug', 'chair')
}
$script:LegacyMaxImageBytes = 5MB
$script:LegacyMimeByExtension = @{
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
}

function Get-LegacyExpectedSpotIds {
  param([Parameter(Mandatory = $true)][string]$LevelId)
  if (-not $script:LegacySpotIdsByLevel.ContainsKey($LevelId)) {
    throw "Unknown Legacy level ID '$LevelId'."
  }
  return $script:LegacySpotIdsByLevel[$LevelId]
}

function Get-LegacyImageInfoFromBytes {
  param(
    [Parameter(Mandatory = $true)][byte[]]$Bytes,
    [string]$DeclaredMime,
    [long]$MaxBytes = 5242880
  )

  if ($Bytes.Length -eq 0) { throw 'Image file is empty.' }
  if ($MaxBytes -gt 0 -and $Bytes.Length -gt $MaxBytes) {
    throw 'Image file exceeds the 5 MiB gameplay asset limit.'
  }

  $detectedMime = $null
  if ($Bytes.Length -ge 8 -and [BitConverter]::ToString($Bytes, 0, 8) -eq '89-50-4E-47-0D-0A-1A-0A') {
    $detectedMime = 'image/png'
  } elseif ($Bytes.Length -ge 3 -and $Bytes[0] -eq 255 -and $Bytes[1] -eq 216 -and $Bytes[2] -eq 255) {
    $detectedMime = 'image/jpeg'
  } elseif ($Bytes.Length -ge 12 -and [Text.Encoding]::ASCII.GetString($Bytes, 0, 4) -eq 'RIFF' -and [Text.Encoding]::ASCII.GetString($Bytes, 8, 4) -eq 'WEBP') {
    $detectedMime = 'image/webp'
  } else {
    throw 'File bytes are not a recognized PNG, JPEG, or WebP image.'
  }

  if ($DeclaredMime -and $DeclaredMime -cne $detectedMime) {
    throw "Declared MIME '$DeclaredMime' does not match detected MIME '$detectedMime'."
  }

  Add-Type -AssemblyName System.Drawing -ErrorAction Stop
  $stream = [System.IO.MemoryStream]::new($Bytes, $false)
  $image = $null
  try {
    try {
      $image = [System.Drawing.Image]::FromStream($stream, $false, $true)
    } catch {
      throw "The local Windows image decoder could not open the $detectedMime file: $($_.Exception.Message)"
    }

    if ($image.Width -le 0 -or $image.Height -le 0) {
      throw 'Decoded image dimensions must be positive.'
    }

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $sha256 = [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant()
    } finally {
      $sha.Dispose()
    }

    return [pscustomobject]@{
      MimeType = $detectedMime
      FileSizeBytes = [long]$Bytes.Length
      Width = [int]$image.Width
      Height = [int]$image.Height
      Sha256 = $sha256
    }
  } finally {
    if ($image) { $image.Dispose() }
    $stream.Dispose()
  }
}

function Resolve-LegacyLocalFile {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$RelativePath
  )

  if ([string]::IsNullOrWhiteSpace($RelativePath) -or [System.IO.Path]::IsPathRooted($RelativePath) -or $RelativePath -match '^[a-zA-Z][a-zA-Z0-9+.-]*://') {
    throw 'Asset and annotation paths must be non-empty local relative paths.'
  }

  $rootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\', '/'))
  $candidate = Join-Path $rootPath $RelativePath
  $resolved = (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).ProviderPath
  $rootPrefix = $rootPath + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolved.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Asset and annotation paths must remain inside the manifest directory.'
  }
  return $resolved
}

function Get-LegacyImageInfoFromPath {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [string]$DeclaredMime,
    [long]$MaxBytes = 5242880
  )

  $resolved = Resolve-LegacyLocalFile -Root $Root -RelativePath $RelativePath
  $file = Get-Item -LiteralPath $resolved -ErrorAction Stop
  if ($file.PSIsContainer) { throw 'Expected an image file, found a directory.' }
  if ($MaxBytes -gt 0 -and $file.Length -gt $MaxBytes) { throw 'Image file exceeds the 5 MiB gameplay asset limit.' }

  $extension = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()
  if (-not $script:LegacyMimeByExtension.ContainsKey($extension)) { throw "Unsupported image extension '$extension'." }
  $extensionMime = $script:LegacyMimeByExtension[$extension]
  if ($DeclaredMime -and $DeclaredMime -cne $extensionMime) {
    throw "Declared MIME '$DeclaredMime' does not match file extension '$extension'."
  }

  $bytes = [System.IO.File]::ReadAllBytes($resolved)
  return Get-LegacyImageInfoFromBytes -Bytes $bytes -DeclaredMime $extensionMime -MaxBytes $MaxBytes
}

function Get-LegacyPairDimensionIssues {
  param([object]$Original, [object]$Comparison)
  if (-not $Original -or -not $Comparison) {
    return @('Both images must decode before pair dimensions can be compared.')
  }
  if ($Original.Width -ne $Comparison.Width -or $Original.Height -ne $Comparison.Height) {
    return @('Original and Comparison decoded dimensions must match.')
  }
  return @()
}

function Test-LegacyNormalizedNumber {
  param([object]$Value, [switch]$AllowZero)
  if ($null -eq $Value -or $Value -is [bool] -or $Value -isnot [System.ValueType]) { return $false }
  $number = [double]$Value
  if ([double]::IsNaN($number) -or [double]::IsInfinity($number) -or $number -gt 1) { return $false }
  if ($AllowZero) { return $number -ge 0 }
  return $number -gt 0
}

function Test-LegacyPositiveInteger {
  param([object]$Value)
  if ($null -eq $Value -or $Value -is [bool] -or $Value -isnot [System.ValueType]) { return $false }
  $number = [double]$Value
  return (-not [double]::IsNaN($number)) -and (-not [double]::IsInfinity($number)) -and $number -gt 0 -and [math]::Floor($number) -eq $number
}

function Get-LegacyGeometryIssues {
  param([Parameter(Mandatory = $true)][object]$Spot)
  $issues = New-Object 'System.Collections.Generic.List[string]'
  $name = if ($Spot.spot_id) { [string]$Spot.spot_id } else { '<missing spot_id>' }
  $geometry = $Spot.geometry
  if (-not $geometry) {
    $issues.Add("Spot '$name' is missing geometry.")
    return $issues.ToArray()
  }

  foreach ($coordinate in @('x_norm', 'y_norm')) {
    if (-not (Test-LegacyNormalizedNumber -Value $geometry.$coordinate -AllowZero)) {
      $issues.Add("Spot '$name' has invalid normalized $coordinate; expected a numeric value in [0,1].")
    }
  }

  if ($geometry.shape -ceq 'circle') {
    $validRadius = Test-LegacyNormalizedNumber -Value $geometry.radius_norm
    if (-not $validRadius) {
      $issues.Add("Spot '$name' has invalid radius_norm; expected a numeric value in (0,1].")
    } elseif ((Test-LegacyNormalizedNumber -Value $geometry.x_norm -AllowZero) -and (Test-LegacyNormalizedNumber -Value $geometry.y_norm -AllowZero)) {
      $centerX = [double]$geometry.x_norm
      $centerY = [double]$geometry.y_norm
      $radius = [double]$geometry.radius_norm
      if ($centerX - $radius -lt 0 -or $centerX + $radius -gt 1 -or $centerY - $radius -lt 0 -or $centerY + $radius -gt 1) {
        $issues.Add("Spot '$name' circle extends outside the normalized image frame.")
      }
    }
  } elseif ($geometry.shape -ceq 'rectangle') {
    $validDimensions = $true
    foreach ($dimension in @('width_norm', 'height_norm')) {
      if (-not (Test-LegacyNormalizedNumber -Value $geometry.$dimension)) {
        $issues.Add("Spot '$name' has invalid $dimension; expected a numeric value in (0,1].")
        $validDimensions = $false
      }
    }
    if ($validDimensions -and (Test-LegacyNormalizedNumber -Value $geometry.x_norm -AllowZero) -and (Test-LegacyNormalizedNumber -Value $geometry.y_norm -AllowZero)) {
      $centerX = [double]$geometry.x_norm
      $centerY = [double]$geometry.y_norm
      $halfWidth = [double]$geometry.width_norm / 2
      $halfHeight = [double]$geometry.height_norm / 2
      if ($centerX - $halfWidth -lt 0 -or $centerX + $halfWidth -gt 1 -or $centerY - $halfHeight -lt 0 -or $centerY + $halfHeight -gt 1) {
        $issues.Add("Spot '$name' rectangle extends outside the normalized image frame.")
      }
    }
  } else {
    $issues.Add("Spot '$name' has unsupported geometry shape '$($geometry.shape)'.")
  }
  return $issues.ToArray()
}

function Get-LegacySpotSetIssues {
  param(
    [Parameter(Mandatory = $true)][string]$LevelId,
    [object[]]$Spots
  )
  $issues = New-Object 'System.Collections.Generic.List[string]'
  if (-not $script:LegacySpotIdsByLevel.ContainsKey($LevelId)) {
    $issues.Add("Unknown Legacy level ID '$LevelId'.")
    return $issues.ToArray()
  }
  $expected = @(Get-LegacyExpectedSpotIds -LevelId $LevelId)
  $seen = New-Object 'System.Collections.Generic.List[string]'
  foreach ($spot in @($Spots)) {
    if (-not $spot.spot_id -or $spot.spot_id -isnot [string]) {
      $issues.Add('Every spot must have a string spot_id.')
      continue
    }
    $id = [string]$spot.spot_id
    if ($seen.Contains($id)) { $issues.Add("Duplicate spot_id '$id'.") }
    $seen.Add($id)
    if ($expected -cnotcontains $id) { $issues.Add("Unexpected spot_id '$id' for level '$LevelId'.") }
  }
  foreach ($id in $expected) {
    if ($seen -cnotcontains $id) { $issues.Add("Required spot_id '$id' is missing for level '$LevelId'.") }
  }
  return $issues.ToArray()
}

function Get-LegacyAnnotationIssues {
  param(
    [object]$Annotation,
    [Parameter(Mandatory = $true)][string]$SpotId,
    [Parameter(Mandatory = $true)][string]$Root,
    [string]$OriginalSha256,
    [string]$ComparisonSha256
  )
  $issues = New-Object 'System.Collections.Generic.List[string]'
  if (-not $Annotation) {
    $issues.Add("Spot '$SpotId' is missing annotation evidence.")
    return $issues.ToArray()
  }
  if ($Annotation.spot_id -cne $SpotId) { $issues.Add("Annotation spot_id must match '$SpotId'.") }
  if (-not $Annotation.path) {
    $issues.Add("Spot '$SpotId' is missing an annotated evidence path.")
  } else {
    try {
      $null = Get-LegacyImageInfoFromPath -Root $Root -RelativePath ([string]$Annotation.path) -MaxBytes 0
    } catch {
      $issues.Add("Spot '$SpotId' annotated evidence is missing or unreadable: $($_.Exception.Message)")
    }
  }
  if (-not $OriginalSha256 -or $Annotation.original_sha256 -cne $OriginalSha256) {
    $issues.Add("Spot '$SpotId' annotation must reference the decoded Original SHA-256.")
  }
  if (-not $ComparisonSha256 -or $Annotation.comparison_sha256 -cne $ComparisonSha256) {
    $issues.Add("Spot '$SpotId' annotation must reference the decoded Comparison SHA-256.")
  }
  if ([string]::IsNullOrWhiteSpace([string]$Annotation.reviewer)) { $issues.Add("Spot '$SpotId' annotation needs a named reviewer.") }
  $reviewedAt = [DateTimeOffset]::MinValue
  if (-not [DateTimeOffset]::TryParse([string]$Annotation.reviewed_at, [ref]$reviewedAt)) {
    $issues.Add("Spot '$SpotId' annotation needs a parseable reviewed_at timestamp.")
  }
  return $issues.ToArray()
}

function Invoke-LegacyManifestValidation {
  param(
    [Parameter(Mandatory = $true)][object]$Manifest,
    [Parameter(Mandatory = $true)][string]$ManifestDirectory
  )
  $issues = New-Object 'System.Collections.Generic.List[string]'
  if ($Manifest.schema_version -ne 1) { $issues.Add('schema_version must be 1.') }
  $levelId = [string]$Manifest.level_id
  if (-not $script:LegacySpotIdsByLevel.ContainsKey($levelId)) {
    $issues.Add("Unknown Legacy level ID '$levelId'.")
    return [pscustomobject]@{ IsValid = $false; LevelId = $levelId; Issues = $issues.ToArray() }
  }

  $assetInfo = @{}
  foreach ($role in @('original', 'comparison')) {
    $asset = $Manifest.assets.$role
    if (-not $asset) {
      $issues.Add("Missing $role asset record.")
      continue
    }
    try {
      $info = Get-LegacyImageInfoFromPath -Root $ManifestDirectory -RelativePath ([string]$asset.path) -DeclaredMime ([string]$asset.mime_type)
      $assetInfo[$role] = $info
      if (-not (Test-LegacyPositiveInteger -Value $asset.width)) {
        $issues.Add("$role declared width must be a positive integer.")
      } elseif ([int]$asset.width -ne $info.Width) { $issues.Add("$role declared width does not match decoded image width.") }
      if (-not (Test-LegacyPositiveInteger -Value $asset.height)) {
        $issues.Add("$role declared height must be a positive integer.")
      } elseif ([int]$asset.height -ne $info.Height) { $issues.Add("$role declared height does not match decoded image height.") }
      if ($asset.file_size_bytes -ne $info.FileSizeBytes) { $issues.Add("$role declared file_size_bytes does not match the local file.") }
      if ([string]$asset.sha256 -cne $info.Sha256) { $issues.Add("$role declared SHA-256 does not match the local file.") }
    } catch {
      $issues.Add("$role image validation failed: $($_.Exception.Message)")
    }
  }

  if ($assetInfo.ContainsKey('original') -and $assetInfo.ContainsKey('comparison')) {
    foreach ($issue in @(Get-LegacyPairDimensionIssues -Original $assetInfo.original -Comparison $assetInfo.comparison)) {
      $issues.Add($issue)
    }
  }

  $spots = @($Manifest.spots)
  foreach ($issue in @(Get-LegacySpotSetIssues -LevelId $levelId -Spots $spots)) { $issues.Add($issue) }
  foreach ($spot in $spots) {
    foreach ($issue in @(Get-LegacyGeometryIssues -Spot $spot)) { $issues.Add($issue) }
    if ([string]::IsNullOrWhiteSpace([string]$spot.answer_description)) {
      $issues.Add("Spot '$($spot.spot_id)' needs a content-owner answer_description.")
    }
    $originalHash = if ($assetInfo.ContainsKey('original')) { $assetInfo.original.Sha256 } else { $null }
    $comparisonHash = if ($assetInfo.ContainsKey('comparison')) { $assetInfo.comparison.Sha256 } else { $null }
    foreach ($issue in @(Get-LegacyAnnotationIssues -Annotation $spot.annotation -SpotId ([string]$spot.spot_id) -Root $ManifestDirectory -OriginalSha256 $originalHash -ComparisonSha256 $comparisonHash)) {
      $issues.Add($issue)
    }
  }

  return [pscustomobject]@{
    IsValid = ($issues.Count -eq 0)
    LevelId = $levelId
    Issues = $issues.ToArray()
  }
}

if ($MyInvocation.InvocationName -ne '.') {
  if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    Write-Output 'Usage: powershell.exe -NoProfile -File scripts/validate-legacy-gameplay-assets.ps1 -ManifestPath <local-manifest.json>'
    exit 2
  }
  try {
    $resolvedManifest = (Resolve-Path -LiteralPath $ManifestPath -ErrorAction Stop).ProviderPath
    $manifest = Get-Content -LiteralPath $resolvedManifest -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    $result = Invoke-LegacyManifestValidation -Manifest $manifest -ManifestDirectory (Split-Path -Parent $resolvedManifest)
  } catch {
    Write-Output "Validation could not run: $($_.Exception.Message)"
    exit 2
  }
  if (-not $result.IsValid) {
    Write-Output "STRUCTURAL VALIDATION FAILED for '$($result.LevelId)':"
    $result.Issues | ForEach-Object { Write-Output "- $_" }
    Write-Output 'This tool cannot determine whether differences are visually correct or whether artwork rights/reviewer authority are valid.'
    exit 1
  }
  Write-Output "STRUCTURAL VALIDATION PASSED for '$($result.LevelId)'. Human visual review and content/legal approval are still required; this tool does not validate answer correctness, licensing, or reviewer authority."
  exit 0
}
