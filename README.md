# Guangya TMDB Renamer

**English** | [简体中文](README_CN.md)

A Tampermonkey userscript for safely renaming TV episode files on `guangyapan.com`. It reads the current season folder, matches files against authoritative TMDB episode metadata, presents a reviewable rename plan, and only then calls the same rename API used by the Guangya web app.

For example, files such as `第一期上` and `第一期下` inside `脱口秀和Ta的朋友们/S03` can become:

```text
脱口秀和Ta的朋友们.S03E01.Episode.Title.mp4
脱口秀和Ta的朋友们.S03E02.Episode.Title.mp4
```

Previews, extras, and bonus clips are considered separately against TMDB season 0. The script does not invent special episode numbers when title, date, or explicit numbering evidence is insufficient.

## Features

- Matches series, seasons, episode numbers, titles, and air dates with TMDB metadata.
- Understands Chinese numerals, issue numbers, upper/middle/lower parts, dates, `Part`, and existing `SxxExx` markers.
- Preserves normalized tags such as `2160p`, `1080p`, `720p`, H.265/HEVC, H.264/AVC, and AV1.
- Previews every rename; medium- and low-confidence matches are unselected by default, and conflicts block execution.
- Includes a searchable manual episode picker, post-rename verification, and reverse recovery for the current session.
- Keeps Guangya authorization data in memory only and stores the TMDB token in isolated userscript storage.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or a compatible userscript manager.
2. Open the [latest userscript release](https://github.com/baofeidyz/guangyapan-tools/releases/latest/download/guangya-tmdb-renamer.user.js) and confirm installation.
3. Open a Guangya file page. The **TMDB 重命名** button appears in the lower-right corner.

To build from source instead, clone this repository, run `npm run build`, and install `dist/guangya-tmdb-renamer.user.js`.

## TMDB setup

Create a Read Access Token (v4 auth) from [TMDB API settings](https://www.themoviedb.org/settings/api), then save it in the userscript panel. The token is never written to the page, build output, or logs.

A `Series Name/S03` directory layout is recommended. The script discovers the folder ID from the URL and season number from `S03`, but still requires you to explicitly select a TMDB search result instead of trusting the first result automatically.

## Usage

1. Open the target `Sxx` directory. If the panel says it is waiting for a page request, refresh the Guangya file list once so the script can observe the required request context.
2. Select the target folder in Guangya. Its name is used as the TMDB query; if nothing is selected, the name inferred from the current path is used. Explicitly select the intended TMDB series.
3. Review each target name, confidence level, evidence, and warning. Search the episode selector with `S03E12`, an episode number, or Chinese/English title text to override a match or mark it unmatched. Arrow keys, Enter, and Escape are supported.
4. Choose full names (including TMDB titles) or compact names, then resolve every blocking conflict.
5. Execute and confirm the count and warnings. The script reloads the directory afterward and verifies the final server-side name by file ID.
6. If only part of a batch succeeds, use the reverse operation available during the current session.

## Matching and safety

- Filenames are Unicode- and separator-normalized before parsing; matching does not depend on one hard-coded filename prefix or suffix.
- Resolution and codec come from filenames first, then from Guangya's read-only file-detail response when needed. File size is never used to guess media properties.
- Multiple versions of one TMDB episode are allowed only when each has a unique resolution/codec combination.
- Explicit `SxxExx`, TMDB titles, air dates, issue parts, and relative order contribute to matching, while gaps in local files or TMDB episodes remain valid.
- Regular seasons and S00 are matched separately. Special content needs TMDB metadata evidence before it can become a high-confidence match.
- Existing `SxxExx` files are skipped by default. Duplicate targets, occupied names, stale source names, and invalid names block execution.
- Swap and cycle renames use unique temporary names. Rename requests default to a concurrency of two; 429/5xx responses receive limited retries, while 401/403 stops work not yet scheduled.
- The file list is refreshed before and after execution. A successful API response with an unexpected final name is reported as inconsistent state.

## Guangya API compatibility

Guangya does not provide a stable public API contract for this project. At `document-start`, the userscript only observes file-list and rename requests made by the official page to `api.guangyapan.com`. It allowlists the required headers and request shape and retains authorization context in memory only.

Currently observed endpoints:

- `POST /userres/v1/file/get_file_list`
- `POST /userres/v1/file/get_file_detail`
- `POST /userres/v1/file/rename`

Legacy `/nd.bizuserres.s/v1/file/...` paths are also supported. An internal Guangya API change can break the adapter, so test with a few recoverable files first. See the redacted [Guangya API contract](docs/guangya-api-contract.md) for details.

## Development

Node.js 20 or newer is required. The project has no third-party runtime dependencies.

```bash
npm test
npm run build
npm run check
```

Tests do not access a real TMDB or Guangya account. Live-page verification should use disposable files and restore their original names afterward.

## Automated builds and releases

GitHub Actions tests and builds the userscript for every push and pull request, then stores the generated script as a workflow artifact. To publish a version:

1. Update the version in both `package.json` and `src/userscript.meta.txt`.
2. Create and push a matching tag, for example:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

The workflow verifies that the tag matches both source versions, creates a GitHub Release, and attaches the installable `guangya-tmdb-renamer.user.js` file.

## Disclaimer

This project is not affiliated with Guangya or TMDB. Renaming changes real cloud files: review the plan and start with a small, recoverable sample.
