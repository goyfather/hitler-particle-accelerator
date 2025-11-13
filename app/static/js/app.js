class HOI4ModEditor {
    constructor() {
        this.currentProject = null;
        this.openTabs = new Map();
        this.unsavedChanges = new Set();
        
        console.log('HOI4ModEditor initializing...');
        
        this.initCountryEditor();
        this.initFocusTreeEditor();
	this.initIdeologyEditor();
        this.initEventListeners();
        
        console.log('HOI4ModEditor initialized');
    }

    initCountryEditor() {
        const countryButton = $(`
            <button class="btn btn-info w-100 mb-2" id="create-country-btn">
                <i class="bi bi-flag me-2"></i>Create Country
            </button>
        `);
        $('#open-project-btn').after(countryButton);

        const modalHTML = `
        <div class="modal fade" id="country-creator-modal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content bg-dark text-light">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title"><i class="bi bi-flag me-2"></i>Create New Country</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Country Tag</label>
                            <input type="text" class="form-control bg-dark text-light border-secondary" 
                                   id="country-tag" maxlength="3" placeholder="e.g., USA, GER, SOV">
                            <div class="form-text text-muted">3 uppercase letters</div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Country Name</label>
                            <input type="text" class="form-control bg-dark text-light border-secondary" 
                                   id="country-name" placeholder="e.g., United States, Germany, Soviet Union">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Color</label>
                            <div class="input-group">
                                <input type="color" class="form-control form-control-color bg-dark border-secondary" 
                                       id="country-color-picker" value="#3d85c6">
                                <span class="input-group-text bg-dark border-secondary">
                                    <div id="color-preview" style="width: 20px; height: 20px; background-color: #3d85c6;"></div>
                                </span>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Graphical Culture</label>
                            <select class="form-select bg-dark text-light border-secondary" id="graphical-culture">
                                <option value="western_european_gfx">Western European</option>
                                <option value="eastern_european_gfx">Eastern European</option>
                                <option value="middle_eastern_gfx">Middle Eastern</option>
                                <option value="asian_gfx">Asian</option>
                                <option value="south_american_gfx">South American</option>
                                <option value="african_gfx">African</option>
                                <option value="neutral_gfx">Neutral</option>
                                <option value="generic_gfx">Generic</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">2D Graphical Culture</label>
                            <select class="form-select bg-dark text-light border-secondary" id="graphical-culture-2d">
                                <option value="western_european_2d">Western European 2D</option>
                                <option value="eastern_european_2d">Eastern European 2D</option>
                                <option value="middle_eastern_2d">Middle Eastern 2D</option>
                                <option value="asian_2d">Asian 2D</option>
                                <option value="south_american_2d">South American 2D</option>
                                <option value="african_2d">African 2D</option>
                                <option value="neutral_2d">Neutral 2D</option>
                                <option value="generic_2d">Generic 2D</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirm-country-create">
                            <i class="bi bi-plus-circle me-1"></i>Create Country
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
        $('body').append(modalHTML);

        this.countryModal = new bootstrap.Modal(document.getElementById('country-creator-modal'));

        $('#create-country-btn').on('click', () => this.openCountryCreator());
        $('#confirm-country-create').on('click', () => this.createCountry());
        $('#country-color-picker').on('input', (e) => this.updateColorPreview(e.target.value));
    }

initIdeologyEditor() {
        // Add button to navbar
        const navbarButtons = $('<div class="navbar-buttons ms-3"></div>');
        $('.navbar-brand').after(navbarButtons);

        const ideologyButton = $(`
            <button class="btn btn-outline-light btn-sm me-2" id="create-ideologies-btn">
                <i class="bi bi-journal-plus me-1"></i>Create Ideologies
            </button>
        `);
        navbarButtons.append(ideologyButton);

        ideologyButton.on('click', () => this.createIdeologiesFile());
    }

    async createIdeologiesFile() {
        if (!this.currentProject) {
            alert('Please open a project first!');
            return;
        }

        try {
            const response = await fetch('/api/create_ideologies_file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
    
            const result = await response.json();
        
            if (result.success) {
                alert(`Success: ${result.message}`);
                // Refresh file tree to show new files
                if (this.currentProject) {
                    const response = await fetch('/api/open_project', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: this.currentProject })
                    });
                
                    const result = await response.json();
                    if (result.success) {
                        this.renderFileTree(result.structure);
                    }
                }
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            alert('Failed to create ideologies file: ' + error.message);
        }
    }

    initFocusTreeEditor() {
        const focusTreeButton = $(`
            <button class="btn btn-warning w-100 mb-2" id="create-focus-tree-btn">
                <i class="bi bi-diagram-3 me-2"></i>New Focus Tree
            </button>
        `);
        $('#create-country-btn').after(focusTreeButton);

        const modalHTML = `
        <div class="modal fade" id="focus-tree-creator-modal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content bg-dark text-light">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title"><i class="bi bi-diagram-3 me-2"></i>Create New Focus Tree</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Focus Tree Name</label>
                            <input type="text" class="form-control bg-dark text-light border-secondary" 
                                   id="focus-tree-name" placeholder="e.g., my_custom_focus_tree">
                            <div class="form-text text-muted">This will create a new focus tree file in common/national_focus/</div>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirm-focus-tree-create">
                            <i class="bi bi-plus-circle me-1"></i>Create Focus Tree
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
        $('body').append(modalHTML);

        this.focusTreeModal = new bootstrap.Modal(document.getElementById('focus-tree-creator-modal'));

        $('#create-focus-tree-btn').on('click', () => this.openFocusTreeCreator());
        $('#confirm-focus-tree-create').on('click', () => this.createFocusTree());
    }

    initEventListeners() {
        $('#open-project-btn').on('click', () => this.openProjectDialog());
    }

    updateColorPreview(color) {
        $('#color-preview').css('background-color', color);
    }

    openCountryCreator() {
        if (!this.currentProject) {
            alert('Please open a project first!');
            return;
        }
        
        $('#country-tag').val('');
        $('#country-name').val('');
        $('#country-color-picker').val('#3d85c6');
        $('#graphical-culture').val('western_european_gfx');
        $('#graphical-culture-2d').val('western_european_2d');
        this.updateColorPreview('#3d85c6');
        
        this.countryModal.show();
    }

    async createCountry() {
        const tag = $('#country-tag').val().toUpperCase().trim();
        const name = $('#country-name').val().trim();
        const color = $('#country-color-picker').val();
        const graphicalCulture = $('#graphical-culture').val();
        const graphicalCulture2d = $('#graphical-culture-2d').val();

        if (!tag || !name) {
            alert('Please fill in all fields');
            return;
        }

        if (!/^[A-Z]{3}$/.test(tag)) {
            alert('Country tag must be exactly 3 uppercase letters');
            return;
        }

        try {
            const response = await fetch('/api/create_country', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag: tag,
                    name: name,
                    color: color,
                    graphical_culture: graphicalCulture,
                    graphical_culture_2d: graphicalCulture2d
                })
            });

            const result = await response.json();
            
            if (result.success) {
                alert(`Success: ${result.message}`);
                this.countryModal.hide();
                
                if (this.currentProject) {
                    const response = await fetch('/api/open_project', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: this.currentProject })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        this.renderFileTree(result.structure);
                    }
                }
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            alert('Failed to create country: ' + error.message);
        }
    }

    openFocusTreeCreator() {
        if (!this.currentProject) {
            alert('Please open a project first!');
            return;
        }
        
        $('#focus-tree-name').val('');
        this.focusTreeModal.show();
    }

    async createFocusTree() {
        const name = $('#focus-tree-name').val().trim();

        if (!name) {
            alert('Please enter a focus tree name');
            return;
        }

        try {
            const response = await fetch('/api/create_focus_tree', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            });

            const result = await response.json();
            
            if (result.success) {
                alert(`Success: ${result.message}`);
                this.focusTreeModal.hide();
                
                if (this.currentProject) {
                    const response = await fetch('/api/open_project', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: this.currentProject })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        this.renderFileTree(result.structure);
                    }
                }
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            alert('Failed to create focus tree: ' + error.message);
        }
    }

    openProjectDialog() {
        const path = prompt('Enter the full path to your mod folder (must contain a .mod file):');
        if (path) {
            this.openProject(path);
        }
    }

    async openProject(projectPath) {
        const response = await fetch('/api/open_project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: projectPath })
        });

        const result = await response.json();
        if (result.success) {
            this.currentProject = projectPath;
            this.updateProjectInfo(projectPath);
            this.renderFileTree(result.structure);
        } else {
            alert('Error: ' + result.error);
        }
    }

    updateProjectInfo(projectPath) {
        const projectName = projectPath.split(/[\\/]/).pop();
        $('#project-info').html(`<i class="bi bi-folder-fill me-2"></i>${projectName}`);
    }

    renderFileTree(structure) {
        const treeContainer = $('#file-tree');
        treeContainer.empty();
        
        if (!structure || !structure.children) {
            treeContainer.html('<div class="text-muted">No files found</div>');
            return;
        }

        const renderItem = (item, depth = 0) => {
            const itemElement = $('<div>').addClass('mb-1');
            
            if (item.type === 'folder') {
                const folderElement = $('<div>')
                    .addClass('folder-item d-flex align-items-center')
                    .css('padding-left', `${depth * 15}px`)
                    .html(`<i class="bi bi-folder me-2"></i>${item.name}`)
                    .on('click', function(e) {
                        e.stopPropagation();
                        const $this = $(this);
                        const $icon = $this.find('i');
                        const $contents = $this.next('.folder-contents');
                        
                        $contents.toggle();
                        $icon.toggleClass('bi-folder-fill bi-folder');
                    });
                
                itemElement.append(folderElement);
                
                const contentsElement = $('<div>')
                    .addClass('folder-contents')
                    .css('display', depth === 0 ? 'block' : 'none');
                
                if (item.children && item.children.length > 0) {
                    item.children.forEach(child => {
                        contentsElement.append(renderItem(child, depth + 1));
                    });
                } else {
                    contentsElement.append('<div class="text-muted ps-3">Empty folder</div>');
                }
                
                itemElement.append(contentsElement);
                
                if (depth === 0) {
                    folderElement.find('i').addClass('bi-folder-fill');
                }
                
            } else {
                const fileElement = $('<div>')
                    .addClass('file-item d-flex align-items-center')
                    .css('padding-left', `${depth * 15}px`)
                    .html(`<i class="bi ${this.getFileIcon(item.name)} me-2"></i>${item.name}`)
                    .on('click', () => this.openFile(item.path, item.name));
                
                itemElement.append(fileElement);
            }
            
            return itemElement;
        };

        structure.children.forEach(child => {
            treeContainer.append(renderItem(child, 0));
        });
    }

    getFileIcon(filename) {
        if (filename.endsWith('.mod')) {
            return 'bi-gear-fill text-warning';
        }
        if (filename.endsWith('.dds') || filename.endsWith('.tga')) {
            return 'bi-image text-info';
        }
        if (filename.endsWith('.gfx') || filename.endsWith('.gui')) {
            return 'bi-palette text-success';
        }
        return 'bi-file-text';
    }

    async openFile(path, name) {
        console.log('Opening file:', path, name);
        
        const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
        console.log('Normalized path:', normalizedPath);
        
        const isFocusTreeFile = normalizedPath.includes('common/national_focus/') && 
                               normalizedPath.endsWith('.txt');
        
        console.log('Is focus tree file:', isFocusTreeFile);
        
        if (isFocusTreeFile) {
            console.log('Opening focus tree in visual editor');
            this.openFocusTreeEditor(path, name);
            return;
        }
        const isIdeologiesFile = normalizedPath.includes('common/ideologies/') && 
                               normalizedPath.endsWith('.txt');

        if (isIdeologiesFile) {
            console.log('Opening ideologies file in visual editor');
            this.openIdeologyEditor(path, name);
            return;
        }

        if (this.openTabs.has(path)) {
            $(`#tab-${this.hashPath(path)}`).tab('show');
            return;
        }

        const response = await fetch('/api/get_file_content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path })
        });

        const result = await response.json();
        if (result.success) {
            this.createEditorTab(path, name, result.content);
            this.openTabs.set(path, { 
                name: name, 
                content: result.content,
                originalContent: result.content
            });
        } else {
            alert('Error opening file: ' + result.error);
        }
    }

    openIdeologyEditor(path, name) {
        if (this.openTabs.has(path)) {
            $(`#tab-${this.hashPath(path)}`).tab('show');
            return;
        }

        const tabId = `tab-${this.hashPath(path)}`;
        const contentId = `content-${tabId}`;
    
        const tabHeader = $(`
            <li class="nav-item">
                <a class="nav-link text-light" id="${tabId}" data-bs-toggle="tab" href="#${contentId}">
                    <i class="bi bi-journal-text me-1"></i>${name}
                    <span class="unsaved-indicator text-warning ms-1" style="display: none;">•</span>
                    <button type="button" class="btn-close btn-close-white ms-2" style="font-size: 0.7rem;"></button>
                </a>
            </li>
        `);
    
        tabHeader.find('.btn-close').on('click', (e) => {
            e.stopPropagation();
            this.closeTab(path, tabId);
        });
    
        $('#editor-tabs').append(tabHeader);
    
        const tabContent = $(`<div class="tab-pane fade h-100" id="${contentId}"></div>`);
        $('#editor-content').append(tabContent);
    
        $('#welcome').removeClass('show active');
        $(`#${tabId}`).tab('show');
    
        try {
            const ideologyEditor = new IdeologyEditor(tabContent, path, name);
            
            this.openTabs.set(path, {
                name: name,
                type: 'ideology',
                editor: ideologyEditor
            });
        
        } catch (error) {
            console.error('Failed to initialize IdeologyEditor:', error);
            // Fallback to text editor
            this.openTabs.delete(path);
            $(`#${tabId}`).remove();
            $(`#${contentId}`).remove();
            this.openFile(path, name);
        }
    }

    openFocusTreeEditor(path, name) {
        console.log('openFocusTreeEditor called for:', path, name);
        console.log('FocusEditor available:', typeof FocusEditor);
        
        if (this.openTabs.has(path)) {
            $(`#tab-${this.hashPath(path)}`).tab('show');
            return;
        }

        const tabId = `tab-${this.hashPath(path)}`;
        const contentId = `content-${tabId}`;
        
        const tabHeader = $(`
            <li class="nav-item">
                <a class="nav-link text-light" id="${tabId}" data-bs-toggle="tab" href="#${contentId}">
                    <i class="bi bi-diagram-3 me-1"></i>${name}
                    <span class="unsaved-indicator text-warning ms-1" style="display: none;">•</span>
                    <button type="button" class="btn-close btn-close-white ms-2" style="font-size: 0.7rem;"></button>
                </a>
            </li>
        `);
        
        tabHeader.find('.btn-close').on('click', (e) => {
            e.stopPropagation();
            this.closeTab(path, tabId);
        });
        
        $('#editor-tabs').append(tabHeader);
        
        const tabContent = $(`<div class="tab-pane fade h-100" id="${contentId}"></div>`);
        $('#editor-content').append(tabContent);
        
        $('#welcome').removeClass('show active');
        $(`#${tabId}`).tab('show');
        
        try {
            if (typeof FocusEditor === 'undefined') {
                throw new Error('FocusEditor class is not defined. Check if focus_editor.js loaded correctly.');
            }
            
            console.log('Creating FocusEditor instance...');
            const focusEditor = new FocusEditor(tabContent, path, name);
            
            this.openTabs.set(path, {
                name: name,
                type: 'focus',
                editor: focusEditor
            });
            
            console.log('FocusTreeEditor initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize FocusTreeEditor:', error);
            
            tabContent.html(`
                <div class="alert alert-danger m-3">
                    <h5><i class="bi bi-exclamation-triangle me-2"></i>Visual Editor Failed to Load</h5>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <div class="mb-2">
                        <small class="text-muted">
                            Path: ${path}<br>
                            FocusEditor defined: ${typeof FocusEditor}<br>
                            Check browser console for details.
                        </small>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-warning btn-sm" id="load-as-text">
                            <i class="bi bi-file-text me-1"></i>Load as Text Editor
                        </button>
                        <button class="btn btn-info btn-sm" id="reload-page">
                            <i class="bi bi-arrow-clockwise me-1"></i>Reload Page
                        </button>
                    </div>
                </div>
            `);
            
            tabContent.find('#load-as-text').on('click', () => {
                this.openTabs.delete(path);
                $(`#${tabId}`).remove();
                $(`#${contentId}`).remove();
                this.openFile(path, name);
            });
            
            tabContent.find('#reload-page').on('click', () => {
                location.reload();
            });
            
            this.openTabs.set(path, {
                name: name,
                type: 'error',
                error: error.message
            });
        }
    }

    hashPath(path) {
        return path.replace(/[^a-zA-Z0-9]/g, '-');
    }

    createEditorTab(path, name, content) {
        const tabId = `tab-${this.hashPath(path)}`;
        const contentId = `content-${tabId}`;
        const editorId = `editor-${tabId}`;
        
        const tabHeader = $(`
            <li class="nav-item">
                <a class="nav-link text-light" id="${tabId}" data-bs-toggle="tab" href="#${contentId}">
                    ${name}
                    <span class="unsaved-indicator text-warning ms-1" style="display: none;">•</span>
                    <button type="button" class="btn-close btn-close-white ms-2" style="font-size: 0.7rem;"></button>
                </a>
            </li>
        `);
        
        tabHeader.find('.btn-close').on('click', (e) => {
            e.stopPropagation();
            this.closeTab(path, tabId);
        });
        
        $('#editor-tabs').append(tabHeader);
        
        const tabContent = $(`
            <div class="tab-pane fade h-100" id="${contentId}">
                <div class="d-flex flex-column h-100">
                    <div class="bg-dark border-bottom border-secondary p-2">
                        <button class="btn btn-success btn-sm save-tab-btn" data-file-path="${path}">
                            <i class="bi bi-save me-1"></i>Save
                        </button>
                        <span class="text-muted ms-2 save-status">All changes saved</span>
                    </div>
                    <textarea class="form-control flex-grow-1 bg-dark text-light border-0" 
                             style="font-family: 'Courier New', monospace; font-size: 14px; resize: none;"
                             id="${editorId}">${content}</textarea>
                </div>
            </div>
        `);
        
        $('#editor-content').append(tabContent);
        
        $('#welcome').removeClass('show active');
        $(`#${tabId}`).tab('show');
        
        this.setupEditorEvents(editorId, path, tabId);
    }

    setupEditorEvents(editorId, filePath, tabId) {
        const editor = $(`#${editorId}`);
        const saveBtn = $(`#content-${tabId} .save-tab-btn`);
        const saveStatus = $(`#content-${tabId} .save-status`);
        const unsavedIndicator = $(`#${tabId} .unsaved-indicator`);
        
        editor.on('input', () => {
            const currentContent = editor.val();
            const originalContent = this.openTabs.get(filePath)?.originalContent || '';
            
            if (currentContent !== originalContent) {
                this.unsavedChanges.add(filePath);
                unsavedIndicator.show();
                saveStatus.removeClass('text-muted').addClass('text-warning').text('Unsaved changes');
            } else {
                this.unsavedChanges.delete(filePath);
                unsavedIndicator.hide();
                saveStatus.removeClass('text-warning').addClass('text-muted').text('All changes saved');
            }
        });

        saveBtn.on('click', () => {
            this.saveFile(filePath, editor.val(), tabId);
        });
    }

    async saveFile(filePath, content, tabId = null) {
        const response = await fetch('/api/save_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, content: content })
        });

        const result = await response.json();
        if (result.success) {
            if (this.openTabs.has(filePath)) {
                this.openTabs.get(filePath).originalContent = content;
            }
            
            this.unsavedChanges.delete(filePath);
            if (tabId) {
                $(`#${tabId} .unsaved-indicator`).hide();
                $(`#content-${tabId} .save-status`)
                    .removeClass('text-warning')
                    .addClass('text-success')
                    .text('Saved successfully');
                
                setTimeout(() => {
                    $(`#content-${tabId} .save-status`)
                        .removeClass('text-success')
                        .addClass('text-muted')
                        .text('All changes saved');
                }, 2000);
            }
            
            return true;
        } else {
            alert('Error saving file: ' + result.error);
            return false;
        }
    }

    closeTab(path, tabId) {
        const tabData = this.openTabs.get(path);
        if (tabData && tabData.type === 'focus') {
            if (this.unsavedChanges.has(path)) {
                if (!confirm('You have unsaved changes in the focus tree editor. Are you sure you want to close this tab?')) {
                    return;
                }
            }
        } else {
            if (this.unsavedChanges.has(path)) {
                if (!confirm('You have unsaved changes. Are you sure you want to close this tab?')) {
                    return;
                }
            }
        }
        
        $(`#${tabId}`).remove();
        $(`#content-${tabId}`).remove();
        this.openTabs.delete(path);
        this.unsavedChanges.delete(path);
        
        if (this.openTabs.size === 0) {
            $('#welcome').addClass('show active');
        }
    }
}

$(document).ready(() => {
    console.log('Document ready, initializing HOI4ModEditor...');
    
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap not loaded');
        alert('Error: Bootstrap JavaScript not loaded. Check CDN connection.');
        return;
    }
    
    try {
        window.editor = new HOI4ModEditor();
        console.log('HOI4ModEditor initialized successfully');
        
        if (typeof FocusEditor !== 'undefined') {
            console.log('✓ FocusEditor class is available');
        } else {
            console.warn('✗ FocusEditor class not found - check script loading order');
        }
        
    } catch (error) {
        console.error('Failed to initialize HOI4ModEditor:', error);
        alert('Failed to initialize editor: ' + error.message);
    }
});
