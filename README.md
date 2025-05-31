# AI Studio Shotgun Prompter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-0.4.8-blue)

A Tampermonkey UserScript to help formulate complex prompts for AI Studio (e.g., Google's Gemini) by using local project files as context. Inspired by the "shotgun surgery" concept in coding, this script allows you to quickly gather relevant code and project structure to feed to the AI.

## Features

*   **Local Folder Selection:** Pick a project folder directly from your filesystem.
*   **File Filtering & Exclusion:**
    *   Uses `.gitignore`-like syntax for ignoring files/folders (e.g., `node_modules/`, `*.log`).
    *   Interactive file tree to manually include/exclude specific files and folders.
    *   Expand/collapse all, select/deselect all controls for the file tree.
*   **Context Generation:**
    *   Generates a project file structure overview.
    *   Concatenates the content of selected files, each wrapped in `<file path="..."></file>` tags.
    *   Handles large files (skip or truncate by characters/lines).
    *   Option to skip binary files.
*   **Prompt Templating:**
    *   Uses a base template structure: `CURRENT_DATE`, `USER_TASK`, `PROMPT_RULES_CONTENT`, `GENERATED_CONTEXT`.
    *   Comes with a default "Git Diff" template.
    *   Manage custom prompt templates (create, edit, delete).
*   **Interactive UI:**
    *   Draggable and resizable modal window.
    *   Resizable panels (left for file/context, right for task/prompt).
    *   Minimize modal option.
    *   Status messages and character/token count statistics.
*   **Settings Management:**
    *   Customize ignore rules with a live tester.
    *   Configure file handling (max size, truncation).
    *   Manage prompt templates.
    *   Import/Export all script settings.
    *   Reset all settings to default.
*   **Convenience:**
    *   "Copy Context" and "Copy Final Prompt" buttons.
    *   Remembers last selected folder name, modal position/size, and UI element sizes.

## Installation

1.  **Install a UserScript Manager:**
    You need a browser extension that can manage userscripts. [Tampermonkey](https://www.tampermonkey.net/) is recommended (available for Chrome, Firefox, Edge, Safari, Opera).
2.  **Install the Script:**
    Click the following link to install the script:
    [Install AI Studio Shotgun Prompter](https://github.com/WhiteBite/Shotgun-Prompter/raw/main/shotgun-prompter.user.js)
    Your userscript manager should automatically detect the `.user.js` file and prompt you for installation.

## Usage

1.  Navigate to [AI Studio](https://aistudio.google.com/).
2.  A "Shotgun Prompter" button will appear at the bottom-left of the page. Click it to open the main modal.
3.  **Select Folder:** Click "Выбор папки" (Select Folder) and choose your project directory.
4.  **Review Files:**
    *   The file tree will show your project structure.
    *   Files/folders matching ignore rules will be un-checked and greyed out.
    *   Manually check/uncheck files or folders to include/exclude them from the context.
    *   Use "Разв. все" (Expand All), "Сверн. все" (Collapse All), "Выбр. все" (Select All), "Снять все" (Deselect All) for easier navigation.
5.  **Generate Context:** Click "Generate Context". The script will read the selected files and create:
    *   A file structure overview.
    *   The combined content of the files.
    This will appear in the "Generated Context" textarea.
6.  **Compose Prompt:**
    *   In the "Your Task for AI" textarea, describe what you want the AI to do with the provided context.
    *   Select a "Prompt Template" from the dropdown. The default helps with generating git diffs.
7.  **Final Prompt:** The "Final Prompt" textarea will automatically update with your task, the selected template's rules, and the generated context.
8.  **Copy & Use:** Click "Copy Final Prompt" and paste it into AI Studio.

### Settings (⚙️ Icon)

*   **Ignore Rules:** Modify the `.gitignore`-style patterns. Test paths to see if they'd be ignored.
*   **File Handling:** Set maximum file size, and what to do if a file exceeds it (skip, truncate). Option to skip binary files.
*   **Prompt Templates:**
    *   View existing templates.
    *   Click "New Template" to create your own.
    *   Select a template to edit its name and content (core templates cannot be modified/deleted, but you can save them as a new one).
    *   Save or delete custom templates.
*   **Import/Export Settings:** Save your current script settings to a JSON file or load them from one.
*   **Reset All Prompter Settings:** Reverts all configurations to their defaults.

## Screenshots

*(Placeholder: Add screenshots of the modal, file tree, settings panel, etc.)*
*   Main Modal Interface
*   File Selection and Tree View
*   Settings Panel - Ignore Rules
*   Settings Panel - Prompt Templates

## Future Plans / Roadmap

*   Implement automatic version checking with notifications for updates.
*   Include more pre-defined prompt templates for common tasks.
*   Refine UI/UX based on feedback.
*   Option to load prompt templates from external files within the `prompt_templates` directory.

## Known Issues

*   File selection relies on browser capabilities (`webkitdirectory`). If a browser doesn't fully support it, relative paths might be lost for single file selections.
*   Token count is an approximation (chars/3.5). Actual tokenization depends on the specific AI model.

## Contributing

Contributions, issues, and feature requests are welcome! Please feel free to check [issues page](https://github.com/WhiteBite/Shotgun-Prompter/issues).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.