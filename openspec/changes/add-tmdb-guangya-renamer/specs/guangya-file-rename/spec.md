## ADDED Requirements

### Requirement: Page-context authentication discovery
The userscript SHALL reuse the authenticated Guangya page context by observing necessary request headers and request shapes for `api.guangyapan.com`, SHALL keep sensitive Guangya credentials in memory only, and SHALL never write them to source, logs, URLs, or persistent userscript configuration.

#### Scenario: Authenticated Guangya requests are observed
- **WHEN** the page sends an authenticated directory-list or rename request
- **THEN** the adapter SHALL retain only the in-memory headers and structural context needed for its own API calls

#### Scenario: Authentication context is unavailable
- **WHEN** the userscript has not observed valid Guangya authorization and device context
- **THEN** directory loading and rename execution SHALL remain blocked with guidance to refresh or interact with the logged-in page

### Requirement: Current directory loading
The system SHALL use `POST https://api.guangyapan.com/userres/v1/file/get_file_list` to retrieve the current directory and SHALL normalize the response into stable file records containing at least file identity, parent identity, name, type, size, and modification metadata when available.

#### Scenario: Folder contains more than one page
- **WHEN** the API indicates additional file-list pages
- **THEN** the adapter SHALL retrieve all pages needed for a complete rename plan rather than matching only the visible virtualized rows

#### Scenario: Page route changes to another folder
- **WHEN** the Guangya single-page application changes the current folder route
- **THEN** the system SHALL invalidate the previous directory plan and SHALL load the new parent context before allowing execution

### Requirement: Preconditioned rename execution
Immediately before writing, the system MUST reload the directory and verify that every selected source still has the planned `fileId` and original name, then SHALL invoke `POST https://api.guangyapan.com/userres/v1/file/rename` only for valid items.

#### Scenario: Source name changed after preview
- **WHEN** the current file name no longer equals the plan's original name
- **THEN** the system SHALL mark that item stale and SHALL NOT send its rename request

#### Scenario: Item already has the target name
- **WHEN** the same file identity already has the planned target name
- **THEN** the system SHALL mark the item successful without sending a duplicate rename request

### Requirement: Safe handling of rename dependencies
The executor SHALL detect target names occupied by source files in the same selected plan and SHALL use unique temporary names before final names when required to avoid transient collisions.

#### Scenario: Two files exchange names
- **WHEN** file A targets file B's current name and file B targets file A's current name
- **THEN** the executor SHALL rename both through collision-free temporary names before applying final names

#### Scenario: Temporary phase fails
- **WHEN** any temporary rename fails
- **THEN** the executor SHALL stop dependent final renames, report the exact state, and provide a recovery plan instead of assuming rollback succeeded

### Requirement: Controlled retries and authentication failure handling
The executor SHALL limit concurrent rename requests, SHALL retry only rate-limit and transient server failures with bounded backoff, and SHALL stop the batch on authentication or authorization failures.

#### Scenario: API returns rate limiting
- **WHEN** a rename returns HTTP 429
- **THEN** the executor SHALL wait using bounded backoff and retry up to the configured limit while displaying retry status

#### Scenario: API returns unauthorized or forbidden
- **WHEN** a rename returns HTTP 401 or 403
- **THEN** the executor SHALL stop sending new rename requests and SHALL request refreshed page authorization

#### Scenario: One item has a business conflict
- **WHEN** the API rejects one item because of a naming conflict or validation error
- **THEN** the executor SHALL mark that item failed and SHALL continue only independent items

### Requirement: Per-item result verification and recovery record
After execution, the system MUST reload the directory, compare server-side names with the plan, report verified success, failure, or mismatch for every selected item, and keep an in-session recovery plan containing successful old-to-new mappings.

#### Scenario: API acknowledged but final name is absent
- **WHEN** the rename API returned success but the reloaded directory does not contain the expected name for that file identity
- **THEN** the system SHALL report a verification mismatch rather than success

#### Scenario: User requests recovery in the same session
- **WHEN** verified successful renames exist and the user requests recovery
- **THEN** the system SHALL create a reverse plan, validate it against current server state, and require confirmation before sending reverse rename requests
