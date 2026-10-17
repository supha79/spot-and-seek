# Spot & Seek - Legacy Gameplay Content Specification

Status: Preparation template based only on Local repository evidence. No artwork, coordinates, asset records, rule versions, or database content have been created or approved by this specification. Do not publish a rule version or apply a migration from this document.

## 1. Evidence Boundary

### Confirmed from Local source

- The Legacy level IDs and their `spot_ids`, duration, and default max-hints are defined by `supabase/migrations/20261004010000_phase_2b_game_runs.sql`.
- The same IDs are listed as reserved Legacy keys in `src/services/content.ts` and have display-only title/difficulty metadata in `src/services/adminDashboard.ts`.
- No Legacy artwork or Legacy visual geometry is supplied by that migration. `src/assets/README.md` describes a placeholder folder.
- The Cozy Cat Corner screen reference is mockup-only. It uses external image URLs, uses the same image URL for both displayed roles, and describes one demo target as approximate. It is not approved artwork and does not provide verified answers or coordinates.
- The current Dynamic asset client contract accepts PNG/JPEG/WebP, limits each file to 5 MiB, requires positive decoded pixel dimensions, requires Original and Comparison dimensions to match, and expects private `gameplay-assets` paths. This is evidence for the current Dynamic flow, not approval that Legacy content already satisfies or uses that flow.
- Current Dynamic geometry represents normalized coordinates in `[0,1]`; the gameplay view positions each target by normalized x/y and sizes a circle from `radius_norm` or a rectangle from `width_norm`/`height_norm`. Do not assume `tolerance_norm` expands the UI hit target.

### Requires content-owner/security approval

Artwork and licensing/provenance; exact answer mapping; geometry and tolerances; supported Legacy runtime/catalog implementation; whether these assets may be placed in the private gameplay bucket; reviewer identities; and product-approved score/policy mapping. Blank fields below are intentionally not inferred.

## 2. Per-Level Content Inventory

The spot IDs below are the only answer identifiers evidenced by the Legacy baseline migration. They do not identify a specific visible difference by themselves.

| Level ID | Duration | Max hints | Repository-evidenced Spot IDs | Original / Comparison status |
|---|---:|---:|---|---|
| `cozy-cat-corner` | 120s | 3 (column default) | `window`, `plant`, `teapot` | No approved pair in repository; not verified elsewhere |
| `sunny-picnic` | 120s | 3 (column default) | `umbrella`, `flower`, `basket` | No approved pair in repository; not verified elsewhere |
| `balloon-hills` | 120s | 3 (column default) | `balloon`, `hill`, `kite` | No approved pair in repository; not verified elsewhere |
| `greenhouse-garden` | 90s | 3 (column default) | `window`, `plant`, `lamp`, `bench`, `vase` | No approved pair in repository; not verified elsewhere |
| `bakery-breeze` | 90s | 3 (column default) | `window`, `plant`, `lamp`, `bench`, `vase` | No approved pair in repository; not verified elsewhere |
| `night-train` | 90s | 3 (column default) | `window`, `plant`, `lamp`, `bench`, `vase` | No approved pair in repository; not verified elsewhere |
| `stormy-shelf` | 60s | 3 (column default) | `window`, `plant`, `lamp`, `book`, `frame`, `mug`, `chair` | No approved pair in repository; not verified elsewhere |
| `forest-fable` | 60s | 3 (column default) | `window`, `plant`, `lamp`, `book`, `frame`, `mug`, `chair` | No approved pair in repository; not verified elsewhere |

## 3. Original / Comparison Asset Requirements

Complete one record per level. Do not mark an asset verified until the exact files and review evidence exist.

