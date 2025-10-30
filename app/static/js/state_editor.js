class StateEditorGUI {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.mapImage = null;
        this.provinces = {};
        this.colorMap = {};
        this.states = {};
        this.selectedState = null;
        this.mode = 'view'; // view, edit_borders, paint_owner
        this.currentOwnerTag = null;
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
    }

    async init() {
        // Check if required files exist
        const checkResponse = await fetch('/api/state_editor/check_files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const checkResult = await checkResponse.json();
        
        if (!checkResult.files_exist) {
            // Prompt user for HOI4 directory
            await this.promptForGameDirectory(checkResult.missing_files);
        }
        
        // Initialize state editor
        await this.initializeEditor();
    }

    async promptForGameDirectory(missingFiles) {
        const modal = $(`
            <div class="modal fade" id="hoi4-dir-modal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title"><i class="bi bi-exclamation-triangle me-2"></i>Missing Required Files</h5>
                        </div>
                        <div class="modal-body">
                            <p>The following files are required for the state editor:</p>
                            <ul>
                                ${missingFiles.map(f => `<li><code>${f}</code></li>`).join('')}
                            </ul>
                            <p>Please provide your Hearts of Iron IV installation directory to copy these files.</p>
                            <div class="alert alert-warning">
                                <i class="bi bi-info-circle me-1"></i>
                                These files are temporary and only needed for the state editor to work.
                            </div>
                            <div class="mb-3">
                                <label class="form-label">HOI4 Directory Path</label>
                                <input type="text" class="form-control bg-dark text-light border-secondary" 
                                       id="hoi4-dir-input" placeholder="C:/Program Files (x86)/Steam/steamapps/common/Hearts of Iron IV">
                                <div class="form-text text-muted">Directory must contain hoi4.exe</div>
                            </div>
                            <div id="validation-message"></div>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-primary" id="validate-hoi4-dir">
                                <i class="bi bi-check-circle me-1"></i>Validate & Copy Files
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        $('body').append(modal);
        const modalInstance = new bootstrap.Modal(document.getElementById('hoi4-dir-modal'));
        modalInstance.show();
        
        $('#validate-hoi4-dir').on('click', async () => {
            const path = $('#hoi4-dir-input').val().trim();
            if (!path) {
                $('#validation-message').html('<div class="alert alert-danger">Please enter a path</div>');
                return;
            }
            
            // Validate directory
            const validateResponse = await fetch('/api/state_editor/validate_hoi4_dir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path })
            });
            
            const validateResult = await validateResponse.json();
            
            if (!validateResult.valid) {
                $('#validation-message').html('<div class="alert alert-danger">Invalid HOI4 directory. Make sure hoi4.exe exists.</div>');
                return;
            }
            
            // Copy files
            $('#validation-message').html('<div class="alert alert-info">Copying files...</div>');
            
            const copyResponse = await fetch('/api/state_editor/copy_game_files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path })
            });
            
            const copyResult = await copyResponse.json();
            
            if (copyResult.success) {
                $('#validation-message').html('<div class="alert alert-success">Files copied successfully!</div>');
                setTimeout(() => {
                    modalInstance.hide();
                    $('#hoi4-dir-modal').remove();
                }, 1500);
            } else {
                $('#validation-message').html(`<div class="alert alert-danger">Error: ${copyResult.message}</div>`);
            }
        });
    }

    async initializeEditor() {
        // Initialize backend
        const initResponse = await fetch('/api/state_editor/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const initResult = await initResponse.json();
        
        if (!initResult.success) {
            alert('Failed to initialize state editor: ' + initResult.error);
            return;
        }
        
        console.log(`Loaded ${initResult.province_count} provinces and ${initResult.state_count} states`);
        
        // Load map image
        await this.loadMapImage();
        
        // Load province data
        await this.loadProvinceData();
        
        // Create UI
        this.createUI();
    }

    async loadMapImage() {
        const response = await fetch('/api/state_editor/get_map_image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error('Failed to load map image');
        }
        
        return new Promise((resolve) => {
            this.mapImage = new Image();
            this.mapImage.onload = () => resolve();
            this.mapImage.src = result.image;
        });
    }

    async loadProvinceData() {
        const response = await fetch('/api/state_editor/get_province_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            this.provinces = result.provinces;
            // Convert color_map keys from string to actual RGB
            const colorMapStr = result.color_map;
            this.colorMap = {};
            for (const [key, value] of Object.entries(colorMapStr)) {
                // key is like "[r, g, b]"
                const rgb = JSON.parse(key.replace(/\(/g, '[').replace(/\)/g, ']'));
                this.colorMap[`${rgb[0]},${rgb[1]},${rgb[2]}`] = value;
            }
        }
    }

    createUI() {
        const editorHTML = `
            <div class="modal fade" id="state-editor-modal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-fullscreen">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title"><i class="bi bi-map me-2"></i>State Editor</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-0">
                            <div class="d-flex h-100">
                                <!-- Toolbar -->
                                <div class="bg-dark border-end border-secondary p-3" style="width: 250px; overflow-y: auto;">
                                    <h6>Tools</h6>
                                    <div class="btn-group-vertical w-100 mb-3">
                                        <button class="btn btn-outline-light btn-sm mode-btn active" data-mode="view">
                                            <i class="bi bi-eye me-1"></i>View Mode
                                        </button>
                                        <button class="btn btn-outline-warning btn-sm mode-btn" data-mode="edit_borders">
                                            <i class="bi bi-pencil me-1"></i>Edit Borders
                                        </button>
                                        <button class="btn btn-outline-info btn-sm mode-btn" data-mode="paint_owner">
                                            <i class="bi bi-brush me-1"></i>Paint Owner
                                        </button>
                                    </div>
                                    
                                    <div id="owner-selector" style="display: none;">
                                        <h6>Select Owner</h6>
                                        <select class="form-select form-select-sm bg-dark text-light border-secondary mb-2" id="owner-tag-select">
                                            <option value="">Loading tags...</option>
                                        </select>
                                        <small class="text-muted">No tag? <a href="#" id="create-country-link">Create one</a></small>
                                    </div>
                                    
                                    <div id="state-info-panel">
                                        <h6>State Info</h6>
                                        <div id="state-info-content" class="text-muted small">
                                            Click a province to see info
                                        </div>
                                    </div>
                                    
                                    <hr class="border-secondary">
                                    
                                    <button class="btn btn-success btn-sm w-100" id="save-all-states">
                                        <i class="bi bi-save me-1"></i>Save All States
                                    </button>
                                </div>
                                
                                <!-- Canvas Area -->
                                <div class="flex-grow-1 position-relative bg-secondary">
                                    <canvas id="state-editor-canvas"></canvas>
                                    <div class="position-absolute bottom-0 start-0 p-2 bg-dark bg-opacity-75 text-light small">
                                        <div id="mouse-info">Hover over map</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(editorHTML);
        
        this.modal = new bootstrap.Modal(document.getElementById('state-editor-modal'));
        this.modal.show();
        
        // Setup canvas
        this.canvas = document.getElementById('state-editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = this.mapImage.width;
        this.canvas.height = this.mapImage.height;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initial render
        this.render();
        
        // Load available tags
        this.loadAvailableTags();
    }

    setupEventListeners() {
        // Mode buttons
        $('.mode-btn').on('click', (e) => {
            const mode = $(e.currentTarget).data('mode');
            this.setMode(mode);
            $('.mode-btn').removeClass('active');
            $(e.currentTarget).addClass('active');
        });
        
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // Save button
        $('#save-all-states').on('click', () => this.saveAllStates());
        
        // Create country link
        $('#create-country-link').on('click', (e) => {
            e.preventDefault();
            this.modal.hide();
            if (window.editor && window.editor.openCountryCreator) {
                window.editor.openCountryCreator();
            }
        });
    }

    setMode(mode) {
        this.mode = mode;
        
        if (mode === 'paint_owner') {
            $('#owner-selector').show();
        } else {
            $('#owner-selector').hide();
        }
    }

    async loadAvailableTags() {
        const response = await fetch('/api/state_editor/get_available_tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success && result.tags.length > 0) {
            const select = $('#owner-tag-select');
            select.empty();
            select.append('<option value="">Select a tag...</option>');
            result.tags.forEach(tag => {
                select.append(`<option value="${tag}">${tag}</option>`);
            });
            
            select.on('change', (e) => {
                this.currentOwnerTag = $(e.target).val();
            });
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.lastMouseX = e.clientX - rect.left;
        this.lastMouseY = e.clientY - rect.top;
        
        if (e.button === 1 || e.button === 2 || (e.button === 0 && e.ctrlKey)) {
            // Middle mouse or right mouse or ctrl+left = pan
            this.isDragging = true;
            e.preventDefault();
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (this.isDragging) {
            const dx = mouseX - this.lastMouseX;
            const dy = mouseY - this.lastMouseY;
            this.panX += dx;
            this.panY += dy;
            this.render();
        }
        
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        
        // Update mouse info
        this.updateMouseInfo(mouseX, mouseY);
    }

    handleMouseUp(e) {
        this.isDragging = false;
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom *= delta;
        this.zoom = Math.max(0.1, Math.min(10, this.zoom));
        this.render();
    }

    async handleClick(e) {
        if (this.mode === 'view') return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = Math.floor((e.clientX - rect.left - this.panX) / this.zoom);
        const mouseY = Math.floor((e.clientY - rect.top - this.panY) / this.zoom);
        
        // Get province at pixel
        const response = await fetch('/api/state_editor/get_province_at_pixel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: mouseX, y: mouseY })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            console.log('No province at this location');
            return;
        }
        
        const provinceId = result.province_id;
        const stateId = result.state_id;
        
        if (this.mode === 'edit_borders') {
            await this.handleBorderEdit(provinceId, stateId);
        } else if (this.mode === 'paint_owner') {
            await this.handlePaintOwner(provinceId, stateId);
        }
    }

    async handleBorderEdit(provinceId, stateId) {
        if (!stateId) {
            // Create new state
            const response = await fetch('/api/state_editor/create_state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ province_id: provinceId, owner_tag: 'XXX' })
            });
            
            const result = await response.json();
            if (result.success) {
                alert(`Created new state ${result.state_id}`);
                await this.initializeEditor();
                this.render();
            }
        } else {
            // Add to selected state
            if (this.selectedState) {
                const response = await fetch('/api/state_editor/add_province_to_state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state_id: this.selectedState, province_id: provinceId })
                });
                
                const result = await response.json();
                if (result.success) {
                    await this.initializeEditor();
                    this.render();
                }
            } else {
                this.selectedState = stateId;
                alert(`Selected state ${stateId}. Click other provinces to add them to this state.`);
            }
        }
    }

    async handlePaintOwner(provinceId, stateId) {
        if (!this.currentOwnerTag) {
            alert('Please select an owner tag first');
            return;
        }
        
        if (!stateId) {
            alert('Province is not part of any state. Use Edit Borders mode first.');
            return;
        }
        
        const response = await fetch('/api/state_editor/set_state_owner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state_id: stateId, owner_tag: this.currentOwnerTag })
        });
        
        const result = await response.json();
        if (result.success) {
            await this.initializeEditor();
            this.render();
        }
    }

    updateMouseInfo(mouseX, mouseY) {
        const worldX = Math.floor((mouseX - this.panX) / this.zoom);
        const worldY = Math.floor((mouseY - this.panY) / this.zoom);
        
        $('#mouse-info').text(`X: ${worldX}, Y: ${worldY} | Zoom: ${(this.zoom * 100).toFixed(0)}%`);
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);
        
        // Draw map image
        if (this.mapImage) {
            this.ctx.drawImage(this.mapImage, 0, 0);
        }
        
        this.ctx.restore();
    }

    async saveAllStates() {
        const response = await fetch('/api/state_editor/save_all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
        } else {
            alert('Error: ' + result.message);
        }
    }
}

// Add button to open state editor
function initStateEditor() {
    const stateEditorButton = $(`
        <button class="btn btn-danger w-100 mb-2" id="open-state-editor-btn">
            <i class="bi bi-map me-2"></i>State Editor
        </button>
    `);
    
    $('#create-focus-tree-btn').after(stateEditorButton);
    
    $('#open-state-editor-btn').on('click', async () => {
        if (!window.editor?.currentProject) {
            alert('Please open a project first!');
            return;
        }
        
        const stateEditor = new StateEditorGUI();
        await stateEditor.init();
    });
}

// Initialize when document is ready
$(document).ready(() => {
    initStateEditor();
});