// ==UserScript==
// @name         AI Studio Shotgun Prompter
// @namespace    http://tampermonkey.net/
// @version      0.9.9
// @description  Formulate prompts for AI Studio. Fixes checkbox tree logic and prompt template display.
// @author       Your Name (based on Shotgun Code concept)
// @match        https://aistudio.google.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @connect      raw.githubusercontent.com
// @downloadURL  https://github.com/WhiteBite/Shotgun-Prompter/raw/main/shotgun-prompter.user.js
// @updateURL  https://github.com/WhiteBite/Shotgun-Prompter/raw/main/shotgun-prompter.user.js
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_VERSION = GM_info.script.version;
  const GITHUB_RAW_CONTENT_URL = "https://raw.githubusercontent.com/WhiteBite/Shotgun-Prompter/main/";
  const VERSION_CHECK_URL = GITHUB_RAW_CONTENT_URL + "latest_version.json";
  const SCRIPT_PREFIX = 'shotgun_prompter_';
  const OFFICIAL_PROMPT_TEMPLATES_URL = GITHUB_RAW_CONTENT_URL
      + "prompt_templates.json";
  const LAST_VERSION_CHECK_KEY = SCRIPT_PREFIX + 'last_version_check_timestamp';
  const CHECK_VERSION_INTERVAL = 24 * 60 * 60 * 1000;
  const LATEST_REMOTE_VERSION_DATA_KEY = SCRIPT_PREFIX
      + 'latest_remote_version_data';

  const CUSTOM_PROMPT_TEMPLATES_KEY = SCRIPT_PREFIX + 'prompt_templates';
  const CUSTOM_IGNORE_RULES_KEY = SCRIPT_PREFIX + 'custom_ignore_rules';
  const LAST_FOLDER_NAME_KEY = SCRIPT_PREFIX + 'last_folder_name';
  const SELECTED_PROMPT_TEMPLATE_ID_KEY = SCRIPT_PREFIX
      + 'selected_prompt_template_id';

  const AUTO_UPDATE_CONTEXT_API_KEY = SCRIPT_PREFIX + 'auto_update_context_api';
  const AUTO_UPDATE_INTERVAL_KEY = SCRIPT_PREFIX + 'auto_update_interval';
  const MODAL_POSITION_KEY = SCRIPT_PREFIX + 'modal_position';
  const MODAL_SIZE_KEY = SCRIPT_PREFIX + 'modal_size';
  const TA_IGNORE_RULES_HEIGHT_KEY = SCRIPT_PREFIX + 'ta_ignore_height';
  const TA_CONTEXT_HEIGHT_KEY = SCRIPT_PREFIX + 'ta_context_height';
  const TA_USER_TASK_HEIGHT_KEY = SCRIPT_PREFIX + 'ta_user_task_height';
  const TA_FINAL_PROMPT_HEIGHT_KEY = SCRIPT_PREFIX + 'ta_final_prompt_height';
  const FILE_LIST_HEIGHT_KEY = SCRIPT_PREFIX + 'file_list_height';
  const TA_LOADED_GITIGNORE_HEIGHT_KEY = SCRIPT_PREFIX
      + 'ta_loaded_gitignore_height';
  const TA_SETTINGS_IGNORE_RULES_HEIGHT_KEY = SCRIPT_PREFIX
      + 'ta_settings_ignore_height';

  const FONT_SIZE_KEY = SCRIPT_PREFIX + 'font_size';
  const DEFAULT_FONT_SIZE = '14px';
  const CURRENT_LANG_KEY = SCRIPT_PREFIX + 'current_lang';
  const AUTO_NOTIFY_ON_COMPLETE_KEY = SCRIPT_PREFIX + 'auto_notify_on_complete';
  const NOTIFICATION_SOUND_KEY = SCRIPT_PREFIX + 'notification_sound';
  const SETTINGS_MODAL_SIZE_KEY = SCRIPT_PREFIX + 'settings_modal_size';
  const PANEL_LEFT_FLEX_BASIS_KEY = SCRIPT_PREFIX + 'panel_left_flex_basis';

  const MAX_FILE_SIZE_KB_KEY = SCRIPT_PREFIX + 'max_file_size_kb';
  const FILE_SIZE_ACTION_KEY = SCRIPT_PREFIX + 'file_size_action';
  const TRUNCATE_VALUE_KEY = SCRIPT_PREFIX + 'truncate_value';
  const SKIP_BINARY_FILES_KEY = SCRIPT_PREFIX + 'skip_binary_files';

  const USE_GITIGNORE_RULES_KEY = SCRIPT_PREFIX + 'use_gitignore_rules';
  const FOLDER_EXPANSION_STATE_KEY = SCRIPT_PREFIX + 'folder_expansion_state';
  const AUTO_LOAD_GITIGNORE_KEY = SCRIPT_PREFIX + 'auto_load_gitignore';
  const PROMPT_HISTORY_KEY = SCRIPT_PREFIX + 'prompt_history';
  const MAX_PROMPT_HISTORY_SIZE = 20;
  const FILE_SEARCH_MODE_KEY = SCRIPT_PREFIX + 'file_search_mode';
  const FILE_TYPE_FILTER_KEY = SCRIPT_PREFIX + 'file_type_filter';

  const MAX_TOKENS_FOR_AUTO_GENERATE = 1050000;
  const BYTES_PER_TOKEN_ESTIMATE = 4;
  const MAX_TOTAL_SIZE_BYTES_FOR_AUTO_GENERATE = MAX_TOKENS_FOR_AUTO_GENERATE
      * BYTES_PER_TOKEN_ESTIMATE;
  const DEFAULT_PROMPT_TEMPLATE_CONTENT = `Your primary goal is to generate a git diff.
Follow the user's instructions carefully.
Output ONLY the git diff, no explanations, no apologies, no extra text.
Ensure the diff is in the standard git format.
If you need to create a new file, use /dev/null as the source for the diff.
If you need to delete a file, use /dev/null as the destination for the diff.
Pay attention to the file paths provided in the context.`;

  const DEFAULT_PROMPT_TEMPLATES = [
    {
      id: 'default_git_diff_template',
      name: 'Default Git Diff',
      content: DEFAULT_PROMPT_TEMPLATE_CONTENT,
      isCore: true
    }
  ];
  const DEFAULT_IGNORE_RULES = `# Enter patterns one per line.\n# Examples:\n# node_modules/  (ignore 'node_modules' directory in any subdir)\n# /build/        (ignore 'build' directory only at the root)\n# *.log          (ignore all files ending with .log)\n# !important.log (do NOT ignore important.log)`;
  const PROMPT_TEMPLATE_BASE = `CURRENT_DATE: 2025-05-31\n\nTASK:\n{USER_TASK}\n\nRULES:\n{PROMPT_RULES_CONTENT}\n\nPROJECT_CONTEXT:\n{GENERATED_CONTEXT}\n`;

  let projectFiles = [];
  let generatedContext = '';
  let promptTemplates = GM_getValue(CUSTOM_PROMPT_TEMPLATES_KEY,
      JSON.parse(JSON.stringify(DEFAULT_PROMPT_TEMPLATES)));
  let selectedPromptTemplateId = GM_getValue(SELECTED_PROMPT_TEMPLATE_ID_KEY,
      promptTemplates.length > 0 ? promptTemplates[0].id : null);

  let isModalMinimized = false;
  let lastSelectedFolderName = GM_getValue(LAST_FOLDER_NAME_KEY, "");

  let modal, fileInput, fileApiInputBtn, refreshApiFolderBtn, selectAllFilesBtn,
      deselectAllFilesBtn, fileListDiv, generateContextBtn, contextTextarea,
      userTaskTextarea, finalPromptTextarea, promptTemplateSelect,
      statusDiv, versionStatusDiv,
      minimizeBtn, modalHeaderTitle, statsDiv, contextStatsDiv, promptStatsDiv,
      folderInputLabel, settingsBtn, settingsModal, fileReadErrorsDiv,
      useGitignoreCheckbox, ignoreRulesControlsContainer,
      leftPanelElement, rightPanelElement, panelResizerElement,
      currentDirectoryHandle = null,
      apiFolderSelected = false, fileSearchInput,
      settingsAutoLoadGitignoreCheckbox, loadedGitignoreDisplayArea,
      settingsIgnoreRulesTextarea, ignoreRulesColumnsContainer, insertPromptBtn,
      autoUpdateContextCheckbox, settingsAutoUpdateIntervalInput,
      settingsIgnoreTesterPathInput, settingsIgnoreTesterResultSpan,
      settingsMaxFileSizeInput, settingsFileSizeActionSelect,
      settingsTruncateValueInput, settingsSkipBinaryCheckbox,
      settingsFontSizeSelect, settingsLanguageSelect;

  let isDragging = false;
  let dragOffsetX, dragOffsetY;
  let isPanelResizing = false;
  let initialLeftPanelBasis = 0;
  let initialResizeMouseX = 0;
  let displayTreeRoot = {};
  let scriptInitialized = false;

  const LANGUAGES = {
    en: {
      name: "English",
      texts: {
        folderNotSelected: "Folder not selected",
        filesSelected: "Files selected:",
        folderSelected: "Folder selected:",
        objects: "objects",
        folderStructureWarning:
            "Warning: Folder structure might not be fully preserved (no webkitRelativePath).",
        contextGenerated: "Context generated for",
        files: "files",
        errorGeneratingContext: "Error generating context. See console.",
        generatingContext: "Generating context...",
        processingFiles: "Processing files...",
        skippingBinaryFile: "Skipping binary file",
        projectExceedsLimit:
            "Project (%1MB) exceeds threshold (%2MB) for auto-generation. Click \"Generate Context\" manually.",
        autoGeneratingContext: "Automatic context generation...",
        contextAutoUpdated: "Context automatically updated.",
        autoUpdateContextEnabled:
            "Auto context update enabled, interval: %1 sec.",
        autoUpdateContextStopped: "Auto context update stopped.",
        fetchingOfficialTemplates:
            "Fetching official prompt template manifest...",
        invalidManifestFormat: "Invalid format for official templates manifest.",
        noOfficialTemplatesInManifest:
            "No official templates found in manifest.",
        fetchedManifestLoading:
            "Fetched manifest. Loading %1 template(s)...",
        errorLoadingTemplateFile: "Failed to load %1",
        officialTemplatesLoaded:
            "Official templates loaded: %1 new, %2 updated.",
        errorLoadingSomeTemplates:
            "Error loading some official templates. See console.",
        errorProcessingManifest: "Error processing official templates manifest:",
        failedToFetchManifest:
            "Failed to fetch official templates manifest (network error). See console.",
        noPromptToInsert: "No prompt to insert.",
        aiStudioFieldNotFound:
            "AI Studio input field not found. Click on an input field in AI Studio and try again.",
        promptInserted: "Prompt inserted into active AI Studio field.",
        promptTemplateNameEmpty:
            "Template name and content cannot be empty.",
        coreTemplatesCannotBeEdited:
            "Core/Official templates cannot be changed directly. Save as new.",
        coreTemplatesCannotBeDeleted:
            "Core/Official templates cannot be deleted.",
        confirmDeleteTemplate: "Are you sure you want to delete template \"%1\"?",
        promptTemplateSaved: "Prompt template saved.",
        promptTemplateDeleted: "Prompt template deleted.",
        confirmResetAllSettings:
            "ARE YOU SURE you want to reset ALL Shotgun Prompter settings to default values? This includes ignore rules, prompt templates, and UI settings. This action is irreversible.",
        allSettingsReset: "All settings have been reset to defaults.",
        settingsExported: "Settings exported.",
        errorImportingSettings: "Error importing settings:",
        invalidJsonFile: "Invalid JSON file.",
        settingsSuccessfullyImported:
            "%1 settings successfully imported. Please check.",
        settingsSaved: "Settings saved.",
        versionCheckErrorParse: "Error checking for updates (parse error).",
        versionCheckErrorNetwork: "Error checking for updates (network error).",
        modalOpenedCheckingUpdates: "Modal opened. Checking for updates...",
        updateAvailable: "New version %1 available! ",
        updateButton: "Update to v%1",
        viewChangelog: "View Changelog",
        errorDisplayingModal: "Error: Could not display modal.",
        lastFolder: "Last folder:",
        noWebkitRelativePathWarning:
            "Warning: Folder structure might not be fully preserved (no webkitRelativePath).",
        noFilesSelected: "No files selected.",
        fileSelectionEventError: "File selection event error.",
        fileApiNotSupported:
            "File System Access API is not supported in this browser. Please use the standard 'Выбор папки' button.",
        apiFolderSelectCanceled: "Folder selection canceled by user.",
        apiFolderSelectError: "Error selecting folder with API. See console.",
        folderApiProcessed: "Folder processed via API. %1 objects found.",
        errorReadingFileHandle: "Error getting file from handle %1:",
        errorAccessingFile: "Error accessing file %1: %2",
        clearErrors: "Clear errors",
        fileReadErrors: "File Read Errors:",
        apiGitignoreLoaded: ".gitignore loaded via API.",
        apiGitignoreLoadError: "Failed to load .gitignore via API.",
        gitignoreNotFound: ".gitignore found (API), but auto-load is disabled in Settings.",
        legacyGitignoreLoaded: ".gitignore loaded (legacy).",
        legacyGitignoreLoadError: "Error reading .gitignore (legacy).",
        gitignoreFoundLegacy: ".gitignore found, but auto-load is disabled in Settings.",
        noFilesToStructure: "No files to structure.",
        filesToInclude: "Files to include:",
        context: "Context:",
        characters: "characters",
        tokens: "tokens",
        finalPrompt: "Final prompt:",
        fileReadError: "Error reading %1 (%2). Processed %3/%4 files...",
        skippingLargeFile: "Skipping large file %1 (%2KB)",
        truncatedLargeFileChars:
            "Truncated large file %1 (%2KB) to %3 chars",
        truncatedLargeFileLines:
            "Truncated large file %1 (%2KB) to %3 lines",
        noFilesInSearch: "No files or folders found matching: \"%1\"",
        noFilesToDisplay:
            "No files to display (all files might be excluded by rules).",
        selectAll: "Select All",
        deselectAll: "Deselect All",
        expandAll: "Expand All",
        collapseAll: "Collapse All",
        selectedFiles: "Selected Files:",
        ignoreRulesGitignoreSyntax: "Ignore Rules (.gitignore syntax)",
        manualEditable: "Manual (Editable)",
        gitignoreLoadedReadonly: ".gitignore (Read-only)",
        applyIgnoreRules: "Apply ignore rules (.gitignore and manual)",
        ignoreRuleTester: "Ignore Rule Tester",
        enterPathToTest: "Enter path to test (e.g., src/temp.log)",
        ignored: "Ignored ✅",
        notIgnored: "Not ignored ❌",
        generateContext: "Generate Context",
        copyContext: "Copy context",
        contextCopied: "Context copied!",
        yourTaskForAi: "Your task for AI:",
        promptTemplate: "Prompt Template:",
        finalPromptText: "Final Prompt:",
        copyPrompt: "Copy prompt",
        promptCopied: "Prompt copied!",
        insertIntoAiStudio: "_Insert into studio",
        settings: "Settings",
        saveAndCloseSettings: "Save & Close Settings",
        fileHandling: "File Handling",
        maxFileSize: "Max file size (KB, 0 - no limit):",
        ifExceeded: "If size exceeded:",
        skipFile: "Skip file",
        truncateChars: "Truncate (chars)",
        truncateLines: "Truncate (lines)",
        truncateTo: "Truncate to (chars/lines):",
        skipBinary: "Skip binary files:",
        autoLoadGitignore:
            "Automatically load .gitignore from selected folder root",
        autoUpdateInterval: "Auto-update interval (API, sec):",
        promptTemplates: "Prompt Templates",
        newTemplate: "New template",
        saveTemplate: "Save template",
        deleteTemplate: "Delete template",
        fetchOfficialTemplates: "Fetch Official Templates",
        templateName: "Template Name:",
        templateContent: "Template Content:",
        importExportSettings: "Import/Export Settings",
        exportSettings: "Export Settings",
        importSettings: "Import Settings",
        general: "General",
        resetAllSettings: "Reset All Settings",
        ignoreRulesEnabled: "Ignore rules enabled. File list updated.",
        ignoreRulesDisabled: "Ignore rules disabled. File list updated.",
        errorApplyingIgnoreRuleChange: "Error applying ignore rule change. See console.",
        manualIgnoreRulesSaved: "Manual ignore rules updated and saved.",
        pastePromptButton: "Paste Prompt",
        pasteContextButton: "Paste Context",
        loadedGitignoreRulesHeader: ".gitignore Rules (Read-only)",
        manualIgnoreRulesHeader: "Manual Rules (Editable)",
        language: "Language:",
        fontSize: "Font Size:",
        small: "Small",
        medium: "Medium",
        large: "Large",
        custom: "Custom:",
        resetHeight: "Reset height"
      }
    },
    ru: {
      name: "Русский",
      texts: {
        folderNotSelected: "Папка не выбрана",
        filesSelected: "Выбрано файлов:",
        folderSelected: "Выбрана папка:",
        objects: "объектов",
        folderStructureWarning:
            "Внимание: Структура папок может быть не полностью сохранена (нет webkitRelativePath).",
        contextGenerated: "Контекст сгенерирован для",
        files: "файлов",
        errorGeneratingContext: "Ошибка генерации контекста. См. консоль.",
        generatingContext: "Генерация контекста...",
        processingFiles: "Обработка файлов...",
        skippingBinaryFile: "Пропускаем бинарный файл",
        projectExceedsLimit:
            "Проект (%1MB) превышает порог (%2MB) для авто-генерации. Нажмите \"Сгенерировать Контекст\" вручную.",
        autoGeneratingContext: "Автоматическая генерация контекста...",
        contextAutoUpdated: "Контекст автоматически обновлен.",
        autoUpdateContextEnabled:
            "Автообновление контекста включено, интервал: %1 сек.",
        autoUpdateContextStopped: "Автообновление контекста остановлено.",
        fetchingOfficialTemplates:
            "Загрузка манифеста официальных шаблонов промптов...",
        invalidManifestFormat: "Неверный формат манифеста официальных шаблонов.",
        noOfficialTemplatesInManifest:
            "В манифесте нет официальных шаблонов.",
        fetchedManifestLoading:
            "Манифест загружен. Загрузка %1 шаблона(ов)...",
        errorLoadingTemplateFile: "Не удалось загрузить %1",
        officialTemplatesLoaded:
            "Официальные шаблоны загружены: %1 новых, %2 обновленных.",
        errorLoadingSomeTemplates:
            "Ошибка загрузки некоторых официальных шаблонов. См. консоль.",
        errorProcessingManifest:
            "Ошибка обработки манифеста официальных шаблонов:",
        failedToFetchManifest:
            "Не удалось загрузить манифест официальных шаблонов (сетевая ошибка). См. консоль.",
        noPromptToInsert: "Нет промпта для вставки.",
        aiStudioFieldNotFound:
            "Не найдено активное поле ввода AI Studio. Кликните на поле ввода в AI Studio и попробуйте снова.",
        promptInserted: "Промпт вставлен в активное поле AI Studio.",
        promptTemplateNameEmpty:
            "Название шаблона и содержимое не могут быть пустыми.",
        coreTemplatesCannotBeEdited:
            "Основные/Официальные шаблоны не могут быть изменены напрямую. Сохраните как новый.",
        coreTemplatesCannotBeDeleted:
            "Основные/Официальные шаблоны не могут быть удалены.",
        confirmDeleteTemplate:
            "Вы уверены, что хотите удалить шаблон \"%1\"?",
        promptTemplateSaved: "Шаблон промпта сохранен.",
        promptTemplateDeleted: "Шаблон промпта удален.",
        confirmResetAllSettings:
            "ВЫ УВЕРЕНЫ, что хотите сбросить ВСЕ настройки Shotgun Prompter к значениям по умолчанию? Это включает правила игнорирования, шаблоны промптов и настройки интерфейса. Это действие необратимо.",
        allSettingsReset: "Все настройки сброшены к значениям по умолчанию.",
        settingsExported: "Настройки экспортированы.",
        errorImportingSettings: "Ошибка импорта настроек:",
        invalidJsonFile: "Неверный JSON файл.",
        settingsSuccessfullyImported:
            "%1 настроек успешно импортировано. Пожалуйста, проверьте.",
        settingsSaved: "Настройки сохранены.",
        versionCheckErrorParse: "Ошибка проверки обновлений (ошибка парсинга).",
        versionCheckErrorNetwork: "Ошибка проверки обновлений (сетевая ошибка).",
        modalOpenedCheckingUpdates:
            "Модальное окно открыто. Проверка обновлений...",
        updateAvailable: "Доступна новая версия %1! ",
        updateButton: "Обновить до v%1",
        viewChangelog: "Посмотреть Changelog",
        errorDisplayingModal: "Ошибка: Не удалось отобразить модальное окно.",
        lastFolder: "Последняя папка:",
        noWebkitRelativePathWarning:
            "Внимание: Структура папок может быть не полностью сохранена (нет webkitRelativePath).",
        noFilesSelected: "Файлы не выбраны.",
        fileSelectionEventError: "Ошибка события выбора файла.",
        apiNotSupported:
            "File System Access API не поддерживается в этом браузере. Пожалуйста, используйте стандартную кнопку 'Выбор папки'.",
        apiFolderSelectCanceled: "Выбор папки отменен пользователем.",
        apiFolderSelectError:
            "Ошибка выбора папки через API. См. консоль.",
        folderApiProcessed:
            "Папка обработана через API. %1 объектов найдено.",
        errorReadingFileHandle:
            "Ошибка получения файла из хэндла %1:",
        errorAccessingFile: "Ошибка доступа к файлу %1: %2",
        clearErrors: "Очистить ошибки",
        fileReadErrors: "Ошибки чтения файлов:",
        apiGitignoreLoaded: ".gitignore загружен через API.",
        apiGitignoreLoadError: "Не удалось загрузить .gitignore через API.",
        gitignoreNotFound:
            ".gitignore найден (API), но автозагрузка отключена в Настройках.",
        legacyGitignoreLoaded: ".gitignore загружен (legacy).",
        legacyGitignoreLoadError: "Ошибка чтения .gitignore (legacy).",
        gitignoreFoundLegacy:
            ".gitignore найден (legacy), но автозагрузка отключена в Настройках.",
        noFilesToStructure: "Нет файлов для структурирования.",
        filesToInclude: "Файлов для включения:",
        context: "Контекст:",
        characters: "символов",
        tokens: "токенов",
        finalPrompt: "Финальный промпт:",
        fileReadError:
            "Ошибка чтения %1 (%2). Обработано %3/%4 файлов...",
        skippingLargeFile:
            "Пропускаем большой файл %1 (%2KB)",
        truncatedLargeFileChars:
            "Обрезан большой файл %1 (%2KB) до %3 символов",
        truncatedLargeFileLines:
            "Обрезан большой файл %1 (%2KB) до %3 строк",
        noFilesInSearch: "Файлы или папки не найдены по запросу: \"%1\"",
        noFilesToDisplay:
            "Нет файлов для отображения (все файлы могут быть исключены правилами).",
        selectAll: "Выбр. все",
        deselectAll: "Снять все",
        expandAll: "Разв. все",
        collapseAll: "Сверн. все",
        selectedFiles: "Выбранные файлы:",
        ignoreRulesGitignoreSyntax:
            "Правила игнорирования (.gitignore синтаксис)",
        manualEditable: "Вручную (редактируемые)",
        gitignoreLoadedReadonly: ".gitignore (только для чтения)",
        applyIgnoreRules: "Применять правила игнорирования (.gitignore и вручную)",
        ignoreRuleTester: "Тестирование правил игнорирования",
        enterPathToTest: "Введите путь (например, src/temp.log)",
        ignored: "Игнорируется ✅",
        notIgnored: "Не игнорируется ❌",
        generateContext: "Сгенерировать Контекст",
        copyContext: "Скопировать контекст",
        contextCopied: "Контекст скопирован!",
        yourTaskForAi: "Ваша задача для ИИ:",
        promptTemplate: "Шаблон промпта:",
        finalPromptText: "Финальный промпт:",
        copyPrompt: "Скопировать промпт",
        promptCopied: "Промпт скопирован!",
        insertIntoAiStudio: "Вставить в AI Studio",
        settings: "Настройки",
        saveAndCloseSettings: "Сохранить и Закрыть Настройки",
        fileHandling: "Обработка файлов",
        maxFileSize: "Макс. размер файла (КБ, 0 - без лимита):",
        ifExceeded: "Если размер превышен:",
        skipFile: "Пропустить файл",
        truncateChars: "Обрезать (символы)",
        truncateLines: "Обрезать (строки)",
        truncateTo: "Обрезать до (символов/строк):",
        skipBinary: "Пропускать бинарные файлы:",
        autoLoadGitignore:
            "Автоматически загружать .gitignore из корня выбранной папки",
        autoUpdateInterval: "Интервал автообновления (API, сек):",
        promptTemplates: "Шаблоны промптов",
        newTemplate: "Новый шаблон",
        saveTemplate: "Сохранить шаблон",
        deleteTemplate: "Удалить шаблон",
        fetchOfficialTemplates: "Загрузить Официальные Шаблоны",
        templateName: "Название шаблона:",
        templateContent: "Содержимое шаблона:",
        importExportSettings: "Импорт/Экспорт настроек",
        exportSettings: "Экспорт настроек",
        importSettings: "Импорт настроек",
        general: "Общие",
        resetAllSettings: "Сбросить все настройки",
        ignoreRulesEnabled: "Правила игнорирования включены. Список файлов обновлен.",
        ignoreRulesDisabled: "Правила игнорирования отключены. Список файлов обновлен.",
        errorApplyingIgnoreRuleChange: "Ошибка применения изменения правил игнорирования. См. консоль.",
        manualIgnoreRulesSaved: "Ручные правила игнорирования обновлены и сохранены.",
        pastePromptButton: "Вставить Промпт",
        pasteContextButton: "Вставить Контекст",
        loadedGitignoreRulesHeader: "Правила из .gitignore (только для чтения)",
        manualIgnoreRulesHeader: "Правила вручную (редактируемые)",
        language: "Язык:",
        fontSize: "Размер шрифта:",
        small: "Маленький",
        medium: "Средний",
        large: "Большой",
        custom: "Произвольный:",
        resetHeight: "Сбросить высоту"
      }
    }
  };

  let currentLang = GM_getValue(CURRENT_LANG_KEY, 'ru');

  function getText(key, ...args) {
    const lang = LANGUAGES[currentLang] || LANGUAGES['ru'];
    let text = lang.texts[key] || LANGUAGES['ru'].texts[key] || key;
    args.forEach((arg, index) => {
      text = text.replace(`%${index + 1}`, arg);
    });
    return text;
  }

  function updateStatus(message, isError = false, isVersionCheck = false) {
    const targetDiv = isVersionCheck ? versionStatusDiv : statusDiv;
    if (!targetDiv) {
      return;
    }

    if (isVersionCheck && !isError && typeof message !== 'string') {
      targetDiv.innerHTML = '';
      targetDiv.appendChild(message);
      return;
    }
    let displayMessage = message;
    if (typeof message === 'string' && message.includes("Copied!")) {
      displayMessage = getText('contextCopied');
    }

    targetDiv.textContent = displayMessage;
    targetDiv.style.color = isError ? 'red' : (displayMessage.includes(getText('generatingContext')) || displayMessage.includes(getText('processingFiles')) ? 'orange' : 'green');
    targetDiv.style.cursor = 'default';
    if (isError) {
      targetDiv.style.animation = 'blink-red 1s infinite alternate';
    } else {
      targetDiv.style.animation = 'none';
    }
  }

  function copyToClipboard(text, buttonElement, successMessageKey) {
    if (!text) {
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      const originalText = buttonElement.textContent;
      const successMessage = getText(successMessageKey);
      buttonElement.textContent = successMessage;
      buttonElement.disabled = true;
      buttonElement.classList.add('shotgun-copy-icon-copied');
      setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
        buttonElement.classList.remove('shotgun-copy-icon-copied');
        updateCopyButtonStates();
      }, 2000);
      updateStatus(successMessage);
    }).catch(err => {
      console.error('[Shotgun Prompter] Failed to copy: ', err);
      updateStatus(getText("failedToCopyToClipboard"), true);
    });
  }

  function createElementWithProps(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    for (const key in props) {
      if (key === 'textContent') {
        el.textContent = props[key];
      } else if (key.startsWith('on') && typeof props[key] === 'function') {
        el[key] = props[key];
      } else if (props[key] !== undefined) {
        if (['webkitdirectory', 'directory', 'multiple', 'disabled', 'readonly',
          'checked', 'selected', 'indeterminate'].includes(key)) {
          if (props[key] === '' || props[key] === true) {
            el.setAttribute(key,
                '');
          }
          if (key === 'checked' && props[key]) {
            el.checked = true;
          }
          if (key === 'indeterminate' && props[key]) {
            el.indeterminate = true;
          }
        } else {
          el.setAttribute(key, props[key]);
        }
      }
    }
    children.forEach(child => {
      if (child) {
        el.appendChild(child);
      }
    });
    return el;
  }

  function updateStats() {
    if (!statsDiv || !contextStatsDiv || !promptStatsDiv) {
      return;
    }
    const includedFilesCount = projectFiles.filter(pf => !pf.excluded).length;
    statsDiv.textContent = `${getText("filesToInclude")} ${includedFilesCount}`;
    const contextCharCount = generatedContext.length;
    const contextTokenCount = Math.round(contextCharCount / 3.5);
    contextStatsDiv.textContent = `${getText("context")}: ${contextCharCount} ${getText("characters")} / ~${contextTokenCount} ${getText("tokens")}`;
    const promptCharCount = finalPromptTextarea && finalPromptTextarea.value
        ? finalPromptTextarea.value.length : 0;
    const promptTokenCount = Math.round(promptCharCount / 3.5);
    promptStatsDiv.textContent = `${getText("finalPrompt")}: ${promptCharCount} ${getText("characters")} / ~${promptTokenCount} ${getText("tokens")}`;
  }

  function patternToRegexString(pattern) {
    const globStarPlaceholder = '__(GLOBSTAR)__';
    let p = pattern.replace(/\*\*/g, globStarPlaceholder);
    p = p.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    p = p.replace(/\?/g, '[^/]');
    p = p.replace(/\*/g, '[^/]*');
    const placeholderRegex = new RegExp(
        globStarPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    p = p.replace(placeholderRegex, '.*');
    return p;
  }

  function isPathIgnored(relPath, ignorePatternsText) {
    if (relPath === "") {
      return false;
    }
    let normalizedRelPath = relPath.replace(/\\/g, '/');
    if (normalizedRelPath.endsWith('/') && normalizedRelPath.length > 1) {
      normalizedRelPath = normalizedRelPath.slice(0, -1);
    }

    const lines = ignorePatternsText.split('\n').map(p => p.trim()).filter(
        p => p && !p.startsWith('#'));
    let currentIgnoredState = false;

    for (const line of lines) {
      let pattern = line;
      let isNegationRule = false;

      if (pattern.startsWith('!')) {
        isNegationRule = true;
        pattern = pattern.substring(1).trim();
      }
      if (!pattern) {
        continue;
      }

      let regexPatternString;
      const originalPatternForLogic = pattern;

      if (originalPatternForLogic.startsWith('/')) {
        pattern = pattern.substring(1);
        regexPatternString = '^' + patternToRegexString(pattern);
        regexPatternString += originalPatternForLogic.endsWith('/') ? '(?:/.*)?'
            : '(?:$|/.*)';
      } else if (originalPatternForLogic.includes('/')
          && !originalPatternForLogic.endsWith('/')) {
        regexPatternString = '^' + patternToRegexString(pattern);
        regexPatternString += '$';
      } else {
        let basePattern = pattern;
        if (pattern.endsWith('/')) {
          basePattern = pattern.slice(0, -1);
        }
        basePattern = patternToRegexString(basePattern);
        regexPatternString = '(?:^|/)' + patternToRegexString(pattern);
        if (originalPatternForLogic.endsWith('/') || !/[*?\[]/.test(
            originalPatternForLogic)) {
          regexPatternString += '(?:$|/.*)';
        } else {
          regexPatternString += '$';
        }
      }
      try {
        const regex = new RegExp(regexPatternString);
        if (regex.test(normalizedRelPath)) {
          currentIgnoredState = !isNegationRule;
        }
      } catch (e) {
        console.warn(
            `[Shotgun Prompter] Error compiling regex from pattern "${originalPatternForLogic}" (regex: "${regexPatternString}"):`,
            e);
      }
    }
    return currentIgnoredState;
  }

  function applyIgnoreRulesToProjectFiles() {
    if (!projectFiles || projectFiles.length === 0) {
      return;
    }
    const applyRulesEnabled = GM_getValue(USE_GITIGNORE_RULES_KEY, true);

    if (!applyRulesEnabled) {
      projectFiles.forEach(pf => {
        pf.isRuleExcluded = false;
      });
      return;
    }
    const ignoreText = GM_getValue(CUSTOM_IGNORE_RULES_KEY,
        DEFAULT_IGNORE_RULES);

    let commonRootPrefix = "";
    if (projectFiles.length > 0) {
      const firstPathWithDirectory = projectFiles.find(
          pf => pf.relPath && pf.relPath.includes('/'));
      if (firstPathWithDirectory) {
        commonRootPrefix = firstPathWithDirectory.relPath.substring(0,
            firstPathWithDirectory.relPath.indexOf('/') + 1);
        const allSharePrefixOrAreRootFiles = projectFiles.every(pf => {
          if (pf.relPath && pf.relPath.includes('/')) {
            return pf.relPath.startsWith(commonRootPrefix);
          }
          return true;
        });
        if (!allSharePrefixOrAreRootFiles) {
          commonRootPrefix = "";
        }
      }
    }

    let combinedIgnoreText = "";
    const loadedGitignoreRules = GM_getValue(
        SCRIPT_PREFIX + 'loaded_gitignore_rules', '');
    const manualIgnoreRules = GM_getValue(CUSTOM_IGNORE_RULES_KEY,
        DEFAULT_IGNORE_RULES);

    if (loadedGitignoreRules) {
      combinedIgnoreText += loadedGitignoreRules.trim() + "\n";
    }
    if (manualIgnoreRules) {
      combinedIgnoreText += manualIgnoreRules.trim();
    }

    projectFiles.forEach(pf => {
      let pathForIgnoreCheck = pf.relPath;
      if (commonRootPrefix && pf.relPath && pf.relPath.startsWith(
          commonRootPrefix)) {
        pathForIgnoreCheck = pf.relPath.substring(commonRootPrefix.length);
      }

      pf.isRuleExcluded = isPathIgnored(pathForIgnoreCheck,
          combinedIgnoreText.trim());

    });
  }

  function updateFileSelectionUI() {
    const useRules = GM_getValue(USE_GITIGNORE_RULES_KEY, true);

    applyIgnoreRulesToProjectFiles();
    displayTreeRoot = buildDisplayTreeAndSetExclusion(projectFiles);
    renderFileList();

    const anyFilesToProcess = projectFiles.some(
        pf => !pf.excluded && (!useRules || !pf.isRuleExcluded));
    if (selectAllFilesBtn) {
      selectAllFilesBtn.disabled = projectFiles.length
          === 0;
    }
    if (deselectAllFilesBtn) {
      deselectAllFilesBtn.disabled = projectFiles.length
          === 0;
    }
    if (generateContextBtn) {
      generateContextBtn.disabled = !(projectFiles.length
          > 0 && anyFilesToProcess);
    }
    updateStats();
  }

  async function handleLegacyFileSelection(event) {
    if (!event || !event.target || !event.target.files) {
      updateStatus(getText("fileSelectionEventError"), true);
      return;
    }
    const files = event.target.files;
    if (files.length === 0) {
      updateStatus(getText("noFilesSelected"));
      projectFiles = [];
      displayTreeRoot = {};
      renderFileList();
      if (generateContextBtn) {
        generateContextBtn.disabled = true;
      }
      return;
    }
    let hasWebkitRelativePath = false;
    let tempProjectRootName = "";
    projectFiles = Array.from(files).map((file, index) => {
      const relPath = file.webkitRelativePath || file.name;
      if (index === 0
          && file.webkitRelativePath) {
        tempProjectRootName = file.webkitRelativePath.split(
            '/')[0];
      }
      if (file.webkitRelativePath) {
        hasWebkitRelativePath = true;
      }
      return {
        file,
        relPath,
        excluded: false,
        content: null,
        id: SCRIPT_PREFIX + 'pf_' + Date.now() + '_' + index
      };
    });
    if (tempProjectRootName) {
      lastSelectedFolderName = tempProjectRootName;
      GM_setValue(LAST_FOLDER_NAME_KEY, lastSelectedFolderName);
      if (folderInputLabel) {
        folderInputLabel.textContent = `${getText("folderSelected")} ${lastSelectedFolderName} (${files.length} ${getText("files")})`;
      }
    } else if (folderInputLabel) {
      folderInputLabel.textContent = `${getText("filesSelected")} ${files.length} (${getText("folderStructureWarning")})`;
    }
    currentDirectoryHandle = null;
    apiFolderSelected = false;
    if (refreshApiFolderBtn) {
      refreshApiFolderBtn.style.display = 'none';
    }

    projectFiles.sort((a, b) => a.relPath.localeCompare(b.relPath));

    let commonPrefixForGitignore = "";
    if (projectFiles.length > 0 && projectFiles[0].relPath.includes('/')) {
      commonPrefixForGitignore = projectFiles[0].relPath.substring(0,
          projectFiles[0].relPath.indexOf('/') + 1);
      if (!projectFiles.every(
          pf => pf.relPath.startsWith(commonPrefixForGitignore)
              || !pf.relPath.includes('/'))) {
        commonPrefixForGitignore = "";
      }
    }

    const autoLoadGitignoreSetting = GM_getValue(AUTO_LOAD_GITIGNORE_KEY, true);
    const gitignoreExpectedPath = commonPrefixForGitignore + ".gitignore";
    const gitignoreFileEntry = projectFiles.find(
        pf => pf.relPath === gitignoreExpectedPath);

    if (autoLoadGitignoreSetting) {
      if (gitignoreFileEntry && gitignoreFileEntry.file) {
        try {
          const gitignoreContent = await gitignoreFileEntry.file.text();
          GM_setValue(SCRIPT_PREFIX + 'loaded_gitignore_rules',
              gitignoreContent);
          updateStatus(getText("legacyGitignoreLoaded"), false);
        } catch (e) {
          console.warn(
              `[Shotgun Prompter] ${getText("legacyGitignoreLoadError")}`,
              e);
          GM_deleteValue(SCRIPT_PREFIX + 'loaded_gitignore_rules');
          updateStatus(getText("legacyGitignoreLoadError"), true);
        }
      } else {
        GM_deleteValue(SCRIPT_PREFIX + 'loaded_gitignore_rules');

      }
    } else {
      GM_deleteValue(SCRIPT_PREFIX + 'loaded_gitignore_rules');
      if (gitignoreFileEntry) {
        updateStatus(
            getText("gitignoreFoundLegacy"),
            false);
      }
    }

    if (!hasWebkitRelativePath && files.length > 0) {
      updateStatus(
          getText("noWebkitRelativePathWarning"),
          false);
    }

    updateFileSelectionUI();

    if (contextTextarea) {
      contextTextarea.value = '';
    }
    generatedContext = '';
    if (finalPromptTextarea) {
      finalPromptTextarea.value = '';
    }
    updateCopyButtonStates();
    updateStatus(
        `${projectFiles.length} ${getText("files")}/${getText("folderNotSelected")} ${getText("filesSelected")}. ${getText("contextGenerated", projectFiles.length)}. ${getText("contextAutoUpdated")}`);
    updateStatus(`${projectFiles.length} ${getText("files")}/${getText("objects")} ${getText("filesSelected")}. ${getText("checkExclusionsAndGenerate")}`);
    updateStatus(`${projectFiles.length} ${getText("files")}/${getText("objects")} ${getText("found")}. ${getText("checkExclusionsAndGenerateContext")}`);

    updateStats();
    updateLoadedGitignoreDisplay();
    await checkSizeAndAutoGenerateContext();
    persistCurrentExpansionState(displayTreeRoot);
  }

  async function readDirectoryRecursiveAPI(dirHandle, currentPath = "") {
    const filesInThisDir = [];
    for await (const entry of dirHandle.values()) {
      const relPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      if (entry.kind === 'file') {
        try {
          const file = await entry.getFile();
          filesInThisDir.push({
            file,
            relPath,
            excluded: false,
            isRuleExcluded: false,
            content: null,
            id: SCRIPT_PREFIX + 'pf_api_' + Date.now() + '_'
                + Math.random().toString(36).substr(2, 9)
          });
        } catch (e) {
          console.error(
              `[Shotgun Prompter] ${getText("errorReadingFileHandle", relPath)}`,
              e);
          if (fileReadErrorsDiv) {
            const errorP = createElementWithProps('p',
                {textContent: `${getText("errorAccessingFile", relPath, e.message)}`});
            fileReadErrorsDiv.appendChild(errorP);
            fileReadErrorsDiv.style.display = 'block';
          }
        }
      } else if (entry.kind === 'directory') {
        filesInThisDir.push(...await readDirectoryRecursiveAPI(entry, relPath));
      }
    }
    return filesInThisDir;
  }

  let autoUpdateTimer = null;

  function startAutoUpdateTimer() {
    stopAutoUpdateTimer();
    const intervalSeconds = parseInt(
        GM_getValue(AUTO_UPDATE_INTERVAL_KEY, '20'), 10);
    if (intervalSeconds > 0 && apiFolderSelected && currentDirectoryHandle) {
      autoUpdateTimer = setInterval(async () => {
        if (currentDirectoryHandle) {
          updateStatus(
              `${getText("autoGeneratingContext")} (${getText("interval")} ${intervalSeconds} ${getText("sec")})`);
          await processDirectoryHandle(currentDirectoryHandle);
          await generateContext();
          updateStatus(getText("contextAutoUpdated"));
        }
      }, intervalSeconds * 1000);
      updateStatus(
          getText("autoUpdateContextEnabled", intervalSeconds),
          false);
    }
  }

  function stopAutoUpdateTimer() {
    if (autoUpdateTimer) {
      clearInterval(autoUpdateTimer);
      autoUpdateTimer = null;
      updateStatus(getText("autoUpdateContextStopped"), false);
    }
  }

  function updateAutoUpdateCheckboxState() {
    if (!autoUpdateContextCheckbox) {
      return;
    }
    const canEnable = apiFolderSelected && currentDirectoryHandle !== null;
    autoUpdateContextCheckbox.disabled = !canEnable;
    const isChecked = GM_getValue(AUTO_UPDATE_CONTEXT_API_KEY, false);
    autoUpdateContextCheckbox.checked = isChecked && canEnable;
    if (autoUpdateContextCheckbox.checked) {
      startAutoUpdateTimer();
    } else {
      stopAutoUpdateTimer();
    }
  }

  async function processDirectoryHandle(dirHandle) {
    if (!dirHandle) {
      return;
    }
    updateStatus(getText("readingFolder"), false);
    if (fileReadErrorsDiv) {
      while (fileReadErrorsDiv.firstChild) {
        fileReadErrorsDiv.removeChild(fileReadErrorsDiv.firstChild);
      }
      fileReadErrorsDiv.style.display = 'none';
    }

    const filesFromApi = await readDirectoryRecursiveAPI(dirHandle);
    projectFiles = filesFromApi.map(pf => ({
      ...pf,
      relPath: dirHandle.name + '/' + pf.relPath
    }));
    projectFiles.sort((a, b) => a.relPath.localeCompare(b.relPath));
    lastSelectedFolderName = dirHandle.name;
    GM_setValue(LAST_FOLDER_NAME_KEY, lastSelectedFolderName);
    if (folderInputLabel) {
      folderInputLabel.textContent = `${getText("folder")}: ${lastSelectedFolderName} (${projectFiles.length} ${getText("objects")})`;
    }

    const autoLoadGitignoreSetting = GM_getValue(AUTO_LOAD_GITIGNORE_KEY, true);

    if (autoLoadGitignoreSetting) {
      try {
        const gitignoreFileHandle = await dirHandle.getFileHandle('.gitignore',
            {create: false});
        const file = await gitignoreFileHandle.getFile();
        const gitignoreContent = await file.text();
        GM_setValue(SCRIPT_PREFIX + 'loaded_gitignore_rules', gitignoreContent);
        updateStatus(getText("apiGitignoreLoaded"), false);
      } catch (e) {
        GM_deleteValue(SCRIPT_PREFIX + 'loaded_gitignore_rules');
        if (e.name !== 'NotFoundError') {
          updateStatus(getText("apiGitignoreLoadError"), true);
          console.warn(`[Shotgun Prompter] ${getText("apiGitignoreLoadError")}`,
              e);
        } else {
        }
      }
    } else {
      try {
        await dirHandle.getFileHandle('.gitignore', {create: false});
        updateStatus(
            getText("gitignoreNotFound"),
            false);
      } catch (e) {
        // Пропущено тело блока catch. Добавляем пустое.
      }
    }

    updateFileSelectionUI();

    if (generateContextBtn) {
      const anyFilesToInclude = projectFiles.some(
          pf => !pf.excluded && (!GM_getValue(USE_GITIGNORE_RULES_KEY, true)
              || !pf.isRuleExcluded));
      generateContextBtn.disabled = !(projectFiles.length > 0
          && anyFilesToInclude);
    }
    if (selectAllFilesBtn) {
      selectAllFilesBtn.disabled = projectFiles.length
          === 0;
    }
    if (deselectAllFilesBtn) {
      deselectAllFilesBtn.disabled = projectFiles.length
          === 0;
    }
    if (contextTextarea) {
      contextTextarea.value = '';
    }
    generatedContext = '';
    if (finalPromptTextarea) {
      finalPromptTextarea.value = '';
    }
    updateCopyButtonStates();
    updateStatus(
        `${getText("folderApiProcessed", projectFiles.length)} ${getText("checkExclusionsAndGenerateContext")}`,
        false);
    updateLoadedGitignoreDisplay();
    await checkSizeAndAutoGenerateContext();
    if (refreshApiFolderBtn) {
      refreshApiFolderBtn.style.display = 'inline-block';
    }
    persistCurrentExpansionState(displayTreeRoot);
    updateAutoUpdateCheckboxState();
  }

  async function handleApiFolderSelect() {
    if (!window.showDirectoryPicker) {
      alert(
          getText("apiNotSupported"));
      if (fileApiInputBtn) {
        fileApiInputBtn.style.display = 'none';
      }
      return;
    }
    try {
      const dirHandle = await window.showDirectoryPicker();
      currentDirectoryHandle = dirHandle;
      apiFolderSelected = true;
      await processDirectoryHandle(dirHandle);
      persistCurrentExpansionState(displayTreeRoot);
    } catch (err) {
      if (err.name === 'AbortError') {
        updateStatus(getText("apiFolderSelectCanceled"), false);
      } else {
        console.error("[Shotgun Prompter] Error selecting folder with API:",
            err);
        updateStatus(getText("apiFolderSelectError"), true);
      }
      currentDirectoryHandle = null;
      apiFolderSelected = false;
      updateAutoUpdateCheckboxState();
      if (refreshApiFolderBtn) {
        refreshApiFolderBtn.style.display = 'none';
      }
    }
  }

  function getPersistedExpansionState() {
    return GM_getValue(FOLDER_EXPANSION_STATE_KEY, {});
  }

  function persistCurrentExpansionState(rootTreeObject) {
    const states = {};

    function traverse(node, pathParts) {
      const currentPath = pathParts.join('/');
      if (node && node._isDir) {
        states[currentPath] = node._expanded;
        if (node._children) {
          Object.values(node._children).forEach(childNode => {
            if (childNode) {
              traverse(childNode, [...pathParts, childNode._name]);
            }
          });
        }
      }
    }

    if (rootTreeObject && typeof rootTreeObject === 'object') {
      Object.values(rootTreeObject).forEach(rootNode => {
        if (rootNode) {
          traverse(rootNode, [rootNode._name]);
        }
      });
    }
    GM_setValue(FOLDER_EXPANSION_STATE_KEY, states);
  }

  function buildDisplayTreeAndSetExclusion(files) {
    const newTree = {};
    const persistedExpansionStates = getPersistedExpansionState();
    const rulesActive = GM_getValue(USE_GITIGNORE_RULES_KEY, true);

    files.forEach((pf) => {
      if (rulesActive && pf.isRuleExcluded) {
        return;
      }

      const parts = pf.relPath.split('/');
      let currentLevel = newTree;
      let pathSoFarArray = [];
      parts.forEach((part, index) => {
        pathSoFarArray.push(part);
        const nodeId = SCRIPT_PREFIX + 'node_' + pathSoFarArray.join(
            '_').replace(/[^a-zA-Z0-9_]/g, '_');
        const isDirNode = index < parts.length - 1;

        if (!currentLevel[part]) {
          const nodePathForExpansion = pathSoFarArray.join('/');
          let expandedState = true;
          if (isDirNode && typeof persistedExpansionStates[nodePathForExpansion]
              === 'boolean') {
            expandedState = persistedExpansionStates[nodePathForExpansion];
          }
          currentLevel[part] = {
            _name: part,
            _isDir: isDirNode,
            _pf: isDirNode ? null : pf,
            _children: {},
            _id: nodeId,
            _excluded: pf.excluded,
            _isRuleExcluded: pf.isRuleExcluded,
            _expanded: isDirNode ? expandedState : undefined
          };
        }
        if (!isDirNode) {
          currentLevel[part]._pf = pf;
          currentLevel[part]._excluded = pf.excluded;
          currentLevel[part]._isRuleExcluded = pf.isRuleExcluded;
        }
        currentLevel = currentLevel[part]._children;
      });
    });

    return newTree;
  }

  function setChildrenChecked(item, checked, isRecursiveCall = false) {
    item._excluded = !checked;
    if (item._pf && item._pf.id) {
      const projectFileEntry = projectFiles.find(pf => pf.id === item._pf.id);
      if (projectFileEntry) {
        projectFileEntry.excluded = !checked;
      }
      if (item._pf) {
        item._pf.excluded = !checked;
      }
    }

    if (item._isDir && item._children) {
      Object.values(item._children).forEach(child => {
        setChildrenChecked(child, checked, true);
      });
    }
    if (!isRecursiveCall) {
      renderFileList();
      updateStats();
      const useRules = GM_getValue(USE_GITIGNORE_RULES_KEY, true);
      const anyFilesToProcess = projectFiles.some(
          pf => pf.file && !pf.excluded && (!useRules || !pf.isRuleExcluded));
      if (generateContextBtn) {
        generateContextBtn.disabled = !(projectFiles.length > 0
            && anyFilesToProcess);
      }
      persistCurrentExpansionState(displayTreeRoot);
    }
  }

  function toggleNodeExpansion(node, expand, isRecursiveCall = false) {
    if (node && node._isDir) {
      node._expanded = expand;
    }
    if (!isRecursiveCall) {
      persistCurrentExpansionState(displayTreeRoot);
      renderFileList();
    }
  }

  function getEffectiveChildrenState(folderNode) {
    let hasIncluded = false;
    let hasExcluded = false;

    function findStates(currentNode) {
      if (!currentNode._isDir) {
        if (currentNode._excluded) {
          hasExcluded = true;
        } else {
          hasIncluded = true;
        }
        return;
      }
      if (Object.keys(currentNode._children).length === 0) {
        if (currentNode._excluded) {
          hasExcluded = true;
        } else {
          hasIncluded = true;
        }
        return;
      }
      for (const childKey in currentNode._children) {
        findStates(currentNode._children[childKey]);
        if (hasIncluded && hasExcluded) {
          return;
        }
      }
    }

    findStates(folderNode);
    return {hasIncluded, hasExcluded};
  }

  function renderTreeRecursiveDOM(currentLevelData, parentUl) {

    const keys = Object.keys(currentLevelData).sort((a, b) => {
      const itemA = currentLevelData[a];
      const itemB = currentLevelData[b];
      if (itemA._isDir && !itemB._isDir) {
        return -1;
      }
      if (!itemA._isDir && itemB._isDir) {
        return 1;
      }
      return a.localeCompare(b);
    });
    keys.forEach((key) => {
      const item = currentLevelData[key];
      const li = document.createElement('li');
      li.className = 'shotgun-tree-li';
      const entryDiv = document.createElement('div');
      entryDiv.className = 'shotgun-tree-entry';
      let checkbox;

      checkbox = createElementWithProps('input', {
        type: 'checkbox',
        id: `shotgun-cb-${item._id}`,
        class: 'shotgun-tree-checkbox'
      });

      if (item._isDir) {
        const {hasIncluded, hasExcluded} = getEffectiveChildrenState(item);
        if (Object.keys(item._children).length === 0) {
          checkbox.checked = !item._excluded;
          checkbox.indeterminate = false;
        } else {
          if (hasIncluded && !hasExcluded) {
            checkbox.checked = true;
            checkbox.indeterminate = false;
          } else if (!hasIncluded && hasExcluded) {
            checkbox.checked = false;
            checkbox.indeterminate = false;
          } else if (hasIncluded && hasExcluded) {
            checkbox.checked = true;
            checkbox.indeterminate = true;
          } else {
            checkbox.checked = !item._excluded;
            checkbox.indeterminate = false;
          }
        }
      } else {
        checkbox.checked = !item._excluded;
      }
      checkbox.addEventListener('change', () => {
        const isChecked = checkbox.checked;
        setChildrenChecked(item, isChecked);
      });
      entryDiv.appendChild(checkbox);

      const iconSpan = document.createElement('span');
      iconSpan.className = 'shotgun-tree-icon';
      if (item._isDir) {
        const expander = createElementWithProps('span', {
          class: 'shotgun-tree-expander',
          textContent: item._expanded ? '▼' : '▶'
        });
        expander.onclick = () => {
          toggleNodeExpansion(item, !item._expanded);
        };
        iconSpan.appendChild(expander);
      }
      iconSpan.appendChild(document.createTextNode(item._isDir ? '📁' : '📄'));
      entryDiv.appendChild(iconSpan);
      const label = document.createElement('label');
      if (checkbox) {
        label.setAttribute('for', checkbox.id);
      }
      label.textContent = key;
      entryDiv.appendChild(label);
      li.appendChild(entryDiv);
      parentUl.appendChild(li);
      if (item._isDir && item._expanded && Object.keys(item._children).length
          > 0) {
        const subUl = document.createElement('ul');
        subUl.className = 'shotgun-tree-ul';
        li.appendChild(subUl);
        renderTreeRecursiveDOM(item._children, subUl);
      }
    });
  }

  function filterTreeRecursive(nodes, queryLower) {
    const newNodes = {};

    for (const key in nodes) {
      if (Object.prototype.hasOwnProperty.call(nodes, key)) {
        const node = nodes[key];
        const nodeNameLower = node._name.toLowerCase();
        const selfMatch = nodeNameLower.includes(queryLower);

        if (node._isDir) {
          const filteredChildren = filterTreeRecursive(node._children,
              queryLower);
          if (selfMatch) {

            newNodes[key] = {
              ...node,
              _children: node._children,
              _expanded: true
            };
          } else if (Object.keys(filteredChildren).length > 0) {

            newNodes[key] = {
              ...node,
              _children: filteredChildren,
              _expanded: true
            };
          }
        } else {
          if (selfMatch) {
            newNodes[key] = node;
          }
        }
      }
    }
    return newNodes;
  }

  function renderFileList() {
    if (!fileListDiv) {
      return;
    }
    while (fileListDiv.firstChild) {
      fileListDiv.removeChild(fileListDiv.firstChild);
    }

    let currentSearchQuery = "";
    if (fileSearchInput && typeof fileSearchInput.value === 'string') {
      currentSearchQuery = fileSearchInput.value.trim();
    }

    let treeToRender = displayTreeRoot;
    if (currentSearchQuery) {
      treeToRender = filterTreeRecursive(displayTreeRoot,
          currentSearchQuery.toLowerCase());
    }

    if (projectFiles.length === 0) {
      const p = document.createElement('p');
      p.textContent = getText("folderNotSelected") + " " + getText("orEmpty");
      fileListDiv.appendChild(p);
    } else if (Object.keys(treeToRender).length === 0) {
      const p = document.createElement('p');
      p.textContent = currentSearchQuery
          ? `${getText("noFilesInSearch", currentSearchQuery)}`
          : getText("noFilesToDisplay");
      fileListDiv.appendChild(p);
    } else {
      const rootUl = document.createElement('ul');
      rootUl.className = 'shotgun-tree-ul shotgun-tree-root';
      renderTreeRecursiveDOM(treeToRender, rootUl);
      fileListDiv.appendChild(rootUl);
    }
    updateStats();
  }

  function formatFileStructure(filesForStructure) {
    if (filesForStructure.length === 0) {
      return getText("noFilesToStructure");
    }
    const tree = {};
    let commonRootPrefix = "";
    let displayRootName = "";
    if (filesForStructure.length > 0 && filesForStructure[0].relPath) {
      const firstPathParts = filesForStructure[0].relPath.split('/');
      if (firstPathParts.length > 0) {
        displayRootName = firstPathParts[0];
        if (filesForStructure.every(f => f.relPath && f.relPath.startsWith(
            displayRootName + '/'))) {
          commonRootPrefix = displayRootName
              + '/';
        } else {
          displayRootName = "(Project Root)";
          commonRootPrefix = "";
        }
      }
    } else {
      displayRootName = "(Project Root)";
    }
    filesForStructure.forEach(f => {
      if (!f.relPath) {
        return;
      }
      let currentPath = f.relPath;
      if (commonRootPrefix && currentPath.startsWith(
          commonRootPrefix)) {
        currentPath = currentPath.substring(
            commonRootPrefix.length);
      }
      if (!currentPath) {
        return;
      }
      const parts = currentPath.split('/').filter(p => p);
      let currentLevel = tree;
      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          currentLevel[part] = (index === parts.length
              - 1) ? {_isFile: true} : {};
        }
        currentLevel = currentLevel[part];
      });
    });
    let output = displayRootName + (commonRootPrefix ? "/" : "") + "\n";

    function buildString(node, indentPrefix) {
      const keys = Object.keys(node).filter(k => k !== '_isFile').sort(
          (a, b) => {
            const isADir = typeof node[a] === 'object' && !node[a]._isFile;
            const isBDir = typeof node[b] === 'object' && !node[b]._isFile;
            if (isADir && !isBDir) {
              return -1;
            }
            if (!isADir && isBDir) {
              return 1;
            }
            return a.localeCompare(b);
          });
      keys.forEach((key, index) => {
        const isLast = index === keys.length - 1;
        const connector = isLast ? "└── " : "├── ";
        const isDir = typeof node[key] === 'object' && !node[key]._isFile;
        output += indentPrefix + connector + key + (isDir ? "/" : "") + "\n";
        if (isDir) {
          buildString(node[key],
              indentPrefix + (isLast ? "    " : "│   "));
        }
      });
    }

    buildString(tree, "");
    return output.trim();
  }

  function isBinaryFile(fileContentSample) {
    if (!fileContentSample) {
      return false;
    }
    const sample = fileContentSample.substring(0,
        Math.min(fileContentSample.length, 512));
    for (let i = 0; i < sample.length; i++) {
      if (sample.charCodeAt(i) === 0) {
        return true;
      }
    }
    let nonPrintable = 0;
    for (let i = 0; i < sample.length; i++) {
      const charCode = sample.charCodeAt(i);
      if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode
          !== 13) {
        nonPrintable++;
      }
    }
    return (nonPrintable / sample.length) > 0.1;
  }

  async function generateContext() {
    if (fileReadErrorsDiv) {
      while (fileReadErrorsDiv.firstChild) {
        fileReadErrorsDiv.removeChild(fileReadErrorsDiv.firstChild);
      }
      fileReadErrorsDiv.style.display = 'none';
    }

    const rulesActive = GM_getValue(USE_GITIGNORE_RULES_KEY, true);
    const filesToProcess = projectFiles.filter(
        pf => pf.file && !pf.excluded && (!rulesActive || !pf.isRuleExcluded));

    if (filesToProcess.length === 0) {
      updateStatus(getText("noFilesSelectedForContext"), true);
      generatedContext = "";
      if (contextTextarea) {
        contextTextarea.value = "";
      }
      if (copyContextBtn) {
        copyContextBtn.disabled = true;
      }
      updateFinalPrompt();
      updateStats();
      return;
    }
    if (generateContextBtn) {
      generateContextBtn.disabled = true;
    }
    updateStatus(`${getText("processingFiles")} ${filesToProcess.length} ${getText("files")}...`, false);
    const maxFileSizeKB = parseInt(GM_getValue(MAX_FILE_SIZE_KB_KEY, '1024'),
        10);
    const fileSizeAction = GM_getValue(FILE_SIZE_ACTION_KEY, 'skip');
    const truncateValue = parseInt(GM_getValue(TRUNCATE_VALUE_KEY, '5000'), 10);
    const skipBinary = GM_getValue(SKIP_BINARY_FILES_KEY, true);
    const fileStructure = formatFileStructure(
        filesToProcess.map(pf => ({relPath: pf.relPath})));
    let fileContentsString = "";
    let filesProcessedCount = 0;
    const fileReadPromises = filesToProcess.map(pf => {
      return new Promise((resolve) => {
        if (maxFileSizeKB > 0 && pf.file.size > maxFileSizeKB * 1024) {
          if (fileSizeAction === 'skip') {
            updateStatus(getText("skippingLargeFile", pf.relPath, (pf.file.size / 1024).toFixed(1)));
            resolve(null);
            return;
          }
        }
        const reader = new FileReader();
        reader.onload = () => {
          let content = reader.result;
          filesProcessedCount++;
          if (skipBinary && isBinaryFile(content.substring(0, 512))) {
            updateStatus(getText("skippingBinaryFile", pf.relPath));
            resolve(null);
            return;
          }
          if (maxFileSizeKB > 0 && pf.file.size > maxFileSizeKB * 1024) {
            const originalSizeKB = (pf.file.size / 1024).toFixed(1);
            if (fileSizeAction === 'truncate_chars') {
              content = content.substring(0, truncateValue);
              updateStatus(
                  getText("truncatedLargeFileChars", pf.relPath, originalSizeKB, truncateValue));
            } else if (fileSizeAction === 'truncate_lines') {
              content = content.split('\n').slice(0, truncateValue).join('\n');
              updateStatus(
                  getText("truncatedLargeFileLines", pf.relPath, originalSizeKB, truncateValue));
            }
          }
          updateStatus(
              `${getText("processing")} ${filesProcessedCount}/${filesToProcess.length} ${getText("files")}...`);
          resolve({relPath: pf.relPath, content: content});
        };
        reader.onerror = (event) => {
          const err = event.target.error;
          console.error(`[Shotgun Prompter] ${getText("errorReadingFile", pf.relPath)}`,
              err, event);
          filesProcessedCount++;
          let errorDetail;
          if (err) {
            errorDetail = `${err.name}: ${err.message}`;
          } else {
            errorDetail = "FileReader error (ProgressEvent)";
          }
          if (fileReadErrorsDiv) {
            const errorP = createElementWithProps('p',
                {textContent: getText("errorReadingFileDetail", pf.relPath, errorDetail)});
            fileReadErrorsDiv.appendChild(errorP);
            fileReadErrorsDiv.style.display = 'block';
          }
          updateStatus(
              getText("fileReadError", pf.relPath, errorDetail, filesProcessedCount, filesToProcess.length),
              true);
          resolve(null);
        };
        reader.readAsText(pf.file);
      });
    });
    try {
      const allFileContents = (await Promise.all(fileReadPromises)).filter(
          item => item !== null);
      allFileContents.sort((a, b) => a.relPath.localeCompare(b.relPath));
      allFileContents.forEach(item => {
        const pathForTag = item.relPath.replace(/\\/g, '/');
        fileContentsString += `<file path="${pathForTag}">\n${item.content}\n</file>\n\n`;
      });
      generatedContext = fileContentsString.trim()
          ? `${fileStructure}\n\n${fileContentsString.trim()}` : fileStructure;
      if (contextTextarea) {
        contextTextarea.value = generatedContext;
      }
      updateStatus(getText("contextGenerated", allFileContents.length), false);
    } catch (error) {
      console.error("[Shotgun Prompter] Error during context generation:",
          error);
      updateStatus(getText("errorGeneratingContext"), true);
    } finally {
      const anyFilesToProcessFinally = projectFiles.some(
          pf => pf.file && !pf.excluded && (!rulesActive
              || !pf.isRuleExcluded));
      if (generateContextBtn) {
        generateContextBtn.disabled = !anyFilesToProcessFinally;
      }
      updateCopyButtonStates();
      updateFinalPrompt();
      updateStats();
    }
  }

  function updateFinalPrompt() {
    if (!userTaskTextarea || !finalPromptTextarea
        || !promptTemplateSelect) {
      return;
    }
    const task = userTaskTextarea.value;
    const selectedTemplate = promptTemplates.find(
        t => t.id === selectedPromptTemplateId);
    const rulesContent = selectedTemplate ? selectedTemplate.content
        : "Шаблон промпта не выбран или не найден.";
    const context = generatedContext;
    const currentDate = new Date().toISOString().split('T')[0];
    let populatedPrompt = PROMPT_TEMPLATE_BASE;
    populatedPrompt = populatedPrompt.replace('{CURRENT_DATE}', currentDate);
    populatedPrompt = populatedPrompt.replace('{USER_TASK}',
        task || "No task provided.");
    populatedPrompt = populatedPrompt.replace('{PROMPT_RULES_CONTENT}',
        rulesContent);
    populatedPrompt = populatedPrompt.replace('{GENERATED_CONTEXT}',
        context || "No context generated or provided.");
    finalPromptTextarea.value = populatedPrompt;
    updateCopyButtonStates();
    updateStats();
  }

  function updateCopyButtonStates() {
    const contextCopyIcon = document.getElementById(
        'shotgun-copy-context-icon-el');
    if (contextCopyIcon) {
      contextCopyIcon.style.display = generatedContext
      && generatedContext.trim() ? 'inline-block' : 'none';
    }

    const promptCopyIcon = document.getElementById(
        'shotgun-copy-prompt-icon-el');
    if (promptCopyIcon && finalPromptTextarea) {
      promptCopyIcon.style.display = finalPromptTextarea.value
      && finalPromptTextarea.value.trim() ? 'inline-block' : 'none';
    }
  }

  function debounce(func, delay) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  }

  function resetElementHeight(element, key, defaultHeight) {
      if (element) {
          element.style.height = defaultHeight;
          GM_setValue(key, defaultHeight);
      }
  }

  function createTextareaHeader(labelText, copyButtonId, copyMessageKey, targetTextarea, heightKey, defaultHeight) {
      const headerDiv = createElementWithProps('div', {class: 'shotgun-textarea-header'});
      headerDiv.appendChild(createElementWithProps('h4', {textContent: labelText}));
      const controlsDiv = createElementWithProps('div', {style: 'display: flex; align-items: center;'});

      if (copyButtonId && targetTextarea) {
          const copyIcon = createElementWithProps('span', {
              id: copyButtonId,
              class: 'shotgun-copy-icon',
              textContent: '📋', // Clipboard icon
              title: getText('copy'),
              style: 'margin-right: 5px;'
          });
          copyIcon.addEventListener('click', () => {
              copyToClipboard(targetTextarea.value, copyIcon, copyMessageKey);
          });
          controlsDiv.appendChild(copyIcon);
      }

      if (targetTextarea && heightKey) {
         const resetHeightBtn = createElementWithProps('span', {
           class: 'shotgun-reset-height-icon',
           textContent: '⤓', // Down arrow icon
           title: getText('resetHeight'),
           style: 'cursor: pointer; font-size: 1.3em; color: #5f6368; user-select: none; padding: 2px 4px; border-radius: 3px; margin-left: 5px;'
         });
         resetHeightBtn.addEventListener('click', () => resetElementHeight(targetTextarea, heightKey, defaultHeight));
         resetHeightBtn.addEventListener('mouseover', () => resetHeightBtn.style.backgroundColor = '#e8eaed');
         resetHeightBtn.addEventListener('mouseout', () => resetHeightBtn.style.backgroundColor = 'transparent');
         controlsDiv.appendChild(resetHeightBtn);
      }


      headerDiv.appendChild(controlsDiv);
      return headerDiv;
  }

  function toggleMinimizeModal() {
    if (!modal) {
      return;
    }
    isModalMinimized = !isModalMinimized;
    modal.classList.toggle('minimized', isModalMinimized);
    if (minimizeBtn) {
      minimizeBtn.textContent = isModalMinimized ? '⤣' : '—';
    }
    if (modalHeaderTitle) {
      modalHeaderTitle.style.cursor = isModalMinimized
          ? 'pointer' : 'default';
    }
    if (isModalMinimized) {
      modal.style.top = '';
      modal.style.left = '';
      const mc = modal.querySelector('.shotgun-modal-content');
      if (mc) {
        mc.style.width = '';
        mc.style.height = '';
      }
    } else {
      loadModalPositionAndSize(modal, MODAL_SIZE_KEY, MODAL_POSITION_KEY);
    }
  }

  function saveElementHeight(element, key) {
    if (element && element.style.height) {
      GM_setValue(key, element.style.height);
    }
  }

  function saveModalPositionAndSize(modalElement, sizeKey, positionKey) {
    if (modalElement && (!isModalMinimized || modalElement !== modal)) {
      const modalContent = modalElement.querySelector('.shotgun-modal-content')
          || modalElement;
      if (positionKey) {
        GM_setValue(positionKey,
            {top: modalElement.style.top, left: modalElement.style.left});
      }
      if (sizeKey && modalContent && modalContent.style.width
          && modalContent.style.height) {
        GM_setValue(sizeKey, {
          width: modalContent.style.width,
          height: modalContent.style.height
        });
      }
    }
  }

  function loadModalPositionAndSize(modalElement, sizeKey, positionKey,
      defaultW = '85%', defaultH = '90vh') {
    if (modalElement && (!isModalMinimized || modalElement !== modal)) {
      const modalContent = modalElement.querySelector('.shotgun-modal-content')
          || modalElement;
      if (positionKey) {
        const pos = GM_getValue(positionKey);
        if (pos && pos.top && pos.left) {
          modalElement.style.top = pos.top;
          modalElement.style.left = pos.left;
          modalElement.style.transform = '';
        } else {
          modalElement.style.top = '50%';
          modalElement.style.left = '50%';
          modalElement.style.transform = 'translate(-50%, -50%)';
        }
      }
      if (sizeKey && modalContent) {
        const size = GM_getValue(sizeKey);
        if (size && size.width && size.height) {
          modalContent.style.width = size.width;
          modalContent.style.height = size.height;
        } else {
          modalContent.style.width = defaultW;
          modalContent.style.height = defaultH;
        }
      }
    }
  }

  async function checkSizeAndAutoGenerateContext() {
    const rulesActive = GM_getValue(USE_GITIGNORE_RULES_KEY, true);
    const filesForPotentialContext = projectFiles.filter(
        pf => pf.file && !pf.excluded && (!rulesActive || !pf.isRuleExcluded));

    if (filesForPotentialContext.length === 0) {
      generatedContext = "";
      if (generateContextBtn) {
        generateContextBtn.disabled = true;
      }
      updateFinalPrompt();
      updateStats();
      return;
    }

    let totalSize = 0;
    filesForPotentialContext.forEach(pf => {
        totalSize += pf.file.size;
    });

    if (totalSize > MAX_TOTAL_SIZE_BYTES_FOR_AUTO_GENERATE) {
      updateStatus(`Проект (${(totalSize / (1024 * 1024)).toFixed(
              2)}MB) превышает порог (${(MAX_TOTAL_SIZE_BYTES_FOR_AUTO_GENERATE
              / (1024 * 1024)).toFixed(
              2)}MB) для авто-генерации. Нажмите "Сгенерировать Контекст" вручную.`,
          true);
      if (generateContextBtn) {
        generateContextBtn.disabled = filesForPotentialContext.length
            === 0;
      }
    } else {
      updateStatus("Автоматическая генерация контекста...", false);
      await generateContext();
    }
  }

  function loadElementHeights() {
    const elementsAndKeys = [
      {el: contextTextarea, key: TA_CONTEXT_HEIGHT_KEY, default: '150px'},
      {el: userTaskTextarea, key: TA_USER_TASK_HEIGHT_KEY, default: '80px'},
      {
        el: finalPromptTextarea,
        key: TA_FINAL_PROMPT_HEIGHT_KEY,
        default: '200px'
      }, {el: fileListDiv, key: FILE_LIST_HEIGHT_KEY, default: '200px'},
      {
        el: loadedGitignoreDisplayArea,
        key: TA_LOADED_GITIGNORE_HEIGHT_KEY,
        default: '60px'
      }
    ];
    elementsAndKeys.forEach(item => {
      if (item.el) {
        item.el.style.height = GM_getValue(
            item.key, item.default);
      }
    });
    loadModalPositionAndSize(modal, MODAL_SIZE_KEY, MODAL_POSITION_KEY);
    if (settingsIgnoreRulesTextarea) {
      settingsIgnoreRulesTextarea.style.height = GM_getValue(
          TA_IGNORE_RULES_HEIGHT_KEY, '100px');
    }
    if (leftPanelElement) {
      leftPanelElement.style.flexBasis = GM_getValue(
          PANEL_LEFT_FLEX_BASIS_KEY, '40%');
    }
    const savedFontSize = GM_getValue(FONT_SIZE_KEY, DEFAULT_FONT_SIZE);
    [contextTextarea, userTaskTextarea, finalPromptTextarea, settingsIgnoreRulesTextarea].forEach(ta => {
      if (ta) {
        ta.style.fontSize = savedFontSize;
      }
    });
  }

  function addResizeListeners() {
    const textareasToSave = [
      {el: contextTextarea, key: TA_CONTEXT_HEIGHT_KEY},
      {el: userTaskTextarea, key: TA_USER_TASK_HEIGHT_KEY},
      {el: finalPromptTextarea, key: TA_FINAL_PROMPT_HEIGHT_KEY},
      {el: fileListDiv, key: FILE_LIST_HEIGHT_KEY},
      {el: loadedGitignoreDisplayArea, key: TA_LOADED_GITIGNORE_HEIGHT_KEY},
      {el: settingsIgnoreRulesTextarea, key: TA_IGNORE_RULES_HEIGHT_KEY}
    ];
    textareasToSave.forEach(item => {
      if (item.el) {
        const onResizeEnd = () => saveElementHeight(item.el, item.key);
        item.el.addEventListener('mouseup', onResizeEnd);
        item.el.addEventListener('touchend', onResizeEnd);
      }
    });
    if (modal) {
      const modalContentEl = modal.querySelector('.shotgun-modal-content');
      if (modalContentEl) {
        const resizeObserver = new ResizeObserver(entries => {
          if (!isModalMinimized && modal.style.display === 'block') {
            for (let entry of entries) {
              const targetEl = entry.target;
              if (targetEl.style.width && targetEl.style.height) {
                saveModalPositionAndSize(modal, MODAL_SIZE_KEY, null);
              }
            }
          }
        });
        resizeObserver.observe(modalContentEl);
      }
    }
  }

  function assignUIElements() {
    modal = document.getElementById('shotgun-prompter-modal');
    if (!modal) {
      return;
    }
    fileInput = document.getElementById('shotgun-folder-input-el');
    folderInputLabel = document.getElementById('shotgun-folder-input-label-el');
    fileListDiv = document.getElementById('shotgun-file-list-el');
    generateContextBtn = document.getElementById(
        'shotgun-generate-context-btn-el');
    contextTextarea = document.getElementById('shotgun-context-textarea-el');
    userTaskTextarea = document.getElementById('shotgun-user-task-el');
    promptTemplateSelect = document.getElementById(
        'shotgun-prompt-template-select-el');
    finalPromptTextarea = document.getElementById('shotgun-final-prompt-el');
    statusDiv = modal.querySelector('.shotgun-status');
    versionStatusDiv = modal.querySelector('.shotgun-version-status');
    minimizeBtn = modal.querySelector('.shotgun-minimize-btn');
    modalHeaderTitle = modal.querySelector('.shotgun-modal-header h2');
    settingsBtn = modal.querySelector('.shotgun-settings-btn');
    statsDiv = document.getElementById('shotgun-stats-el');
    contextStatsDiv = document.getElementById('shotgun-context-stats-el');
    promptStatsDiv = document.getElementById('shotgun-prompt-stats-el');
    settingsModal = document.getElementById('shotgun-settings-modal');
    leftPanelElement = document.getElementById('shotgun-left-panel-el');
    rightPanelElement = document.getElementById('shotgun-right-panel-el');
    panelResizerElement = document.getElementById('shotgun-panel-resizer-el');
    settingsIgnoreRulesTextarea = document.getElementById(
        'shotgun-main-ignore-rules-ta');
    autoUpdateContextCheckbox = document.getElementById(
        'shotgun-auto-update-context-api-cb');
    settingsAutoUpdateIntervalInput = document.getElementById(
        'shotgun-settings-auto-update-interval');
    insertPromptBtn = document.getElementById('shotgun-insert-prompt-btn-el');
    loadedGitignoreDisplayArea = document.getElementById(
        'shotgun-loaded-gitignore-display-el');
    fileSearchInput = document.getElementById('shotgun-file-search-input-el');
    fileReadErrorsDiv = document.getElementById('shotgun-file-read-errors-div');
    useGitignoreCheckbox = document.getElementById(
        'shotgun-use-gitignore-checkbox');
    fileApiInputBtn = document.getElementById('shotgun-folder-api-input-btn');
    refreshApiFolderBtn = document.getElementById(
        'shotgun-refresh-api-folder-btn');
    selectAllFilesBtn = document.getElementById('shotgun-select-all-btn');
    deselectAllFilesBtn = document.getElementById('shotgun-deselect-all-btn');
  }

  function populatePromptTemplateSelect() {
    if (!promptTemplateSelect) {
      return;
    }
    const currentValueBeforeUpdate = promptTemplateSelect.value;
    while (promptTemplateSelect.firstChild) {
      promptTemplateSelect.removeChild(promptTemplateSelect.firstChild);
    }
    let idToSelect = selectedPromptTemplateId;
    if (currentValueBeforeUpdate && promptTemplates.find(
        t => t.id === currentValueBeforeUpdate)) {
      idToSelect = currentValueBeforeUpdate;
    } else if (!promptTemplates.find(t => t.id === selectedPromptTemplateId)
        && promptTemplates.length > 0) {
      idToSelect = promptTemplates[0].id;
    } else if (promptTemplates.length === 0) {
      idToSelect = null;
    }
    promptTemplates.forEach(template => {
      const option = createElementWithProps('option',
          {value: template.id, textContent: template.name});
      if (template.id === idToSelect) {
        option.selected = true;
      }
      promptTemplateSelect.appendChild(option);
    });
    selectedPromptTemplateId = promptTemplateSelect.value
        || (promptTemplates.length > 0 ? promptTemplates[0].id : null);
    GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, selectedPromptTemplateId);
  }

  function onModalDragStart(event) {
    if (event.target.closest(
        '.shotgun-control-btn, .shotgun-settings-btn, input, textarea, select, button, .shotgun-panel-resizer')) {
      return;
    }
    if (modal && !isModalMinimized) {
      isDragging = true;
      dragOffsetX = event.clientX - modal.offsetLeft;
      dragOffsetY = event.clientY - modal.offsetTop;
      document.addEventListener('mousemove', onModalDragging);
      document.addEventListener('mouseup', onModalDragEnd);
      modal.classList.add('dragging');
    }
  }

  function onModalDragging(event) {
    if (isDragging && modal && !isModalMinimized) {
      event.preventDefault();
      modal.style.left = (event.clientX - dragOffsetX) + 'px';
      modal.style.top = (event.clientY - dragOffsetY) + 'px';
      modal.style.transform = '';
    }
  }

  function onModalDragEnd() {
    if (isDragging) {
      isDragging = false;
      document.removeEventListener('mousemove', onModalDragging);
      document.removeEventListener('mouseup', onModalDragEnd);
      if (modal) {
        modal.classList.remove('dragging');
      }
      saveModalPositionAndSize(modal, null, MODAL_POSITION_KEY);
    }
  }

  function onPanelResizeStart(event) {
    event.preventDefault();
    isPanelResizing = true;
    // Убеждаемся, что leftPanelElement и modal доступны
    assignUIElements(); // Переприсваиваем элементы на всякий случай
    if (!leftPanelElement || !modal) {
        console.error('[Shotgun Prompter] Resize start failed: panel or modal element not found.');
        isPanelResizing = false;
        return;
    }
    initialLeftPanelBasis = parseFloat(leftPanelElement.style.flexBasis) || leftPanelElement.offsetWidth;
    // Используем clientX из события мыши или touches[0] из тач-события
    initialResizeMouseX = event.clientX || (event.touches ? event.touches[0].clientX : null);
    if (initialResizeMouseX === null) {
        console.error('[Shotgun Prompter] Resize start failed: clientX not found.');
        isPanelResizing = false;
        return;
    }
    document.addEventListener('mousemove', onPanelResizing);
    document.addEventListener('mouseup', onPanelResizeEnd);
    document.addEventListener('touchmove', onPanelResizing, { passive: false }); // Тач-события
    document.addEventListener('touchend', onPanelResizeEnd); // Тач-события

    if (document.body) {
      document.body.classList.add('panel-resizing-active');
    }
  }

  function onPanelResizing(event) {
    // Используем clientX из события мыши или touches[0] из тач-события
    const clientX = event.clientX || (event.touches ? event.touches[0].clientX : null);
    if (!isPanelResizing || !leftPanelElement || !modal || clientX === null) {
      return;
    }
    const deltaX = clientX - initialResizeMouseX;
    let newLeftPanelWidth = initialLeftPanelBasis + deltaX;
    const modalBody = modal.querySelector('.shotgun-modal-body');
    if (!modalBody) {
      return;
    }
    const modalBodyRect = modalBody.getBoundingClientRect();
    const minPanelWidth = 100;
    const resizerWidth = panelResizerElement ? panelResizerElement.offsetWidth
        + (parseFloat(getComputedStyle(panelResizerElement).marginLeft) || 0)
        + (parseFloat(getComputedStyle(panelResizerElement).marginRight) || 0)
        : 5;
    const maxLeftPanelWidth = modalBodyRect.width - minPanelWidth
        - resizerWidth;
    if (newLeftPanelWidth < minPanelWidth) {
      newLeftPanelWidth = minPanelWidth;
    }
    if (newLeftPanelWidth
        > maxLeftPanelWidth) {
      newLeftPanelWidth = maxLeftPanelWidth;
    }
    leftPanelElement.style.flexBasis = newLeftPanelWidth + 'px';
  }

  function onPanelResizeEnd() {
    if (isPanelResizing) {
      isPanelResizing = false;
      document.removeEventListener('mousemove', onPanelResizing);
      document.removeEventListener('mouseup', onPanelResizeEnd);
      document.removeEventListener('touchmove', onPanelResizing, { passive: false }); // Тач-события
      document.removeEventListener('touchend', onPanelResizeEnd); // Тач-события

      if (document.body) {
        document.body.classList.remove(
            'panel-resizing-active');
      }
      if (leftPanelElement) {
        GM_setValue(PANEL_LEFT_FLEX_BASIS_KEY,
            leftPanelElement.style.flexBasis);
      }
    }
  }

  function createModal() {
    console.log('[Shotgun Prompter] Entering createModal function.'); // Лог в начале функции
    if (document.getElementById('shotgun-prompter-modal')) {
      console.log('[Shotgun Prompter] Modal element already exists in DOM inside createModal. Re-assigning elements.'); // Лог если модальное окно уже в DOM
      assignUIElements();
      loadElementHeights();
      populatePromptTemplateSelect();
      updateFinalPrompt();
      return;
    }
    console.log('[Shotgun Prompter] Modal element not found in DOM inside createModal. Proceeding with creation.'); // Лог перед созданием элементов
    modal = createElementWithProps('div',
        {id: 'shotgun-prompter-modal', class: 'shotgun-modal'});
    console.log('[Shotgun Prompter] Modal element created in createModal.', modal); // Лог после создания элемента модального окна
    const modalContent = createElementWithProps('div',
        {class: 'shotgun-modal-content'});
    const modalHeader = createElementWithProps('div',
        {class: 'shotgun-modal-header'});
    modalHeader.onmousedown = onModalDragStart;
    modalHeaderTitle = createElementWithProps('h2',
        {textContent: 'Shotgun Prompter'});
    modalHeaderTitle.addEventListener('click', () => {
      if (isModalMinimized) {
        toggleMinimizeModal();
      }
    });
    const headerControls = createElementWithProps('div',
        {class: 'shotgun-header-controls'});
    settingsBtn = createElementWithProps('span',
        {class: 'shotgun-control-btn shotgun-settings-btn', textContent: '⚙️'});
    settingsBtn.title = getText("settings");
    settingsBtn.addEventListener('click', () => {
      createSettingsModal();
      if (settingsModal) {
        settingsModal.style.display = 'block';
        loadSettings();
      }
    });

    minimizeBtn = createElementWithProps('span',
        {class: 'shotgun-control-btn shotgun-minimize-btn', textContent: '—'});
    minimizeBtn.addEventListener('click', toggleMinimizeModal);
    const closeBtnElement = createElementWithProps('span',
        {class: 'shotgun-control-btn shotgun-close-btn', textContent: '×'});
    closeBtnElement.addEventListener('click', () => {
      if (modal) {
        modal.style.display = 'none';
      }
    });
    headerControls.appendChild(settingsBtn);
    headerControls.appendChild(minimizeBtn);
    headerControls.appendChild(closeBtnElement);
    modalHeader.appendChild(modalHeaderTitle);
    modalHeader.appendChild(headerControls);
    const modalBody = createElementWithProps('div',
        {class: 'shotgun-modal-body'});
    leftPanelElement = createElementWithProps('div', {
      id: 'shotgun-left-panel-el',
      class: 'shotgun-panel shotgun-left-panel'
    });
    const fileInputContainer = createElementWithProps('div',
        {class: 'shotgun-file-input-container'});

    fileInput = createElementWithProps('input', {
      type: 'file',
      id: 'shotgun-folder-input-el',
      webkitdirectory: '',
      directory: '',
      multiple: '',
      style: 'display: none;'
    });
    fileInput.addEventListener('change', handleLegacyFileSelection);

    const fileInputLabelButton = createElementWithProps('label', {
      for: 'shotgun-folder-input-el',
      class: 'shotgun-button',
      textContent: getText('selectFolderLegacy')
    });
    fileInputContainer.appendChild(fileInput);
    fileInputContainer.appendChild(fileInputLabelButton);

    fileApiInputBtn = createElementWithProps('button', {
      id: 'shotgun-folder-api-input-btn',
      class: 'shotgun-button',
      textContent: getText('selectFolderApi'),
      style: 'margin-left: 5px;'
    });
    if (!window.showDirectoryPicker) {
      fileApiInputBtn.disabled = true;
      fileApiInputBtn.title = getText("apiNotSupported");
    } else {
      fileApiInputBtn.title = getText("apiSupportedTooltip");
    }
    fileApiInputBtn.addEventListener('click', handleApiFolderSelect);
    refreshApiFolderBtn = createElementWithProps('button', {
      id: 'shotgun-refresh-api-folder-btn',
      class: 'shotgun-button shotgun-button-small',
      textContent: getText('refreshApi'),
      style: 'display: none; margin-left: 5px;'
    });
    refreshApiFolderBtn.addEventListener('click', () => {
      if (currentDirectoryHandle) {
        processDirectoryHandle(currentDirectoryHandle,
            true);
      }
    });
    folderInputLabel = createElementWithProps('span', {
      id: 'shotgun-folder-input-label-el',
      style: 'margin-left: 10px; font-size: 0.85em; color: #5f6368;'
    });
    folderInputLabel.textContent = lastSelectedFolderName
        ? `${getText("lastFolder")} ${lastSelectedFolderName}` : getText('folderNotSelected');
    fileInputContainer.append(fileApiInputBtn, refreshApiFolderBtn,
        folderInputLabel);
    leftPanelElement.appendChild(fileInputContainer);

    fileReadErrorsDiv = createElementWithProps('div', {
      id: 'shotgun-file-read-errors-div',
      class: 'shotgun-file-read-errors',
      style: 'display: none;'
    });
    fileReadErrorsDiv.appendChild(createElementWithProps('h4', {textContent: getText('fileReadErrors')}));
    const clearErrorsBtn = createElementWithProps('button', {
      class: 'shotgun-button shotgun-button-small',
      textContent: getText('clearErrors'),
      style: 'margin-top: 5px;'
    });
    clearErrorsBtn.addEventListener('click', () => {
      if (fileReadErrorsDiv) {
        while (fileReadErrorsDiv.firstChild) {
          fileReadErrorsDiv.removeChild(fileReadErrorsDiv.firstChild);
        }
        fileReadErrorsDiv.style.display = 'none';
      }
    });
    fileReadErrorsDiv.appendChild(clearErrorsBtn);
    leftPanelElement.appendChild(fileReadErrorsDiv);

    const searchInputDiv = createElementWithProps('div',
        {style: 'margin-bottom: 8px; display: flex; align-items: center; gap: 5px;'});
    searchInputDiv.appendChild(createElementWithProps('span',
        {textContent: '🔍', style: 'font-size: 1.2em; user-select: none;'}));
    fileSearchInput = createElementWithProps('input', {
      type: 'text',
      id: 'shotgun-file-search-input-el',
      class: 'shotgun-input',
      placeholder: getText('searchFilesPlaceholder'),
      style: 'flex-grow: 1; margin-bottom: 0;'
    });
    searchInputDiv.appendChild(fileSearchInput);
    leftPanelElement.appendChild(searchInputDiv);

    const fileListHeader = createElementWithProps('div',
        {class: 'shotgun-file-list-header'});
    fileListHeader.appendChild(
        createElementWithProps('h4', {textContent: getText('selectedFiles')}));

    function setAllNodesExpansion(expandState) {
      function recurseSet(node, state) {
        if (node && node._isDir) {
          node._expanded = state;
          Object.values(node._children).forEach(
              child => recurseSet(child, state));
        }
      }

      Object.values(displayTreeRoot).forEach(
          rootNode => recurseSet(rootNode, expandState));
      persistCurrentExpansionState(displayTreeRoot);
      renderFileList();
    }

    function setAllNodesCheckedState(rootTreeObject, targetCheckedState) {
      function recurseSet(node, isChecked) {
        node._excluded = !isChecked;
        if (node._pf && node._pf.id) {
          const projectFileEntry = projectFiles.find(
              pf => pf.id === node._pf.id);
          if (projectFileEntry) {
            projectFileEntry.excluded = !isChecked;
          }
          if (node._pf) {
            node._pf.excluded = !isChecked;
          }
        }
        if (node._isDir && node._children) {
          Object.values(node._children).forEach(
              child => recurseSet(child, isChecked));
        }
      }

      if (rootTreeObject && typeof rootTreeObject === 'object') {
        Object.values(rootTreeObject).forEach(rootNode => {
          if (rootNode) {
            recurseSet(rootNode, targetCheckedState);
          }
        });
      }
      renderFileList();
      updateStats();
      const anyFilesToProcess = projectFiles.some(
          pf => pf.file && !pf.excluded && (!GM_getValue(
              USE_GITIGNORE_RULES_KEY, true) || !pf.isRuleExcluded));
      if (generateContextBtn) {
        generateContextBtn.disabled = !(projectFiles.length
            > 0 && anyFilesToProcess);
      }
    }

    const fileListControls = createElementWithProps('div',
        {class: 'shotgun-file-list-controls'});
    const expandAllBtn = createElementWithProps('button', {
      class: 'shotgun-button shotgun-button-small',
      textContent: getText('expandAll')
    });
    expandAllBtn.onclick = () => setAllNodesExpansion(true);
    const collapseAllBtn = createElementWithProps('button', {
      class: 'shotgun-button shotgun-button-small',
      textContent: getText('collapseAll')
    });
    collapseAllBtn.onclick = () => setAllNodesExpansion(false);
    selectAllFilesBtn = createElementWithProps('button', {
      id: 'shotgun-select-all-btn',
      class: 'shotgun-button shotgun-button-small',
      textContent: getText('selectAll')
    });
    selectAllFilesBtn.onclick = () => {
      projectFiles.forEach(pf => pf.excluded = false);
      displayTreeRoot = buildDisplayTreeAndSetExclusion(projectFiles);
      renderFileList();
      if (generateContextBtn) {
        generateContextBtn.disabled = projectFiles.length
            === 0;
      }
    };
    selectAllFilesBtn.onclick = () => setAllNodesCheckedState(displayTreeRoot,
        true);
    deselectAllFilesBtn = createElementWithProps('button', {
      id: 'shotgun-deselect-all-btn',
      class: 'shotgun-button shotgun-button-small',
      textContent: getText('deselectAll')
    });
    deselectAllFilesBtn.onclick = () => setAllNodesCheckedState(displayTreeRoot,
        false);
    fileListControls.append(expandAllBtn, collapseAllBtn, selectAllFilesBtn,
        deselectAllFilesBtn);
    fileListHeader.appendChild(fileListControls);
    leftPanelElement.appendChild(fileListHeader);

    const fileListContainerWithReset = createElementWithProps('div', {style: 'display: flex; flex-direction: column; flex-grow: 1;'});
    const fileListStatsHeader = createElementWithProps('div', {style: 'display: flex; justify-content: space-between; align-items: center;'});
    statsDiv = createElementWithProps('div',
        {id: 'shotgun-stats-el', class: 'shotgun-stats-text'});
    fileListStatsHeader.appendChild(statsDiv);

    const fileListResetHeightBtn = createElementWithProps('span', {
      class: 'shotgun-reset-height-icon',
      textContent: '⤓',
      title: getText('resetHeight'),
      style: 'cursor: pointer; font-size: 1.3em; color: #5f6368; user-select: none; padding: 2px 4px; border-radius: 3px; margin-left: 5px;'
    });
    fileListResetHeightBtn.addEventListener('click', () => resetElementHeight(fileListDiv, FILE_LIST_HEIGHT_KEY, '200px'));
    fileListResetHeightBtn.addEventListener('mouseover', () => fileListResetHeightBtn.style.backgroundColor = '#e8eaed');
    fileListResetHeightBtn.addEventListener('mouseout', () => fileListResetHeightBtn.style.backgroundColor = 'transparent');
    fileListStatsHeader.appendChild(fileListResetHeightBtn);
    fileListContainerWithReset.appendChild(fileListStatsHeader);

    fileListDiv = createElementWithProps('div',
        {id: 'shotgun-file-list-el', class: 'shotgun-file-list'});
    fileListContainerWithReset.appendChild(fileListDiv);
    leftPanelElement.appendChild(fileListContainerWithReset);

    const ignoreRulesHeaderContainer = createElementWithProps('div',
        {style: 'display: flex; align-items: center; justify-content: space-between; margin-top: 15px;'});
    ignoreRulesHeaderContainer.appendChild(createElementWithProps('h3', {
      textContent: getText('ignoreRulesGitignoreSyntax'),
      style: 'margin-bottom: 0;'
    }));
    const useGitignoreContainer = createElementWithProps('div',
        {style: 'display: flex; align-items: center; flex-shrink: 0;'});
    useGitignoreCheckbox = createElementWithProps('input', {
      type: 'checkbox',
      id: 'shotgun-use-gitignore-checkbox',
      style: 'margin-right: 4px;'
    });
    const useGitignoreLabel = createElementWithProps('label', {
      textContent: getText('applyIgnoreRules'),
      for: 'shotgun-use-gitignore-checkbox',
      style: 'cursor: pointer; font-size: 0.9em; color: #5f6368;'
    });
    useGitignoreContainer.append(useGitignoreCheckbox, useGitignoreLabel);
    ignoreRulesHeaderContainer.appendChild(useGitignoreContainer);
    leftPanelElement.appendChild(ignoreRulesHeaderContainer);

    const globalIgnoreRulesToggleHeader = createElementWithProps('div', {
      id: 'shotgun-global-ignore-rules-toggle-el',
      class: 'shotgun-collapsible-header',
      style: 'margin-top: 8px;'
    });
    const globalExpanderSpan = createElementWithProps('span',
        {class: 'shotgun-collapsible-expander', textContent: '▼'});
    const globalTitleH5 = createElementWithProps('h5', {
      textContent: getText('ignoreRulesDetails'),
      style: 'margin: 0; font-size: 0.9em; color: #3c4043; display: inline-block;'
    });
    globalIgnoreRulesToggleHeader.append(globalExpanderSpan, globalTitleH5);
    leftPanelElement.appendChild(globalIgnoreRulesToggleHeader);

    ignoreRulesColumnsContainer = createElementWithProps('div',
        {class: 'shotgun-ignore-rules-columns-container'});
    ignoreRulesColumnsContainer.style.display = 'flex';

    globalIgnoreRulesToggleHeader.addEventListener('click', () => {
      const isExpanded = ignoreRulesColumnsContainer.style.display !== 'none';
      ignoreRulesColumnsContainer.style.display = isExpanded ? 'none' : 'flex';
      globalExpanderSpan.textContent = isExpanded ? '▶' : '▼';
    });

    const loadedRulesColumn = createElementWithProps('div', {
      class: 'shotgun-ignore-column',
      id: 'shotgun-loaded-gitignore-column-el'
    });
    loadedRulesColumn.style.display = 'none';
    const loadedTitle = createElementWithProps('h5', {
      textContent: getText('gitignoreLoadedReadonly'),
      style: 'margin-top:0; margin-bottom: 5px; font-size: 0.85em; color: #5f6368;'
    });

    loadedGitignoreDisplayArea = createElementWithProps('textarea', {
      id: 'shotgun-loaded-gitignore-display-el',
      class: 'shotgun-textarea',
      readonly: '',
      style: `height: ${GM_getValue(TA_LOADED_GITIGNORE_HEIGHT_KEY,
          '100px')}; resize: vertical; min-height: 40px; background-color: #f8f9fa;`
    });

    const loadedGitignoreHeaderWithReset = createTextareaHeader(
        getText('gitignoreLoadedReadonly'),
        null, null,
        loadedGitignoreDisplayArea, TA_LOADED_GITIGNORE_HEIGHT_KEY, '100px'
    );
    loadedRulesColumn.append(loadedGitignoreHeaderWithReset, loadedGitignoreDisplayArea);
    ignoreRulesColumnsContainer.appendChild(loadedRulesColumn);

    const manualRulesColumn = createElementWithProps('div', {
      class: 'shotgun-ignore-column',
      id: 'shotgun-manual-ignore-rules-column-el'
    });
    const manualTitle = createElementWithProps('h5', {
      textContent: getText('manualEditable'),
      style: 'margin-top:0; margin-bottom: 5px; font-size: 0.85em; color: #5f6368;'
    });

    settingsIgnoreRulesTextarea = createElementWithProps('textarea', {
      id: 'shotgun-main-ignore-rules-ta',
      class: 'shotgun-textarea',
      style: `height: ${GM_getValue(TA_IGNORE_RULES_HEIGHT_KEY,
          '100px')}; resize: vertical; min-height: 40px;`,
      placeholder: DEFAULT_IGNORE_RULES
    });

    const manualIgnoreHeaderWithReset = createTextareaHeader(
        getText('manualEditable'),
        null, null,
        settingsIgnoreRulesTextarea, TA_IGNORE_RULES_HEIGHT_KEY, '100px'
    );
    manualRulesColumn.append(manualIgnoreHeaderWithReset, settingsIgnoreRulesTextarea);
    ignoreRulesColumnsContainer.appendChild(manualRulesColumn);

    leftPanelElement.appendChild(ignoreRulesColumnsContainer);

    useGitignoreCheckbox.checked = GM_getValue(USE_GITIGNORE_RULES_KEY, true);
    useGitignoreCheckbox.addEventListener('change', () => {
      const isChecked = useGitignoreCheckbox.checked;
      GM_setValue(USE_GITIGNORE_RULES_KEY, isChecked);
      if (settingsIgnoreRulesTextarea) {
        settingsIgnoreRulesTextarea.disabled = !isChecked;
        settingsIgnoreRulesTextarea.style.backgroundColor = !isChecked ? '#e9ecef' : '#fff';
        settingsIgnoreRulesTextarea.style.color = !isChecked ? '#6c757d' : '#202124';
      }
      if (loadedGitignoreDisplayArea) {
        loadedGitignoreDisplayArea.style.backgroundColor = isChecked ? '#f8f9fa'
            : '#e9ecef';
        loadedGitignoreDisplayArea.style.color = isChecked ? '#202124'
            : '#6c757d';
      }
      updateLoadedGitignoreDisplay();

      let opPromise;
      if (apiFolderSelected && currentDirectoryHandle) {
        opPromise = processDirectoryHandle(currentDirectoryHandle, true);
      } else {
        updateFileSelectionUI();
        opPromise = Promise.resolve();
      }

      opPromise.then(() => {
        updateStatus(getText(isChecked ? 'ignoreRulesEnabled' : 'ignoreRulesDisabled'));
      }).catch(err => {
        console.error(
            "[Shotgun Prompter] Error during ignore rules change operation:",
            err);
        updateStatus(getText("errorApplyingIgnoreRuleChange"), true);
      });
    });

    const debouncedSaveAndApplyIgnoreRules = debounce(() => {
      if (!useGitignoreCheckbox.checked) {
        return;
      }
      GM_setValue(CUSTOM_IGNORE_RULES_KEY, settingsIgnoreRulesTextarea.value);
      applyIgnoreRulesToProjectFiles();
      if (projectFiles.length > 0) {
        displayTreeRoot = buildDisplayTreeAndSetExclusion(projectFiles);
        renderFileList();
        persistCurrentExpansionState(displayTreeRoot);
      }
      updateStatus(getText("manualIgnoreRulesSaved"), false);
    }, 750);
    settingsIgnoreRulesTextarea.addEventListener('input',
        debouncedSaveAndApplyIgnoreRules);
    if (settingsIgnoreRulesTextarea) {
       const initialUseRules = GM_getValue(USE_GITIGNORE_RULES_KEY, true);
       settingsIgnoreRulesTextarea.disabled = !initialUseRules;
       settingsIgnoreRulesTextarea.style.backgroundColor = !initialUseRules ? '#e9ecef' : '#fff';
       settingsIgnoreRulesTextarea.style.color = !initialUseRules ? '#6c757d' : '#202124';
    }

    const ignoreTesterSection = createElementWithProps('div',
        {style: 'margin-top: 20px;'});
    ignoreTesterSection.appendChild(createElementWithProps('h4', {
      textContent: getText('ignoreRuleTester'),
      style: 'margin-top:0;'
    }));
    const testerDiv = createElementWithProps('div',
        {class: 'shotgun-settings-ignore-tester'});
    settingsIgnoreTesterPathInput = createElementWithProps('input', {
      type: 'text',
      id: 'shotgun-ignore-tester-path-input',
      class: 'shotgun-input',
      placeholder: getText('enterPathToTest')
    });
    settingsIgnoreTesterResultSpan = createElementWithProps('span', {
      id: 'shotgun-ignore-tester-result-span',
      style: 'font-weight: bold; margin-left: 10px;'
    });

    testerDiv.append(settingsIgnoreTesterPathInput,
        settingsIgnoreTesterResultSpan);
    ignoreTesterSection.appendChild(testerDiv);
    leftPanelElement.appendChild(ignoreTesterSection);

    if (settingsIgnoreTesterPathInput) {
      const debouncedTestIgnore = debounce(() => {
        const testPath = settingsIgnoreTesterPathInput.value.trim();
        if (testPath) {
          const combinedIgnoreRules = GM_getValue(
                  SCRIPT_PREFIX + 'loaded_gitignore_rules', '') + '\n'
              + GM_getValue(CUSTOM_IGNORE_RULES_KEY, DEFAULT_IGNORE_RULES);
          const isIgnored = isPathIgnored(testPath, combinedIgnoreRules);
          if (settingsIgnoreTesterResultSpan) {
            settingsIgnoreTesterResultSpan.textContent = isIgnored
                ? getText('ignored') : getText('notIgnored');
            settingsIgnoreTesterResultSpan.style.color = isIgnored ? 'red'
                : 'green';
          }
        } else {
          if (settingsIgnoreTesterResultSpan) {
            settingsIgnoreTesterResultSpan.textContent = '';
          }
        }
      }, 300);

      settingsIgnoreTesterPathInput.addEventListener('input',
          debouncedTestIgnore);
    }

    const contextActionsContainer = createElementWithProps('div',
        {class: 'shotgun-actions-container'});
    generateContextBtn = createElementWithProps('button', {
      id: 'shotgun-generate-context-btn-el',
      class: 'shotgun-button',
      textContent: getText('generateContext'),
      disabled: ''
    });
    contextActionsContainer.appendChild(generateContextBtn);
    leftPanelElement.appendChild(contextActionsContainer);

    const contextHeaderWithReset = createTextareaHeader(
        getText('context'),
        'shotgun-copy-context-icon-el',
        'contextCopied',
        contextTextarea, TA_CONTEXT_HEIGHT_KEY, '150px'
    );
    leftPanelElement.appendChild(contextHeaderWithReset);

    contextStatsDiv = createElementWithProps('div',
        {id: 'shotgun-context-stats-el', class: 'shotgun-stats-text'});
    leftPanelElement.appendChild(contextStatsDiv);
    contextTextarea = createElementWithProps('textarea', {
      id: 'shotgun-context-textarea-el',
      class: 'shotgun-textarea',
      readonly: '',
      placeholder: getText('contextPlaceholder')
    });
    leftPanelElement.appendChild(contextTextarea);
    panelResizerElement = createElementWithProps('div',
        {id: 'shotgun-panel-resizer-el', class: 'shotgun-panel-resizer'});

    // !!! ДОБАВЛЯЕМ ЭТОТ СЛУШАТЕЛЬ !!!
    if(panelResizerElement) {
        panelResizerElement.addEventListener('mousedown', onPanelResizeStart);
        panelResizerElement.addEventListener('touchstart', (event) => {
             if (event.touches.length === 1) onPanelResizeStart(event.touches[0]);
        }); // Добавляем поддержку тач-событий
    }
    // !!! КОНЕЦ ДОБАВЛЕНИЯ !!!

    rightPanelElement = createElementWithProps('div', {
      id: 'shotgun-right-panel-el',
      class: 'shotgun-panel shotgun-right-panel'
    });
    rightPanelElement.appendChild(
        createElementWithProps('h3', {textContent: getText('step2Prompt')}));
    rightPanelElement.appendChild(
        createElementWithProps('h4', {textContent: getText('yourTaskForAi')}));
    userTaskTextarea = createElementWithProps('textarea', {
      id: 'shotgun-user-task-el',
      class: 'shotgun-textarea',
      placeholder: getText('userTaskPlaceholder')
    });

    const userTaskHeaderWithReset = createTextareaHeader(
        getText('yourTaskForAi'),
        null, null,
        userTaskTextarea, TA_USER_TASK_HEIGHT_KEY, '80px'
    );
    rightPanelElement.removeChild(rightPanelElement.lastChild);
    rightPanelElement.appendChild(userTaskHeaderWithReset);

    rightPanelElement.appendChild(userTaskTextarea);

    rightPanelElement.appendChild(
        createElementWithProps('h4', {textContent: getText('promptTemplate')}));
    promptTemplateSelect = createElementWithProps('select',
        {id: 'shotgun-prompt-template-select-el', class: 'shotgun-select'});
    rightPanelElement.appendChild(promptTemplateSelect);

    const finalPromptHeaderWithReset = createTextareaHeader(
        getText('finalPromptText'),
        'shotgun-copy-prompt-icon-el',
        'promptCopied',
        finalPromptTextarea, TA_FINAL_PROMPT_HEIGHT_KEY, '200px'
    );
    rightPanelElement.appendChild(finalPromptHeaderWithReset);

    promptStatsDiv = createElementWithProps('div',
        {id: 'shotgun-prompt-stats-el', class: 'shotgun-stats-text'});
    rightPanelElement.appendChild(promptStatsDiv);
    finalPromptTextarea = createElementWithProps('textarea', {
      id: 'shotgun-final-prompt-el',
      class: 'shotgun-textarea',
      readonly: '',
      placeholder: getText('finalPromptPlaceholder')
    });
    rightPanelElement.appendChild(finalPromptTextarea);

    const finalPromptActionsContainer = createElementWithProps('div',
        {class: 'shotgun-actions-container'});
    insertPromptBtn = createElementWithProps('button', {
      id: 'shotgun-insert-prompt-btn-el',
      class: 'shotgun-button',
      textContent: getText('insertIntoAiStudio'),
      title: getText('insertIntoAiStudioTooltip')
    });
    finalPromptActionsContainer.appendChild(insertPromptBtn);
    rightPanelElement.appendChild(finalPromptActionsContainer);

    modalBody.append(leftPanelElement, panelResizerElement, rightPanelElement);
    const modalFooter = createElementWithProps('div',
        {class: 'shotgun-modal-footer'});
    statusDiv = createElementWithProps('div',
        {class: 'shotgun-status', textContent: getText('ready')});
    versionStatusDiv = createElementWithProps('div',
        {class: 'shotgun-version-status'});
    const currentVersionSpan = createElementWithProps('div', {
      class: 'shotgun-current-script-version',
      textContent: `v${SCRIPT_VERSION}`
    });

    modalFooter.appendChild(versionStatusDiv);
    modalFooter.appendChild(statusDiv);
    modalFooter.appendChild(currentVersionSpan);
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    modal.appendChild(modalContent);
    console.log('[Shotgun Prompter] Modal content appended to modal element.'); // Лог перед добавлением в body
    if (document.body) {
      document.body.appendChild(modal);
      console.log('[Shotgun Prompter] Modal appended to document body.'); // Лог после добавления в body
    } else {
      console.error('[Shotgun Prompter] document.body is not available. Cannot append modal.'); // Лог если body не доступен
      return; // Прерываем выполнение функции, если body нет
    }
    assignUIElements();
    loadElementHeights();
    populatePromptTemplateSelect();
    updateFinalPrompt();
    console.log('[Shotgun Prompter] UI elements assigned and initial setup done in createModal.'); // Лог после assignUIElements и начальной настройки

    if (insertPromptBtn) {
      insertPromptBtn.addEventListener('click',
          insertPromptIntoAiStudio);
    }
    if (userTaskTextarea) {
      userTaskTextarea.addEventListener('input',
          updateFinalPrompt);
    }
    if (promptTemplateSelect) {
      promptTemplateSelect.addEventListener('change', (event) => {
        selectedPromptTemplateId = event.target.value;
        GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, selectedPromptTemplateId);
        updateFinalPrompt();
      });
    }
    updateLoadedGitignoreDisplay();
    if (fileSearchInput) {
      fileSearchInput.addEventListener('input', debounce(() => {
        renderFileList();
      }, 300));
    }
    updateCopyButtonStates();
    checkForUpdates();

    if (autoUpdateContextCheckbox) {
      autoUpdateContextCheckbox.addEventListener('change', () => {
        GM_setValue(AUTO_UPDATE_CONTEXT_API_KEY,
            autoUpdateContextCheckbox.checked);
        updateAutoUpdateCheckboxState();
      });
    }
    if (settingsAutoUpdateIntervalInput) {
      settingsAutoUpdateIntervalInput.addEventListener('change',
          debounce(() => {
            GM_setValue(AUTO_UPDATE_INTERVAL_KEY,
                settingsAutoUpdateIntervalInput.value);
            if (GM_getValue(AUTO_UPDATE_CONTEXT_API_KEY, false)) {
              startAutoUpdateTimer();
            }
          }, 500));
    }
    updateAutoUpdateCheckboxState();
    console.log('[Shotgun Prompter] Exiting createModal function.'); // Лог перед выходом из функции
  }

  function updateLoadedGitignoreDisplay() {
    const loadedRulesColumn = document.getElementById(
        'shotgun-loaded-gitignore-column-el');
    if (!loadedGitignoreDisplayArea || !loadedRulesColumn) {
      return;
    }

    const loadedRules = GM_getValue(SCRIPT_PREFIX + 'loaded_gitignore_rules',
        '');
    loadedGitignoreDisplayArea.value = loadedRules;

    if (loadedRules) {
      loadedRulesColumn.style.display = 'flex';
    } else {
      loadedRulesColumn.style.display = 'none';
    }

    const useRules = GM_getValue(USE_GITIGNORE_RULES_KEY, true);
    loadedGitignoreDisplayArea.style.backgroundColor = useRules ? '#f8f9fa'
        : '#e9ecef';
    loadedGitignoreDisplayArea.style.color = useRules ? '#202124' : '#6c757d';
    if (settingsIgnoreRulesTextarea) {
      settingsIgnoreRulesTextarea.style.backgroundColor = useRules ? '#fff' : '#e9ecef';
      settingsIgnoreRulesTextarea.style.color = useRules ? '#202124' : '#6c757d';
    }
  }

  function insertPromptIntoAiStudio() {
    const promptText = finalPromptTextarea.value;
    if (!promptText) {
      updateStatus(getText("noPromptToInsert"), true);
      return;
    }

    let targetTextarea = document.activeElement;

    if (!targetTextarea || (targetTextarea.tagName !== 'TEXTAREA'
        && !targetTextarea.isContentEditable)) {
      targetTextarea = document.querySelector(
          'textarea[aria-label*="Type something"], textarea.textarea.gmat-body-medium');
      if (!targetTextarea) {
        targetTextarea = document.querySelector(
            'div[contenteditable="true"][aria-label*="Prompt"], div[contenteditable="true"][aria-label*="Message"]');
      }
    }

    if (targetTextarea && (targetTextarea.tagName === 'TEXTAREA'
        || targetTextarea.isContentEditable)) {
      if (targetTextarea.tagName === 'TEXTAREA'
          || (targetTextarea.isContentEditable && typeof targetTextarea.value
              !== 'undefined')) {
        targetTextarea.value = promptText;
      } else {
        targetTextarea.textContent = promptText;
      }
      targetTextarea.dispatchEvent(
          new Event('input', {bubbles: true, cancelable: true}));
      updateStatus(getText("promptInserted"), false);
    } else {
      updateStatus(
          getText("aiStudioFieldNotFound"),
          true);
    }
  }

  let settingsTemplateListDiv, settingsTemplateNameInput,
      settingsTemplateContentTextarea, settingsSelectedTemplateId = null;
  let settingsFontSizeInputCustom;

  function loadSettings() {
    if (document.getElementById(
        'shotgun-main-ignore-rules-ta')) {
      document.getElementById(
          'shotgun-main-ignore-rules-ta').value = GM_getValue(
          CUSTOM_IGNORE_RULES_KEY, DEFAULT_IGNORE_RULES);
    }
    renderSettingsTemplateList();
    if (promptTemplates.length > 0) {
      const templateToSelect = promptTemplates.find(
          t => t.id === selectedPromptTemplateId) || promptTemplates[0];
      selectTemplateForEditing(templateToSelect.id);
    } else {
      clearTemplateEditFields();
    }
    loadModalPositionAndSize(settingsModal, SETTINGS_MODAL_SIZE_KEY, null,
        '70%', '75vh');
    if (settingsMaxFileSizeInput) {
      settingsMaxFileSizeInput.value = GM_getValue(
          MAX_FILE_SIZE_KB_KEY, '1024');
    }
    if (settingsFileSizeActionSelect) {
      settingsFileSizeActionSelect.value = GM_getValue(
          FILE_SIZE_ACTION_KEY, 'skip');
    }
    if (settingsTruncateValueInput) {
      settingsTruncateValueInput.value = GM_getValue(
          TRUNCATE_VALUE_KEY, '5000');
    }
    if (settingsSkipBinaryCheckbox) {
      settingsSkipBinaryCheckbox.checked = GM_getValue(
          SKIP_BINARY_FILES_KEY, true);
    }
    if (settingsAutoUpdateIntervalInput) {
      settingsAutoUpdateIntervalInput.value = GM_getValue(
          AUTO_UPDATE_INTERVAL_KEY, '20');
    }
    if (settingsAutoLoadGitignoreCheckbox) {
      settingsAutoLoadGitignoreCheckbox.checked = GM_getValue(
          AUTO_LOAD_GITIGNORE_KEY, true);
    }
    toggleTruncateValueVisibility();
    if (settingsIgnoreTesterPathInput) {
      settingsIgnoreTesterPathInput.value = '';
    }
    if (settingsIgnoreTesterResultSpan) {
      settingsIgnoreTesterResultSpan.textContent = '';
    }
    updateAutoUpdateCheckboxState();

    if(settingsLanguageSelect) {
      settingsLanguageSelect.value = GM_getValue(CURRENT_LANG_KEY, 'ru');
    }
    if(settingsFontSizeSelect) {
      const savedFontSize = GM_getValue(FONT_SIZE_KEY, DEFAULT_FONT_SIZE);
      const presetSizes = {'12px': 'small', '14px': 'medium', '16px': 'large'};
      if (Object.keys(presetSizes).find(key => key === savedFontSize)) {
        const presetValue = Object.keys(presetSizes).find(key => key === savedFontSize);
        settingsFontSizeSelect.value = presetSizes[presetValue];
        if (settingsFontSizeInputCustom) settingsFontSizeInputCustom.style.display = 'none';
      } else {
        settingsFontSizeSelect.value = 'custom';
        if (settingsFontSizeInputCustom) {
          settingsFontSizeInputCustom.style.display = '';
          settingsFontSizeInputCustom.value = savedFontSize.replace('px', '');
        }
      }
    }
  }

  function saveSettings() {
    saveModalPositionAndSize(settingsModal, SETTINGS_MODAL_SIZE_KEY, null);
    if (settingsMaxFileSizeInput) {
      GM_setValue(MAX_FILE_SIZE_KB_KEY,
          settingsMaxFileSizeInput.value);
    }
    if (settingsFileSizeActionSelect) {
      GM_setValue(FILE_SIZE_ACTION_KEY,
          settingsFileSizeActionSelect.value);
    }
    if (settingsTruncateValueInput) {
      GM_setValue(TRUNCATE_VALUE_KEY,
          settingsTruncateValueInput.value);
    }
    if (settingsSkipBinaryCheckbox) {
      GM_setValue(SKIP_BINARY_FILES_KEY,
          settingsSkipBinaryCheckbox.checked);
    }
    if (settingsAutoLoadGitignoreCheckbox) {
      GM_setValue(AUTO_LOAD_GITIGNORE_KEY,
          settingsAutoLoadGitignoreCheckbox.checked);
    }
    if(settingsLanguageSelect) {
      const selectedLang = settingsLanguageSelect.value;
      GM_setValue(CURRENT_LANG_KEY, selectedLang);
      currentLang = selectedLang;
      if (modal && modal.style.display === 'block') {
        assignUIElements();
        loadElementHeights();
        populatePromptTemplateSelect();
        updateFinalPrompt();
      }
    }
    if(settingsFontSizeSelect) {
      let fontSizeToSave = DEFAULT_FONT_SIZE;
      const selectedFontSize = settingsFontSizeSelect.value;
      if (selectedFontSize === 'small') fontSizeToSave = '12px';
      else if (selectedFontSize === 'medium') fontSizeToSave = '14px';
      else if (selectedFontSize === 'large') fontSizeToSave = '16px';
      else if (selectedFontSize === 'custom' && settingsFontSizeInputCustom && settingsFontSizeInputCustom.value) {
        fontSizeToSave = settingsFontSizeInputCustom.value + 'px';
      }
      GM_setValue(FONT_SIZE_KEY, fontSizeToSave);
      [contextTextarea, userTaskTextarea, finalPromptTextarea, settingsIgnoreRulesTextarea].forEach(ta => {
        if (ta) {
          ta.style.fontSize = fontSizeToSave;
        }
      });
    }

    updateStatus(getText("settingsSaved"), false);
  }

  function renderSettingsTemplateList() {
    if (!settingsTemplateListDiv) {
      return;
    }
    while (settingsTemplateListDiv.firstChild) {
      settingsTemplateListDiv.removeChild(settingsTemplateListDiv.firstChild);
    }
    promptTemplates.forEach(template => {
      let displayName = template.name;
      if (template.isOfficial) {
        displayName += ' (Official)';
      } else if (template.isCore
          && !template.isOfficial) {
        displayName += ' (Core)';
      }
      const itemDiv = createElementWithProps('div', {
        class: 'shotgun-settings-list-item' + (template.id
        === settingsSelectedTemplateId ? ' selected' : ''),
        textContent: displayName
      });
      settingsTemplateListDiv.appendChild(itemDiv);
    });
  }

  function selectTemplateForEditing(templateId) {
    const template = promptTemplates.find(t => t.id === templateId);
    if (template && settingsTemplateNameInput && settingsTemplateContentTextarea
        && settingsTemplateListDiv) {
      settingsSelectedTemplateId = template.id;
      settingsTemplateNameInput.value = template.name;
      settingsTemplateContentTextarea.value = template.content;
      settingsTemplateNameInput.disabled = !!template.isCore;
      settingsTemplateContentTextarea.disabled = !!template.isCore;
      Array.from(settingsTemplateListDiv.children).forEach(child => {
        child.classList.remove('selected');
        if (child.textContent.startsWith(template.name)) {
          child.classList.add(
              'selected');
        }
      });
      const deleteBtn = document.getElementById(
          'shotgun-settings-delete-template-btn');
      if (deleteBtn) {
        deleteBtn.disabled = !!(template.isCore
            || template.isOfficial);
      }
    }
  }

  function clearTemplateEditFields() {
    if (settingsTemplateNameInput && settingsTemplateContentTextarea
        && settingsTemplateListDiv) {
      settingsSelectedTemplateId = null;
      settingsTemplateNameInput.value = '';
      settingsTemplateContentTextarea.value = '';
      settingsTemplateNameInput.disabled = false;
      settingsTemplateContentTextarea.disabled = false;
      Array.from(settingsTemplateListDiv.children).forEach(
          child => child.classList.remove('selected'));
      const deleteBtn = document.getElementById(
          'shotgun-settings-delete-template-btn');
      if (deleteBtn) {
        deleteBtn.disabled = true;
      }
    }
  }

  function handleSaveTemplate() {
    const name = settingsTemplateNameInput.value.trim();
    const content = settingsTemplateContentTextarea.value;
    if (!name || !content) {
      updateStatus(getText("promptTemplateNameEmpty"), true);
      return;
    }
    if (settingsSelectedTemplateId) {
      const template = promptTemplates.find(
          t => t.id === settingsSelectedTemplateId);
      if (template && !template.isCore) {
        template.name = name;
        template.content = content;
      } else if (template && (template.isCore || template.isOfficial)) {
        updateStatus(
            getText("coreTemplatesCannotBeEdited"),
            true);
        return;
      }
    } else {
      const newId = SCRIPT_PREFIX + 'tpl_' + Date.now();
      promptTemplates.push(
          {id: newId, name: name, content: content, isCore: false});
      settingsSelectedTemplateId = newId;
      selectedPromptTemplateId = newId;
      GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, selectedPromptTemplateId);
    }
    GM_setValue(CUSTOM_PROMPT_TEMPLATES_KEY, promptTemplates);
    renderSettingsTemplateList();
    selectTemplateForEditing(settingsSelectedTemplateId);
    populatePromptTemplateSelect();
    updateFinalPrompt();
    updateStatus(getText("promptTemplateSaved"), false);
  }

  function handleDeleteTemplate() {
    if (settingsSelectedTemplateId) {
      const template = promptTemplates.find(
          t => t.id === settingsSelectedTemplateId);
      if (template && (template.isCore || template.isOfficial)) {
        updateStatus(getText("coreTemplatesCannotBeDeleted"), true);
        return;
      }
      if (template && confirm(
          getText("confirmDeleteTemplate", template.name))) {
        const deletedId = settingsSelectedTemplateId;
        promptTemplates = promptTemplates.filter(
            t => t.id !== settingsSelectedTemplateId);
        GM_setValue(CUSTOM_PROMPT_TEMPLATES_KEY, promptTemplates);
        clearTemplateEditFields();
        renderSettingsTemplateList();
        if (selectedPromptTemplateId === deletedId) {
          selectedPromptTemplateId = promptTemplates.length > 0
              ? promptTemplates[0].id : null;
          GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY,
              selectedPromptTemplateId);
        }
        populatePromptTemplateSelect();
        updateFinalPrompt();
        updateStatus(getText("promptTemplateDeleted"), false);
      }
    }
  }

  function handleResetAllSettings() {
    if (confirm(
        getText("confirmResetAllSettings"))) {
      const keys = GM_listValues();
      keys.forEach(key => {
        if (key.startsWith(SCRIPT_PREFIX)) {
          GM_deleteValue(key);
        }
      });
      promptTemplates = JSON.parse(JSON.stringify(DEFAULT_PROMPT_TEMPLATES));
      selectedPromptTemplateId = promptTemplates.length > 0
          ? promptTemplates[0].id : null;
      lastSelectedFolderName = "";
      currentLang = 'ru';
      GM_setValue(CURRENT_LANG_KEY, currentLang);
      GM_deleteValue(FONT_SIZE_KEY);
      if (settingsModal && settingsModal.style.display === 'block') {
        loadSettings();
      }
      if (modal && modal.style.display === 'block') {
        assignUIElements();
        loadElementHeights();
        populatePromptTemplateSelect();
        updateFinalPrompt();
      }
      populatePromptTemplateSelect();
      if (folderInputLabel) {
        folderInputLabel.textContent = getText('folderNotSelected');
      }
      loadElementHeights();
      if (leftPanelElement) {
        leftPanelElement.style.flexBasis = '40%';
      }
      updateFinalPrompt();
      updateStatus(getText("allSettingsReset"), false);
    }
  }

  function toggleTruncateValueVisibility() {
    if (!settingsFileSizeActionSelect || !settingsTruncateValueInput) {
      return;
    }
    const parent = settingsTruncateValueInput.parentElement;
    if (parent) {
      parent.style.display = settingsFileSizeActionSelect.value.startsWith(
          'truncate_') ? '' : 'none';
    }
  }

  function exportSettings() {
    const settingsToExport = {};
    const keys = GM_listValues();
    keys.forEach(key => {
      if (key.startsWith(SCRIPT_PREFIX)) {
        settingsToExport[key] = GM_getValue(
            key);
      }
    });
    const jsonString = JSON.stringify(settingsToExport, null, 2);
    const blob = new Blob([jsonString], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shotgun_prompter_settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateStatus(getText("settingsExported"));
  }

  function importSettings(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target.result);
        let settingsApplied = 0;
        for (const key in importedSettings) {
          if (key.startsWith(SCRIPT_PREFIX)) {
            GM_setValue(key, importedSettings[key]);
            settingsApplied++;
          }
        }
        promptTemplates = GM_getValue(CUSTOM_PROMPT_TEMPLATES_KEY,
            JSON.parse(JSON.stringify(DEFAULT_PROMPT_TEMPLATES)));
        selectedPromptTemplateId = GM_getValue(SELECTED_PROMPT_TEMPLATE_ID_KEY,
            promptTemplates.length > 0 ? promptTemplates[0].id : null);
        lastSelectedFolderName = GM_getValue(LAST_FOLDER_NAME_KEY, "");
        currentLang = GM_getValue(CURRENT_LANG_KEY, 'ru');
        const importedFontSize = GM_getValue(FONT_SIZE_KEY, DEFAULT_FONT_SIZE);

        if (modal && modal.style.display === 'block') {
          assignUIElements();
          loadElementHeights();
          populatePromptTemplateSelect();
          updateFinalPrompt();
          if (folderInputLabel) {
            folderInputLabel.textContent = lastSelectedFolderName
                ? `${getText("lastFolder")} ${lastSelectedFolderName}`
                : getText('folderNotSelected');
          }
        }
        if (settingsModal && settingsModal.style.display === 'block') {
          loadSettings();
        }
        updateStatus(
            getText("settingsSuccessfullyImported", settingsApplied));
      } catch (error) {
        updateStatus(getText("errorImportingSettings") + " " + getText("invalidJsonFile"), true);
      } finally {
        event.target.value = null;
      }
    };
    reader.readAsText(file);
  }

  function fetchOfficialPromptTemplates() {
    updateStatus(getText("fetchingOfficialTemplates"), false);
    GM_xmlhttpRequest({
      method: "GET",
      url: OFFICIAL_PROMPT_TEMPLATES_URL + "?t=" + Date.now(),
      onload: function (response) {
        try {
          const manifest = JSON.parse(response.responseText);
          if (!Array.isArray(manifest)) {
            throw new Error(
                getText("invalidManifestFormat"));
          }

          if (manifest.length === 0) {
            updateStatus(getText("noOfficialTemplatesInManifest"), false);
            return;
          }

          updateStatus(
              getText("fetchedManifestLoading", manifest.length),
              false);

          const fetchPromises = manifest.map(templateInfo => {
            if (!templateInfo.id || !templateInfo.name || !templateInfo.file) {
              return Promise.resolve(null);
            }
            const templateUrl = GITHUB_RAW_CONTENT_URL + "prompt_templates/"
                + templateInfo.file + "?t=" + Date.now();
            return new Promise((resolve, reject) => {
              GM_xmlhttpRequest({
                url: templateUrl,
                method: "GET",
                onload: function (fileResponse) {
                       resolve({
                          ...templateInfo,
                          content: fileResponse.responseText,
                          isOfficial: true
                       });
                },
                onerror: function () {
                  reject(
                      new Error(getText("errorLoadingTemplateFile", templateInfo.file)));
                }
              });
            });
          });

          Promise.all(fetchPromises)
          .then(fetchedTemplates => {
            let updatedCount = 0;
            let newCount = 0;
            fetchedTemplates.filter(t => t !== null).forEach(officialTpl => {
              const existingIndex = promptTemplates.findIndex(
                  t => t.id === officialTpl.id);
              const templateData = {
                id: officialTpl.id,
                name: officialTpl.name,
                content: officialTpl.content,
                isCore: typeof officialTpl.isCore === 'boolean'
                    ? officialTpl.isCore : false,
                isOfficial: true
              };

              if (existingIndex > -1) {
                if (promptTemplates[existingIndex].isCore || !promptTemplates[existingIndex].isOfficial) {
                  promptTemplates[existingIndex] = {...promptTemplates[existingIndex], ...templateData};
                  updatedCount++;
                } else {
                  promptTemplates[existingIndex] = {...promptTemplates[existingIndex], ...templateData};
                  updatedCount++;
                }

              } else {
                promptTemplates.push(templateData);
                newCount++;
              }
            });
            DEFAULT_PROMPT_TEMPLATES.forEach(coreTpl => {
              if (!promptTemplates.find(t => t.id === coreTpl.id)) {
                promptTemplates.push(coreTpl);
                 } else {
                const existingCoreIndex = promptTemplates.findIndex(t => t.id === coreTpl.id);
                if (existingCoreIndex > -1) {
                  promptTemplates[existingCoreIndex].isCore = true;
                }
                 }
            });

            GM_setValue(CUSTOM_PROMPT_TEMPLATES_KEY, promptTemplates);
            renderSettingsTemplateList();
            populatePromptTemplateSelect();
            updateFinalPrompt();
            updateStatus(
                getText("officialTemplatesLoaded", newCount, updatedCount),
                false);
          })
          .catch(errors => {
            console.error("[Shotgun Prompter] Errors loading some official templates:", errors);
            updateStatus(
                getText("errorLoadingSomeTemplates"),
                true);
          });
        } catch (e) {
          updateStatus(
              getText("errorProcessingManifest") + " " + e.message,
              true);
        }
      },
      onerror: function () {
        GM_setValue(LAST_VERSION_CHECK_KEY, Date.now());
        updateStatus(
            getText("failedToFetchManifest"),
            true);
      }
    });
  }

  function createSettingsFileHandlingSection() {
    const sectionDiv = createElementWithProps('div');
    sectionDiv.appendChild(
        createElementWithProps('h3', {textContent: getText('fileHandling')}));
    const fhGrid = createElementWithProps('div',
        {class: 'shotgun-settings-grid'});
    fhGrid.appendChild(createElementWithProps('label', {
      textContent: getText('maxFileSize'),
      for: 'shotgun-max-file-size'
    }));
    settingsMaxFileSizeInput = createElementWithProps('input', {
      type: 'number',
      id: 'shotgun-max-file-size',
      class: 'shotgun-input',
      min: '0'
    });
    fhGrid.appendChild(settingsMaxFileSizeInput);
    fhGrid.appendChild(createElementWithProps('label', {
      textContent: getText('ifExceeded'),
      for: 'shotgun-file-size-action'
    }));
    settingsFileSizeActionSelect = createElementWithProps('select',
        {id: 'shotgun-file-size-action', class: 'shotgun-select'}, [
          createElementWithProps('option',
              {value: 'skip', textContent: getText('skipFile')}),
          createElementWithProps('option',
              {value: 'truncate_chars', textContent: getText('truncateChars')}),
          createElementWithProps('option',
              {value: 'truncate_lines', textContent: getText('truncateLines')}),
        ]);
    settingsFileSizeActionSelect.addEventListener('change',
        toggleTruncateValueVisibility);
    fhGrid.appendChild(settingsFileSizeActionSelect);
    const truncateValueLabel = createElementWithProps('label', {
      textContent: getText('truncateTo'),
      for: 'shotgun-truncate-value'
    });
    settingsTruncateValueInput = createElementWithProps('input', {
      type: 'number',
      id: 'shotgun-truncate-value',
      class: 'shotgun-input',
      min: '1'
    });
    const truncateWrapper = createElementWithProps('div', {},
        [truncateValueLabel, settingsTruncateValueInput]);
    fhGrid.appendChild(truncateWrapper);
    const skipBinaryLabel = createElementWithProps('label', {
      textContent: getText('skipBinary'),
      for: 'shotgun-skip-binary'
    });
    settingsSkipBinaryCheckbox = createElementWithProps('input', {
      type: 'checkbox',
      id: 'shotgun-skip-binary',
      style: 'width: auto; margin-left: 5px;'
    });
    const skipBinaryWrapper = createElementWithProps('div',
        {style: 'display: flex; align-items: center;'},
        [skipBinaryLabel, settingsSkipBinaryCheckbox]);
    fhGrid.appendChild(skipBinaryWrapper);
    sectionDiv.appendChild(fhGrid);

    const autoLoadDiv = createElementWithProps('div',
        {style: 'margin-top: 10px; display: flex; align-items: center;'});
    settingsAutoLoadGitignoreCheckbox = createElementWithProps('input', {
      type: 'checkbox',
      id: 'shotgun-auto-load-gitignore-cb',
      style: 'margin-right: 8px;'
    });
    const autoLoadLabel = createElementWithProps('label', {
      textContent: getText("autoLoadGitignore"),
      for: 'shotgun-auto-load-gitignore-cb',
      style: 'cursor: pointer;'
    });
    autoLoadDiv.append(settingsAutoLoadGitignoreCheckbox, autoLoadLabel);
    sectionDiv.appendChild(autoLoadDiv);

    const autoUpdateIntervalLabel = createElementWithProps('label', {
      textContent: getText('autoUpdateInterval'),
      for: 'shotgun-settings-auto-update-interval'
    });
    settingsAutoUpdateIntervalInput = createElementWithProps('input', {
      type: 'number',
      id: 'shotgun-settings-auto-update-interval',
      class: 'shotgun-input',
      min: '5',
      step: '1'
    });
    const autoUpdateIntervalWrapper = createElementWithProps('div',
        {style: 'margin-top: 10px; display: flex; align-items: center; gap: 8px;'},
        [autoUpdateIntervalLabel, settingsAutoUpdateIntervalInput]);
    sectionDiv.appendChild(autoUpdateIntervalWrapper);

    return sectionDiv;
  }

  function createSettingsPromptTemplatesSection() {
    const sectionDiv = createElementWithProps('div');
    sectionDiv.appendChild(
        createElementWithProps('h3', {textContent: getText('promptTemplates')}));
    const templateSection = createElementWithProps('div',
        {class: 'shotgun-settings-template-section'});
    settingsTemplateListDiv = createElementWithProps('div',
        {class: 'shotgun-settings-template-list'});
    templateSection.appendChild(settingsTemplateListDiv);

    const templateEditDiv = createElementWithProps('div',
        {class: 'shotgun-settings-template-edit'});
    templateEditDiv.appendChild(createElementWithProps('label', {
      textContent: getText('templateName'),
      for: 'shotgun-settings-template-name'
    }));
    settingsTemplateNameInput = createElementWithProps('input', {
      type: 'text',
      id: 'shotgun-settings-template-name',
      class: 'shotgun-input'
    });
    templateEditDiv.appendChild(settingsTemplateNameInput);
    templateEditDiv.appendChild(createElementWithProps('label', {
      textContent: getText('templateContent'),
      for: 'shotgun-settings-template-content'
    }));
    settingsTemplateContentTextarea = createElementWithProps('textarea', {
      id: 'shotgun-settings-template-content',
      class: 'shotgun-textarea',
      style: 'height: 150px; resize: vertical;'
    });
    templateEditDiv.appendChild(settingsTemplateContentTextarea);

    const templateButtonsDiv = createElementWithProps('div',
        {class: 'shotgun-settings-template-buttons'});
    const newTemplateBtn = createElementWithProps('button',
        {class: 'shotgun-button', textContent: getText('newTemplate')});
    newTemplateBtn.addEventListener('click', clearTemplateEditFields);
    templateButtonsDiv.appendChild(newTemplateBtn);

    const saveTemplateBtn = createElementWithProps('button',
        {class: 'shotgun-button', textContent: getText('saveTemplate')});
    saveTemplateBtn.addEventListener('click', handleSaveTemplate);
    templateButtonsDiv.appendChild(saveTemplateBtn);

    const deleteTemplateBtn = createElementWithProps('button', {
      id: 'shotgun-settings-delete-template-btn',
      class: 'shotgun-button shotgun-button-danger',
      textContent: getText('deleteTemplate')
    });
    deleteTemplateBtn.disabled = true;
    deleteTemplateBtn.addEventListener('click', handleDeleteTemplate);
    templateButtonsDiv.appendChild(deleteTemplateBtn);

    const fetchOfficialBtn = createElementWithProps('button', {
      class: 'shotgun-button',
      textContent: getText('fetchOfficialTemplates'),
      title: getText('fetchOfficialTemplatesTooltip')
    });
    fetchOfficialBtn.addEventListener('click', fetchOfficialPromptTemplates);
    templateButtonsDiv.appendChild(fetchOfficialBtn);

    templateEditDiv.appendChild(templateButtonsDiv);
    templateSection.appendChild(templateEditDiv);
    sectionDiv.appendChild(templateSection);
    return sectionDiv;
  }

  function createSettingsImportExportSection() {
    const sectionDiv = createElementWithProps('div');
    sectionDiv.appendChild(
        createElementWithProps('h3', {textContent: getText('importExportSettings')}));
    const ieDiv = createElementWithProps('div',
        {class: 'shotgun-settings-import-export'});
    const exportBtn = createElementWithProps('button',
        {class: 'shotgun-button', textContent: getText('exportSettings')});
    exportBtn.addEventListener('click', exportSettings);

    const importBtn = createElementWithProps('button', {
      class: 'shotgun-button',
      textContent: getText('importSettings'),
      style: 'margin-left: 10px;'
    });
    const importInput = createElementWithProps('input', {
      type: 'file',
      id: 'shotgun-import-settings-input',
      accept: '.json',
      style: 'display: none;'
    });
    importBtn.addEventListener('click', () => {
      if (importInput) {
        importInput.click();
      }
    });

    ieDiv.append(exportBtn, importBtn, importInput);
    importInput.addEventListener('change', importSettings);
    sectionDiv.appendChild(ieDiv);
    return sectionDiv;
  }

  function createSettingsLanguageAndFontSection() {
      const sectionDiv = createElementWithProps('div');
      sectionDiv.appendChild(createElementWithProps('h3', {textContent: getText('languageAndAppearance')}));

      const settingsGrid = createElementWithProps('div', {class: 'shotgun-settings-grid'});

      settingsGrid.appendChild(createElementWithProps('label', {textContent: getText('language'), for: 'shotgun-language-select'}));
      settingsLanguageSelect = createElementWithProps('select', {id: 'shotgun-language-select', class: 'shotgun-select'});
      for (const langKey in LANGUAGES) {
          const langInfo = LANGUAGES[langKey];
          const option = createElementWithProps('option', {value: langKey, textContent: langInfo.name});
          settingsLanguageSelect.appendChild(option);
      }
      settingsLanguageSelect.addEventListener('change', (event) => {
          const selectedLang = event.target.value;
          GM_setValue(CURRENT_LANG_KEY, selectedLang);
          currentLang = selectedLang;
           updateStatus(getText('languageSaved'));
      });
      settingsGrid.appendChild(settingsLanguageSelect);

      settingsGrid.appendChild(createElementWithProps('label', {textContent: getText('fontSize'), for: 'shotgun-font-size-select'}));
      const fontSizeSelectWrapper = createElementWithProps('div', {style: 'display: flex; align-items: center; gap: 5px;'});

      settingsFontSizeSelect = createElementWithProps('select', {id: 'shotgun-font-size-select', class: 'shotgun-select'});
      const fontSizeOptions = [
          {value: 'small', text: getText('small')},
          {value: 'medium', text: getText('medium')},
          {value: 'large', text: getText('large')},
          {value: 'custom', text: getText('custom')}
      ];
      fontSizeOptions.forEach(option => {
          settingsFontSizeSelect.appendChild(createElementWithProps('option', {value: option.value, textContent: option.text}));
      });

      settingsFontSizeInputCustom = createElementWithProps('input', {
          type: 'number',
          id: 'shotgun-font-size-input-custom',
          class: 'shotgun-input',
          min: '8',
          step: '1',
          placeholder: 'px',
          style: 'width: 60px; display: none; margin-bottom: 0;'
      });

      settingsFontSizeSelect.addEventListener('change', (event) => {
          const selectedValue = event.target.value;
          if (selectedValue === 'custom') {
              if (settingsFontSizeInputCustom) settingsFontSizeInputCustom.style.display = '';
          } else {
              if (settingsFontSizeInputCustom) settingsFontSizeInputCustom.style.display = 'none';
          }
      });
      fontSizeSelectWrapper.append(settingsFontSizeSelect, settingsFontSizeInputCustom);
      settingsGrid.appendChild(fontSizeSelectWrapper);

      sectionDiv.appendChild(settingsGrid);
      return sectionDiv;
  }

  function createSettingsGeneralSection() {
    const sectionDiv = createElementWithProps('div');
    sectionDiv.appendChild(
        createElementWithProps('h3', {textContent: getText('general')}));
    const resetAllBtn = createElementWithProps('button', {
      class: 'shotgun-button shotgun-button-danger',
      textContent: getText('resetAllSettings')
    });
    resetAllBtn.addEventListener('click', handleResetAllSettings);
    sectionDiv.appendChild(resetAllBtn);
    return sectionDiv;
  }

  function createSettingsModal() {
    const existingModalElement = document.getElementById(
        'shotgun-settings-modal');
    if (existingModalElement) {
      existingModalElement.remove();
    }

    settingsModal = createElementWithProps('div', {
      id: 'shotgun-settings-modal',
      class: 'shotgun-modal shotgun-settings-submodal'
    });
    const modalContent = createElementWithProps('div',
        {class: 'shotgun-modal-content'});
    const modalHeader = createElementWithProps('div',
        {class: 'shotgun-modal-header'});
    modalHeader.onmousedown = (event) => {
      if (event.target.closest(
          '.shotgun-control-btn, input, textarea, select, button')) {
        return;
      }
      let sm = document.getElementById('shotgun-settings-modal');
      if (sm) {
        let isSMDragging = true;
        let smDragOffsetX = event.clientX - sm.offsetLeft;
        let smDragOffsetY = event.clientY - sm.offsetTop;
        const onSMDragging = (e) => {
          if (isSMDragging) {
            e.preventDefault();
            sm.style.left = (e.clientX - smDragOffsetX) + 'px';
            sm.style.top = (e.clientY - smDragOffsetY) + 'px';
            sm.style.transform = '';
          }
        };
        const onSMDragEnd = () => {
          if (isSMDragging) {
            isSMDragging = false;
            document.removeEventListener('mousemove', onSMDragging);
            document.removeEventListener('mouseup', onSMDragEnd);
            saveModalPositionAndSize(sm, SETTINGS_MODAL_SIZE_KEY, null);
          }
        };
        document.addEventListener('mousemove', onSMDragging);
        document.addEventListener('mouseup', onSMDragEnd);
      }
    };
    modalHeader.appendChild(createElementWithProps('h2',
        {textContent: getText('shotgunPrompterSettings')}));
    const closeBtn = createElementWithProps('span',
        {class: 'shotgun-control-btn shotgun-close-btn', textContent: '×'});
    closeBtn.addEventListener('click', () => {
      saveSettings();
      if (settingsModal) {
        settingsModal.style.display = 'none';
      }
    });
    modalHeader.appendChild(closeBtn);

    const modalBody = createElementWithProps('div',
        {class: 'shotgun-modal-body', style: 'flex-direction: column;'});
    modalBody.appendChild(createSettingsGeneralSection());
    modalBody.appendChild(createSettingsLanguageAndFontSection());
    modalBody.appendChild(createSettingsFileHandlingSection());
    modalBody.appendChild(createSettingsPromptTemplatesSection());
    modalBody.appendChild(createSettingsImportExportSection());

    const modalFooter = createElementWithProps('div',
        {class: 'shotgun-modal-footer'});
    const saveAndCloseBtn = createElementWithProps('button',
        {class: 'shotgun-button', textContent: getText('saveAndCloseSettings')});
    saveAndCloseBtn.addEventListener('click', () => {
      saveSettings();
      if (settingsModal) {
        settingsModal.style.display = 'none';
      }
    });
    modalFooter.appendChild(saveAndCloseBtn);

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    settingsModal.appendChild(modalContent);
    if (document.body) {
      document.body.appendChild(settingsModal);
      const smContentEl = settingsModal.querySelector('.shotgun-modal-content');
      if (smContentEl) {
        const smResizeObserver = new ResizeObserver(entries => {
          if (settingsModal.style.display === 'block') {
            for (let entry of entries) {
              const targetEl = entry.target;
              if (targetEl.style.width && targetEl.style.height) {
                saveModalPositionAndSize(settingsModal, SETTINGS_MODAL_SIZE_KEY,
                    null);
              }
            }
          }
        });
        smResizeObserver.observe(smContentEl);
      }
    }
    loadModalPositionAndSize(settingsModal, SETTINGS_MODAL_SIZE_KEY, null,
        '70%', '75vh');
  }

  function compareVersions(v1, v2) {
    if (typeof v1 !== 'string' || typeof v2 !== 'string') {
      return 0;
    }
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const len = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < len; i++) {
      const n1 = parts1[i] || 0;
      const n2 = parts2[i] || 0;
      if (n1 > n2) {
        return 1;
      }
      if (n1 < n2) {
        return -1;
      }
    }
    return 0;
  }

  function displayUpdateNotification(remoteVersion, updateUrl, changelogUrl) {
    if (!versionStatusDiv) {
      return;
    }
    const fragment = document.createDocumentFragment();
    fragment.appendChild(
        document.createTextNode(getText("updateAvailable", remoteVersion)));

    const updateBtn = createElementWithProps('button',
        {class: 'shotgun-button', textContent: getText("updateButton", remoteVersion)});
    updateBtn.style.marginLeft = "5px";
    updateBtn.style.marginRight = "5px";
    updateBtn.onclick = () => window.open(updateUrl, '_blank');
    fragment.appendChild(updateBtn);

    if (changelogUrl) {
      const changelogLink = createElementWithProps('a', {
        href: changelogUrl,
        target: '_blank',
        textContent: getText('viewChangelog')
      });
      changelogLink.style.color = '#1a73e8';
      fragment.appendChild(changelogLink);
    }
    updateStatus(fragment, false, true);
  }

  function checkForUpdates(forceCheck = false) {
    const lastCheck = GM_getValue(LAST_VERSION_CHECK_KEY, 0);
    const timeSinceLastCheck = Date.now() - lastCheck;

    if (!forceCheck && timeSinceLastCheck < CHECK_VERSION_INTERVAL) {
      const storedRemoteData = GM_getValue(LATEST_REMOTE_VERSION_DATA_KEY,
          null);
      if (storedRemoteData && storedRemoteData.version && compareVersions(
          storedRemoteData.version, SCRIPT_VERSION) > 0) {
        displayUpdateNotification(storedRemoteData.version,
            storedRemoteData.update_url || GM_info.script.downloadURL
            || '#', storedRemoteData.changelog_url || '');
      }
      return;
    }
    GM_xmlhttpRequest({
      method: "GET",
      url: VERSION_CHECK_URL + "?t=" + Date.now(),
      onload: function (response) {
        GM_setValue(LAST_VERSION_CHECK_KEY, Date.now());
        try {
          const remoteVersionData = JSON.parse(response.responseText);
          const remoteVersion = remoteVersionData.version;
          if (remoteVersion && compareVersions(remoteVersion, SCRIPT_VERSION)
              > 0) {
            GM_setValue(LATEST_REMOTE_VERSION_DATA_KEY, remoteVersionData);
            displayUpdateNotification(remoteVersion,
                remoteVersionData.update_url || GM_info.script.downloadURL
                || '#', remoteVersionData.changelog_url || '');
          } else {
            GM_deleteValue(LATEST_REMOTE_VERSION_DATA_KEY);
            if (versionStatusDiv) {
              versionStatusDiv.textContent = '';
            }
          }
        } catch (e) {
          if (versionStatusDiv) {
            versionStatusDiv.textContent = '';
          }
          updateStatus(getText("versionCheckErrorParse"), true, true);
        }
      },
      onerror: function () {
        GM_setValue(LAST_VERSION_CHECK_KEY, Date.now());
        updateStatus(getText("versionCheckErrorNetwork"), true, true);
      }
    });
  }

  function injectMainButton() {
    console.log('[Shotgun Prompter] Trying to inject main button.'); // Лог перед попыткой инъекции
    const btn = document.getElementById('shotgun-prompter-btn'); // Получаем кнопку, если она уже есть

    if (btn) {
      console.log('[Shotgun Prompter] Button already exists. Skipping injection.'); // Лог если кнопка уже есть
      return;
    }

    // Если кнопки нет, создаем ее
    const newBtn = document.createElement('button');
    newBtn.id = 'shotgun-prompter-btn';
    newBtn.textContent = 'Shotgun Prompter';
    console.log('[Shotgun Prompter] Button element created.', newBtn); // Лог после создания элемента кнопки

    // Добавляем обработчик клика к новой кнопке
    newBtn.addEventListener('click', async () => { // Сделаем обработчик async на случай, если понадобится await
      console.log('[Shotgun Prompter] Button clicked.');

      // !!! Отключаем кнопку в самом начале !!!
      newBtn.disabled = true;
      console.log('[Shotgun Prompter] Button disabled.');

      try {
        // Проверяем наличие модального окна по ID в DOM
        let existingModalElement = document.getElementById('shotgun-prompter-modal');

        if (!existingModalElement) {
          console.log('[Shotgun Prompter] Modal element not found in DOM. Creating modal.'); // Лог перед созданием модального окна
          createModal(); // Создаем и добавляем в DOM
          existingModalElement = document.getElementById('shotgun-prompter-modal'); // Снова получаем из DOM
          console.log('[Shotgun Prompter] createModal() called and element re-fetched from DOM.', existingModalElement); // Лог после вызова createModal и повторного получения элемента
        } else {
           console.log('[Shotgun Prompter] Modal element found in DOM.');
        }

        // !!! Вызываем assignUIElements() ЗДЕСЬ, после того как existingModalElement гарантированно существует !!!
        if (existingModalElement) {
          modal = existingModalElement; // Обновляем глобальную переменную modal
          assignUIElements(); // Обновляем все остальные глобальные переменные UI элементов
          console.log('[Shotgun Prompter] UI elements assigned/re-assigned.');

          console.log('[Shotgun Prompter] Modal element found after logic. Setting display to block.');
          existingModalElement.style.display = 'block';

          // Обновляем глобальную переменную modal, если она еще не была обновлена
          // (хотя assignUIElements должен это делать) - это на всякий случай
          modal = existingModalElement;

          if (isModalMinimized) {
            console.log('[Shotgun Prompter] Modal minimized, toggling minimize.'); // Лог если окно было свернуто
            toggleMinimizeModal();
          } else {
            console.log('[Shotgun Prompter] Loading modal position and size.'); // Лог перед загрузкой позиции/размера
            loadModalPositionAndSize(
                modal, MODAL_SIZE_KEY, MODAL_POSITION_KEY);
          }

          // Обновление содержимого модального окна после его открытия
          const mainIgnoreRulesTA = document.getElementById(
              'shotgun-main-ignore-rules-ta');
          if (mainIgnoreRulesTA) {
            mainIgnoreRulesTA.value = GM_getValue(
                CUSTOM_IGNORE_RULES_KEY, DEFAULT_IGNORE_RULES);
            const initialUseRules = GM_getValue(USE_GITIGNORE_RULES_KEY, true);
            mainIgnoreRulesTA.disabled = !initialUseRules;
            mainIgnoreRulesTA.style.backgroundColor = !initialUseRules ? '#e9ecef' : '#fff';
            mainIgnoreRulesTA.style.color = !initialUseRules ? '#6c757d' : '#202124';
          }
          if (useGitignoreCheckbox) {
            useGitignoreCheckbox.checked = GM_getValue(
                USE_GITIGNORE_RULES_KEY, true);
          }
          if (refreshApiFolderBtn
              && apiFolderSelected) {
            refreshApiFolderBtn.style.display = 'inline-block';
          } else if (refreshApiFolderBtn) {
            refreshApiFolderBtn.style.display = 'none';
          }
          if (settingsIgnoreRulesTextarea
              && useGitignoreCheckbox) {
            settingsIgnoreRulesTextarea.disabled = !useGitignoreCheckbox.checked;
          }
          updateStatus(getText('modalOpenedCheckingUpdates'));
          checkForUpdates(true);
          updateLoadedGitignoreDisplay();
          renderFileList();
          updateStats();
          console.log('[Shotgun Prompter] Modal display set to block and updates/renders called.');

        } else {
          console.error('[Shotgun Prompter] Modal element not found or is null after click handler logic.'); // Лог если модальное окно все еще не найдено
          updateStatus(getText("errorDisplayingModal"), true);
        }
      } finally {
          // !!! Включаем кнопку обратно после завершения попытки открыть окно !!!
          newBtn.disabled = false;
          console.log('[Shotgun Prompter] Button enabled.');
      }
    });

    // Добавляем новую кнопку в body
    if (document.body) {
      document.body.appendChild(newBtn);
      console.log('[Shotgun Prompter] Button appended to body.', newBtn); // Лог после добавления кнопки в DOM
    } else {
      console.error('[Shotgun Prompter] document.body is not available. Cannot append button.'); // Лог если body не доступен
    }
  }

  function injectStyles() {
    GM_addStyle(`
            #shotgun-prompter-btn { position: fixed; bottom: 20px; left: 20px; background-color: #1a73e8; color: white; padding: 8px 12px; border: none; border-radius: 5px; cursor: pointer; z-index: 9999; font-size: 13px; }
            #shotgun-prompter-btn:hover { background-color: #1765cc; }
            .shotgun-modal { display: none; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; background-color: transparent; color: #202124; font-family: 'Google Sans', Roboto, Arial, sans-serif; font-size: 14px; pointer-events: none; }
            .panel-resizing-active { cursor: col-resize !important; user-select: none !important; }
            .shotgun-modal-content { background-color: #fff; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 1px solid #dadce0; width: 85%; min-width: 700px; height: 90vh; min-height: 500px; border-radius: 8px; display: flex; flex-direction: column; resize: both; overflow: hidden; padding: 0; pointer-events: auto; }
            .shotgun-modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e8eaed; padding: 12px 20px; margin-bottom: 0; flex-shrink: 0; cursor: grab; }
            .shotgun-modal-header:active { cursor: grabbing; }
            .shotgun-modal-header h2 { margin: 0; font-size: 1.4em; color: #202124; }
            .shotgun-header-controls { display: flex; align-items: center; }
            .shotgun-control-btn { color: #5f6368; font-size: 24px; font-weight: normal; cursor: pointer; line-height: 1; margin-left: 10px; padding: 2px; user-select: none; }
            .shotgun-control-btn:hover { color: #000; }
            .shotgun-settings-btn { font-size: 20px; }
            .shotgun-modal-body { display: flex; flex-direction: row; flex-grow: 1; overflow-y: hidden; padding: 15px 20px; }
            .shotgun-panel { padding: 12px; overflow-y: auto; background-color: #f8f9fa; border-radius: 6px; border: 1px solid #e8eaed; display: flex; flex-direction: column; }
            .shotgun-left-panel { flex-grow: 1; flex-shrink: 0; min-width: 100px; }
            .shotgun-right-panel { flex-grow: 1; flex-shrink: 0; min-width: 100px; }
            .shotgun-panel-resizer { width: 5px; background-color: #e0e0e0; cursor: col-resize; flex-shrink: 0; margin: 0 5px; border-radius: 3px; z-index: 1; }
            .shotgun-panel-resizer:hover { background-color: #c0c0c0; }
            .shotgun-panel h3 { margin-top: 0; margin-bottom: 10px; font-size: 1.15em; color: #3c4043; flex-shrink: 0; }
            .shotgun-panel h4 { margin-top: 12px; margin-bottom: 6px; font-size: 0.9em; color: #5f6368; font-weight: 500; flex-shrink: 0;}
            .shotgun-textarea, .shotgun-input, .shotgun-select { width: calc(100% - 16px); padding: 7px; margin-bottom: 8px; border: 1px solid #dadce0; border-radius: 4px; font-family: 'Roboto Mono', monospace; background-color: #fff; flex-shrink: 0; }
            .shotgun-textarea, .shotgun-select { color: #202124; } .shotgun-textarea { resize: vertical; overflow-y: auto; }
            .shotgun-textarea:disabled, .shotgun-input:disabled { background-color: #f1f3f4; color: #9aa0a6; cursor: not-allowed; }
            select.shotgun-select option { background-color: #fff; color: #000; }
            #shotgun-context-textarea-el, #shotgun-final-prompt-el { flex-grow: 1; }
            .shotgun-textarea:focus, .shotgun-input:focus, .shotgun-select:focus { border-color: #1a73e8; box-shadow: 0 0 0 1px #1a73e8; }
            .shotgun-file-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
            .shotgun-file-list-header h4 { margin-bottom: 0; margin-right: 10px; }
            .shotgun-file-list-controls { display: flex; gap: 5px; flex-wrap: wrap; }
            .shotgun-button-small { padding: 4px 8px; font-size: 0.8em; }
            .shotgun-file-list { overflow-y: auto; border: 1px solid #e0e0e0; padding: 7px; margin-bottom: 8px; background-color: #fff; border-radius: 4px; font-size: 13px; flex-shrink: 0; resize: vertical; }
            .shotgun-tree-ul { list-style-type: none; padding-left: 0; margin: 0; } .shotgun-tree-root { padding-left: 0; }
            .shotgun-tree-ul .shotgun-tree-ul { padding-left: 20px; position: relative; }
            .shotgun-tree-ul .shotgun-tree-ul::before { content: ""; position: absolute; left: -10px; top: -0.8em; bottom: 0.5em; width: 1px; border-left: 1px solid #ccc; }
            .shotgun-tree-li { position: relative; }
            .shotgun-tree-li > .shotgun-tree-entry::before { content: ""; position: absolute; left: -10px; top: 0.7em; width: 10px; border-top: 1px solid #ccc; }
            .shotgun-tree-li:last-child > .shotgun-tree-ul::before { bottom: auto; height: 1.5em; }
            .shotgun-tree-entry { display: flex; align-items: center; padding: 2px 0; position: relative; }
            .shotgun-tree-icon { margin-right: 4px; display: inline-flex; align-items: center; width: auto; user-select: none; }
            .shotgun-tree-expander { cursor: pointer; margin-right: 2px; display: inline-block; width: 1em; text-align: center; }
            .shotgun-tree-entry input[type="checkbox"] { margin-right: 5px; vertical-align: middle; }
            .shotgun-tree-entry label { vertical-align: middle; cursor: pointer; white-space: nowrap; }
            .shotgun-button { background-color: #1a73e8; color: white; padding: 7px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; margin-right: 6px; margin-bottom: 8px; font-weight: 500; flex-shrink: 0; }
            .shotgun-button:hover { background-color: #1765cc; }
            .shotgun-button:disabled { background-color: #f1f3f4; color: #9aa0a6; cursor: not-allowed; }
            .shotgun-button-danger { background-color: #d93025; } .shotgun-button-danger:hover { background-color: #c5221f; }
            .shotgun-modal-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e8eaed; padding: 10px 20px; margin-top: 0; flex-shrink: 0; }
            .shotgun-status { font-size: 0.85em; color: #5f6368; text-align: center; flex-grow: 1; margin: 0 10px; }
            .shotgun-version-status { font-size: 0.8em; color: #5f6368; text-align: left; display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
            .shotgun-version-status a { color: #1a73e8; text-decoration: underline; }
            .shotgun-stats-text { font-size: 0.8em; color: #5f6368; margin-bottom: 4px; flex-shrink: 0; }
            .shotgun-current-script-version { font-size: 0.8em; color: #5f6368; flex-shrink: 0; }
            .shotgun-modal.minimized .shotgun-modal-content { position: fixed !important; bottom: 10px !important; left: 10px !important; width: 300px !important; height: 50px !important; padding: 0; overflow: hidden !important; resize: none !important; transform: none !important; }
            .shotgun-modal.minimized .shotgun-modal-body, .shotgun-modal.minimized .shotgun-modal-footer { display: none; }
            .shotgun-modal.minimized .shotgun-modal-header { padding: 10px 15px; margin-bottom: 0; border-bottom: none; cursor: pointer; }
            .shotgun-modal.minimized .shotgun-modal-header h2 { font-size: 1.1em; }
            .shotgun-settings-submodal { z-index: 10001; background-color: transparent; pointer-events: none; }
            .shotgun-settings-submodal .shotgun-modal-content { pointer-events: auto; resize: none !important; }
            .shotgun-settings-submodal .shotgun-modal-body { flex-direction: column; overflow-y: auto; padding-bottom: 10px; }
            .shotgun-settings-ignore-tester { display: flex; align-items: center; margin-bottom: 10px; gap: 5px; }
            .shotgun-settings-ignore-tester input { flex-grow: 1; }
            .shotgun-settings-grid { display: grid; grid-template-columns: auto 1fr; gap: 8px 10px; align-items: center; margin-bottom: 15px; }
            .shotgun-settings-grid label:not(.shotgun-button) { justify-self: end; }
            .shotgun-settings-grid .shotgun-button { justify-self: start; }
            .shotgun-settings-import-export { display: flex; gap: 10px; margin-bottom: 15px; }
            .shotgun-settings-template-section { display: flex; gap: 15px; margin-bottom: 15px; min-height: 200px; }
            .shotgun-settings-template-list { flex: 1; border: 1px solid #dadce0; border-radius: 4px; padding: 5px; overflow-y: auto; max-height: 250px; }
            .shotgun-settings-list-item { padding: 5px 8px; cursor: pointer; border-radius: 3px; margin-bottom: 3px; font-size: 0.9em; }
            .shotgun-settings-list-item:hover { background-color: #f1f3f4; }
            .shotgun-settings-list-item.selected { background-color: #e8f0fe; color: #174ea6; font-weight: 500; }
            .shotgun-settings-template-edit { flex: 2; display: flex; flex-direction: column; }
            .shotgun-settings-template-edit label { font-size: 0.85em; color: #5f6368; margin-bottom: 3px; }
            .shotgun-settings-template-edit .shotgun-input, .shotgun-settings-template-edit .shotgun-textarea { margin-bottom: 10px; }
            .shotgun-settings-template-buttons { margin-top: auto; display: flex; flex-wrap: wrap; gap: 5px; }
            .shotgun-collapsible-header { cursor: pointer; display: flex; align-items: center; padding: 4px 0; }
            .shotgun-collapsible-expander { margin-right: 6px; font-size: 0.9em; width: 1em; text-align: center; user-select: none; color: #5f6368; }
            .shotgun-ignore-rules-columns-container {
                display: flex;
                flex-direction: row;
                gap: var(--column-gap, 15px);
                --column-gap: 15px;
            }
            .shotgun-ignore-rules-columns-container > .shotgun-ignore-column {
                width: calc(50% - (var(--column-gap, 15px) / 2));
                min-width: 150px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
            }
            .shotgun-ignore-rules-columns-container .shotgun-textarea {
                width: 100%;
                box-sizing: border-box;
                margin-bottom: 0;
            }
            .shotgun-textarea-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            .shotgun-textarea-header h4 { margin-bottom: 0; }
            .shotgun-copy-icon {
                cursor: pointer;
                font-size: 1.3em;
                color: #5f6368;
                user-select: none;
                padding: 2px 4px;
                border-radius: 3px;
            }
            .shotgun-copy-icon:hover { background-color: #e8eaed; }
            .shotgun-actions-container {
                display: flex;
                gap: 10px;
                margin-top: 8px;
            }
            .shotgun-copy-icon.shotgun-copy-icon-copied {
                background-color: #e6f4ea;
                color: #137333;
                transition: background-color 0.3s, color 0.3s;
            }

            .shotgun-file-read-errors {
                border: 1px solid #d93025;
                background-color: #fce8e6;
                color: #a50e0e;
                padding: 10px;
                margin-bottom: 10px;
                border-radius: 4px;
                font-size: 0.9em;
                max-height: 100px;
                overflow-y: auto;
            }
            .shotgun-file-read-errors p { margin: 0 0 5px 0; }
            .shotgun-file-read-errors p:last-child { margin-bottom: 0;
            }
            @keyframes blink-red {
                0% { background-color: transparent; }
                50% { background-color: rgba(255, 0, 0, 0.1); }
                100% { background-color: transparent; }
            }
             .shotgun-reset-height-icon {
                cursor: pointer;
                font-size: 1em;
                color: #5f6368;
                user-select: none;
                padding: 2px 4px;
                border-radius: 3px;
             }
             .shotgun-reset-height-icon:hover {
                 background-color: #e8eaed;
             }
        `);
  }

  function init() {
    if (scriptInitialized) {
      return;
    }
    scriptInitialized = true;
    try {
      DEFAULT_PROMPT_TEMPLATES.forEach(coreTpl => {
        const existing = promptTemplates.find(t => t.id === coreTpl.id);
        if (existing) {
          existing.isCore = true;
          if (!coreTpl.isOfficial) {
            existing.isOfficial = false;
          }
        } else {
          promptTemplates.push({...coreTpl, isCore: true, isOfficial: coreTpl.isOfficial || false});
        }
      });

      if (!Array.isArray(promptTemplates) || promptTemplates.length === 0) {
        promptTemplates = JSON.parse(JSON.stringify(DEFAULT_PROMPT_TEMPLATES));
        GM_setValue(CUSTOM_PROMPT_TEMPLATES_KEY, promptTemplates);
      }

      if (!selectedPromptTemplateId || !promptTemplates.find(t => t.id === selectedPromptTemplateId)) {
        selectedPromptTemplateId = promptTemplates.length > 0 ? promptTemplates[0].id : null;
        GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, selectedPromptTemplateId);
      } else if (promptTemplates.length === 0) {
        selectedPromptTemplateId = null;
        GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, null);
      }

      currentLang = GM_getValue(CURRENT_LANG_KEY, 'ru');
      if (!LANGUAGES[currentLang]) {
        currentLang = 'ru';
        GM_setValue(CURRENT_LANG_KEY, currentLang);
      }

      injectStyles();
      injectMainButton();
    } catch (e) {
      console.error("[Shotgun Prompter] Error during init:", e);
      alert(
          "[Shotgun Prompter] Critical error during initialization. Check console.");
    }
  }

  function runInitialization() {
    if (scriptInitialized) {
      return;
    }
    if (document.body && typeof GM_addStyle === 'function'
        && typeof GM_xmlhttpRequest === 'function' && typeof GM_info
        === 'object' && typeof GM_setValue === 'function' && typeof GM_getValue === 'function' && typeof GM_deleteValue === 'function' && typeof GM_listValues === 'function') {
      init();
    } else {
      const onPageLoad = () => {
        if (scriptInitialized) {
          return;
        }
        if (typeof GM_addStyle === 'function' && typeof GM_xmlhttpRequest
            === 'function' && typeof GM_info === 'object' && typeof GM_setValue === 'function' && typeof GM_getValue === 'function' && typeof GM_deleteValue === 'function' && typeof GM_listValues === 'function') {
          init();
        } else {
          console.error(
              "[Shotgun Prompter] GM functions not available on load. Script cannot run.");
        }
      };
      if (document.readyState === 'complete') {
        onPageLoad();
      } else {
        window.addEventListener('DOMContentLoaded', onPageLoad, {once: true});
      }
    }
  }

  runInitialization();
})();
