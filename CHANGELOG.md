# Changelog

All notable changes to the "AI Studio Shotgun Prompter" will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - YYYY-MM-DD

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