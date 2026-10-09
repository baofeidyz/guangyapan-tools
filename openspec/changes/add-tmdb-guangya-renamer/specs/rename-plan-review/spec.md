## ADDED Requirements

### Requirement: Standard target name generation
The system SHALL generate a target filename from the confirmed TMDB series title, two-digit season and episode numbers, an optional TMDB episode title, and the unchanged original extension, while removing characters unsafe for a cloud filename.

#### Scenario: Full naming mode is selected
- **WHEN** series `脱口秀和Ta的朋友们`, season 3 episode 1, title `朋友初见面`, and extension `.mp4` are confirmed
- **THEN** the system SHALL generate `脱口秀和Ta的朋友们.S03E01.朋友初见面.mp4` after filename sanitization

#### Scenario: Compact naming mode is selected
- **WHEN** the same episode is confirmed and the user selects compact mode
- **THEN** the system SHALL generate `脱口秀和Ta的朋友们.S03E01.mp4`

#### Scenario: Existing standard name is encountered
- **WHEN** a file already contains a valid `SxxExx` identifier
- **THEN** the system SHALL exclude it from execution by default while allowing the user to explicitly request rematching

### Requirement: Explainable preview
The system MUST display every local file in a preview before execution with its original name, proposed target name, TMDB episode, confidence level, matching evidence, warnings, and selection state.

#### Scenario: High-confidence match is generated
- **WHEN** a match has no conflict and meets the high-confidence threshold
- **THEN** the preview SHALL select it by default and SHALL show the signals that produced the match

#### Scenario: Match is medium, low, or ambiguous
- **WHEN** a result is below the high-confidence threshold or has competing candidates
- **THEN** the preview SHALL leave it unselected by default and SHALL identify the ambiguity

### Requirement: Manual correction before execution
The system SHALL allow the user to change or clear the proposed season and episode assignment and SHALL recompute the target filename and validation state before submission.

#### Scenario: User assigns a different TMDB episode
- **WHEN** the user selects another episode from the loaded TMDB season
- **THEN** the plan SHALL use that episode's exact season and episode numbers, update the target name, and mark the assignment as manually confirmed

#### Scenario: User clears an assignment
- **WHEN** the user clears a proposed episode
- **THEN** the item SHALL become unselected and SHALL not be sent to the rename executor

### Requirement: Plan validation and conflict blocking
The system MUST validate the complete selected plan for duplicate targets, occupied target names, stale source names, missing identifiers, unsafe names, and multiple files assigned to one TMDB episode.

#### Scenario: Two selected files have the same target
- **WHEN** validation finds duplicate target filenames
- **THEN** execution SHALL be blocked until the conflict is resolved or one item is unselected

#### Scenario: A non-participating file already owns the target name
- **WHEN** the current directory contains the target name on a file outside the selected plan
- **THEN** execution SHALL be blocked for that item and the existing filename SHALL be shown

### Requirement: Explicit execution confirmation
The system MUST require a final confirmation that states the number of selected files and any remaining non-blocking warnings before invoking a cloud rename API.

#### Scenario: User cancels confirmation
- **WHEN** the user cancels the final confirmation
- **THEN** no rename request SHALL be sent
