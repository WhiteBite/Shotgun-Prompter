# Changelog

All notable changes to the "AI Studio Shotgun Prompter" will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.3] - 2025-05-31
### Changed
- Relocated the "Ignore Rules" textarea and its live tester from the Settings modal to the main modal's left panel for easier access.
- Ignore rules are now saved automatically a short moment after changes are made in the textarea.
- The file list is automatically updated to reflect changes in ignore rules.
### Fixed
- Addressed potential issues with ignore rules not being applied immediately or saved consistently.
- Incremented script version to `0.6.3`.
## [0.6.2] - 2025-05-31
### Fixed
- Ensured that the expansion state of individual folders in the file tree is correctly persisted between sessions when a folder is expanded or collapsed directly by clicking its expander icon. Previously, only "Expand All"/"Collapse All" actions properly saved these states.
### Changed
- Incremented script version to `0.6.2`.
## [0.6.1] - 2025-05-31
### Changed
- Reworked the "Fetch Official Templates" functionality:
  - `prompt_templates.json` (at project root) now acts as a manifest file, listing official templates and their corresponding `.md` filenames.
  - The script first fetches this manifest, then fetches each individual `.md` template file from the `prompt_templates/` directory on GitHub.
- Updated content of `prompt_templates/default_git_diff.md` to include standard git diff instructions.
### Fixed
- Incremented script version to `0.6.1`.
## [0.6.0] - 2025-05-31
### Added
- Created `prompt_templates.json` at the project root. This file will store official prompt templates fetched via the "Fetch Official Templates" button.
### Fixed
- Resolved the JSON parsing error ("Unexpected non-whitespace character after JSON") that occurred when fetching official templates. The error was due to the `prompt_templates.json` file not existing at the target URL, causing the script to attempt to parse a 404 error page.
### Changed
- Incremented script version to `0.6.0`.
## [0.5.9] - 2025-05-31
### Changed
- Major refactoring of the settings modal (`createSettingsModal` function).
  - Divided into multiple smaller functions for each settings section (Ignore Rules, File Handling, Prompt Templates, Import/Export, General) to improve modularity and readability.
  - Event listeners for buttons within the settings modal, particularly in the Prompt Templates section, are now attached using `addEventListener` for robustness.
- Removed specific CSS overrides for `pointer-events` and `cursor` in the template settings section, relying on default behavior after refactoring.
### Fixed
- Aimed to resolve persistent issues with button interactivity in the settings modal through structural code improvements.
## [0.5.8] - 2025-05-31
### Fixed
- Applied `pointer-events: auto !important;` to the settings modal's template editing section and its child elements, including buttons.
- Explicitly set `cursor: pointer !important;` for buttons within the template editing section to ensure the correct cursor appears on hover.
### Changed
- Incremented script version to `0.5.8`.
## [0.5.7] - 2025-05-31
### Fixed
- Attempted to fix unclickable buttons in the settings modal's template section by disabling the `resize` functionality for the settings modal. This is a workaround to test if the browser's resize handle was interfering with click events.
### Changed
- Incremented script version to `0.5.7`.

## [0.5.6] - 2025-05-31
### Fixed
- Corrected regex generation in `isPathIgnored` function to better align with .gitignore pattern matching, especially for patterns without slashes and file-specific patterns.
### Changed
- Incremented script version to `0.5.6`.
- Removed verbose debugging console logs related to button event assignments and update checks.
- Clarified comment for forced update check on modal open.
## [0.5.5] - 2025-05-31
### Fixed
- Added more detailed logging within `createElementWithProps` for `onclick` assignments to diagnose button non-interactivity.

### Changed
- Incremented script version to `0.5.5`.

## [0.5.4] - 2025-05-31
### Fixed
- Addressed `TrustedHTML` error when displaying update notifications by modifying `updateStatus` to avoid direct `innerHTML` assignment for node messages.

### Changed
- Incremented script version to `0.5.4`.
## [0.5.3] - 2025-05-31
### Fixed
- Made `checkForUpdates` more aggressive by default when opening the modal (forceCheck=true) to aid update testing.
- Added a prominent script version log at the very start of execution.
### Changed
- Incremented script version to 0.5.3.
## [0.5.2] - 2025-05-31
### Fixed
- Added extensive logging to template management button handlers (`clearTemplateEditFields`, `handleSaveTemplate`, `handleDeleteTemplate`, `fetchOfficialPromptTemplates`) to diagnose click issues.
- Modified `checkForUpdates` to be more aggressive for testing (temporarily ignoring check interval) and to improve update notification persistence.
### Changed
- Incremented script version to 0.5.2.

## [0.5.1] - 2025-05-31
### Fixed
- Changed event listener attachment for template management buttons in settings (New, Save, Delete, Fetch Official) to use direct `onclick` properties to ensure reliability.

### Changed
- Incremented script version to 0.5.1.
## [0.5.0] - 2025-05-31
### Fixed
- Ensured settings modal buttons (New Template, Save Template, Delete Template, Fetch Official Templates) are correctly interactive by removing potentially confusing commented-out code. (This was the intention, but the issue persisted).
### Changed
- Removed legacy commented-out code and development console logs from template management functions.
### Added
- Version checking mechanism: The script will now check `latest_version.json` on GitHub for updates and notify the user. (Requires GM_xmlhttpRequest)
- `@downloadURL` and `@updateURL` in script metadata for Tampermonkey auto-updates.

## [0.4.8] - YYYY-MM-DD *(Adjust date to your release date)*

### Added
- Initial public release.
- Core functionality: Folder selection, file tree display with include/exclude.
- Ignore rules based on `.gitignore` syntax, with live tester in settings.
- Context generation (file structure + content).
- Prompt templating system (core + custom templates).
- Draggable, resizable modal UI with split panels.
- Settings:
    - Ignore rules management.
    - File handling options (max size, truncation, skip binary).
    - Prompt template management (CRUD).
    - Import/Export all script settings.
    - Reset all settings.
- UI persistence for modal size/position, panel sizes, textarea heights.
- "Copy Context" and "Copy Final Prompt" buttons.
- Status messages and character/token count statistics.
- Minimize modal option.
- Russian localization for some UI elements ("Выбор папки", etc.).

---
*Template for future entries:*
## [Version.Number.Patch] - YYYY-MM-DD
### Added
-
### Changed
-
### Deprecated
-
### Removed
-
### Fixed
-
### Security
-
