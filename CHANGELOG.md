# Changelog

All notable changes to the "AI Studio Shotgun Prompter" will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