| Field | Original | Comparison |
|---|---|---|
| Source filename / immutable content reference | TBD | TBD |
| Provenance / rights / license approval reference | TBD | TBD |
| SHA-256 (or approved content hash) | TBD | TBD |
| MIME type (`image/png`, `image/jpeg`, or `image/webp` under current Dynamic client contract) | TBD | TBD |
| File size in bytes (current client maximum 5 MiB) | TBD | TBD |
| Decoded width x height in pixels | TBD | TBD |
| Crop / orientation / color-profile notes | TBD | TBD |
| Content-owner approval and date | TBD | TBD |
| Technical reviewer and date | TBD | TBD |

Requirements and decision points:

- Both files must be the intended matching puzzle pair, show the same composition/crop/orientation, and have exactly matching positive pixel dimensions. The current client checks dimensions and supported MIME/size, but does not define a canonical resolution; Content Owner and QA must approve the actual resolution and aspect ratio for the target devices.
- Compare the exact files, not thumbnails or mockups. Preserve immutable hashes with the review record so annotations and geometry remain tied to the approved bytes.
- The Dynamic uploader uses non-overwriting object paths scoped by level and upload ID and registers the pair after both uploads; registration/publishing behavior is not a substitute for content, rights, or answer review. Do not upload or register Legacy content as part of this specification.
- Record any edit, crop, resampling, or re-export as a new candidate pair and repeat geometry review. Never silently reuse coordinates after the image frame changes.

## 4. Coordinate and Answer-Mapping Convention

The following is the current Dynamic UI convention and a proposed measurement worksheet convention only. Legacy adoption requires explicit approval of a Legacy runtime source/adapter.

- Use the exact approved image frame as the coordinate basis, origin at its top-left; `x_norm = x_px / image_width_px`, `y_norm = y_px / image_height_px`. Runtime places x/y as the target center. Values must be finite and within `[0,1]`.
- Circle targets require a positive normalized radius; rectangle targets require positive normalized width and height. Current geometry types also carry `tolerance_norm`; record it only when the approved Legacy runtime defines how it is used. The current Dynamic visible button size comes from circle radius or rectangle width/height, not from `tolerance_norm`.
- Measure and verify every target against both Original and Comparison at native resolution. A spot is valid only if the corresponding visible difference exists in the pair and the chosen target region unambiguously covers that difference without accidentally including a neighboring answer.
- Record the pixel-space measurement and normalized values, but do not fill them until the final image pair is selected. Keep a separate annotated copy for each image with the exact spot ID, outline/center, and hash in the review record.
- Review the rendered pair at the runtime aspect ratio and representative desktop/mobile sizes. Confirm that scaling/cropping does not shift the normalized target. Re-test if either image or the rendering mode changes.
- Confirm each ID is distinct, is submitted at most once, and maps to the server-supported answer/event ID. Spot labels, level names, filenames, and the mockup's approximate marker are not answer evidence.

## 5. Geometry Worksheet - Fill Only After Artwork Approval

Leave coordinate/shape fields blank until the pair and actual difference are reviewed. Duplicate/extend rows only when the owner approves a separate answer ID; never invent IDs to make counts match.

| Level ID | Repository Spot ID | Visible difference description (owner) | Shape (circle/rectangle) | Center X px | Center Y px | `x_norm` | `y_norm` | Radius px / `radius_norm` OR width x height px / normalized | `tolerance_norm` and runtime meaning | Original / Comparison hashes | Annotation reference | Reviewer / date |
|---|---|---|---|---:|---:|---:|---:|---|---|---|---|---|
| `cozy-cat-corner` | `window` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `cozy-cat-corner` | `plant` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `cozy-cat-corner` | `teapot` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `sunny-picnic` | `umbrella` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `sunny-picnic` | `flower` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `sunny-picnic` | `basket` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `balloon-hills` | `balloon` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `balloon-hills` | `hill` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `balloon-hills` | `kite` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `greenhouse-garden` | `window` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `greenhouse-garden` | `plant` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `greenhouse-garden` | `lamp` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `greenhouse-garden` | `bench` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `greenhouse-garden` | `vase` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `bakery-breeze` | `window` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `bakery-breeze` | `plant` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `bakery-breeze` | `lamp` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `bakery-breeze` | `bench` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `bakery-breeze` | `vase` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `night-train` | `window` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `night-train` | `plant` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `night-train` | `lamp` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `night-train` | `bench` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `night-train` | `vase` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `stormy-shelf` | `window` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `stormy-shelf` | `plant` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `stormy-shelf` | `lamp` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `stormy-shelf` | `book` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `stormy-shelf` | `frame` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `stormy-shelf` | `mug` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `stormy-shelf` | `chair` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `forest-fable` | `window` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `forest-fable` | `plant` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `forest-fable` | `lamp` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `forest-fable` | `book` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `forest-fable` | `frame` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `forest-fable` | `mug` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `forest-fable` | `chair` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## 6. Reviewer Sign-Off Checklist

