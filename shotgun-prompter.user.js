// ==UserScript==
// @name         AI Studio Shotgun Prompter
// @namespace    http://tampermonkey.net/
// @version      0.5.4
// @description  Formulate prompts for AI Studio. Fix TrustedHTML issue for update notifications.
// @author       Your Name (based on Shotgun Code concept)
// @match        https://aistudio.google.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @downloadURL  https://github.com/WhiteBite/Shotgun-Prompter/raw/main/shotgun-prompter.user.js
// @updateURL    https://github.com/WhiteBite/Shotgun-Prompter/raw/main/shotgun-prompter.user.js
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : '0.5.4'; // Fallback for safety
    const GITHUB_RAW_CONTENT_URL = "https://raw.githubusercontent.com/WhiteBite/Shotgun-Prompter/main/";
    console.log(`[Shotgun Prompter] Running version ${SCRIPT_VERSION}. GM_info version: ${(typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : 'N/A'}`);
    const VERSION_CHECK_URL = GITHUB_RAW_CONTENT_URL + "latest_version.json";
    const SCRIPT_PREFIX = 'shotgun_prompter_';
    const OFFICIAL_PROMPT_TEMPLATES_URL = GITHUB_RAW_CONTENT_URL + "prompt_templates.json";
    const LAST_VERSION_CHECK_KEY = SCRIPT_PREFIX + 'last_version_check_timestamp';
    const CHECK_VERSION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    const LATEST_REMOTE_VERSION_DATA_KEY = SCRIPT_PREFIX + 'latest_remote_version_data';

    const CUSTOM_PROMPT_TEMPLATES_KEY = SCRIPT_PREFIX + 'prompt_templates';
    const CUSTOM_IGNORE_RULES_KEY = SCRIPT_PREFIX + 'custom_ignore_rules';
    const LAST_FOLDER_NAME_KEY = SCRIPT_PREFIX + 'last_folder_name';
    const SELECTED_PROMPT_TEMPLATE_ID_KEY = SCRIPT_PREFIX + 'selected_prompt_template_id';

    const MODAL_POSITION_KEY = SCRIPT_PREFIX + 'modal_position';
    const MODAL_SIZE_KEY = SCRIPT_PREFIX + 'modal_size';
    const TA_IGNORE_RULES_HEIGHT_KEY = SCRIPT_PREFIX + 'ta_ignore_height';
    const TA_CONTEXT_HEIGHT_KEY = SCRIPT_PREFIX + 'ta_context_height';
    const TA_USER_TASK_HEIGHT_KEY = SCRIPT_PREFIX + 'ta_user_task_height';
    const TA_FINAL_PROMPT_HEIGHT_KEY = SCRIPT_PREFIX + 'ta_final_prompt_height';
    const FILE_LIST_HEIGHT_KEY = SCRIPT_PREFIX + 'file_list_height';
    const SETTINGS_MODAL_SIZE_KEY = SCRIPT_PREFIX + 'settings_modal_size';
    const PANEL_LEFT_FLEX_BASIS_KEY = SCRIPT_PREFIX + 'panel_left_flex_basis';

    const MAX_FILE_SIZE_KB_KEY = SCRIPT_PREFIX + 'max_file_size_kb';
    const FILE_SIZE_ACTION_KEY = SCRIPT_PREFIX + 'file_size_action';
    const TRUNCATE_VALUE_KEY = SCRIPT_PREFIX + 'truncate_value';
    const SKIP_BINARY_FILES_KEY = SCRIPT_PREFIX + 'skip_binary_files';

    const FOLDER_EXPANSION_STATE_KEY = SCRIPT_PREFIX + 'folder_expansion_state';

    const DEFAULT_PROMPT_TEMPLATE_CONTENT = `Your primary goal is to generate a git diff.
Follow the user's instructions carefully.
Output ONLY the git diff, no explanations, no apologies, no extra text.
Ensure the diff is in the standard git format.
If you need to create a new file, use /dev/null as the source for the diff.
If you need to delete a file, use /dev/null as the destination for the diff.
Pay attention to the file paths provided in the context.`;

    const DEFAULT_PROMPT_TEMPLATES = [
        { id: 'default_git_diff_template', name: 'Default Git Diff', content: DEFAULT_PROMPT_TEMPLATE_CONTENT, isCore: true }
    ];
    const DEFAULT_IGNORE_RULES = `node_modules/\n.git/\n.github/\n.vscode/\ndist/\nbuild/\ncoverage/\n*.log\n*.lock\n*.env\npackage-lock.json\nyarn.lock\ncomposer.lock\nvenv/\n__pycache__/\n*.pyc\n*.pyo\n*.pyd\n.DS_Store\nThumbs.db`;
    const PROMPT_TEMPLATE_BASE = `CURRENT_DATE: {CURRENT_DATE}\n\nTASK:\n{USER_TASK}\n\nRULES:\n{PROMPT_RULES_CONTENT}\n\nPROJECT_CONTEXT:\n{GENERATED_CONTEXT}\n`;

    let projectFiles = [];
    let generatedContext = '';
    let promptTemplates = GM_getValue(CUSTOM_PROMPT_TEMPLATES_KEY, JSON.parse(JSON.stringify(DEFAULT_PROMPT_TEMPLATES)));
    let selectedPromptTemplateId = GM_getValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, promptTemplates.length > 0 ? promptTemplates[0].id : null);

    let isModalMinimized = false;
    let lastSelectedFolderName = GM_getValue(LAST_FOLDER_NAME_KEY, "");

    let modal, fileInput, fileListDiv, generateContextBtn, contextTextarea,
        userTaskTextarea, finalPromptTextarea, promptTemplateSelect,
        copyContextBtn, copyPromptBtn, statusDiv, versionStatusDiv,
        minimizeBtn, modalHeaderTitle, statsDiv, contextStatsDiv, promptStatsDiv,
        folderInputLabel, settingsBtn, settingsModal,
        leftPanelElement, rightPanelElement, panelResizerElement,
        settingsIgnoreTesterPathInput, settingsIgnoreTesterResultSpan,
        settingsMaxFileSizeInput, settingsFileSizeActionSelect, settingsTruncateValueInput, settingsSkipBinaryCheckbox;

    let isDragging = false; let dragOffsetX, dragOffsetY;
    let isPanelResizing = false; let initialLeftPanelBasis = 0; let initialResizeMouseX = 0;
    let displayTreeRoot = {};
    let scriptInitialized = false;

    function logHelper(message) { console.log(`[Shotgun Prompter] ${message}`); }
    function updateStatus(message, isError = false, isVersionCheck = false) {
        const targetDiv = isVersionCheck ? versionStatusDiv : statusDiv;
        if (!targetDiv) return;

        if (isVersionCheck && !isError && typeof message !== 'string') { // If message is a node/fragment for version check
            targetDiv.innerHTML = ''; // Clear previous content
            targetDiv.appendChild(message);
            return;
        }
        targetDiv.textContent = message;
        targetDiv.style.color = isError ? 'red' : (message.includes("Generating") || message.includes("Processing") ? 'orange' : 'green');
        targetDiv.style.cursor = 'default';
        // if (!isVersionCheck) logHelper(message); // Avoid logging version checks too often
    }
    function copyToClipboard(text, buttonElement, successMessage = "Copied!") {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = buttonElement.textContent; buttonElement.textContent = successMessage; buttonElement.disabled = true;
            setTimeout(() => {
                buttonElement.textContent = originalText;
                if (buttonElement === copyContextBtn) copyContextBtn.disabled = !generatedContext.trim();
                if (buttonElement === copyPromptBtn) copyPromptBtn.disabled = !finalPromptTextarea.value.trim();
            }, 2000);
            updateStatus(successMessage.replace("!", " to clipboard."));
        }).catch(err => { console.error('[Shotgun Prompter] Failed to copy: ', err); updateStatus('Failed to copy to clipboard. See console.', true); });
    }
    function createElementWithProps(tag, props = {}, children = []) {
        const el = document.createElement(tag);
        for (const key in props) {
            if (key === 'textContent') el.textContent = props[key];
            else if (key.startsWith('on') && typeof props[key] === 'function') el[key] = props[key];
            else if (props[key] !== undefined) {
                if (['webkitdirectory', 'directory', 'multiple', 'disabled', 'readonly', 'checked', 'selected', 'indeterminate'].includes(key)) {
                     if (props[key] === '' || props[key] === true) el.setAttribute(key, '');
                     if (key === 'checked' && props[key]) el.checked = true;
                     if (key === 'selected' && props[key]) el.selected = true;
                     if (key === 'indeterminate' && props[key]) el.indeterminate = true;
                } else el.setAttribute(key, props[key]);
            }
        }
        children.forEach(child => { if (child) el.appendChild(child); });
        return el;
    }

    function updateStats() {
        if (!statsDiv || !contextStatsDiv || !promptStatsDiv) return;
        const includedFilesCount = projectFiles.filter(pf => !pf.excluded).length;
        statsDiv.textContent = `Files to include: ${includedFilesCount}`;
        const contextCharCount = generatedContext.length; const contextTokenCount = Math.round(contextCharCount / 3.5);
        contextStatsDiv.textContent = `Context: ${contextCharCount} chars / ~${contextTokenCount} tokens`;
        const promptCharCount = finalPromptTextarea ? finalPromptTextarea.value.length : 0; const promptTokenCount = Math.round(promptCharCount / 3.5);
        promptStatsDiv.textContent = `Final Prompt: ${promptCharCount} chars / ~${promptTokenCount} tokens`;
    }

    function patternToRegexString(pattern) {
        const globStarPlaceholder = '__(GLOBSTAR)__';
        let p = pattern.replace(/\*\*/g, globStarPlaceholder);
        p = p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
             .replace(/\?/g, '.')
             .replace(/\*/g, '[^/]*');
        p = p.replace(new RegExp(globStarPlaceholder, 'g'), '.*');
        return p;
    }

    function isPathIgnored(relPath, ignorePatternsText) {
        const normalizedRelPath = relPath.replace(/\\/g, '/');
        const lines = ignorePatternsText.split('\n').map(p => p.trim()).filter(p => p && !p.startsWith('#'));
        let ignored = false;

        for (const line of lines) {
            let pattern = line;
            let isNegated = false;

            if (pattern.startsWith('!')) {
                isNegated = true;
                pattern = pattern.substring(1).trim();
            }
            if (!pattern) continue;

            let regexPatternString;
            let isDirPattern = pattern.endsWith('/');
            if (isDirPattern) {
                regexPatternString = '^' + patternToRegexString(pattern.slice(0, -1)) + '(/.*|$)';
            } else {
                regexPatternString = '^' + patternToRegexString(pattern) + '$';
            }
            const regex = new RegExp(regexPatternString);

            if (regex.test(normalizedRelPath) || (!pattern.includes('/') && !isDirPattern && regex.test(normalizedRelPath.split('/').pop()))) {
                if (isNegated) ignored = false; else ignored = true;
            }
        }
        return ignored;
    }

    function applyIgnoreRulesToProjectFiles() {
        if (!projectFiles || projectFiles.length === 0) return;
        const ignoreText = GM_getValue(CUSTOM_IGNORE_RULES_KEY, DEFAULT_IGNORE_RULES);
        projectFiles.forEach(pf => { pf.excluded = isPathIgnored(pf.relPath, ignoreText); });
    }
    function handleFileSelection(event) {
        if (!event || !event.target || !event.target.files) { updateStatus("File selection event error.", true); return; }
        const files = event.target.files;
        if (files.length === 0) { updateStatus("No files selected."); projectFiles = []; displayTreeRoot = {}; renderFileList(); if(generateContextBtn) generateContextBtn.disabled = true; return; }
        let hasWebkitRelativePath = false; let tempProjectRootName = "";
        projectFiles = Array.from(files).map((file, index) => {
            const relPath = file.webkitRelativePath || file.name;
            if (index === 0 && file.webkitRelativePath) tempProjectRootName = file.webkitRelativePath.split('/')[0];
            if (file.webkitRelativePath) hasWebkitRelativePath = true;
            return { file, relPath, excluded: false, content: null, id: SCRIPT_PREFIX + 'pf_' + Date.now() + '_' + index };
        });
        if (tempProjectRootName) { lastSelectedFolderName = tempProjectRootName; GM_setValue(LAST_FOLDER_NAME_KEY, lastSelectedFolderName); if (folderInputLabel) folderInputLabel.textContent = `Выбрана папка: ${lastSelectedFolderName} (${files.length} файлов)`; }
        else if (folderInputLabel) { folderInputLabel.textContent = `Выбрано файлов: ${files.length} (относительные пути могут отсутствовать)`; }
        if (!hasWebkitRelativePath && files.length > 0) updateStatus("Warning: Folder structure might not be fully preserved (no webkitRelativePath).", false);
        projectFiles.sort((a, b) => a.relPath.localeCompare(b.relPath)); applyIgnoreRulesToProjectFiles();
        displayTreeRoot = buildDisplayTreeAndSetExclusion(projectFiles); renderFileList();
        if (projectFiles.length > 0 && projectFiles.some(pf => !pf.excluded)) { if(generateContextBtn) generateContextBtn.disabled = false; } else { if(generateContextBtn) generateContextBtn.disabled = true; }
        if(contextTextarea) contextTextarea.value = ''; generatedContext = ''; if(copyContextBtn) copyContextBtn.disabled = true;
        if(finalPromptTextarea) finalPromptTextarea.value = ''; if(copyPromptBtn) copyPromptBtn.disabled = true;
        updateStatus(`${projectFiles.length} files/folders found. Review exclusions and generate context.`); updateStats();
        // Persist default expansion state for a new folder if needed (all expanded)
        persistCurrentExpansionState(displayTreeRoot);
    }

    function getPersistedExpansionState() {
        return GM_getValue(FOLDER_EXPANSION_STATE_KEY, {});
    }

    function persistCurrentExpansionState(rootTreeObject) {
        const states = {};
        function traverse(node, pathParts) { // pathParts is the path to the current node
            const currentPath = pathParts.join('/');
            if (node._isDir) {
                states[currentPath] = node._expanded;
                Object.values(node._children).forEach(childNode => {
                    traverse(childNode, [...pathParts, childNode._name]);
                });
            }
        }
        Object.values(rootTreeObject).forEach(rootNode => { traverse(rootNode, [rootNode._name]); });
        GM_setValue(FOLDER_EXPANSION_STATE_KEY, states);
    }

    function findNodeInTree(treeObject, pathArray) {
        let currentLevelNode = null;
        let currentSubTree = treeObject;
        for (const part of pathArray) {
            if (currentSubTree && currentSubTree[part]) {
                currentLevelNode = currentSubTree[part];
                currentSubTree = currentLevelNode._children;
            } else { return null; }
        }
        return currentLevelNode;
    }

    function buildDisplayTreeAndSetExclusion(files) {
        const newTree = {};
        const persistedExpansionStates = getPersistedExpansionState();

        files.forEach((pf) => {
            const parts = pf.relPath.split('/'); let currentLevel = newTree; let pathSoFarArray = [];
            parts.forEach((part, index) => {
                pathSoFarArray.push(part);
                const nodeId = SCRIPT_PREFIX + 'node_' + pathSoFarArray.join('_').replace(/[^a-zA-Z0-9_]/g, '_');
                if (!currentLevel[part]) {
                    const isDirNode = index < parts.length - 1;
                    const nodePathForExpansion = pathSoFarArray.join('/');
                    let expandedState = true; // Default for new dirs
                    if (isDirNode && persistedExpansionStates[nodePathForExpansion] !== undefined) {
                        expandedState = persistedExpansionStates[nodePathForExpansion];
                    }
                    currentLevel[part] = { _name: part, _isDir: isDirNode, _pf: null, _children: {}, _id: nodeId, _excluded: false, 
                                           _expanded: isDirNode ? expandedState : undefined };
                }
                if (index === parts.length - 1) { // This is the file node or an empty directory treated as file if path ends with /
                    currentLevel[part]._isDir = false; // Ensure it's marked as not a directory for rendering purposes if it's a file
                    currentLevel[part]._pf = pf; currentLevel[part]._excluded = pf.excluded; }
                currentLevel = currentLevel[part]._children;
            });
        });
        function setExclusion(node) {
            if (!node._isDir) return node._excluded; if (Object.keys(node._children).length === 0) { node._excluded = false; return false; }
            let allChildrenExcluded = true; for (const childKey in node._children) { if (!setExclusion(node._children[childKey])) allChildrenExcluded = false; }
            node._excluded = allChildrenExcluded; return allChildrenExcluded;
        }
        Object.values(newTree).forEach(rootNode => setExclusion(rootNode));
        return newTree;
    }

    function setChildrenChecked(item, checked, isRecursiveCall = false) {
        item._excluded = !checked; if (item._pf) item._pf.excluded = !checked;
        Object.values(item._children).forEach(child => { setChildrenChecked(child, checked, true); });
        if (!isRecursiveCall) {
            displayTreeRoot = buildDisplayTreeAndSetExclusion(projectFiles); renderFileList();
            if(generateContextBtn) generateContextBtn.disabled = !projectFiles.some(pf => !pf.excluded);
        }
    }

    function toggleNodeExpansion(node, expand, isRecursiveCall = false) {
        if (node && node._isDir) {
            node._expanded = expand;
            // If this is a direct click (not recursive part of expand/collapse all),
            // it should not recursively expand/collapse children unless that's the desired behavior for single click.
            // Standard tree behavior: single click only toggles immediate node.
            // The `isRecursiveCall` here is more for the "Expand/Collapse All" functionality.
        }
        if (!isRecursiveCall) { // Top-level call (e.g. user click on one expander)
            persistCurrentExpansionState(displayTreeRoot);
            renderFileList();
        }
    }

    function renderTreeRecursiveDOM(currentLevelData, parentUl) {
        const keys = Object.keys(currentLevelData).sort((a, b) => {
            const itemA = currentLevelData[a]; const itemB = currentLevelData[b];
            if (itemA._isDir && !itemB._isDir) return -1; if (!itemA._isDir && itemB._isDir) return 1; return a.localeCompare(b);
        });
        keys.forEach((key) => {
            const item = currentLevelData[key]; const li = document.createElement('li'); li.className = 'shotgun-tree-li';
            const entryDiv = document.createElement('div'); entryDiv.className = 'shotgun-tree-entry';
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = `shotgun-cb-${item._id}`;
            if (item._isDir) {
                let allChildrenExcluded = true; let noChildrenExcluded = true;
                if (Object.keys(item._children).length > 0) { Object.values(item._children).forEach(child => { if (!child._excluded) allChildrenExcluded = false; if (child._excluded) noChildrenExcluded = false; }); }
                else { allChildrenExcluded = false; noChildrenExcluded = true; }
                checkbox.checked = !allChildrenExcluded; checkbox.indeterminate = !allChildrenExcluded && !noChildrenExcluded; item._excluded = allChildrenExcluded;
            } else { checkbox.checked = !item._excluded; }
            checkbox.addEventListener('change', () => { const isChecked = checkbox.checked; setChildrenChecked(item, isChecked); });
            entryDiv.appendChild(checkbox); const iconSpan = document.createElement('span'); iconSpan.className = 'shotgun-tree-icon';
            if (item._isDir) {
                const expander = createElementWithProps('span', { class: 'shotgun-tree-expander', textContent: item._expanded ? '▼' : '▶' });
                expander.onclick = () => { item._expanded = !item._expanded; renderFileList(); };
                iconSpan.appendChild(expander);
            }
            iconSpan.appendChild(document.createTextNode(item._isDir ? '📁' : '📄'));
            entryDiv.appendChild(iconSpan); const label = document.createElement('label'); label.setAttribute('for', checkbox.id); label.textContent = key;
            if ((item._isDir && item._excluded) || (!item._isDir && item._excluded)) label.classList.add('excluded');
            entryDiv.appendChild(label); li.appendChild(entryDiv); parentUl.appendChild(li);
            if (item._isDir && item._expanded && Object.keys(item._children).length > 0) { const subUl = document.createElement('ul'); subUl.className = 'shotgun-tree-ul'; li.appendChild(subUl); renderTreeRecursiveDOM(item._children, subUl); }
        });
    }
    function renderFileList() {
        if (!fileListDiv) return; while (fileListDiv.firstChild) { fileListDiv.removeChild(fileListDiv.firstChild); }
        if (projectFiles.length === 0) { const p = document.createElement('p'); p.textContent = 'No folder selected or folder is empty.'; fileListDiv.appendChild(p); updateStats(); return; }
        const rootUl = document.createElement('ul'); rootUl.className = 'shotgun-tree-ul shotgun-tree-root'; renderTreeRecursiveDOM(displayTreeRoot, rootUl); fileListDiv.appendChild(rootUl); updateStats();
    }
    function formatFileStructure(filesForStructure) {
        if (filesForStructure.length === 0) return "No files to structure."; const tree = {}; let commonRootPrefix = ""; let displayRootName = "";
        if (filesForStructure.length > 0 && filesForStructure[0].relPath) { const firstPathParts = filesForStructure[0].relPath.split('/'); if (firstPathParts.length > 0) { displayRootName = firstPathParts[0]; if (filesForStructure.every(f => f.relPath && f.relPath.startsWith(displayRootName + '/'))) commonRootPrefix = displayRootName + '/'; else { displayRootName = "(Project Root)"; commonRootPrefix = ""; } } } else { displayRootName = "(Project Root)"; }
        filesForStructure.forEach(f => { if (!f.relPath) return; let currentPath = f.relPath; if (commonRootPrefix && currentPath.startsWith(commonRootPrefix)) currentPath = currentPath.substring(commonRootPrefix.length); if (!currentPath) return; const parts = currentPath.split('/').filter(p => p); let currentLevel = tree; parts.forEach((part, index) => { if (!currentLevel[part]) currentLevel[part] = (index === parts.length - 1) ? { _isFile: true } : {}; currentLevel = currentLevel[part]; }); });
        let output = displayRootName + (commonRootPrefix ? "/" : "") + "\n";
        function buildString(node, indentPrefix) { const keys = Object.keys(node).filter(k => k !== '_isFile').sort((a, b) => { const isADir = typeof node[a] === 'object' && !node[a]._isFile; const isBDir = typeof node[b] === 'object' && !node[b]._isFile; if (isADir && !isBDir) return -1; if (!isADir && isBDir) return 1; return a.localeCompare(b); }); keys.forEach((key, index) => { const isLast = index === keys.length - 1; const connector = isLast ? "└── " : "├── "; const isDir = typeof node[key] === 'object' && !node[key]._isFile; output += indentPrefix + connector + key + (isDir ? "/" : "") + "\n"; if (isDir) buildString(node[key], indentPrefix + (isLast ? "    " : "│   ")); });}
        buildString(tree, ""); return output.trim();
    }
    function isBinaryFile(fileContentSample) {
        if (!fileContentSample) return false;
        const sample = fileContentSample.substring(0, Math.min(fileContentSample.length, 512));
        for (let i = 0; i < sample.length; i++) { if (sample.charCodeAt(i) === 0) return true; }
        let nonPrintable = 0;
        for (let i = 0; i < sample.length; i++) { const charCode = sample.charCodeAt(i); if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) nonPrintable++; }
        return (nonPrintable / sample.length) > 0.1;
    }
    async function generateContext() {
        const filesToProcess = projectFiles.filter(pf => !pf.excluded && pf.file);
        if (filesToProcess.length === 0) { updateStatus("No files selected for context generation.", true); generatedContext = ""; if(contextTextarea) contextTextarea.value = ""; if(copyContextBtn) copyContextBtn.disabled = true; updateFinalPrompt(); updateStats(); return; }
        if(generateContextBtn) generateContextBtn.disabled = true; updateStatus(`Processing ${filesToProcess.length} files...`);
        const maxFileSizeKB = parseInt(GM_getValue(MAX_FILE_SIZE_KB_KEY, '1024'), 10);
        const fileSizeAction = GM_getValue(FILE_SIZE_ACTION_KEY, 'skip');
        const truncateValue = parseInt(GM_getValue(TRUNCATE_VALUE_KEY, '5000'), 10);
        const skipBinary = GM_getValue(SKIP_BINARY_FILES_KEY, true);
        const fileStructure = formatFileStructure(filesToProcess.map(pf => ({ relPath: pf.relPath })));
        let fileContentsString = ""; let filesProcessedCount = 0;
        const fileReadPromises = filesToProcess.map(pf => {
            return new Promise((resolve) => {
                if (maxFileSizeKB > 0 && pf.file.size > maxFileSizeKB * 1024) {
                    if (fileSizeAction === 'skip') { updateStatus(`Skipping large file ${pf.relPath} (${(pf.file.size / 1024).toFixed(1)}KB)`); resolve(null); return; }
                }
                const reader = new FileReader();
                reader.onload = () => {
                    let content = reader.result; filesProcessedCount++;
                    if (skipBinary && isBinaryFile(content.substring(0, 512))) { updateStatus(`Skipping binary file ${pf.relPath}`); resolve(null); return; }
                    if (maxFileSizeKB > 0 && pf.file.size > maxFileSizeKB * 1024) {
                        const originalSizeKB = (pf.file.size / 1024).toFixed(1);
                        if (fileSizeAction === 'truncate_chars') { content = content.substring(0, truncateValue); updateStatus(`Truncated large file ${pf.relPath} (${originalSizeKB}KB) to ${truncateValue} chars`); }
                        else if (fileSizeAction === 'truncate_lines') { content = content.split('\n').slice(0, truncateValue).join('\n'); updateStatus(`Truncated large file ${pf.relPath} (${originalSizeKB}KB) to ${truncateValue} lines`);}
                    }
                    updateStatus(`Processing ${filesProcessedCount}/${filesToProcess.length} files...`);
                    resolve({ relPath: pf.relPath, content: content });
                };
                reader.onerror = (error) => { console.error(`[Shotgun Prompter] Error reading file ${pf.relPath}:`, error); filesProcessedCount++; updateStatus(`Error reading ${pf.relPath}. Processed ${filesProcessedCount}/${filesToProcess.length} files...`, true); resolve({ relPath: pf.relPath, content: `Error reading file: ${error.message}` }); };
                reader.readAsText(pf.file);
            });
        });
        try {
            const allFileContents = (await Promise.all(fileReadPromises)).filter(item => item !== null);
            allFileContents.sort((a, b) => a.relPath.localeCompare(b.relPath));
            allFileContents.forEach(item => { const pathForTag = item.relPath.replace(/\\/g, '/'); fileContentsString += `<file path="${pathForTag}">\n${item.content}\n</file>\n\n`; });
            generatedContext = `${fileStructure}\n\n${fileContentsString.trim()}`;
            if(contextTextarea) contextTextarea.value = generatedContext; if(copyContextBtn) copyContextBtn.disabled = false;
            updateStatus(`Context generated for ${allFileContents.length} files.`, false);
        } catch (error) { console.error("[Shotgun Prompter] Error during context generation:", error); updateStatus("Error generating context. See console.", true);
        } finally { if(generateContextBtn) generateContextBtn.disabled = (projectFiles.filter(pf => !pf.excluded && pf.file).length === 0); updateFinalPrompt(); updateStats(); }
    }

    function updateFinalPrompt() {
        if (!userTaskTextarea || !finalPromptTextarea || !promptTemplateSelect) return;
        const task = userTaskTextarea.value;
        const selectedTemplate = promptTemplates.find(t => t.id === selectedPromptTemplateId);
        const rulesContent = selectedTemplate ? selectedTemplate.content : "No prompt template selected or found.";
        const context = generatedContext; const currentDate = new Date().toISOString().split('T')[0];
        let populatedPrompt = PROMPT_TEMPLATE_BASE;
        populatedPrompt = populatedPrompt.replace('{CURRENT_DATE}', currentDate);
        populatedPrompt = populatedPrompt.replace('{USER_TASK}', task || "No task provided.");
        populatedPrompt = populatedPrompt.replace('{PROMPT_RULES_CONTENT}', rulesContent);
        populatedPrompt = populatedPrompt.replace('{GENERATED_CONTEXT}', context || "No context generated or provided.");
        finalPromptTextarea.value = populatedPrompt;
        if(copyPromptBtn) copyPromptBtn.disabled = !populatedPrompt.trim();
        updateStats();
    }
    function toggleMinimizeModal() {
        if (!modal) return; isModalMinimized = !isModalMinimized; modal.classList.toggle('minimized', isModalMinimized);
        if (minimizeBtn) minimizeBtn.textContent = isModalMinimized ? '⤣' : '—';
        if (modalHeaderTitle) modalHeaderTitle.style.cursor = isModalMinimized ? 'pointer' : 'default';
        if (isModalMinimized) { modal.style.top = ''; modal.style.left = ''; const mc = modal.querySelector('.shotgun-modal-content'); if(mc) {mc.style.width = ''; mc.style.height = '';} }
        else { loadModalPositionAndSize(modal, MODAL_SIZE_KEY, MODAL_POSITION_KEY); }
    }
    function saveElementHeight(element, key) { if (element && element.style.height) GM_setValue(key, element.style.height); }
    function saveModalPositionAndSize(modalElement, sizeKey, positionKey) {
        if (modalElement && (!isModalMinimized || modalElement !== modal )) {
            const modalContent = modalElement.querySelector('.shotgun-modal-content') || modalElement;
            if (positionKey) GM_setValue(positionKey, { top: modalElement.style.top, left: modalElement.style.left });
            if (sizeKey && modalContent && modalContent.style.width && modalContent.style.height) {
                GM_setValue(sizeKey, { width: modalContent.style.width, height: modalContent.style.height });
            }
        }
    }
    function loadModalPositionAndSize(modalElement, sizeKey, positionKey, defaultW = '85%', defaultH = '90vh') {
         if (modalElement && (!isModalMinimized || modalElement !== modal)) {
            const modalContent = modalElement.querySelector('.shotgun-modal-content') || modalElement;
            if (positionKey) {
                const pos = GM_getValue(positionKey);
                if (pos && pos.top && pos.left) { modalElement.style.top = pos.top; modalElement.style.left = pos.left; modalElement.style.transform = ''; }
                else { modalElement.style.top = '50%'; modalElement.style.left = '50%'; modalElement.style.transform = 'translate(-50%, -50%)'; }
            }
            if (sizeKey && modalContent) {
                const size = GM_getValue(sizeKey);
                if (size && size.width && size.height) { modalContent.style.width = size.width; modalContent.style.height = size.height; }
                else { modalContent.style.width = defaultW; modalContent.style.height = defaultH; }
            }
        }
    }
    function loadElementHeights() {
        const elementsAndKeys = [
            { el: contextTextarea, key: TA_CONTEXT_HEIGHT_KEY, default: '150px' }, { el: userTaskTextarea, key: TA_USER_TASK_HEIGHT_KEY, default: '80px' },
            { el: finalPromptTextarea, key: TA_FINAL_PROMPT_HEIGHT_KEY, default: '200px' }, { el: fileListDiv, key: FILE_LIST_HEIGHT_KEY, default: '200px'}
        ];
        elementsAndKeys.forEach(item => { if (item.el) { const savedHeight = GM_getValue(item.key, item.default); item.el.style.height = savedHeight; } });
        loadModalPositionAndSize(modal, MODAL_SIZE_KEY, MODAL_POSITION_KEY);
        if (leftPanelElement) { const leftBasis = GM_getValue(PANEL_LEFT_FLEX_BASIS_KEY, '40%'); leftPanelElement.style.flexBasis = leftBasis; }
    }
    function addResizeListeners() {
        const textareasToSave = [
            { el: contextTextarea, key: TA_CONTEXT_HEIGHT_KEY }, { el: userTaskTextarea, key: TA_USER_TASK_HEIGHT_KEY },
            { el: finalPromptTextarea, key: TA_FINAL_PROMPT_HEIGHT_KEY }, { el: fileListDiv, key: FILE_LIST_HEIGHT_KEY }
        ];
        textareasToSave.forEach(item => { if (item.el) { const onResizeEnd = () => saveElementHeight(item.el, item.key); item.el.addEventListener('mouseup', onResizeEnd); item.el.addEventListener('touchend', onResizeEnd); }});
        if (modal) {
            const modalContentEl = modal.querySelector('.shotgun-modal-content');
            if (modalContentEl) {
                const resizeObserver = new ResizeObserver(entries => {
                    if (!isModalMinimized && modal.style.display === 'block') {
                        for (let entry of entries) {
                            const targetEl = entry.target;
                            if (targetEl.style.width && targetEl.style.height) { saveModalPositionAndSize(modal, MODAL_SIZE_KEY, null); }
                        }
                    }
                });
                resizeObserver.observe(modalContentEl);
            }
        }
    }
    function assignUIElements() {
        modal = document.getElementById('shotgun-prompter-modal'); if (!modal) return;
        fileInput = document.getElementById('shotgun-folder-input-el'); folderInputLabel = document.getElementById('shotgun-folder-input-label-el');
        fileListDiv = document.getElementById('shotgun-file-list-el'); generateContextBtn = document.getElementById('shotgun-generate-context-btn-el');
        contextTextarea = document.getElementById('shotgun-context-textarea-el'); copyContextBtn = document.getElementById('shotgun-copy-context-btn-el');
        userTaskTextarea = document.getElementById('shotgun-user-task-el'); promptTemplateSelect = document.getElementById('shotgun-prompt-template-select-el');
        finalPromptTextarea = document.getElementById('shotgun-final-prompt-el'); copyPromptBtn = document.getElementById('shotgun-copy-prompt-btn-el');
        statusDiv = modal.querySelector('.shotgun-status');
        versionStatusDiv = modal.querySelector('.shotgun-version-status');
        minimizeBtn = modal.querySelector('.shotgun-minimize-btn');
        modalHeaderTitle = modal.querySelector('.shotgun-modal-header h2'); settingsBtn = modal.querySelector('.shotgun-settings-btn');
        statsDiv = document.getElementById('shotgun-stats-el'); contextStatsDiv = document.getElementById('shotgun-context-stats-el'); promptStatsDiv = document.getElementById('shotgun-prompt-stats-el');
        settingsModal = document.getElementById('shotgun-settings-modal');
        leftPanelElement = document.getElementById('shotgun-left-panel-el'); rightPanelElement = document.getElementById('shotgun-right-panel-el'); panelResizerElement = document.getElementById('shotgun-panel-resizer-el');
    }
    function populatePromptTemplateSelect() {
        if (!promptTemplateSelect) return;
        const currentValueBeforeUpdate = promptTemplateSelect.value;
        while (promptTemplateSelect.firstChild) { promptTemplateSelect.removeChild(promptTemplateSelect.firstChild); }
        let idToSelect = selectedPromptTemplateId;
        if (currentValueBeforeUpdate && promptTemplates.find(t => t.id === currentValueBeforeUpdate)) { idToSelect = currentValueBeforeUpdate; }
        else if (!promptTemplates.find(t => t.id === selectedPromptTemplateId) && promptTemplates.length > 0) { idToSelect = promptTemplates[0].id; }
        else if (promptTemplates.length === 0) { idToSelect = null; }
        promptTemplates.forEach(template => {
            const option = createElementWithProps('option', { value: template.id, textContent: template.name });
            if (template.id === idToSelect) option.selected = true;
            promptTemplateSelect.appendChild(option);
        });
        selectedPromptTemplateId = promptTemplateSelect.value || (promptTemplates.length > 0 ? promptTemplates[0].id : null);
        GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, selectedPromptTemplateId);
    }
    function onModalDragStart(event) {
        if (event.target.closest('.shotgun-control-btn, .shotgun-settings-btn, input, textarea, select, button, .shotgun-panel-resizer')) return;
        if (modal && !isModalMinimized) { isDragging = true; dragOffsetX = event.clientX - modal.offsetLeft; dragOffsetY = event.clientY - modal.offsetTop; document.addEventListener('mousemove', onModalDragging); document.addEventListener('mouseup', onModalDragEnd); modal.classList.add('dragging'); }
    }
    function onModalDragging(event) { if (isDragging && modal && !isModalMinimized) { event.preventDefault(); modal.style.left = (event.clientX - dragOffsetX) + 'px'; modal.style.top = (event.clientY - dragOffsetY) + 'px'; modal.style.transform = ''; } }
    function onModalDragEnd() { if (isDragging) { isDragging = false; document.removeEventListener('mousemove', onModalDragging); document.removeEventListener('mouseup', onModalDragEnd); if (modal) modal.classList.remove('dragging'); saveModalPositionAndSize(modal, null, MODAL_POSITION_KEY); } }

    function onPanelResizeStart(event) {
        event.preventDefault(); isPanelResizing = true;
        initialLeftPanelBasis = parseFloat(leftPanelElement.style.flexBasis) || leftPanelElement.offsetWidth;
        initialResizeMouseX = event.clientX;
        document.addEventListener('mousemove', onPanelResizing); document.addEventListener('mouseup', onPanelResizeEnd);
        if (document.body) document.body.classList.add('panel-resizing-active');
    }
    function onPanelResizing(event) {
        if (!isPanelResizing || !leftPanelElement || !modal) return;
        const deltaX = event.clientX - initialResizeMouseX; let newLeftPanelWidth = initialLeftPanelBasis + deltaX;
        const modalBody = modal.querySelector('.shotgun-modal-body'); if (!modalBody) return;
        const modalBodyRect = modalBody.getBoundingClientRect(); const minPanelWidth = 100;
        const resizerWidth = panelResizerElement ? panelResizerElement.offsetWidth + (parseFloat(getComputedStyle(panelResizerElement).marginLeft) || 0) + (parseFloat(getComputedStyle(panelResizerElement).marginRight) || 0) : 5;
        const maxLeftPanelWidth = modalBodyRect.width - minPanelWidth - resizerWidth;
        if (newLeftPanelWidth < minPanelWidth) newLeftPanelWidth = minPanelWidth;
        if (newLeftPanelWidth > maxLeftPanelWidth) newLeftPanelWidth = maxLeftPanelWidth;
        leftPanelElement.style.flexBasis = newLeftPanelWidth + 'px';
    }
    function onPanelResizeEnd() {
        if (isPanelResizing) {
            isPanelResizing = false; document.removeEventListener('mousemove', onPanelResizing); document.removeEventListener('mouseup', onPanelResizeEnd);
            if (document.body) document.body.classList.remove('panel-resizing-active');
            if (leftPanelElement) GM_setValue(PANEL_LEFT_FLEX_BASIS_KEY, leftPanelElement.style.flexBasis);
        }
    }

    function createModal() {
        if (document.getElementById('shotgun-prompter-modal')) { assignUIElements(); loadElementHeights(); populatePromptTemplateSelect(); updateFinalPrompt(); return; }
        modal = createElementWithProps('div', { id: 'shotgun-prompter-modal', class: 'shotgun-modal' });
        const modalContent = createElementWithProps('div', { class: 'shotgun-modal-content' });
        const modalHeader = createElementWithProps('div', { class: 'shotgun-modal-header' }); modalHeader.onmousedown = onModalDragStart;
        modalHeaderTitle = createElementWithProps('h2', { textContent: 'Shotgun Prompter' }); modalHeaderTitle.addEventListener('click', () => { if (isModalMinimized) toggleMinimizeModal(); });
        const headerControls = createElementWithProps('div', { class: 'shotgun-header-controls'});
        settingsBtn = createElementWithProps('span', { class: 'shotgun-control-btn shotgun-settings-btn', textContent: '⚙️'}); settingsBtn.title = "Settings";
        settingsBtn.addEventListener('click', () => { if (!settingsModal) createSettingsModal(); if (settingsModal) { loadSettings(); settingsModal.style.display = 'block'; } });
        minimizeBtn = createElementWithProps('span', { class: 'shotgun-control-btn shotgun-minimize-btn', textContent: '—'}); minimizeBtn.addEventListener('click', toggleMinimizeModal);
        const closeBtnElement = createElementWithProps('span', { class: 'shotgun-control-btn shotgun-close-btn', textContent: '×'}); closeBtnElement.addEventListener('click', () => { if(modal) modal.style.display = 'none'; });
        headerControls.appendChild(settingsBtn); headerControls.appendChild(minimizeBtn); headerControls.appendChild(closeBtnElement);
        modalHeader.appendChild(modalHeaderTitle); modalHeader.appendChild(headerControls);
        const modalBody = createElementWithProps('div', { class: 'shotgun-modal-body' });
        leftPanelElement = createElementWithProps('div', { id: 'shotgun-left-panel-el', class: 'shotgun-panel shotgun-left-panel' });
        leftPanelElement.appendChild(createElementWithProps('h3', { textContent: '1. Select Files & Generate Context' }));
        const fileInputContainer = createElementWithProps('div', { style: 'margin-bottom:10px;' });
        fileInput = createElementWithProps('input', { type: 'file', id: 'shotgun-folder-input-el', webkitdirectory: '', directory: '', multiple: '', style: 'display: none;' });
        const fileInputTriggerBtn = createElementWithProps('button', { class: 'shotgun-button', textContent: 'Выбор папки' }); fileInputTriggerBtn.addEventListener('click', () => fileInput.click());
        folderInputLabel = createElementWithProps('span', { id: 'shotgun-folder-input-label-el', style: 'margin-left: 10px; font-size: 0.85em; color: #5f6368;' }); folderInputLabel.textContent = lastSelectedFolderName ? `Последняя папка: ${lastSelectedFolderName}` : 'Папка не выбрана';
        fileInputContainer.appendChild(fileInputTriggerBtn); fileInputContainer.appendChild(fileInput); fileInputContainer.appendChild(folderInputLabel); leftPanelElement.appendChild(fileInputContainer);
        const fileListHeader = createElementWithProps('div', { class: 'shotgun-file-list-header' });
        fileListHeader.appendChild(createElementWithProps('h4', { textContent: 'Selected Files:' }));
        
        function setAllNodesExpansion(expandState) {
            function recurseSet(node, state) {
                if (node && node._isDir) {
                    node._expanded = state;
                    Object.values(node._children).forEach(child => recurseSet(child, state));
                }
            }
            Object.values(displayTreeRoot).forEach(rootNode => recurseSet(rootNode, expandState));
            persistCurrentExpansionState(displayTreeRoot);
            renderFileList();
        }

        const fileListControls = createElementWithProps('div', {class: 'shotgun-file-list-controls'});
        const expandAllBtn = createElementWithProps('button', {class: 'shotgun-button shotgun-button-small', textContent: 'Разв. все'});
        expandAllBtn.onclick = () => setAllNodesExpansion(true);
        const collapseAllBtn = createElementWithProps('button', {class: 'shotgun-button shotgun-button-small', textContent: 'Сверн. все'});
        collapseAllBtn.onclick = () => setAllNodesExpansion(false);
        const selectAllBtn = createElementWithProps('button', {class: 'shotgun-button shotgun-button-small', textContent: 'Выбр. все'});
        selectAllBtn.onclick = () => { projectFiles.forEach(pf => pf.excluded = false); displayTreeRoot = buildDisplayTreeAndSetExclusion(projectFiles); renderFileList(); if(generateContextBtn) generateContextBtn.disabled = projectFiles.length === 0; };
        const deselectAllBtn = createElementWithProps('button', {class: 'shotgun-button shotgun-button-small', textContent: 'Снять все'});
        deselectAllBtn.onclick = () => { projectFiles.forEach(pf => pf.excluded = true); displayTreeRoot = buildDisplayTreeAndSetExclusion(projectFiles); renderFileList(); if(generateContextBtn) generateContextBtn.disabled = true; };
        fileListControls.append(expandAllBtn, collapseAllBtn, selectAllBtn, deselectAllBtn);
        fileListHeader.appendChild(fileListControls);
        leftPanelElement.appendChild(fileListHeader);
        statsDiv = createElementWithProps('div', { id: 'shotgun-stats-el', class: 'shotgun-stats-text' }); leftPanelElement.appendChild(statsDiv);
        fileListDiv = createElementWithProps('div', { id: 'shotgun-file-list-el', class: 'shotgun-file-list' }); leftPanelElement.appendChild(fileListDiv);
        generateContextBtn = createElementWithProps('button', { id: 'shotgun-generate-context-btn-el', class: 'shotgun-button', textContent: 'Generate Context', disabled: '' }); leftPanelElement.appendChild(generateContextBtn);
        copyContextBtn = createElementWithProps('button', { id: 'shotgun-copy-context-btn-el', class: 'shotgun-button', textContent: 'Copy Context', disabled: '' }); leftPanelElement.appendChild(copyContextBtn);
        leftPanelElement.appendChild(createElementWithProps('h4', { textContent: 'Generated Context:' }));
        contextStatsDiv = createElementWithProps('div', { id: 'shotgun-context-stats-el', class: 'shotgun-stats-text' }); leftPanelElement.appendChild(contextStatsDiv);
        contextTextarea = createElementWithProps('textarea', { id: 'shotgun-context-textarea-el', class: 'shotgun-textarea', readonly: '', placeholder: 'Context will appear here...' }); leftPanelElement.appendChild(contextTextarea);
        panelResizerElement = createElementWithProps('div', { id: 'shotgun-panel-resizer-el', class: 'shotgun-panel-resizer' }); panelResizerElement.onmousedown = onPanelResizeStart;
        rightPanelElement = createElementWithProps('div', { id: 'shotgun-right-panel-el', class: 'shotgun-panel shotgun-right-panel' });
        rightPanelElement.appendChild(createElementWithProps('h3', { textContent: '2. Compose Prompt' }));
        rightPanelElement.appendChild(createElementWithProps('h4', { textContent: 'Your Task for AI:' }));
        userTaskTextarea = createElementWithProps('textarea', { id: 'shotgun-user-task-el', class: 'shotgun-textarea', placeholder: 'Describe what the AI should do...' }); rightPanelElement.appendChild(userTaskTextarea);
        rightPanelElement.appendChild(createElementWithProps('h4', { textContent: 'Prompt Template:' }));
        promptTemplateSelect = createElementWithProps('select', { id: 'shotgun-prompt-template-select-el', class: 'shotgun-select' }); rightPanelElement.appendChild(promptTemplateSelect);
        rightPanelElement.appendChild(createElementWithProps('h4', { textContent: 'Final Prompt:' }));
        promptStatsDiv = createElementWithProps('div', { id: 'shotgun-prompt-stats-el', class: 'shotgun-stats-text' }); rightPanelElement.appendChild(promptStatsDiv);
        finalPromptTextarea = createElementWithProps('textarea', { id: 'shotgun-final-prompt-el', class: 'shotgun-textarea', readonly: '', placeholder: 'Final prompt will be assembled here...' }); rightPanelElement.appendChild(finalPromptTextarea);
        copyPromptBtn = createElementWithProps('button', { id: 'shotgun-copy-prompt-btn-el', class: 'shotgun-button', textContent: 'Copy Final Prompt', disabled: '' }); rightPanelElement.appendChild(copyPromptBtn);
        modalBody.appendChild(leftPanelElement); modalBody.appendChild(panelResizerElement); modalBody.appendChild(rightPanelElement);
        const modalFooter = createElementWithProps('div', { class: 'shotgun-modal-footer' });
        statusDiv = createElementWithProps('div', { class: 'shotgun-status', textContent: 'Ready.' });
        versionStatusDiv = createElementWithProps('div', { class: 'shotgun-version-status'}); // Version status div
        const currentVersionSpan = createElementWithProps('div', { class: 'shotgun-current-script-version', textContent: `v${SCRIPT_VERSION}` });

        modalFooter.appendChild(versionStatusDiv); // Add version status first
        modalFooter.appendChild(statusDiv);      // Then regular status (will grow)
        modalFooter.appendChild(currentVersionSpan); // Then current script version
        modalContent.appendChild(modalHeader); modalContent.appendChild(modalBody); modalContent.appendChild(modalFooter);
        modal.appendChild(modalContent);
        if (document.body) document.body.appendChild(modal); else { console.error("[Shotgun Prompter] document.body not available."); return; }
        assignUIElements(); loadElementHeights(); addResizeListeners(); renderFileList(); updateStats(); populatePromptTemplateSelect(); updateFinalPrompt();
        checkForUpdates(); // Check for updates when modal is created/shown
        if (fileInput) fileInput.addEventListener('change', handleFileSelection);
        if (generateContextBtn) generateContextBtn.addEventListener('click', generateContext);
        if (copyContextBtn) copyContextBtn.addEventListener('click', () => copyToClipboard(contextTextarea.value, copyContextBtn));
        if (copyPromptBtn) copyPromptBtn.addEventListener('click', () => copyToClipboard(finalPromptTextarea.value, copyPromptBtn));
        if (userTaskTextarea) userTaskTextarea.addEventListener('input', updateFinalPrompt);
        if (promptTemplateSelect) {
            promptTemplateSelect.addEventListener('change', (event) => {
                selectedPromptTemplateId = event.target.value; GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, selectedPromptTemplateId);
                updateFinalPrompt();
            });
        }
    }

    let settingsIgnoreRulesTextarea, settingsTemplateListDiv, settingsTemplateNameInput, settingsTemplateContentTextarea, settingsSelectedTemplateId = null;
    function loadSettings() {
        if (settingsIgnoreRulesTextarea) settingsIgnoreRulesTextarea.value = GM_getValue(CUSTOM_IGNORE_RULES_KEY, DEFAULT_IGNORE_RULES);
        renderSettingsTemplateList();
        if (promptTemplates.length > 0) { const templateToSelect = promptTemplates.find(t => t.id === selectedPromptTemplateId) || promptTemplates[0]; selectTemplateForEditing(templateToSelect.id); }
        else clearTemplateEditFields();
        loadModalPositionAndSize(settingsModal, SETTINGS_MODAL_SIZE_KEY, null, '70%', '75vh');
        if(settingsMaxFileSizeInput) settingsMaxFileSizeInput.value = GM_getValue(MAX_FILE_SIZE_KB_KEY, '1024');
        if(settingsFileSizeActionSelect) settingsFileSizeActionSelect.value = GM_getValue(FILE_SIZE_ACTION_KEY, 'skip');
        if(settingsTruncateValueInput) settingsTruncateValueInput.value = GM_getValue(TRUNCATE_VALUE_KEY, '5000');
        if(settingsSkipBinaryCheckbox) settingsSkipBinaryCheckbox.checked = GM_getValue(SKIP_BINARY_FILES_KEY, true);
        toggleTruncateValueVisibility();
        if(settingsIgnoreTesterPathInput) settingsIgnoreTesterPathInput.value = '';
        if(settingsIgnoreTesterResultSpan) settingsIgnoreTesterResultSpan.textContent = '';
    }
    function saveSettings() {
        if (settingsIgnoreRulesTextarea) { GM_setValue(CUSTOM_IGNORE_RULES_KEY, settingsIgnoreRulesTextarea.value); if (projectFiles.length > 0) { applyIgnoreRulesToProjectFiles(); displayTreeRoot = buildDisplayTreeAndSetExclusion(projectFiles); renderFileList(); if(contextTextarea) contextTextarea.value = ''; generatedContext = ''; if(copyContextBtn) copyContextBtn.disabled = true; updateFinalPrompt(); updateStats(); } }
        saveModalPositionAndSize(settingsModal, SETTINGS_MODAL_SIZE_KEY, null);
        if(settingsMaxFileSizeInput) GM_setValue(MAX_FILE_SIZE_KB_KEY, settingsMaxFileSizeInput.value);
        if(settingsFileSizeActionSelect) GM_setValue(FILE_SIZE_ACTION_KEY, settingsFileSizeActionSelect.value);
        if(settingsTruncateValueInput) GM_setValue(TRUNCATE_VALUE_KEY, settingsTruncateValueInput.value);
        if(settingsSkipBinaryCheckbox) GM_setValue(SKIP_BINARY_FILES_KEY, settingsSkipBinaryCheckbox.checked);
        updateStatus("Settings saved.", false);
    }
    function renderSettingsTemplateList() {
        if (!settingsTemplateListDiv) return; while (settingsTemplateListDiv.firstChild) { settingsTemplateListDiv.removeChild(settingsTemplateListDiv.firstChild); }
        promptTemplates.forEach(template => {
            let displayName = template.name;
            if (template.isOfficial) displayName += ' (Official)'; 
            else if (template.isCore && !template.isOfficial) displayName += ' (Core)'; // Ensure "Official" takes precedence if isCore is also true
            const itemDiv = createElementWithProps('div', { class: 'shotgun-settings-list-item' + (template.id === settingsSelectedTemplateId ? ' selected' : ''), textContent: displayName, onclick: () => selectTemplateForEditing(template.id) }); settingsTemplateListDiv.appendChild(itemDiv); });
    }
    function selectTemplateForEditing(templateId) {
        const template = promptTemplates.find(t => t.id === templateId);
        if (template && settingsTemplateNameInput && settingsTemplateContentTextarea && settingsTemplateListDiv) {
            settingsSelectedTemplateId = template.id; settingsTemplateNameInput.value = template.name; settingsTemplateContentTextarea.value = template.content;
            settingsTemplateNameInput.disabled = !!template.isCore; settingsTemplateContentTextarea.disabled = !!template.isCore;
            Array.from(settingsTemplateListDiv.children).forEach(child => {
                child.classList.remove('selected'); if (child.textContent.startsWith(template.name)) child.classList.add('selected');
            });
            // Core or Official templates cannot be deleted or modified (name/content fields are disabled)
            const deleteBtn = document.getElementById('shotgun-settings-delete-template-btn'); if (deleteBtn) deleteBtn.disabled = !!(template.isCore || template.isOfficial);
        }
    }
    function clearTemplateEditFields() {
        console.log('[Shotgun Prompter] clearTemplateEditFields called');
        if (settingsTemplateNameInput && settingsTemplateContentTextarea && settingsTemplateListDiv) {
            settingsSelectedTemplateId = null; settingsTemplateNameInput.value = ''; settingsTemplateContentTextarea.value = '';
            settingsTemplateNameInput.disabled = false; settingsTemplateContentTextarea.disabled = false;
            Array.from(settingsTemplateListDiv.children).forEach(child => child.classList.remove('selected'));
            const deleteBtn = document.getElementById('shotgun-settings-delete-template-btn'); if (deleteBtn) deleteBtn.disabled = true; // No template selected, so disable delete
        }
    }
    function handleSaveTemplate() {
        console.log('[Shotgun Prompter] handleSaveTemplate called');
        const name = settingsTemplateNameInput.value.trim(); const content = settingsTemplateContentTextarea.value;
        if (!name || !content) { updateStatus("Template name and content cannot be empty.", true); return; }
        if (settingsSelectedTemplateId) {
            const template = promptTemplates.find(t => t.id === settingsSelectedTemplateId);
            if (template && !template.isCore) { template.name = name; template.content = content; }
            else if (template && (template.isCore || template.isOfficial)) { updateStatus("Core/Official templates cannot be modified directly. Save as new instead.", true); return; }
        } else {
            const newId = SCRIPT_PREFIX + 'tpl_' + Date.now();
            promptTemplates.push({ id: newId, name: name, content: content, isCore: false });
            settingsSelectedTemplateId = newId; selectedPromptTemplateId = newId; GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, selectedPromptTemplateId);
        }
        GM_setValue(CUSTOM_PROMPT_TEMPLATES_KEY, promptTemplates); renderSettingsTemplateList();
        selectTemplateForEditing(settingsSelectedTemplateId); populatePromptTemplateSelect(); updateFinalPrompt();
        updateStatus("Prompt template saved.", false);
    }
    function handleDeleteTemplate() {
        console.log('[Shotgun Prompter] handleDeleteTemplate called');
        if (settingsSelectedTemplateId) {
            const template = promptTemplates.find(t => t.id === settingsSelectedTemplateId);
            if (template && (template.isCore || template.isOfficial)) { updateStatus("Core/Official templates cannot be deleted.", true); return; }
            if (template && confirm(`Are you sure you want to delete template "${template.name}"?`)) {
                const deletedId = settingsSelectedTemplateId;
                promptTemplates = promptTemplates.filter(t => t.id !== settingsSelectedTemplateId);
                GM_setValue(CUSTOM_PROMPT_TEMPLATES_KEY, promptTemplates); clearTemplateEditFields(); renderSettingsTemplateList();
                if (selectedPromptTemplateId === deletedId) { selectedPromptTemplateId = promptTemplates.length > 0 ? promptTemplates[0].id : null; GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, selectedPromptTemplateId); }
                populatePromptTemplateSelect(); updateFinalPrompt(); updateStatus("Prompt template deleted.", false);
            }
        }
    }
    function handleResetAllSettings() {
        if (confirm("ARE YOU SURE you want to reset ALL Shotgun Prompter settings to their defaults? This includes ignore rules, prompt templates, and UI customizations. This action cannot be undone.")) {
            const keys = GM_listValues(); keys.forEach(key => { if (key.startsWith(SCRIPT_PREFIX)) GM_deleteValue(key); });
            promptTemplates = JSON.parse(JSON.stringify(DEFAULT_PROMPT_TEMPLATES)); selectedPromptTemplateId = promptTemplates.length > 0 ? promptTemplates[0].id : null;
            lastSelectedFolderName = "";
            if (settingsModal && settingsModal.style.display === 'block') loadSettings();
            populatePromptTemplateSelect(); if (folderInputLabel) folderInputLabel.textContent = 'Папка не выбрана';
            loadElementHeights();
            if (leftPanelElement) leftPanelElement.style.flexBasis = '40%';
            updateFinalPrompt(); updateStatus("All settings have been reset to defaults.", false);
        }
    }
    function testIgnoreRule() {
        if (!settingsIgnoreTesterPathInput || !settingsIgnoreTesterResultSpan || !settingsIgnoreRulesTextarea) return;
        const path = settingsIgnoreTesterPathInput.value.trim();
        const rules = settingsIgnoreRulesTextarea.value;
        if (!path) { settingsIgnoreTesterResultSpan.textContent = "Enter a path to test."; settingsIgnoreTesterResultSpan.style.color = 'orange'; return; }
        const ignored = isPathIgnored(path, rules);
        settingsIgnoreTesterResultSpan.textContent = ignored ? "Ignored" : "Included";
        settingsIgnoreTesterResultSpan.style.color = ignored ? "red" : "green";
    }
    function toggleTruncateValueVisibility() {
        if (!settingsFileSizeActionSelect || !settingsTruncateValueInput) return;
        const parent = settingsTruncateValueInput.parentElement;
        if (parent) { parent.style.display = settingsFileSizeActionSelect.value.startsWith('truncate_') ? '' : 'none'; }
    }
    function exportSettings() {
        const settingsToExport = {};
        const keys = GM_listValues();
        keys.forEach(key => { if (key.startsWith(SCRIPT_PREFIX)) settingsToExport[key] = GM_getValue(key); });
        const jsonString = JSON.stringify(settingsToExport, null, 2);
        const blob = new Blob([jsonString], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'shotgun_prompter_settings.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        updateStatus("Settings exported.");
    }
    function importSettings(event) {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedSettings = JSON.parse(e.target.result); let settingsApplied = 0;
                for (const key in importedSettings) { if (key.startsWith(SCRIPT_PREFIX)) { GM_setValue(key, importedSettings[key]); settingsApplied++; } }
                promptTemplates = GM_getValue(CUSTOM_PROMPT_TEMPLATES_KEY, JSON.parse(JSON.stringify(DEFAULT_PROMPT_TEMPLATES)));
                selectedPromptTemplateId = GM_getValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, promptTemplates.length > 0 ? promptTemplates[0].id : null);
                lastSelectedFolderName = GM_getValue(LAST_FOLDER_NAME_KEY, "");
                if (modal && modal.style.display === 'block') { assignUIElements(); loadElementHeights(); populatePromptTemplateSelect(); updateFinalPrompt(); if (folderInputLabel) folderInputLabel.textContent = lastSelectedFolderName ? `Последняя папка: ${lastSelectedFolderName}` : 'Папка не выбрана'; }
                if (settingsModal && settingsModal.style.display === 'block') { loadSettings(); }
                updateStatus(`${settingsApplied} settings imported successfully. Please review.`);
            } catch (error) { console.error("[Shotgun Prompter] Error importing settings:", error); updateStatus("Error importing settings: Invalid JSON file.", true);
            } finally { event.target.value = null; }
        };
        reader.readAsText(file);
    }

    function fetchOfficialPromptTemplates() {
        console.log('[Shotgun Prompter] fetchOfficialPromptTemplates called');
        updateStatus("Fetching official prompt templates...", false);
        GM_xmlhttpRequest({
            method: "GET",
            url: OFFICIAL_PROMPT_TEMPLATES_URL + "?t=" + Date.now(), // Cache buster
            onload: function(response) {
                console.log('[Shotgun Prompter] Fetched official templates response:', response.responseText);
                try {
                    const officialTemplates = JSON.parse(response.responseText);
                    if (!Array.isArray(officialTemplates)) throw new Error("Invalid format for official templates.");
                    let updatedCount = 0; let newCount = 0;
                    officialTemplates.forEach(officialTpl => {
                        if (!officialTpl.id || !officialTpl.name || !officialTpl.content) return; // Skip invalid
                        const existingIndex = promptTemplates.findIndex(t => t.id === officialTpl.id);
                        const templateData = { ...officialTpl, isCore: true, isOfficial: true }; // Mark as core and official

                        if (existingIndex > -1) {
                            promptTemplates[existingIndex] = { ...promptTemplates[existingIndex], ...templateData };
                            updatedCount++;
                        } else {
                            promptTemplates.push(templateData);
                            newCount++;
                        }
                    });
                    GM_setValue(CUSTOM_PROMPT_TEMPLATES_KEY, promptTemplates);
                    renderSettingsTemplateList(); populatePromptTemplateSelect(); updateFinalPrompt();
                    updateStatus(`Official templates loaded: ${newCount} new, ${updatedCount} updated.`, false);
                } catch (e) { console.error("[Shotgun Prompter] Error processing official templates:", e); updateStatus("Error processing official templates: " + e.message, true); }
            },
            onerror: function(response) {
                console.error("[Shotgun Prompter] Error fetching official templates (network/http error):", response);
                updateStatus("Failed to fetch official templates (network error). See console.", true);
            }
        });
    }

    function createSettingsModal() {
        if (document.getElementById('shotgun-settings-modal')) return;
        settingsModal = createElementWithProps('div', { id: 'shotgun-settings-modal', class: 'shotgun-modal shotgun-settings-submodal' });
        const modalContent = createElementWithProps('div', { class: 'shotgun-modal-content' });
        modalContent.style.resize = 'both';
        const modalHeader = createElementWithProps('div', { class: 'shotgun-modal-header' });
        modalHeader.onmousedown = (event) => { if (event.target.closest('.shotgun-control-btn, input, textarea, select, button')) return; let sm = document.getElementById('shotgun-settings-modal'); if (sm) { let isSMDragging = true; let smDragOffsetX = event.clientX - sm.offsetLeft; let smDragOffsetY = event.clientY - sm.offsetTop; const onSMDragging = (e) => { if (isSMDragging) { e.preventDefault(); sm.style.left = (e.clientX - smDragOffsetX) + 'px'; sm.style.top = (e.clientY - smDragOffsetY) + 'px'; sm.style.transform = ''; } }; const onSMDragEnd = () => { if (isSMDragging) { isSMDragging = false; document.removeEventListener('mousemove', onSMDragging); document.removeEventListener('mouseup', onSMDragEnd); saveModalPositionAndSize(sm, SETTINGS_MODAL_SIZE_KEY, null); } }; document.addEventListener('mousemove', onSMDragging); document.addEventListener('mouseup', onSMDragEnd); }};
        modalHeader.appendChild(createElementWithProps('h2', { textContent: 'Shotgun Prompter Settings' }));
        const closeBtn = createElementWithProps('span', { class: 'shotgun-control-btn shotgun-close-btn', textContent: '×' });
        closeBtn.addEventListener('click', () => { saveSettings(); if(settingsModal) settingsModal.style.display = 'none'; });
        modalHeader.appendChild(closeBtn);
        const modalBody = createElementWithProps('div', { class: 'shotgun-modal-body', style: 'flex-direction: column;' });
        modalBody.appendChild(createElementWithProps('h3', { textContent: 'Ignore Rules' }));
        settingsIgnoreRulesTextarea = createElementWithProps('textarea', { id: 'shotgun-settings-ignore-rules-ta', class: 'shotgun-textarea', style: `height: ${GM_getValue(TA_IGNORE_RULES_HEIGHT_KEY, '100px')}; resize: vertical;`, placeholder: DEFAULT_IGNORE_RULES });
        settingsIgnoreRulesTextarea.addEventListener('mouseup', () => saveElementHeight(settingsIgnoreRulesTextarea, TA_IGNORE_RULES_HEIGHT_KEY));
        settingsIgnoreRulesTextarea.addEventListener('input', testIgnoreRule);
        modalBody.appendChild(settingsIgnoreRulesTextarea);
        const testerDiv = createElementWithProps('div', {class: 'shotgun-settings-ignore-tester'});
        testerDiv.appendChild(createElementWithProps('label', {textContent: 'Test Path:', for: 'shotgun-ignore-tester-path'}));
        settingsIgnoreTesterPathInput = createElementWithProps('input', {type: 'text', id: 'shotgun-ignore-tester-path', class: 'shotgun-input', placeholder: 'e.g., node_modules/file.js or src/my_file.txt'});
        settingsIgnoreTesterPathInput.addEventListener('input', testIgnoreRule);
        testerDiv.appendChild(settingsIgnoreTesterPathInput);
        settingsIgnoreTesterResultSpan = createElementWithProps('span', {id: 'shotgun-ignore-tester-result', style: 'margin-left: 10px; font-weight: bold;'});
        testerDiv.appendChild(settingsIgnoreTesterResultSpan);
        modalBody.appendChild(testerDiv);
        modalBody.appendChild(createElementWithProps('h3', { textContent: 'File Handling' }));
        const fhGrid = createElementWithProps('div', { class: 'shotgun-settings-grid' });
        fhGrid.appendChild(createElementWithProps('label', {textContent: 'Max File Size (KB, 0 for unlimited):', for: 'shotgun-max-file-size'}));
        settingsMaxFileSizeInput = createElementWithProps('input', {type: 'number', id: 'shotgun-max-file-size', class: 'shotgun-input', min: '0'});
        fhGrid.appendChild(settingsMaxFileSizeInput);
        fhGrid.appendChild(createElementWithProps('label', {textContent: 'If Size Exceeded:', for: 'shotgun-file-size-action'}));
        settingsFileSizeActionSelect = createElementWithProps('select', {id: 'shotgun-file-size-action', class: 'shotgun-select'}, [
            createElementWithProps('option', {value: 'skip', textContent: 'Skip File'}),
            createElementWithProps('option', {value: 'truncate_chars', textContent: 'Truncate (Characters)'}),
            createElementWithProps('option', {value: 'truncate_lines', textContent: 'Truncate (Lines)'}),
        ]);
        settingsFileSizeActionSelect.onchange = toggleTruncateValueVisibility;
        fhGrid.appendChild(settingsFileSizeActionSelect);
        const truncateValueLabel = createElementWithProps('label', {textContent: 'Truncate to (chars/lines):', for: 'shotgun-truncate-value'});
        settingsTruncateValueInput = createElementWithProps('input', {type: 'number', id: 'shotgun-truncate-value', class: 'shotgun-input', min: '1'});
        const truncateWrapper = createElementWithProps('div', {}, [truncateValueLabel, settingsTruncateValueInput]);
        fhGrid.appendChild(truncateWrapper);
        const skipBinaryLabel = createElementWithProps('label', {textContent: 'Skip Binary Files:', for: 'shotgun-skip-binary'});
        settingsSkipBinaryCheckbox = createElementWithProps('input', {type: 'checkbox', id: 'shotgun-skip-binary', style: 'width: auto; margin-left: 5px;'});
        const skipBinaryWrapper = createElementWithProps('div', {style: 'display: flex; align-items: center;'}, [skipBinaryLabel, settingsSkipBinaryCheckbox]);
        fhGrid.appendChild(skipBinaryWrapper);
        modalBody.appendChild(fhGrid);
        modalBody.appendChild(createElementWithProps('h3', { textContent: 'Prompt Templates' }));
        const templateSection = createElementWithProps('div', { class: 'shotgun-settings-template-section' });
        settingsTemplateListDiv = createElementWithProps('div', { class: 'shotgun-settings-template-list' }); templateSection.appendChild(settingsTemplateListDiv);
        const templateEditDiv = createElementWithProps('div', { class: 'shotgun-settings-template-edit' });
        templateEditDiv.appendChild(createElementWithProps('label', { textContent: 'Template Name:', for: 'shotgun-settings-template-name' }));
        settingsTemplateNameInput = createElementWithProps('input', { type: 'text', id: 'shotgun-settings-template-name', class: 'shotgun-input' }); templateEditDiv.appendChild(settingsTemplateNameInput);
        templateEditDiv.appendChild(createElementWithProps('label', { textContent: 'Template Content:', for: 'shotgun-settings-template-content' }));
        settingsTemplateContentTextarea = createElementWithProps('textarea', { id: 'shotgun-settings-template-content', class: 'shotgun-textarea', style: 'height: 150px; resize: vertical;' }); templateEditDiv.appendChild(settingsTemplateContentTextarea);
        const templateButtonsDiv = createElementWithProps('div', { class: 'shotgun-settings-template-buttons' });

        const newTemplateBtn = createElementWithProps('button', {
            class: 'shotgun-button', textContent: 'New Template',
            onclick: clearTemplateEditFields
        });
        templateButtonsDiv.appendChild(newTemplateBtn);

        const saveTemplateBtn = createElementWithProps('button', {
            class: 'shotgun-button', textContent: 'Save Template',
            onclick: handleSaveTemplate
        });
        templateButtonsDiv.appendChild(saveTemplateBtn);

        const deleteTemplateBtn = createElementWithProps('button', {
            id: 'shotgun-settings-delete-template-btn', class: 'shotgun-button shotgun-button-danger', textContent: 'Delete Template', disabled: '',
            onclick: handleDeleteTemplate
        });
        templateButtonsDiv.appendChild(deleteTemplateBtn);

        const fetchOfficialBtn = createElementWithProps('button', {
            class: 'shotgun-button', textContent: 'Fetch Official Templates', title: 'Download or update templates from GitHub',
            onclick: fetchOfficialPromptTemplates
        });
        templateButtonsDiv.appendChild(fetchOfficialBtn);

        templateEditDiv.appendChild(templateButtonsDiv); templateSection.appendChild(templateEditDiv); modalBody.appendChild(templateSection); 

        modalBody.appendChild(createElementWithProps('h3', { textContent: 'Import/Export Settings' }));
        const ieDiv = createElementWithProps('div', { class: 'shotgun-settings-import-export' }); // Changed from grid to simple div
        const exportBtn = createElementWithProps('button', {class: 'shotgun-button', textContent: 'Export Settings'});
        exportBtn.onclick = exportSettings;
        ieDiv.appendChild(exportBtn);
        const importLabel = createElementWithProps('label', {class: 'shotgun-button', textContent: 'Import Settings', for: 'shotgun-import-settings-input', style: 'margin-left: 10px;'}); // Added margin
        const importInput = createElementWithProps('input', {type: 'file', id: 'shotgun-import-settings-input', accept: '.json', style: 'display: none;'});
        importInput.onchange = importSettings;
        ieDiv.appendChild(importLabel);
        ieDiv.appendChild(importInput);
        modalBody.appendChild(ieDiv);

        modalBody.appendChild(createElementWithProps('h3', { textContent: 'General' }));
        const resetAllBtn = createElementWithProps('button', { class: 'shotgun-button shotgun-button-danger', textContent: 'Reset All Prompter Settings' }); resetAllBtn.addEventListener('click', handleResetAllSettings); modalBody.appendChild(resetAllBtn);
        const modalFooter = createElementWithProps('div', { class: 'shotgun-modal-footer' });
        const saveAndCloseBtn = createElementWithProps('button', { class: 'shotgun-button', textContent: 'Save & Close Settings' });
        saveAndCloseBtn.addEventListener('click', () => { saveSettings(); if(settingsModal) settingsModal.style.display = 'none'; });
        modalFooter.appendChild(saveAndCloseBtn);
        modalContent.appendChild(modalHeader); modalContent.appendChild(modalBody); modalContent.appendChild(modalFooter);
        settingsModal.appendChild(modalContent);
        if (document.body) {
            document.body.appendChild(settingsModal);
            const smContentEl = settingsModal.querySelector('.shotgun-modal-content');
            if (smContentEl) {
                const smResizeObserver = new ResizeObserver(entries => {
                    if (settingsModal.style.display === 'block') {
                        for (let entry of entries) {
                            const targetEl = entry.target;
                            if (targetEl.style.width && targetEl.style.height) { saveModalPositionAndSize(settingsModal, SETTINGS_MODAL_SIZE_KEY, null); }
                        }
                    }
                });
                smResizeObserver.observe(smContentEl);
            }
        } else console.error("[Shotgun Prompter] document.body not available for settings modal.");
        loadModalPositionAndSize(settingsModal, SETTINGS_MODAL_SIZE_KEY, null, '70%', '75vh');
    }

    function compareVersions(v1, v2) {
        if (typeof v1 !== 'string' || typeof v2 !== 'string') return 0; // Or handle error
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        const len = Math.max(parts1.length, parts2.length);
        for (let i = 0; i < len; i++) {
            const n1 = parts1[i] || 0;
            const n2 = parts2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    }

    function displayUpdateNotification(remoteVersion, updateUrl, changelogUrl) {
        if (!versionStatusDiv) return;
        const fragment = document.createDocumentFragment();
        fragment.appendChild(document.createTextNode(`New version ${remoteVersion} available! `));
        
        const updateBtn = createElementWithProps('button', { class: 'shotgun-button shotgun-button-small', textContent: `Update to v${remoteVersion}`});
        updateBtn.style.marginLeft = "5px"; updateBtn.style.marginRight = "5px";
        updateBtn.onclick = () => window.open(updateUrl, '_blank');
        fragment.appendChild(updateBtn);

        if (changelogUrl) {
            const changelogLink = createElementWithProps('a', { href: changelogUrl, target: '_blank', textContent: 'View Changelog' });
            changelogLink.style.color = '#1a73e8'; 
            fragment.appendChild(changelogLink);
        }
        updateStatus(fragment, false, true);
    }

    function checkForUpdates(forceCheck = false) { // Added forceCheck for testing
        const lastCheck = GM_getValue(LAST_VERSION_CHECK_KEY, 0);
        const timeSinceLastCheck = Date.now() - lastCheck;
        console.log(`[Shotgun Prompter] checkForUpdates: SCRIPT_VERSION=${SCRIPT_VERSION}. Last check: ${new Date(lastCheck).toLocaleString()}. Time since: ${timeSinceLastCheck/1000}s. Interval: ${CHECK_VERSION_INTERVAL/1000}s. Force check: ${forceCheck}`);
        if (!forceCheck && timeSinceLastCheck < CHECK_VERSION_INTERVAL) {
            console.log("[Shotgun Prompter] Version check interval not yet passed and not forced.");
            const storedRemoteData = GM_getValue(LATEST_REMOTE_VERSION_DATA_KEY, null);
            if (storedRemoteData && storedRemoteData.version && compareVersions(storedRemoteData.version, SCRIPT_VERSION) > 0) {
                console.log("[Shotgun Prompter] Redisplaying stored update notification for version " + storedRemoteData.version);
                displayUpdateNotification(storedRemoteData.version, storedRemoteData.update_url, storedRemoteData.changelog_url);
            }
            return;
        }
        console.log("[Shotgun Prompter] Proceeding with version check API call.");
        GM_xmlhttpRequest({
            method: "GET",
            url: VERSION_CHECK_URL + "?t=" + Date.now(), // Cache buster
            onload: function(response) {
                GM_setValue(LAST_VERSION_CHECK_KEY, Date.now());
                try {
                    const remoteVersionData = JSON.parse(response.responseText);
                    const remoteVersion = remoteVersionData.version;
                    console.log(`[Shotgun Prompter] Remote version data fetched:`, remoteVersionData, `Local version: ${SCRIPT_VERSION}`);
                    if (remoteVersion && compareVersions(remoteVersion, SCRIPT_VERSION) > 0) {
                        GM_setValue(LATEST_REMOTE_VERSION_DATA_KEY, remoteVersionData);
                        displayUpdateNotification(remoteVersion, remoteVersionData.update_url || GM_info.script.downloadURL || '#', remoteVersionData.changelog_url || '');
                    } else {
                        GM_deleteValue(LATEST_REMOTE_VERSION_DATA_KEY);
                        console.log("[Shotgun Prompter] Script is up to date or remote version is not newer.");
                        if (versionStatusDiv) versionStatusDiv.textContent = ''; // Clear if up-to-date
                    }
                } catch (e) {
                    console.error("[Shotgun Prompter] Error parsing version data:", e);
                    if (versionStatusDiv) versionStatusDiv.textContent = ''; // Clear on error too
                    updateStatus("Error checking for updates (parse error).", true, true);
                }
            },
            onerror: function(response) {
                GM_setValue(LAST_VERSION_CHECK_KEY, Date.now()); // Still update timestamp to avoid spamming on network errors
                console.error("[Shotgun Prompter] Error fetching version data:", response);
                updateStatus("Error checking for updates (network error).", true, true);
            }
        });
    }


    function injectMainButton() {
        if (document.getElementById('shotgun-prompter-btn')) return;
        const btn = document.createElement('button'); btn.id = 'shotgun-prompter-btn'; btn.textContent = 'Shotgun Prompter';
        btn.addEventListener('click', () => {
            if (!modal || !document.getElementById('shotgun-prompter-modal')) createModal();
            else { assignUIElements(); loadElementHeights(); populatePromptTemplateSelect(); updateFinalPrompt(); }
            if (modal && document.getElementById('shotgun-prompter-modal')) {
                modal.style.display = 'block';
                if (isModalMinimized) toggleMinimizeModal(); else loadModalPositionAndSize(modal, MODAL_SIZE_KEY, MODAL_POSITION_KEY);
                if (folderInputLabel) folderInputLabel.textContent = lastSelectedFolderName ? `Последняя папка: ${lastSelectedFolderName}` : 'Папка не выбрана';
                updateStatus('Modal opened.');
                checkForUpdates(true); // Force check when modal is opened by user for this debug session
            } else { console.error("[Shotgun Prompter] Modal is null or not in DOM."); updateStatus("Error: Could not display modal.", true); }
        });
        if (document.body) document.body.appendChild(btn);
        else console.error("[Shotgun Prompter] document.body not available to append main button.");
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
            .shotgun-textarea, .shotgun-input, .shotgun-select { width: calc(100% - 16px); padding: 7px; margin-bottom: 8px; border: 1px solid #dadce0; border-radius: 4px; font-family: 'Roboto Mono', monospace; font-size: 0.8em; background-color: #fff; flex-shrink: 0; }
            .shotgun-textarea { resize: vertical; overflow-y: auto; }
            .shotgun-select { font-family: 'Google Sans', Roboto, Arial, sans-serif; font-size: 0.85em; padding: 8px 7px; color: #000; background-color: #fff; }
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
            .shotgun-tree-icon { margin-right: 4px; display: inline-flex; align-items: center; width: auto; }
            .shotgun-tree-expander { cursor: pointer; margin-right: 2px; display: inline-block; width: 1em; text-align: center; }
            .shotgun-tree-entry input[type="checkbox"] { margin-right: 5px; vertical-align: middle; }
            .shotgun-tree-entry label { vertical-align: middle; cursor: pointer; white-space: nowrap; }
            .shotgun-tree-entry label.excluded { text-decoration: line-through; color: #999; }
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
            .shotgun-settings-submodal .shotgun-modal-content { pointer-events: auto; }
            .shotgun-settings-submodal .shotgun-modal-body { flex-direction: column; overflow-y: auto; }
            .shotgun-settings-ignore-tester { display: flex; align-items: center; margin-bottom: 10px; gap: 5px; }
            .shotgun-settings-ignore-tester input { flex-grow: 1; }
            .shotgun-settings-grid { display: grid; grid-template-columns: auto 1fr; gap: 8px 10px; align-items: center; margin-bottom: 15px; }
            .shotgun-settings-grid label:not(.shotgun-button) { justify-self: end; }
            .shotgun-settings-grid .shotgun-button { justify-self: start; }
            .shotgun-settings-import-export { display: flex; gap: 10px; margin-bottom: 15px; } /* Flex for import/export buttons */
            .shotgun-settings-template-section { display: flex; gap: 15px; margin-bottom: 15px; min-height: 200px; }
            .shotgun-settings-template-list { flex: 1; border: 1px solid #dadce0; border-radius: 4px; padding: 5px; overflow-y: auto; max-height: 250px; }
            .shotgun-settings-list-item { padding: 5px 8px; cursor: pointer; border-radius: 3px; margin-bottom: 3px; font-size: 0.9em; }
            .shotgun-settings-list-item:hover { background-color: #f1f3f4; }
            .shotgun-settings-list-item.selected { background-color: #e8f0fe; color: #174ea6; font-weight: 500; }
            .shotgun-settings-template-edit { flex: 2; display: flex; flex-direction: column; }
            .shotgun-settings-template-edit label { font-size: 0.85em; color: #5f6368; margin-bottom: 3px; }
            .shotgun-settings-template-edit .shotgun-input, .shotgun-settings-template-edit .shotgun-textarea { margin-bottom: 10px; }
            .shotgun-settings-template-buttons { margin-top: auto; display: flex; flex-wrap: wrap; gap: 5px; }
        `);
    }

    function init() {
        if (scriptInitialized) return;
        scriptInitialized = true;
        logHelper("init() called.");
        try {
            if (!Array.isArray(promptTemplates) || promptTemplates.length === 0 || !promptTemplates.find(t => t.isCore)) {
                promptTemplates = JSON.parse(JSON.stringify(DEFAULT_PROMPT_TEMPLATES)); GM_setValue(CUSTOM_PROMPT_TEMPLATES_KEY, promptTemplates);
                selectedPromptTemplateId = promptTemplates[0].id; GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, selectedPromptTemplateId);
            }
            if (!promptTemplates.find(t => t.id === selectedPromptTemplateId) && promptTemplates.length > 0) {
                selectedPromptTemplateId = promptTemplates[0].id; GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, selectedPromptTemplateId);
            } else if (promptTemplates.length === 0) { selectedPromptTemplateId = null; GM_setValue(SELECTED_PROMPT_TEMPLATE_ID_KEY, null); }
            injectStyles();
            injectMainButton();
            logHelper("Script initialized. Click 'Shotgun Prompter' button.");
        } catch (e) { console.error("[Shotgun Prompter] Error during init:", e); alert("[Shotgun Prompter] Critical error during initialization. Check console."); }
    }

    function runInitialization() {
        if (scriptInitialized) return;
        if (document.body && typeof GM_addStyle === 'function' && typeof GM_xmlhttpRequest === 'function' && typeof GM_info === 'object') {
             init();
        } else {
            const onPageLoad = () => {
                if (scriptInitialized) return;
                if (typeof GM_addStyle === 'function' && typeof GM_xmlhttpRequest === 'function' && typeof GM_info === 'object') init();
                else console.error("[Shotgun Prompter] GM functions not available on load. Script cannot run.");
            };
            if (document.readyState === 'complete') onPageLoad();
            else window.addEventListener('load', onPageLoad, { once: true });
        }
    }
    runInitialization();

})();
