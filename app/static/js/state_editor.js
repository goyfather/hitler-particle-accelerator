class StateEditorGUI {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.mapImage = null;
        this.provinces = {};
        this.colorMap = {};
        this.states = {};
        this.provinceToState = {};
        this.countryColors = {};
        this.selectedState = null;
        this.mode = 'view';
        this.currentOwnerTag = null;
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.modal = null;
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
        this.stylizedImage = null;
        this.provinceBordersImage = null;
        this.stateBordersImage = null;
        this.showStateBorders = true;
        this.showProvinceBorders = true;
        this.editingState = null;
        
        // PERFORMANCE: Cache rendered layers
        this.cachedLayers = {
            stylized: null,
            provinceBorders: null,
            stateBorders: null
        };
        this.layersDirty = {
            stylized: true,
            provinceBorders: false,
            stateBorders: true
        };
    }

    async init() {
        console.log('StateEditorGUI initializing...');
        
        const checkResponse = await fetch('/api/state_editor/check_files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const checkResult = await checkResponse.json();
        
        if (!checkResult.files_exist) {
            const success = await this.promptForGameDirectory(checkResult.missing_files);
            if (!success) return;
        }
        
        await this.initializeEditor();
    }

    async promptForGameDirectory(missingFiles) {
        return new Promise((resolve) => {
            const modal = $(`
                <div class="modal fade" id="hoi4-dir-modal" tabindex="-1" data-bs-backdrop="static">
                    <div class="modal-dialog">
                        <div class="modal-content bg-dark text-light">
                            <div class="modal-header border-secondary">
                                <h5 class="modal-title"><i class="bi bi-exclamation-triangle me-2"></i>Missing Required Files</h5>
                            </div>
                            <div class="modal-body">
                                <p>The following files are required:</p>
                                <ul>
                                    ${missingFiles.map(f => `<li><code>${f}</code></li>`).join('')}
                                </ul>
                                <div class="mb-3">
                                    <label class="form-label">HOI4 Directory Path</label>
                                    <input type="text" class="form-control bg-dark text-light border-secondary" 
                                           id="hoi4-dir-input" placeholder="C:/Program Files (x86)/Steam/steamapps/common/Hearts of Iron IV">
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
                
                const validateResponse = await fetch('/api/state_editor/validate_hoi4_dir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: path })
                });
                
                const validateResult = await validateResponse.json();
                
                if (!validateResult.valid) {
                    $('#validation-message').html('<div class="alert alert-danger">Invalid HOI4 directory.</div>');
                    return;
                }
                
                $('#validation-message').html('<div class="alert alert-info">Copying files...</div>');
                
                const copyResponse = await fetch('/api/state_editor/copy_game_files', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: path })
                });
                
                const copyResult = await copyResponse.json();
                
                if (copyResult.success) {
                    $('#validation-message').html('<div class="alert alert-success">Files copied!</div>');
                    setTimeout(() => {
                        modalInstance.hide();
                        $('#hoi4-dir-modal').remove();
                        resolve(true);
                    }, 1500);
                } else {
                    $('#validation-message').html(`<div class="alert alert-danger">Error: ${copyResult.message}</div>`);
                    resolve(false);
                }
            });
        });
    }

    async initializeEditor() {
        console.log('Initializing state editor backend...');
        
        const initResponse = await fetch('/api/state_editor/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const initResult = await initResponse.json();
        
        if (!initResult.success) {
            alert('Failed to initialize: ' + initResult.error);
            return false;
        }
        
        console.log(`Loaded ${initResult.province_count} provinces and ${initResult.state_count} states`);
        
        this.states = {};
        this.provinceToState = {};
        initResult.states.forEach(state => {
            this.states[state.id] = state;
            state.provinces.forEach(provinceId => {
                this.provinceToState[provinceId] = state.id;
            });
        });
        
        await this.loadCountryColors();
        await this.loadMapImage();
        await this.loadProvinceData();
        
        // Create all visual layers
        await this.createStylizedMap();
        await this.createProvinceBorders();
        await this.createStateBorders();
        
        this.createUI();
        return true;
    }

    async loadCountryColors() {
        const response = await fetch('/api/state_editor/get_country_colors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            this.countryColors = result.colors;
        }
    }

    async loadMapImage() {
        const response = await fetch('/api/state_editor/get_map_image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error('Failed to load map image: ' + result.error);
        }
        
        return new Promise((resolve, reject) => {
            this.mapImage = new Image();
            this.mapImage.onload = () => {
                this.offscreenCanvas = document.createElement('canvas');
                this.offscreenCanvas.width = this.mapImage.width;
                this.offscreenCanvas.height = this.mapImage.height;
                this.offscreenCtx = this.offscreenCanvas.getContext('2d');
                this.offscreenCtx.drawImage(this.mapImage, 0, 0);
                resolve();
            };
            this.mapImage.onerror = () => reject(new Error('Failed to load image'));
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
            this.colorMap = result.color_map;
        }
    }

    async createStylizedMap() {
        console.log('Creating stylized map with highlights...');
        
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = this.mapImage.width;
            canvas.height = this.mapImage.height;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(this.mapImage, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // NEW: Track which provinces belong to selected state
            const selectedProvinces = new Set();
            if (this.selectedState) {
                this.selectedState.provinces.forEach(p => selectedProvinces.add(p));
            }
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const colorKey = `${r},${g},${b}`;
                const provinceId = this.colorMap[colorKey];
                
                if (provinceId && this.provinces[provinceId]) {
                    const province = this.provinces[provinceId];
                    const stateId = this.provinceToState[provinceId];
                    
                    if (province.type === 'land') {
                        let baseColor;
                        
                        if (stateId && this.states[stateId] && this.states[stateId].owner) {
                            const owner = this.states[stateId].owner;
                            if (this.countryColors[owner]) {
                                const color = this.countryColors[owner];
                                baseColor = [
                                    Math.min(255, color[0] + 40),
                                    Math.min(255, color[1] + 40),
                                    Math.min(255, color[2] + 40)
                                ];
                            } else {
                                baseColor = [200, 200, 200];
                            }
                        } else {
                            // Unassigned - light gray
                            baseColor = [200, 200, 200];
                        }
                        
                        // Apply highlights
                        if (selectedProvinces.has(provinceId)) {
                            // Selected province - much darker
                            data[i] = Math.max(0, baseColor[0] - 60);
                            data[i + 1] = Math.max(0, baseColor[1] - 60);
                            data[i + 2] = Math.max(0, baseColor[2] - 60);
                        } else if (this.selectedState && stateId === this.selectedState.id) {
                            // Same state but different province - darker
                            data[i] = Math.max(0, baseColor[0] - 40);
                            data[i + 1] = Math.max(0, baseColor[1] - 40);
                            data[i + 2] = Math.max(0, baseColor[2] - 40);
                        } else {
                            // Normal
                            data[i] = baseColor[0];
                            data[i + 1] = baseColor[1];
                            data[i + 2] = baseColor[2];
                        }
                    } else if (province.type === 'sea') {
                        // FIX: Much darker ocean
                        data[i] = 30;
                        data[i + 1] = 50;
                        data[i + 2] = 80;
                    } else if (province.type === 'lake') {
                        // Lakes slightly lighter than ocean
                        data[i] = 50;
                        data[i + 1] = 70;
                        data[i + 2] = 100;
                    }
                } else {
                    // Unknown - very dark
                    data[i] = 20;
                    data[i + 1] = 20;
                    data[i + 2] = 20;
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            this.stylizedImage = new Image();
            this.stylizedImage.onload = () => {
                console.log('Stylized map created');
                this.cachedLayers.stylized = this.stylizedImage;
                this.layersDirty.stylized = false;
                resolve();
            };
            this.stylizedImage.src = canvas.toDataURL();
        });
    }

    async createProvinceBorders() {
        console.log('Creating province borders (thin)...');
        
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = this.mapImage.width;
            canvas.height = this.mapImage.height;
            const ctx = canvas.getContext('2d');
            
            const imageData = this.offscreenCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const borderData = ctx.createImageData(canvas.width, canvas.height);
            
            // FIX: Thinner borders - only draw on certain pixels
            for (let y = 1; y < canvas.height - 1; y++) {
                for (let x = 1; x < canvas.width - 1; x++) {
                    const idx = (y * canvas.width + x) * 4;
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                    const colorKey = `${r},${g},${b}`;
                    const provinceId = this.colorMap[colorKey];
                    
                    if (provinceId) {
                        // Only check right and down neighbors for thinner lines
                        const neighbors = [
                            {dx: 1, dy: 0},
                            {dx: 0, dy: 1}
                        ];
                        
                        for (const {dx, dy} of neighbors) {
                            const nx = x + dx, ny = y + dy;
                            const nIdx = (ny * canvas.width + nx) * 4;
                            const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
                            const nColorKey = `${nr},${ng},${nb}`;
                            const nProvinceId = this.colorMap[nColorKey];
                            
                            if (nProvinceId && nProvinceId !== provinceId) {
                                borderData.data[idx] = 140;
                                borderData.data[idx + 1] = 140;
                                borderData.data[idx + 2] = 140;
                                borderData.data[idx + 3] = 200; // Slightly transparent
                                break;
                            }
                        }
                    }
                }
            }
            
            ctx.putImageData(borderData, 0, 0);
            
            this.provinceBordersImage = new Image();
            this.provinceBordersImage.onload = () => {
                console.log('Province borders created');
                this.cachedLayers.provinceBorders = this.provinceBordersImage;
                this.layersDirty.provinceBorders = false;
                resolve();
            };
            this.provinceBordersImage.src = canvas.toDataURL();
        });
    }

    async createStateBorders() {
        console.log('Creating state borders...');
        
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = this.mapImage.width;
            canvas.height = this.mapImage.height;
            const ctx = canvas.getContext('2d');
            
            const imageData = this.offscreenCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const borderData = ctx.createImageData(canvas.width, canvas.height);
            
            for (let y = 1; y < canvas.height - 1; y++) {
                for (let x = 1; x < canvas.width - 1; x++) {
                    const idx = (y * canvas.width + x) * 4;
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                    const colorKey = `${r},${g},${b}`;
                    const provinceId = this.colorMap[colorKey];
                    
                    if (provinceId) {
                        const stateId = this.provinceToState[provinceId];
                        
                        const neighbors = [
                            {dx: -1, dy: 0}, {dx: 1, dy: 0},
                            {dx: 0, dy: -1}, {dx: 0, dy: 1}
                        ];
                        
                        for (const {dx, dy} of neighbors) {
                            const nx = x + dx, ny = y + dy;
                            const nIdx = (ny * canvas.width + nx) * 4;
                            const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
                            const nColorKey = `${nr},${ng},${nb}`;
                            const nProvinceId = this.colorMap[nColorKey];
                            
                            if (nProvinceId) {
                                const nStateId = this.provinceToState[nProvinceId];
                                
                                if (stateId !== nStateId) {
                                    borderData.data[idx] = 0;
                                    borderData.data[idx + 1] = 0;
                                    borderData.data[idx + 2] = 0;
                                    borderData.data[idx + 3] = 255;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            ctx.putImageData(borderData, 0, 0);
            
            this.stateBordersImage = new Image();
            this.stateBordersImage.onload = () => {
                console.log('State borders created');
                this.cachedLayers.stateBorders = this.stateBordersImage;
                this.layersDirty.stateBorders = false;
                resolve();
            };
            this.stateBordersImage.src = canvas.toDataURL();
        });
    }

    createUI() {
        console.log('Creating state editor UI...');
        
        $('#state-editor-modal').remove();
        
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
                                <div class="bg-dark border-end border-secondary p-3" style="width: 300px; overflow-y: auto;">
                                    <h6><i class="bi bi-tools me-2"></i>Tools</h6>
                                    <div class="btn-group-vertical w-100 mb-3">
                                        <button class="btn btn-outline-light btn-sm mode-btn active" data-mode="view">
                                            <i class="bi bi-eye me-1"></i>View Mode
                                        </button>
                                        <button class="btn btn-outline-warning btn-sm mode-btn" data-mode="edit_borders">
                                            <i class="bi bi-pencil me-1"></i>Edit State Borders
                                        </button>
                                        <button class="btn btn-outline-info btn-sm mode-btn" data-mode="paint_owner">
                                            <i class="bi bi-brush me-1"></i>Paint Owner
                                        </button>
                                    </div>
                                    
                                    <button class="btn btn-success w-100 mb-3" id="create-new-state-btn">
                                        <i class="bi bi-plus-circle me-1"></i>Create New State
                                    </button>
                                    
                                    <!-- Edit Borders Panel -->
                                    <div id="edit-borders-panel" style="display: none;">
                                        <div class="alert alert-info">
                                            <small>
                                                <strong>Edit State Borders Mode:</strong><br>
                                                Click a province to select/view its state.<br>
                                                Use buttons below to modify.
                                            </small>
                                        </div>
                                        <div id="selected-state-info"></div>
                                    </div>
                                    
                                    <div id="owner-selector" style="display: none;">
                                        <h6><i class="bi bi-flag me-1"></i>Select Owner</h6>
                                        <select class="form-select form-select-sm bg-dark text-light border-secondary mb-2" id="owner-tag-select">
                                            <option value="">Loading...</option>
                                        </select>
                                    </div>
                                    
                                    <div class="mt-3">
                                        <h6><i class="bi bi-palette me-1"></i>Display</h6>
                                        <div class="form-check form-switch">
                                            <input class="form-check-input" type="checkbox" id="show-province-borders" checked>
                                            <label class="form-check-label" for="show-province-borders">Province Borders</label>
                                        </div>
                                        <div class="form-check form-switch">
                                            <input class="form-check-input" type="checkbox" id="show-state-borders" checked>
                                            <label class="form-check-label" for="show-state-borders">State Borders</label>
                                        </div>
                                    </div>
                                    
                                    <hr class="border-secondary my-3">
                                    
                                    <button class="btn btn-success w-100" id="save-all-states">
                                        <i class="bi bi-save me-1"></i>Save All States
                                    </button>
                                    <button class="btn btn-secondary w-100 mt-2" id="close-state-editor">
                                        <i class="bi bi-x-circle me-1"></i>Close Editor
                                    </button>
                                </div>
                                
                                <!-- Canvas Area -->
                                <div class="flex-grow-1 position-relative bg-secondary">
                                    <canvas id="state-editor-canvas" 
                                            style="display: block; background: #1a1a1a; cursor: crosshair;"></canvas>
                                    <div class="position-absolute bottom-0 start-0 p-2 bg-dark bg-opacity-75 text-light small">
                                        <div id="mouse-info">Mouse coordinates</div>
                                        <div id="province-info"></div>
                                    </div>
                                    <div class="position-absolute top-0 end-0 p-2 bg-dark bg-opacity-75 text-light small">
                                        Mode: <span id="current-mode">View</span> | Zoom: <span id="zoom-level">100%</span>
                                    </div>
                                </div>
                                
                                <!-- Properties Panel -->
                                <div class="bg-dark border-start border-secondary p-3" style="width: 400px; overflow-y: auto;">
                                    <h6><i class="bi bi-info-circle me-2"></i>State Properties</h6>
                                    <div id="state-properties"></div>
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
        
        setTimeout(() => {
            this.setupCanvas();
            this.setupEventListeners();
            this.loadAvailableTags();
            this.render();
        }, 500);
    }

    setupCanvas() {
        this.canvas = document.getElementById('state-editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    setupEventListeners() {
        $('.mode-btn').on('click', (e) => {
            const mode = $(e.currentTarget).data('mode');
            this.setMode(mode);
            $('.mode-btn').removeClass('active');
            $(e.currentTarget).addClass('active');
        });
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        $('#save-all-states').on('click', () => this.saveAllStates());
        $('#close-state-editor').on('click', () => {
            this.modal.hide();
            $('#state-editor-modal').remove();
        });
        
        $('#create-new-state-btn').on('click', () => this.showCreateStateModal());
        
        $('#show-province-borders').on('change', (e) => {
            this.showProvinceBorders = e.target.checked;
            this.render();
        });
        
        $('#show-state-borders').on('change', (e) => {
            this.showStateBorders = e.target.checked;
            this.render();
        });
    }

    setMode(mode) {
        this.mode = mode;
        $('#current-mode').text(this.getModeDisplayName(mode));
        
        // Show/hide panels based on mode
        if (mode === 'edit_borders') {
            $('#edit-borders-panel').show();
            $('#owner-selector').hide();
        } else if (mode === 'paint_owner') {
            $('#edit-borders-panel').hide();
            $('#owner-selector').show();
        } else {
            $('#edit-borders-panel').hide();
            $('#owner-selector').hide();
        }
        
        if (mode === 'view') {
            this.canvas.style.cursor = 'grab';
        } else if (mode === 'edit_borders') {
            this.canvas.style.cursor = 'crosshair';
        } else if (mode === 'paint_owner') {
            this.canvas.style.cursor = 'cell';
        } else if (mode === 'remove_province') {
            this.canvas.style.cursor = 'not-allowed';
        }
        
        // Clear selection when changing modes (except remove_province)
        if (mode !== 'remove_province') {
            this.selectedState = null;
            this.updateSelectedStateInfo();
        }
    }

    getModeDisplayName(mode) {
        const names = {
            'view': 'View',
            'edit_borders': 'Edit State Borders',
            'paint_owner': 'Paint Owner',
            'remove_province': 'Remove Province'
        };
        return names[mode] || mode;
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
            select.append('<option value="">Select tag...</option>');
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
        
        if (e.button === 2 || e.button === 1) {
            this.isDragging = true;
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (this.isDragging && (e.buttons === 2 || e.buttons === 4)) {
            const dx = mouseX - this.lastMouseX;
            const dy = mouseY - this.lastMouseY;
            this.panX += dx;
            this.panY += dy;
            this.render();
        }
        
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        
        this.updateMouseInfo(mouseX, mouseY);
    }

    handleMouseUp(e) {
        this.isDragging = false;
        this.setMode(this.mode);
    }

    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate world position before zoom
        const worldXBefore = (mouseX - this.panX) / this.zoom;
        const worldYBefore = (mouseY - this.panY) / this.zoom;
        
        // Apply zoom
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, this.zoom * delta));
        
        // Calculate world position after zoom
        const worldXAfter = (mouseX - this.panX) / newZoom;
        const worldYAfter = (mouseY - this.panY) / newZoom;
        
        // Adjust pan to keep mouse position constant
        this.panX += (worldXAfter - worldXBefore) * newZoom;
        this.panY += (worldYAfter - worldYBefore) * newZoom;
        
        this.zoom = newZoom;
        
        $('#zoom-level').text(Math.round(this.zoom * 100) + '%');
        this.render();
    }

    async handleClick(e) {
        if (this.mode === 'view') return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = Math.floor((e.clientX - rect.left - this.panX) / this.zoom);
        const mouseY = Math.floor((e.clientY - rect.top - this.panY) / this.zoom);
        
        const provinceId = this.getProvinceAtPixel(mouseX, mouseY);
        
        if (!provinceId) {
            $('#province-info').html('<span class="text-warning">No province</span>');
            return;
        }
        
        // Check if it's a sea/lake province
        const province = this.provinces[provinceId];
        if (province && (province.type === 'sea' || province.type === 'lake')) {
            $('#province-info').html(`<span class="text-danger">Cannot assign ${province.type} provinces to states!</span>`);
            return;
        }
        
        const stateId = this.provinceToState[provinceId];
        
        this.updateProvinceInfo(provinceId, stateId);
        
        // FIX: Handle remove province mode
        if (this.mode === 'remove_province') {
            if (!this.selectedState) {
                alert('No state selected');
                return;
            }
            
            if (stateId !== this.selectedState.id) {
                alert(`Province ${provinceId} is not in the selected state ${this.selectedState.id}`);
                return;
            }
            
            if (!confirm(`Remove province ${provinceId} from state ${stateId}?`)) {
                return;
            }
            
            const response = await fetch('/api/state_editor/remove_province_from_state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state_id: stateId, province_id: provinceId })
            });
            
            const result = await response.json();
            if (result.success) {
                $('#remove-mode-alert').remove();
                this.setMode('edit_borders');
                this.layersDirty.stateBorders = true;
                await this.quickRefreshData();
                $('#province-info').html(`<span class="text-success">Province ${provinceId} removed from state ${stateId}</span>`);
            } else {
                alert('Error: ' + result.message);
            }
            return;
        }
        
        if (this.mode === 'edit_borders') {
            await this.handleBorderEditClick(provinceId, stateId);
        } else if (this.mode === 'paint_owner') {
            await this.handlePaintOwner(provinceId, stateId);
        }
    }

    // FIX ISSUE 2: Proper edit borders mode with IMPROVED WORKFLOW
    async handleBorderEditClick(provinceId, stateId) {
        // NEW WORKFLOW: If state is selected, add province to it
        if (this.selectedState) {
            // Adding province to selected state
            if (stateId === this.selectedState.id) {
                // Already in this state
                $('#province-info').html(`<span class="text-info">Province ${provinceId} is already in State ${stateId}</span>`);
                return;
            }
            
            const response = await fetch('/api/state_editor/add_province_to_state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state_id: this.selectedState.id, province_id: provinceId })
            });
            
            const result = await response.json();
            if (result.success) {
                this.layersDirty.stateBorders = true;
                await this.quickRefreshData();
                $('#province-info').html(`<span class="text-success">Province ${provinceId} added to State ${this.selectedState.id}</span>`);
            }
            return;
        }
        
        // No state selected - if province has no state, show dialog
        if (!stateId) {
            this.showProvinceAssignmentDialog(provinceId);
            return;
        }
        
        // Province has a state - select it
        this.selectedState = this.states[stateId];
        this.updateSelectedStateInfo();
        this.renderPropertiesPanel();
    }

    // FIX: Paint owner SHOULD mark stylized layer dirty
    async handlePaintOwner(provinceId, stateId) {
        if (!this.currentOwnerTag) {
            alert('Please select an owner tag first');
            return;
        }
        if (!stateId) {
            alert('Province not in a state. Use Edit State Borders mode first.');
            return;
        }
        
        const response = await fetch('/api/state_editor/set_state_owner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state_id: stateId, owner_tag: this.currentOwnerTag })
        });
        
        const result = await response.json();
        if (result.success) {
            // FIX: Mark stylized layer as dirty since owner changed
            this.layersDirty.stylized = true;
            await this.quickRefreshData();
        }
    }

    showProvinceAssignmentDialog(provinceId) {
        const modalHtml = `
            <div class="modal fade" id="province-assignment-modal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title">Assign Province ${provinceId}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Province ${provinceId} is not assigned to any state.</p>
                            <div class="mb-3">
                                <label class="form-label">Choose action:</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="assignAction" id="action-new-state" value="new" checked>
                                    <label class="form-check-label" for="action-new-state">
                                        Create a new state with this province
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="assignAction" id="action-add-existing" value="existing">
                                    <label class="form-check-label" for="action-add-existing">
                                        Add to an existing state
                                    </label>
                                </div>
                            </div>
                            <div id="existing-state-selector" style="display: none;">
                                <label class="form-label">Select State:</label>
                                <select class="form-select bg-dark text-light border-secondary" id="target-state-select">
                                    <option value="">Choose state...</option>
                                    ${Object.values(this.states).map(s => 
                                        `<option value="${s.id}">State ${s.id} - ${s.name || 'Unnamed'} (${s.owner || 'No owner'})</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div id="new-state-options" class="mt-3">
                                <label class="form-label">Owner Tag for New State:</label>
                                <select class="form-select bg-dark text-light border-secondary" id="new-state-owner-select">
                                    <option value="XXX">XXX (Default)</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirm-province-assignment">
                                <i class="bi bi-check-circle me-1"></i>Assign
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('#province-assignment-modal').remove();
        $('body').append(modalHtml);
        
        const modal = new bootstrap.Modal(document.getElementById('province-assignment-modal'));
        
        // Load available tags for new state option
        fetch('/api/state_editor/get_available_tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).then(res => res.json()).then(data => {
            if (data.success) {
                const select = $('#new-state-owner-select');
                data.tags.forEach(tag => {
                    select.append(`<option value="${tag}">${tag}</option>`);
                });
            }
        });
        
        // Toggle visibility of options based on radio selection
        $('input[name="assignAction"]').on('change', function() {
            if ($(this).val() === 'existing') {
                $('#existing-state-selector').show();
                $('#new-state-options').hide();
            } else {
                $('#existing-state-selector').hide();
                $('#new-state-options').show();
            }
        });
        
        $('#confirm-province-assignment').on('click', async () => {
            const action = $('input[name="assignAction"]:checked').val();
            
            if (action === 'new') {
                const ownerTag = $('#new-state-owner-select').val();
                const response = await fetch('/api/state_editor/create_state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ province_id: provinceId, owner_tag: ownerTag })
                });
                
                const result = await response.json();
                if (result.success) {
                    modal.hide();
                    $('#province-assignment-modal').remove();
                    this.layersDirty.stylized = true;
                    this.layersDirty.stateBorders = true;
                    await this.quickRefreshData();
                    this.selectedState = this.states[result.state_id];
                    this.updateSelectedStateInfo();
                    this.renderPropertiesPanel();
                }
            } else {
                const targetStateId = parseInt($('#target-state-select').val());
                if (!targetStateId) {
                    alert('Please select a state');
                    return;
                }
                
                const response = await fetch('/api/state_editor/add_province_to_state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state_id: targetStateId, province_id: provinceId })
                });
                
                const result = await response.json();
                if (result.success) {
                    modal.hide();
                    $('#province-assignment-modal').remove();
                    this.layersDirty.stateBorders = true;
                    await this.quickRefreshData();
                    this.selectedState = this.states[targetStateId];
                    this.updateSelectedStateInfo();
                    this.renderPropertiesPanel();
                }
            }
        });
        
        modal.show();
    }

    updateSelectedStateInfo() {
        const panel = $('#selected-state-info');
        
        if (!this.selectedState) {
            panel.html(`
                <div class="text-muted">
                    <small>No state selected. Click a province to select its state, or click unassigned provinces to add them to a new state.</small>
                </div>
            `);
            return;
        }
        
        const state = this.selectedState;
        panel.html(`
            <div class="alert alert-success">
                <strong>Selected State ${state.id}</strong><br>
                Name: ${state.name || 'Unnamed'}<br>
                Owner: ${state.owner || 'None'}<br>
                Provinces: ${state.provinces.length}
            </div>
            <div class="alert alert-info">
                <small><strong>Tip:</strong> Click unassigned provinces to add them to this state!</small>
            </div>
            <button class="btn btn-sm btn-warning w-100 mb-2" id="remove-province-mode-btn">
                <i class="bi bi-dash-circle me-1"></i>Remove Province Mode
            </button>
            <button class="btn btn-sm btn-secondary w-100 mb-2" id="deselect-state-btn">
                <i class="bi bi-x-circle me-1"></i>Deselect State
            </button>
            <button class="btn btn-sm btn-danger w-100" id="delete-current-state">
                <i class="bi bi-trash me-1"></i>Delete State
            </button>
        `);
        
        // FIX: Remove province mode that actually works
        $('#remove-province-mode-btn').on('click', () => {
            this.mode = 'remove_province';
            $('#remove-province-mode-btn').addClass('active btn-danger').removeClass('btn-warning');
            this.canvas.style.cursor = 'not-allowed';
            $('#current-mode').text('Remove Province from State ' + state.id);
            
            // Show notification
            $('body').append(`
                <div class="alert alert-warning alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3" 
                     style="z-index: 9999; max-width: 500px;" id="remove-mode-alert">
                    <strong>Remove Province Mode Active</strong><br>
                    Click any province in State ${state.id} to remove it from the state.<br>
                    <button type="button" class="btn btn-sm btn-secondary mt-2" id="cancel-remove-mode">Cancel</button>
                </div>
            `);
            
            $('#cancel-remove-mode').on('click', () => {
                this.setMode('edit_borders');
                $('#remove-mode-alert').remove();
            });
        });
        
        $('#deselect-state-btn').on('click', () => {
            this.selectedState = null;
            this.updateSelectedStateInfo();
            this.renderPropertiesPanel();
            this.layersDirty.stylized = true; // Remove highlight
            this.render();
        });
        
        $('#delete-current-state').on('click', async () => {
            if (!confirm(`Delete state ${state.id}? All provinces will become unassigned.`)) {
                return;
            }
            
            const response = await fetch('/api/state_editor/delete_state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state_id: state.id })
            });
            
            const result = await response.json();
            if (result.success) {
                this.selectedState = null;
                this.layersDirty.stylized = true;
                this.layersDirty.stateBorders = true;
                await this.quickRefreshData();
                this.updateSelectedStateInfo();
                this.renderPropertiesPanel();
            } else {
                alert('Error: ' + result.error);
            }
        });
    }

    getProvinceAtPixel(x, y) {
        if (!this.offscreenCtx || x < 0 || y < 0 || 
            x >= this.offscreenCanvas.width || y >= this.offscreenCanvas.height) {
            return null;
        }
        
        const pixelData = this.offscreenCtx.getImageData(x, y, 1, 1).data;
        const colorKey = `${pixelData[0]},${pixelData[1]},${pixelData[2]}`;
        
        return this.colorMap[colorKey];
    }

    updateProvinceInfo(provinceId, stateId) {
        let info = `Province: <strong>${provinceId}</strong>`;
        
        if (provinceId in this.provinces) {
            const province = this.provinces[provinceId];
            info += ` (${province.type})`;
        }
        
        if (stateId) {
            const state = this.states[stateId];
            info += ` | State: <strong>${stateId}</strong>`;
            if (state) {
                info += ` (${state.name})`;
                info += ` | Owner: <strong>${state.owner || 'None'}</strong>`;
            }
        } else {
            info += ` | <span class="text-warning">No state</span>`;
        }
        
        $('#province-info').html(info);
    }

    updateMouseInfo(mouseX, mouseY) {
        const worldX = Math.floor((mouseX - this.panX) / this.zoom);
        const worldY = Math.floor((mouseY - this.panY) / this.zoom);
        
        const provinceId = this.getProvinceAtPixel(worldX, worldY);
        let provinceText = '';
        if (provinceId) {
            provinceText = ` | Province: ${provinceId}`;
        }
        
        $('#mouse-info').text(`World: ${worldX}, ${worldY}${provinceText}`);
    }

    render() {
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);
        
        if (this.cachedLayers.stylized) {
            this.ctx.drawImage(this.cachedLayers.stylized, 0, 0);
        }
        
        if (this.showProvinceBorders && this.cachedLayers.provinceBorders) {
            this.ctx.drawImage(this.cachedLayers.provinceBorders, 0, 0);
        }
        
        if (this.showStateBorders && this.cachedLayers.stateBorders) {
            this.ctx.drawImage(this.cachedLayers.stateBorders, 0, 0);
        }
        
        this.ctx.restore();
    }

    async quickRefreshData() {
        console.log('Quick refresh - updating data only...');
        
        const initResponse = await fetch('/api/state_editor/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const initResult = await initResponse.json();
        
        this.states = {};
        this.provinceToState = {};
        initResult.states.forEach(state => {
            this.states[state.id] = state;
            state.provinces.forEach(provinceId => {
                this.provinceToState[provinceId] = state.id;
            });
        });
        
        // Only regenerate layers that are dirty
        if (this.layersDirty.stylized) {
            await this.createStylizedMap();
        }
        if (this.layersDirty.stateBorders) {
            await this.createStateBorders();
        }
        
        this.render();
        
        if (this.selectedState && this.states[this.selectedState.id]) {
            this.selectedState = this.states[this.selectedState.id];
            this.renderPropertiesPanel();
        }
    }

    renderPropertiesPanel() {
        const panel = $('#state-properties');
        panel.empty();
        
        if (!this.selectedState) {
            panel.html('<div class="text-muted text-center py-4">Click a province to view state</div>');
            return;
        }
        
        const state = this.selectedState;
        
        panel.html(`
            <div class="mb-3">
                <label class="form-label small">State ID</label>
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary"
                       value="${state.id}" disabled>
            </div>
            
            <div class="mb-3">
                <label class="form-label small">Name</label>
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary"
                       id="edit-state-name" value="${state.name || ''}">
            </div>
            
            <div class="mb-3">
                <label class="form-label small">Owner</label>
                <select class="form-select form-select-sm bg-dark text-light border-secondary" id="edit-state-owner">
                    <option value="">None</option>
                </select>
            </div>
            
            <div class="mb-3">
                <label class="form-label small">Manpower</label>
                <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary"
                       id="edit-state-manpower" value="${state.manpower || 1000}">
            </div>
            
            <div class="mb-3">
                <label class="form-label small">Category</label>
                <select class="form-select form-select-sm bg-dark text-light border-secondary" id="edit-state-category">
                    <option value="wasteland">Wasteland</option>
                    <option value="enclave">Enclave</option>
                    <option value="tiny_island">Tiny Island</option>
                    <option value="pastoral">Pastoral</option>
                    <option value="rural">Rural</option>
                    <option value="town">Town</option>
                    <option value="large_town">Large Town</option>
                    <option value="city">City</option>
                    <option value="large_city">Large City</option>
                    <option value="metropolis">Metropolis</option>
                    <option value="megalopolis">Megalopolis</option>
                </select>
            </div>
            
            <h6 class="mt-3">Resources</h6>
            <div class="row g-2 mb-3">
                ${['steel', 'aluminium', 'rubber', 'tungsten', 'chromium', 'oil'].map(res => `
                    <div class="col-6">
                        <label class="form-label small text-capitalize">${res}</label>
                        <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary resource-input"
                               data-resource="${res}" value="${state.resources?.[res] || 0}" step="0.1">
                    </div>
                `).join('')}
            </div>
            
            <h6 class="mt-3">Buildings</h6>
            ${['infrastructure', 'industrial_complex', 'arms_factory', 'air_base', 'naval_base', 'synthetic_refinery', 'fuel_silo'].map(bld => `
                <div class="mb-2">
                    <label class="form-label small text-capitalize">${bld.replace(/_/g, ' ')}</label>
                    <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary building-input"
                           data-building="${bld}" value="${state.buildings?.[bld] || 0}">
                </div>
            `).join('')}
            
            <h6 class="mt-3">Cores & Claims</h6>
            <div class="mb-3">
                <label class="form-label small">Cores</label>
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary"
                       id="edit-state-cores" value="${(state.cores || []).join(', ')}" placeholder="Comma-separated">
            </div>
            
            <div class="mb-3">
                <label class="form-label small">Claims</label>
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary"
                       id="edit-state-claims" value="${(state.claims || []).join(', ')}" placeholder="Comma-separated">
            </div>
            
            <div class="mb-3">
                <label class="form-label small">Provinces</label>
                <div class="text-muted small">${(state.provinces || []).join(', ')}</div>
            </div>
            
            <button class="btn btn-success btn-sm w-100 mt-3" id="save-state-btn">
                <i class="bi bi-save me-1"></i>Save State
            </button>
        `);
        
        // Populate owner dropdown
        const ownerSelect = $('#edit-state-owner');
        fetch('/api/state_editor/get_available_tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).then(res => res.json()).then(data => {
            if (data.success) {
                data.tags.forEach(tag => {
                    ownerSelect.append(`<option value="${tag}" ${state.owner === tag ? 'selected' : ''}>${tag}</option>`);
                });
            }
        });
        
        // Set category
        $('#edit-state-category').val(state.state_category || 'rural');
        
        // Save button handler
        $('#save-state-btn').on('click', () => this.saveStateProperties());
    }

    async saveStateProperties() {
        if (!this.selectedState) return;
        
        const properties = {
            name: $('#edit-state-name').val(),
            owner: $('#edit-state-owner').val(),
            manpower: parseInt($('#edit-state-manpower').val()),
            state_category: $('#edit-state-category').val(),
            resources: {},
            buildings: {},
            cores: $('#edit-state-cores').val().split(',').map(s => s.trim()).filter(s => s),
            claims: $('#edit-state-claims').val().split(',').map(s => s.trim()).filter(s => s)
        };
        
        // Collect resources
        $('.resource-input').each((i, el) => {
            const res = $(el).data('resource');
            const val = parseFloat($(el).val());
            if (val > 0) {
                properties.resources[res] = val;
            }
        });
        
        // Collect buildings (including arms_factory!)
        $('.building-input').each((i, el) => {
            const bld = $(el).data('building');
            const val = parseInt($(el).val());
            properties.buildings[bld] = val;
        });
        
        const response = await fetch('/api/state_editor/update_state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                state_id: this.selectedState.id,
                properties: properties
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const btn = $('#save-state-btn');
            const originalHtml = btn.html();
            btn.html('<i class="bi bi-check me-1"></i>Saved!').prop('disabled', true);
            
            // Mark stylized layer as dirty since owner might have changed
            this.layersDirty.stylized = true;
            await this.quickRefreshData();
            
            setTimeout(() => {
                btn.html(originalHtml).prop('disabled', false);
            }, 2000);
        } else {
            alert('Error: ' + result.message);
        }
    }

    showCreateStateModal() {
        const modalHtml = `
            <div class="modal fade" id="create-state-modal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title">Create New State</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <small>Creates an empty state. Add provinces using Edit State Borders mode.</small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">State Name</label>
                                <input type="text" class="form-control bg-dark text-light border-secondary"
                                       id="new-state-name" placeholder="Optional (e.g., STATE_123)">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Owner Tag</label>
                                <select class="form-select bg-dark text-light border-secondary" id="new-state-owner">
                                    <option value="XXX">XXX (Default)</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirm-create-state">
                                <i class="bi bi-plus-circle me-1"></i>Create
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('#create-state-modal').remove();
        $('body').append(modalHtml);
        
        const modal = new bootstrap.Modal(document.getElementById('create-state-modal'));
        
        // Populate owner dropdown
        fetch('/api/state_editor/get_available_tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).then(res => res.json()).then(data => {
            if (data.success) {
                const select = $('#new-state-owner');
                data.tags.forEach(tag => {
                    select.append(`<option value="${tag}">${tag}</option>`);
                });
            }
        });
        
        $('#confirm-create-state').on('click', async () => {
            const name = $('#new-state-name').val().trim();
            const owner = $('#new-state-owner').val();
            
            const response = await fetch('/api/state_editor/create_state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    province_id: null,
                    owner_tag: owner,
                    name: name || undefined
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                modal.hide();
                $('#create-state-modal').remove();
                this.layersDirty.stylized = true;
                await this.quickRefreshData();
                alert(`State ${result.state_id} created! Use Edit State Borders mode to add provinces.`);
            } else {
                alert('Error: ' + result.error);
            }
        });
        
        modal.show();
    }

    async saveAllStates() {
        const response = await fetch('/api/state_editor/save_all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✓ ' + result.message);
        } else {
            alert('✗ Error: ' + result.message);
        }
    }
}

// Initialize when document is ready
function initStateEditor() {
    console.log('Initializing state editor button...');
    
    const stateEditorButton = $(`
        <button class="btn btn-danger w-100 mb-2" id="open-state-editor-btn">
            <i class="bi bi-map me-2"></i>State Editor
        </button>
    `);
    
    const focusTreeBtn = $('#create-focus-tree-btn');
    if (focusTreeBtn.length) {
        focusTreeBtn.after(stateEditorButton);
    } else {
        $('#create-country-btn').after(stateEditorButton);
    }
    
    $('#open-state-editor-btn').on('click', async () => {
        console.log('Opening state editor...');
        
        if (!window.editor?.currentProject) {
            alert('Please open a project first!');
            return;
        }
        
        try {
            const stateEditor = new StateEditorGUI();
            await stateEditor.init();
        } catch (error) {
            console.error('Failed to open state editor:', error);
            alert('Failed to open state editor: ' + error.message);
        }
    });
}

$(document).ready(() => {
    console.log('Document ready, initializing state editor...');
    setTimeout(initStateEditor, 1000);
});