Per level, the content owner and reviewers must complete and retain:

- [ ] Exact Original and Comparison files are present; filenames, immutable hashes, MIME, file size, decoded dimensions, and aspect ratio are recorded.
- [ ] Content provenance and license/usage permission are approved and referenceable; approval covers both images and the intended distribution/storage method.
- [ ] Every repository-evidenced Spot ID has exactly one reviewed visible answer mapping in the selected pair; no answer has been inferred from its ID or mockup text.
- [ ] Pixel and normalized geometry are independently checked on both images; annotations match the exact hashes; neighboring negative-control regions are checked.
- [ ] Runtime coordinate basis, image scaling/crop, shape and tolerance semantics, and any Legacy adapter are approved by the technical owner. Unknown behavior remains a blocker.
- [ ] Content reviewer name/date: TBD. Independent reviewer name/date: TBD. QA name/date: TBD.
- [ ] Decision: NOT REVIEWED / APPROVED FOR IMPLEMENTATION / REJECTED. Reference/ticket: TBD. Decision date: TBD.

Approval here is content review only. It does not create or publish DB content, approve a score policy, authorize migration, or permit opening the Dynamic Gameplay Gate.

## 7. Local Manifest Validator

Run the Local-only structural validator on Windows PowerShell 5.1 after preparing a per-level JSON manifest:

```powershell
powershell.exe -NoProfile -File scripts/validate-legacy-gameplay-assets.ps1 -ManifestPath <local-manifest.json>
Invoke-Pester -Script scripts/tests/validate-legacy-gameplay-assets.Tests.ps1
```

The manifest is local metadata only. It must list the Original/Comparison relative paths, declared MIME, exact file size/dimensions/SHA-256, and one row per repository Spot ID with geometry, answer description, and an annotation record referencing both image hashes, a reviewer, and review time. The tool enforces the 5 MiB image limit, local file boundaries, image byte signature/decoder readability, equal dimensions, exact spot-ID set, numeric geometry ranges, and annotation references. It reports structural validation only; it cannot confirm visible answer correctness, rights/provenance, or reviewer authority.

The current machine's `System.Drawing` decoder opened PNG locally but could not decode the WebP probe. WebP is allowed by the Dynamic client contract, but this Local validator will fail closed when the installed decoder cannot open it. Use an approved decoder/codec or an allowed locally decodable format; do not treat decoder failure as proof that a file is invalid artwork or transcode without recording a new hash and repeating review. The tool does not upload, register, publish, or write database content.

## 8. Local Blockers

- No Legacy Original/Comparison asset files or measured Legacy geometry are present in the repository.
- No authoritative Legacy catalog/runtime adapter currently connects the baseline `spot_ids` to gameplay hit geometry; the Player Legacy route remains unavailable.
- Art ownership, licensing/provenance, exact answer mapping, dimensions, reviewer approvals, and any external asset existence are unknown.
- Current asset validation belongs to the Dynamic asset flow; a Legacy path/storage contract and any schema/runtime change require separate compatibility review and approval.

Next safe step: content owners provide and approve the actual source artwork; technical/content reviewers fill the asset and geometry worksheets against those exact files; QA reviews the annotated pairs. Do not upload, register, publish, apply migrations, or enable any gameplay gate as part of this preparation.
