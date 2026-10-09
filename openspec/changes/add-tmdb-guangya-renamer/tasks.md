## 1. Project Foundation

- [x] 1.1 Initialize the JavaScript package, source/test directories, lint-free build scripts, and Node built-in test runner configuration.
- [x] 1.2 Add a userscript metadata header and build pipeline that produces one installable `dist/guangya-tmdb-renamer.user.js` with narrowly scoped `@match`, `@connect`, storage, and request permissions.
- [x] 1.3 Add shared domain types/JSDoc contracts for parsed files, TMDB series and episodes, match candidates, rename-plan items, Guangya file records, and execution results.

## 2. Filename Parsing

- [x] 2.1 Implement Unicode normalization, basename/extension splitting, delimiter normalization, and preservation of original text.
- [x] 2.2 Implement Chinese-number conversion and extraction of dates, explicit `SxxExx`, issue/episode ordinals, upper/middle/lower and Part segments without treating dates or resolution tags as episode numbers.
- [x] 2.3 Implement special-content classification, release-tag detection, remaining-title tokenization, and ambiguity warnings.
- [x] 2.4 Add parser tests covering the live Guangya S03 samples, Chinese ordinals, mixed brackets/separators, release noise, unknown text, specials, existing standard names, and false numeric signals.

## 3. TMDB Integration and Matching

- [x] 3.1 Implement isolated TMDB credential storage and a `GM_xmlhttpRequest` client with redacted errors, TV search, season details, language fallback, and normalized response validation.
- [x] 3.2 Implement series-candidate mapping and require explicit user selection before caching a folder-to-series association.
- [x] 3.3 Implement regular-season and season-zero loading while preserving TMDB episode identifiers, numbers, titles, dates, and source links.
- [x] 3.4 Implement candidate scoring from explicit identifiers, title tokens, air dates, issue/segment order, special classification, and relative order.
- [x] 3.5 Implement monotonic dynamic-programming alignment with local-file and TMDB-episode gaps, separate regular/S00 domains, confidence bands, evidence, and conflict reporting.
- [x] 3.6 Add matching tests for split issues, missing intermediate files, title/date matches, explicit-identifier conflicts, verified specials, and unmatched specials that must not receive synthetic numbering.

## 4. Rename Planning

- [x] 4.1 Implement full and compact TMDB filename generation, two-digit season/episode formatting, extension preservation, and unsafe cloud-filename sanitization.
- [x] 4.2 Implement rename-plan construction with default selection policy, evidence, confidence, warnings, and default skipping of existing `SxxExx` names.
- [x] 4.3 Implement manual episode reassignment/clearing and deterministic target-name recomputation.
- [x] 4.4 Implement plan validation for duplicate targets, occupied names, stale/missing identities, unsafe names, and repeated assignment of one TMDB episode.
- [x] 4.5 Add plan tests covering both naming modes, manual correction, collisions, occupied names, invalid names, and existing-standard-name behavior.

## 5. Guangya API Adapter

- [x] 5.1 Capture and redact a real official `get_file_list` and `rename` request, document the minimum required headers/body fields as fixtures, and ensure the probe file is restored to its original name.
- [x] 5.2 Implement a document-start page bridge that observes only Guangya API fetch/XHR requests, sends necessary request context to the userscript through a validated channel, and keeps sensitive values in memory only.
- [x] 5.3 Implement paginated current-directory loading through `POST /userres/v1/file/get_file_list`, response validation, stable file normalization, and route-change invalidation.
- [x] 5.4 Implement `POST /userres/v1/file/rename` using the captured contract, with precondition checks, bounded concurrency, bounded retry/backoff for 429/5xx, batch stop on 401/403, and per-item business-error reporting.
- [x] 5.5 Implement rename-dependency detection, unique temporary-name staging for swaps/cycles, explicit partial-state reporting, and reverse recovery-plan generation.
- [x] 5.6 Implement post-execution directory reload and file-ID-based verification that distinguishes verified success, API failure, and server-state mismatch.
- [x] 5.7 Add adapter/executor tests with mocked API responses for pagination, stale sources, idempotent targets, swaps, temporary-stage failure, retry, authorization stop, partial failure, verification mismatch, and recovery validation.

## 6. Tampermonkey User Interface

- [x] 6.1 Add a non-invasive Guangya-page launcher and panel with current-folder detection, authorization readiness, and TMDB credential settings.
- [x] 6.2 Implement series search and explicit candidate selection UI with title, original title, year, country, poster, and TMDB link.
- [x] 6.3 Implement season loading and a preview table showing original/target names, episode, confidence, evidence, warnings, selection state, and manual episode controls.
- [x] 6.4 Implement naming-mode controls, validation summaries, blocking-error display, and final confirmation that states selected count and remaining warnings.
- [x] 6.5 Implement execution progress, retry/stop status, per-item verified results, session recovery action, and route-change plan invalidation.
- [x] 6.6 Add DOM-level UI tests for missing credentials/auth context, candidate confirmation, low-confidence defaults, manual correction, blocked conflicts, cancellation, progress, and result rendering.

## 7. Build and Runtime Verification

- [x] 7.1 Run all unit and DOM tests, build the userscript, inspect the generated metadata/header, and verify the distributable contains no Guangya or TMDB credentials.
- [ ] 7.2 Install the built userscript in the connected browser and verify read-only behavior on the live `脱口秀和Ta的朋友们/S03` folder, including complete directory loading and TMDB-backed preview without executing the proposed batch.
- [ ] 7.3 Create or select an isolated disposable Guangya test file, verify one rename and reverse rename through the userscript, and confirm final server state matches the original name.
- [x] 7.4 Run OpenSpec validation, review the final diff for scope and secrets, and document installation, TMDB token setup, supported behavior, safety model, and known API fragility in the README.
