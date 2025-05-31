# Changelog

All notable changes to the "AI Studio Shotgun Prompter" will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2025-05-31
### Added
- Experimental support for File System Access API:
  - New "Select Folder (API)" button to use `window.showDirectoryPicker()`.
  - Recursive reading of directory contents via the API.
  - Automatic loading of `.gitignore` from the root of the directory selected via API.
  - "Refresh List (API)" button to re-scan the directory if changes were made externally.
### Changed
- Corrected a `ReferenceError` in `renderTreeRecursiveDOM` that occurred when "Apply Ignore Rules" was active, due to attempting to access `checkbox.id` when the checkbox was not created.
- Improved `.gitignore` pattern matching in `isPathIgnored` for patterns ending with `/` and patterns without slashes (e.g., `.git` vs `.git/`).
- Implemented loading of rules from a `.gitignore` file found in the root of the selected folder. These rules are combined with manually entered rules.
- Ignored files/folders are now hidden from the file tree view when "Apply Ignore Rules" is active, instead of being struck out. Individual selection checkboxes are also hidden in this mode.
- Removed the "Test Path" input and result display from the Ignore Rules section on the main panel.
- Updated the label for the ignore rules checkbox to "Apply Ignore Rules (.gitignore & manual)" for clarity.
- Added `flex-shrink: 0` to the "Use .gitignore rules" checkbox container to prevent it from being hidden on smaller panel widths.
### Fixed
- Incremented script version to `0.7.0`.

## [0.6.9] - 2025-05-31
### Added
- Added a checkbox "Use .gitignore rules" to enable/disable the application of ignore rules. When disabled, the ignore rules textarea and path tester are also disabled.
- Implemented a dedicated error display area on the main modal for file read errors. Errors during context generation (e.g., file changed during read) will now appear here instead of being embedded in the generated context.
### Changed
- Incremented script version to `0.6.9`.


## [0.6.8] - 2025-05-31
### Fixed
- Ensured that ignore patterns are checked against paths truly relative to the selected project root. This corrects an issue where patterns like `.git/` or `node_modules/` might not work if the selected path included the project's root folder name (e.g., `ProjectName/.git/` vs. pattern `.git/`).
- Improved error message detail when a file reading operation fails (e.g., if a file is modified during reading), providing more specific error information instead of just "ProgressEvent".
### Changed
- Incremented script version to `0.6.8`.

## [0.6.7] - 2025-05-31
### Fixed
- Corrected .gitignore pattern matching for rules without slashes (e.g., `.git`, `build`, `*.log`). Ensures that such patterns correctly match files or directories (including their contents) anywhere in the tree, aligning more closely with standard .gitignore behavior. This specifically addresses issues where directory names containing dots (like `.git` or `.idea`) were not being ignored as directories.
### Changed
- Incremented script version to `0.6.7`.

## [0.6.6] - 2025-05-31
### Fixed
- Further refined regex construction in `isPathIgnored` for more accurate .gitignore pattern matching, ensuring correct anchoring for various pattern types (root-anchored, directory-specific, file-specific, and global).
- Corrected escaping of special characters in `patternToRegexString` to prevent misinterpretation of regex metacharacters within ignore patterns.
### Changed
- Incremented script version to `0.6.6`.

## [0.6.5] - 2025-05-31
### Fixed
- Corrected an issue in `patternToRegexString` where `?` was replaced with `.` instead of `[^/]`, improving .gitignore compatibility for single-character wildcards.
- Refined regex construction in `isPathIgnored` to better handle various .gitignore pattern types (anchored, directory, file, glob-like).
### Changed
- Incremented script version to `0.6.5`.

## [0.6.4] - 2025-05-31
### Changed
- Improved styling for the "Ignore Rules" section (textarea and live tester) on the main modal's left panel for better visual integration and usability.
- Incremented script version to `0.6.4`.

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
- Added more detailed logging within `createElementWithProps`

## [0.9.3] - 2025-05-31
### Fixed
- Resolved a "TrustedHTML" error when clearing the file read error display by changing how child nodes are removed. This was an issue when using the File System Access API on sites with strict CSP.
- Corrected logic for enabling/disabling the "Generate Context" button and visibility of "Select All"/"Deselect All" buttons when using File System Access API and ignore rules.
### Changed
- Incremented script version to `0.9.3`.

## [0.9.4] - 2025-05-31
### Fixed
- Restored functionality for the standard folder selection method.
- Ensured that file selection checkboxes are correctly displayed or hidden in the tree view based on whether "Apply Ignore Rules" is active.
### Changed
- Incremented script version to `0.9.4`.

## [0.9.5] - 2025-05-31
### Fixed
- Corrected an issue where standard folder selection ("Выбор папки (стандарт)") would not populate the file tree. This was due to an incorrect event handler assignment.
- Resolved a bug in the file tree rendering that prevented file/folder selection checkboxes from appearing or functioning correctly when "Apply Ignore Rules" was disabled. This was caused by a variable scoping issue.
- Unified script versioning by ensuring the internal `SCRIPT_VERSION` constant primarily relies on `GM_info.script.version` (derived from the `@version` metadata tag) and uses the same version string as a fallback, eliminating discrepancies.
### Changed
- Incremented script version to `0.9.5`.
