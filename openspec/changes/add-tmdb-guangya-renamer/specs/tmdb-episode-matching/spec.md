## ADDED Requirements

### Requirement: TMDB credentials and series selection
The userscript SHALL store the user-supplied TMDB credential in Tampermonkey isolated storage, SHALL use it only for requests to `api.themoviedb.org`, and SHALL require explicit series selection before episode matching.

#### Scenario: Search returns similarly named series
- **WHEN** the user searches a folder title and TMDB returns multiple TV series
- **THEN** the system SHALL show identifying metadata including translated name, original name, first-air year, origin country, and poster, and SHALL wait for the user to select one result

#### Scenario: TMDB credential is missing or rejected
- **WHEN** no TMDB credential is configured or TMDB responds with an authorization error
- **THEN** the system SHALL block metadata matching and SHALL present an actionable credential error without exposing a credential value

### Requirement: Season metadata is authoritative
The system SHALL obtain the selected regular season and season zero from TMDB Season Details and SHALL use returned `season_number` and `episode_number` values as the only automatically assignable standard episode identifiers.

#### Scenario: Regular and special seasons are available
- **WHEN** the selected series has the requested regular season and season zero in TMDB
- **THEN** the system SHALL load both episode collections and keep them as separate matching domains

#### Scenario: TMDB does not contain a local item
- **WHEN** no episode in the applicable TMDB season can be matched to a local file
- **THEN** the system SHALL mark the file as unmatched and SHALL NOT synthesize an episode number for it

### Requirement: Noise-tolerant filename feature extraction
The system SHALL normalize Unicode and extract independent semantic features from any position in a filename, including standard season/episode tokens, dates, Chinese and Arabic issue numbers, upper/middle/lower or Part segments, special-content terms, release tags, remaining title tokens, and the extension.

#### Scenario: Filename contains mixed noise
- **WHEN** a file is named `2026.08.28-第10期上[1080P WEB-DL].mp4`
- **THEN** the parser SHALL retain `.mp4`, identify issue 10 and upper segment, recognize the date and release tags as separate signals, and SHALL NOT interpret 2026, 1080, or the date components as an episode number

#### Scenario: Unknown text surrounds known signals
- **WHEN** a filename contains unrecognized prefixes or suffixes around a recognizable issue and segment
- **THEN** the parser SHALL preserve the original text for review while still emitting the recognizable features and any ambiguity warnings

#### Scenario: Chinese issue number is used
- **WHEN** a filename contains a supported Chinese ordinal such as `第十一期下`
- **THEN** the parser SHALL emit issue number 11 and the lower segment ordering signal

### Requirement: Directory-wide monotonic episode alignment
The system SHALL match the whole directory as an ordered sequence and SHALL score candidates using explicit identifiers, normalized title similarity, air date, issue/segment order, special-content classification, and relative file order.

#### Scenario: Split issues map to consecutive TMDB episodes
- **WHEN** ordered local files are `第一期上`, `第一期下`, `第二期上`, and `第二期下`, and the selected TMDB season contains the corresponding four ordered episodes
- **THEN** the system SHALL propose the four TMDB episodes in order rather than assigning both parts the same episode number

#### Scenario: An intermediate local file is missing
- **WHEN** evidence indicates a missing local part between two matched files
- **THEN** the alignment SHALL be able to skip the corresponding TMDB episode and SHALL NOT automatically compress all later files into earlier episode numbers

#### Scenario: Explicit standard identifier conflicts with sequence
- **WHEN** a filename contains an explicit `SxxExx` that conflicts with the best sequence alignment
- **THEN** the system SHALL report the conflict and SHALL require manual confirmation instead of silently replacing either interpretation

### Requirement: Special content uses verified season-zero entries
The system SHALL treat terms such as pilot, preview, behind-the-scenes, extra, unaired, and special as evidence for season zero while requiring a match to an actual TMDB season-zero episode before automatically assigning `S00Exx`.

#### Scenario: Local special matches a TMDB special
- **WHEN** a local file title or date matches a TMDB season-zero episode
- **THEN** the system SHALL propose the exact TMDB `S00Exx` identifier and include the matching evidence

#### Scenario: Several local specials do not match TMDB
- **WHEN** local special files cannot be aligned with TMDB season-zero entries
- **THEN** the system SHALL leave them unmatched and SHALL NOT number them consecutively merely from local list order
