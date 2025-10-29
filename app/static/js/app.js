class HOI4ModEditor {
    constructor() {
        this.currentProject = null;
        this.openTabs = new Map();
        this.unsavedChanges = new Set();
        
        // Initialize everything in correct order
        this.initCountryEditor();
        this.initFocusTreeEditor();
        this.initEventListeners();
    }

    initCountryEditor() {
        // Create country editor button
        const countryButton = $(`
            <button class="btn btn-info w-100 mb-2" id="create-country-btn">
                <i class="bi bi-flag me-2"></i>Create Country
            </button>
        `);
        $('#open-project-btn').after(countryButton);

        // Create modal for country creation
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

        // Store modal instance
        this.countryModal = new bootstrap.Modal(document.getElementById('country-creator-modal'));

        // Set up event handlers
        $('#create-country-btn').on('click', () => this.openCountryCreator());
        $('#confirm-country-create').on('click', () => this.createCountry());
        $('#country-color-picker').on('input', (e) => this.updateColorPreview(e.target.value));
    }

    initFocusTreeEditor() {
        // Create focus tree editor button
        const focusTreeButton = $(`
            <button class="btn btn-warning w-100 mb-2" id="create-focus-tree-btn">
                <i class="bi bi-diagram-3 me-2"></i>New Focus Tree
            </button>
        `);
        $('#create-country-btn').after(focusTreeButton);

        // Create modal for focus tree creation
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

        // Store modal instance
        this.focusTreeModal = new bootstrap.Modal(document.getElementById('focus-tree-creator-modal'));

        // Set up event handlers
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
        
        // Reset form
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
                
                // Refresh file tree
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
        
        // Reset form
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
                
                // Refresh file tree
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
                // Folder item
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
                
                // Folder contents
                const contentsElement = $('<div>')
                    .addClass('folder-contents')
                    .css('display', depth === 0 ? 'block' : 'none'); // Root expanded, others collapsed
                
                // Add children
                if (item.children && item.children.length > 0) {
                    item.children.forEach(child => {
                        contentsElement.append(renderItem(child, depth + 1));
                    });
                } else {
                    contentsElement.append('<div class="text-muted ps-3">Empty folder</div>');
                }
                
                itemElement.append(contentsElement);
                
                // Set initial icon state
                if (depth === 0) {
                    folderElement.find('i').addClass('bi-folder-fill');
                }
                
            } else {
                // File item
                const fileElement = $('<div>')
                    .addClass('file-item d-flex align-items-center')
                    .css('padding-left', `${depth * 15}px`)
                    .html(`<i class="bi ${this.getFileIcon(item.name)} me-2"></i>${item.name}`)
                    .on('click', () => this.openFile(item.path, item.name));
                
                itemElement.append(fileElement);
            }
            
            return itemElement;
        };

        // Start rendering from root's children
        structure.children.forEach(child => {
            treeContainer.append(renderItem(child, 0));
        });
    }

    getFileIcon(filename) {
        if (filename.endsWith('.mod')) {
            return 'bi-gear-fill text-warning';
        }
        return 'bi-file-text';
    }

    async openFile(path, name) {
        // Check if it's a focus tree file
        if (path.includes('common/national_focus/') && path.endsWith('.txt')) {
            this.openFocusTreeEditor(path, name);
            return;
        }

        // Otherwise, open as text file
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

    openFocusTreeEditor(path, name) {
        if (this.openTabs.has(path)) {
            $(`#tab-${this.hashPath(path)}`).tab('show');
            return;
        }

        const tabId = `tab-${this.hashPath(path)}`;
        const contentId = `content-${tabId}`;
        
        // Create tab header
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
        
        // Create tab content
        const tabContent = $(`<div class="tab-pane fade h-100" id="${contentId}"></div>`);
        $('#editor-content').append(tabContent);
        
        // Show the tab and hide welcome
        $('#welcome').removeClass('show active');
        $(`#${tabId}`).tab('show');
        
        // Initialize the focus tree editor
        this.openTabs.set(path, {
            name: name,
            type: 'focus',
            editor: new FocusEditor(tabContent, path, name)
        });
    }

    hashPath(path) {
        return path.replace(/[^a-zA-Z0-9]/g, '-');
    }

    createEditorTab(path, name, content) {
        const tabId = `tab-${this.hashPath(path)}`;
        const contentId = `content-${tabId}`;
        const editorId = `editor-${tabId}`;
        
        // Create tab header
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
        
        // Create tab content
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
        
        // Show the tab and hide welcome
        $('#welcome').removeClass('show active');
        $(`#${tabId}`).tab('show');
        
        // Set up save functionality
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

        // Save button click
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
        if (this.unsavedChanges.has(path)) {
            if (!confirm('You have unsaved changes. Are you sure you want to close this tab?')) {
                return;
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

// Initialize editor when page loads
$(document).ready(() => {
    window.editor = new HOI4ModEditor();
});