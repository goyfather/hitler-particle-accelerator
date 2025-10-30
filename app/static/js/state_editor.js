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
        this.stateBordersImage = null;
    }

    async init() {
        console.log('StateEditorGUI initializing...');
        
        // Check if required files exist
        const checkResponse = await fetch('/api/state_editor/check_files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const checkResult = await checkResponse.json();
        
        if (!checkResult.files_exist) {
            const success = await this.promptForGameDirectory(checkResult.missing_files);
            if (!success) return;
        }
        
        // Initialize state editor backend
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
                        resolve(true);
                    }, 1500);
                } else {
                    $('#validation-message').html(`<div class="alert alert-danger">Error: ${copyResult.message}</div>`);
                    resolve(false);
                }
            });

            // Handle modal close without copying
            $('#hoi4-dir-modal').on('hidden.bs.modal', () => {
                $('#hoi4-dir-modal').remove();
                resolve(false);
            });
        });
    }

    async initializeEditor() {
        console.log('Initializing state editor backend...');
        
        // Initialize backend
        const initResponse = await fetch('/api/state_editor/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const initResult = await initResponse.json();
        
        if (!initResult.success) {
            alert('Failed to initialize state editor: ' + initResult.error);
            return false;
        }
        
        console.log(`Loaded ${initResult.province_count} provinces and ${initResult.state_count} states`);
        
        // Store states data
        this.states = {};
        this.provinceToState = {};
        initResult.states.forEach(state => {
            this.states[state.id] = state;
            state.provinces.forEach(provinceId => {
                this.provinceToState[provinceId] = state.id;
            });
        });
        
        // Load country colors
        await this.loadCountryColors();
        
        // Load map image
        await this.loadMapImage();
        
        // Load province data
        await this.loadProvinceData();
        
        // Create stylized map (only once)
        await this.createStylizedMap();
        
        // Create state borders overlay
        await this.createStateBorders();
        
        // Create UI
        this.createUI();
        return true;
    }

    async loadCountryColors() {
        console.log('Loading country colors...');
        const response = await fetch('/api/state_editor/get_country_colors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            this.countryColors = result.colors;
            console.log('Loaded colors for', Object.keys(this.countryColors).length, 'countries');
        } else {
            console.error('Failed to load country colors:', result.error);
            this.countryColors = {};
        }
    }

    async loadMapImage() {
        console.log('Loading map image...');
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
                console.log('Map image loaded:', this.mapImage.width, 'x', this.mapImage.height);
                
                // Create offscreen canvas for province detection
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
        console.log('Loading province data...');
        const response = await fetch('/api/state_editor/get_province_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            this.provinces = result.provinces;
            this.colorMap = result.color_map;
            console.log('Loaded province data:', Object.keys(this.provinces).length, 'provinces');
        } else {
            console.error('Failed to load province data:', result.error);
        }
    }

    async createStylizedMap() {
        console.log('Creating stylized map...');
        
        return new Promise((resolve) => {
            const stylizedCanvas = document.createElement('canvas');
            stylizedCanvas.width = this.mapImage.width;
            stylizedCanvas.height = this.mapImage.height;
            const stylizedCtx = stylizedCanvas.getContext('2d');
            
            // Draw the original image first
            stylizedCtx.drawImage(this.mapImage, 0, 0);
            
            // Get image data for processing
            const imageData = stylizedCtx.getImageData(0, 0, stylizedCanvas.width, stylizedCanvas.height);
            const data = imageData.data;
            
            // Process in batches for better performance
            const batchSize = 100000;
            let processed = 0;
            
            const processBatch = () => {
                const end = Math.min(processed + batchSize, data.length);
                
                for (let i = processed; i < end; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const colorKey = `${r},${g},${b}`;
                    const provinceId = this.colorMap[colorKey];
                    
                    if (provinceId && this.provinces[provinceId]) {
                        const province = this.provinces[provinceId];
                        const stateId = this.provinceToState[provinceId];
                        
                        if (province.type === 'land') {
                            // Color land provinces based on owner
                            if (stateId && this.states[stateId] && this.states[stateId].owner) {
                                const owner = this.states[stateId].owner;
                                if (this.countryColors[owner]) {
                                    const color = this.countryColors[owner];
                                    // Use country color with some brightness
                                    data[i] = Math.min(255, color[0] + 40);
                                    data[i + 1] = Math.min(255, color[1] + 40);
                                    data[i + 2] = Math.min(255, color[2] + 40);
                                } else {
                                    // Default color for unowned land
                                    data[i] = 200;
                                    data[i + 1] = 200;
                                    data[i + 2] = 200;
                                }
                            } else {
                                // Unowned land
                                data[i] = 200;
                                data[i + 1] = 200;
                                data[i + 2] = 200;
                            }
                        } else if (province.type === 'sea') {
                            // Light blue for sea
                            data[i] = 100;
                            data[i + 1] = 150;
                            data[i + 2] = 200;
                        } else if (province.type === 'lake') {
                            // Different blue for lakes
                            data[i] = 120;
                            data[i + 1] = 170;
                            data[i + 2] = 220;
                        }
                    } else {
                        // Unknown province - dark gray
                        data[i] = 50;
                        data[i + 1] = 50;
                        data[i + 2] = 50;
                    }
                }
                
                processed = end;
                
                if (processed < data.length) {
                    setTimeout(processBatch, 0);
                } else {
                    // All batches processed
                    stylizedCtx.putImageData(imageData, 0, 0);
                    
                    this.stylizedImage = new Image();
                    this.stylizedImage.onload = () => {
                        console.log('Stylized map created successfully');
                        resolve();
                    };
                    this.stylizedImage.src = stylizedCanvas.toDataURL();
                }
            };
            
            processBatch();
        });
    }

    async createStateBorders() {
        console.log('Creating state borders overlay...');
        
        return new Promise((resolve) => {
            const bordersCanvas = document.createElement('canvas');
            bordersCanvas.width = this.mapImage.width;
            bordersCanvas.height = this.mapImage.height;
            const bordersCtx = bordersCanvas.getContext('2d');
            
            // Start with transparent background
            bordersCtx.clearRect(0, 0, bordersCanvas.width, bordersCanvas.height);
            
            const imageData = this.offscreenCtx.getImageData(0, 0, bordersCanvas.width, bordersCanvas.height);
            const data = imageData.data;
            
            const batchSize = 100000;
            let processed = 0;
            
            const processBatch = () => {
                const end = Math.min(processed + batchSize, data.length);
                
                for (let i = processed; i < end; i += 4) {
                    const x = (i / 4) % bordersCanvas.width;
                    const y = Math.floor((i / 4) / bordersCanvas.width);
                    
                    if (x === 0 || y === 0 || x === bordersCanvas.width - 1 || y === bordersCanvas.height - 1) {
                        continue;
                    }
                    
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const colorKey = `${r},${g},${b}`;
                    const provinceId = this.colorMap[colorKey];
                    
                    if (provinceId) {
                        const currentState = this.provinceToState[provinceId];
                        
                        // Check 4-directional neighbors for state borders
                        const neighbors = [
                            {dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: 0, dy: 1}
                        ];
                        
                        for (const neighbor of neighbors) {
                            const nx = x + neighbor.dx;
                            const ny = y + neighbor.dy;
                            const nIndex = (ny * bordersCanvas.width + nx) * 4;
                            
                            if (nIndex >= 0 && nIndex < data.length) {
                                const nr = data[nIndex];
                                const ng = data[nIndex + 1];
                                const nb = data[nIndex + 2];
                                const nColorKey = `${nr},${ng},${nb}`;
                                const nProvinceId = this.colorMap[nColorKey];
                                
                                if (nProvinceId) {
                                    const neighborState = this.provinceToState[nProvinceId];
                                    
                                    // Draw state borders (black) between different states
                                    if (currentState !== neighborState) {
                                        bordersCtx.fillStyle = '#000000';
                                        bordersCtx.fillRect(x, y, 1, 1);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                
                processed = end;
                
                if (processed < data.length) {
                    setTimeout(processBatch, 0);
                } else {
                    this.stateBordersImage = new Image();
                    this.stateBordersImage.onload = () => {
                        console.log('State borders overlay created successfully');
                        resolve();
                    };
                    this.stateBordersImage.src = bordersCanvas.toDataURL();
                }
            };
            
            processBatch();
        });
    }

    createUI() {
        console.log('Creating state editor UI...');
        
        // Remove existing modal if any
        $('#state-editor-modal').remove();
        
        const editorHTML = `
            <div class="modal fade" id="state-editor-modal" tabindex="-1" data-bs-backdrop="static" style="display: none;">
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
                                            <i class="bi bi-pencil me-1"></i>Edit Borders
                                        </button>
                                        <button class="btn btn-outline-info btn-sm mode-btn" data-mode="paint_owner">
                                            <i class="bi bi-brush me-1"></i>Paint Owner
                                        </button>
                                    </div>
                                    
                                    <div id="owner-selector" style="display: none;">
                                        <h6><i class="bi bi-flag me-1"></i>Select Owner</h6>
                                        <select class="form-select form-select-sm bg-dark text-light border-secondary mb-2" id="owner-tag-select">
                                            <option value="">Loading tags...</option>
                                        </select>
                                        <small class="text-muted">No tag? <a href="#" id="create-country-link">Create one</a></small>
                                    </div>
                                    
                                    <div id="state-info-panel" class="mt-3">
                                        <h6><i class="bi bi-info-circle me-1"></i>State Info</h6>
                                        <div id="state-info-content" class="text-muted small border rounded p-2 bg-dark">
                                            Click a province to see state information
                                        </div>
                                    </div>
                                    
                                    <div class="mt-3">
                                        <h6><i class="bi bi-gear me-1"></i>Controls</h6>
                                        <div class="small text-muted">
                                            <div><kbd>Mouse Wheel</kbd> - Zoom</div>
                                            <div><kbd>Right Click + Drag</kbd> - Pan</div>
                                            <div><kbd>Click</kbd> - Select province</div>
                                        </div>
                                    </div>
                                    
                                    <div class="mt-3">
                                        <h6><i class="bi bi-palette me-1"></i>Map Display</h6>
                                        <div class="small">
                                            <div class="form-check form-switch">
                                                <input class="form-check-input" type="checkbox" id="show-state-borders" checked>
                                                <label class="form-check-label" for="show-state-borders">Show State Borders</label>
                                            </div>
                                            <div class="form-check form-switch">
                                                <input class="form-check-input" type="checkbox" id="show-country-colors" checked>
                                                <label class="form-check-label" for="show-country-colors">Show Country Colors</label>
                                            </div>
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
                                        <div id="mouse-info">Move mouse over map to see coordinates</div>
                                        <div id="province-info"></div>
                                    </div>
                                    <div class="position-absolute top-0 end-0 p-2 bg-dark bg-opacity-75 text-light small">
                                        Mode: <span id="current-mode">View</span> | Zoom: <span id="zoom-level">100%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(editorHTML);
        
        // Initialize modal
        this.modal = new bootstrap.Modal(document.getElementById('state-editor-modal'));
        
        // Show modal first, then setup canvas (so dimensions are available)
        this.modal.show();
        
        // Wait for modal to be fully shown
        setTimeout(() => {
            this.setupCanvas();
            this.setupEventListeners();
            this.loadAvailableTags();
            this.render();
        }, 500);
    }

    setupCanvas() {
        console.log('Setting up canvas...');
        this.canvas = document.getElementById('state-editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        // Set canvas size to fill available space
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        console.log('Canvas size:', this.canvas.width, 'x', this.canvas.height);
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
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
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Save button
        $('#save-all-states').on('click', () => this.saveAllStates());
        
        // Close button
        $('#close-state-editor').on('click', () => {
            this.modal.hide();
            $('#state-editor-modal').remove();
        });
        
        // Create country link
        $('#create-country-link').on('click', (e) => {
            e.preventDefault();
            this.modal.hide();
            $('#state-editor-modal').remove();
            if (window.editor && window.editor.openCountryCreator) {
                window.editor.openCountryCreator();
            }
        });

        // Display toggles
        $('#show-state-borders').on('change', () => this.render());
        $('#show-country-colors').on('change', () => {
            this.createStylizedMap().then(() => this.render());
        });

        // Handle modal close
        $('#state-editor-modal').on('hidden.bs.modal', () => {
            $('#state-editor-modal').remove();
        });
    }

    setMode(mode) {
        this.mode = mode;
        $('#current-mode').text(this.getModeDisplayName(mode));
        
        if (mode === 'paint_owner') {
            $('#owner-selector').show();
        } else {
            $('#owner-selector').hide();
        }
        
        // Update cursor
        if (mode === 'view') {
            this.canvas.style.cursor = 'grab';
        } else if (mode === 'edit_borders') {
            this.canvas.style.cursor = 'crosshair';
        } else if (mode === 'paint_owner') {
            this.canvas.style.cursor = 'cell';
        }
    }

    getModeDisplayName(mode) {
        const names = {
            'view': 'View',
            'edit_borders': 'Edit Borders', 
            'paint_owner': 'Paint Owner'
        };
        return names[mode] || mode;
    }

    async loadAvailableTags() {
        console.log('Loading available country tags...');
        const response = await fetch('/api/state_editor/get_available_tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success && result.tags.length > 0) {
            const select = $('#owner-tag-select');
            select.empty();
            select.append('<option value="">Select a country tag...</option>');
            result.tags.forEach(tag => {
                select.append(`<option value="${tag}">${tag}</option>`);
            });
            
            select.on('change', (e) => {
                this.currentOwnerTag = $(e.target).val();
                console.log('Selected owner tag:', this.currentOwnerTag);
            });
            
            console.log('Loaded', result.tags.length, 'country tags');
        } else {
            console.warn('No country tags found or error loading tags');
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.lastMouseX = e.clientX - rect.left;
        this.lastMouseY = e.clientY - rect.top;
        
        // Right mouse button or middle mouse for panning
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
        
        if (this.isDragging && (e.buttons === 2 || e.buttons === 1)) {
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
        this.setMode(this.mode); // Reset cursor
    }

    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const oldZoom = this.zoom;
        this.zoom *= delta;
        this.zoom = Math.max(0.1, Math.min(5, this.zoom));
        
        // Adjust pan to zoom towards mouse position
        const worldX = (mouseX - this.panX) / oldZoom;
        const worldY = (mouseY - this.panY) / oldZoom;
        
        this.panX = mouseX - worldX * this.zoom;
        this.panY = mouseY - worldY * this.zoom;
        
        $('#zoom-level').text(Math.round(this.zoom * 100) + '%');
        this.render();
    }

    handleClick(e) {
        if (this.mode === 'view') return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = Math.floor((e.clientX - rect.left - this.panX) / this.zoom);
        const mouseY = Math.floor((e.clientY - rect.top - this.panY) / this.zoom);
        
        console.log(`Clicked at world coordinates: ${mouseX}, ${mouseY}`);
        
        // Get province at pixel using our color map (client-side)
        const provinceId = this.getProvinceAtPixel(mouseX, mouseY);
        
        if (!provinceId) {
            console.log('No province at this location');
            $('#province-info').html('<span class="text-warning">No province here</span>');
            return;
        }
        
        const stateId = this.provinceToState[provinceId];
        
        console.log(`Province ${provinceId} in state ${stateId}`);
        
        // Update province info display
        this.updateProvinceInfo(provinceId, stateId);
        
        if (this.mode === 'edit_borders') {
            this.handleBorderEdit(provinceId, stateId);
        } else if (this.mode === 'paint_owner') {
            this.handlePaintOwner(provinceId, stateId);
        }
    }

    getProvinceAtPixel(x, y) {
        if (!this.offscreenCtx || x < 0 || y < 0 || x >= this.offscreenCanvas.width || y >= this.offscreenCanvas.height) {
            return null;
        }
        
        // Get pixel color from offscreen canvas
        const pixelData = this.offscreenCtx.getImageData(x, y, 1, 1).data;
        const colorKey = `${pixelData[0]},${pixelData[1]},${pixelData[2]}`;
        
        // Look up province ID in color map
        return this.colorMap[colorKey];
    }

    updateProvinceInfo(provinceId, stateId) {
        let infoHtml = `Province: <strong>${provinceId}</strong>`;
        
        if (provinceId in this.provinces) {
            const province = this.provinces[provinceId];
            infoHtml += ` (${province.type})`;
        }
        
        if (stateId) {
            const state = this.states[stateId];
            infoHtml += ` | State: <strong>${stateId}</strong>`;
            if (state) {
                infoHtml += ` (${state.name})`;
                infoHtml += ` | Owner: <strong>${state.owner || 'None'}</strong>`;
            }
        } else {
            infoHtml += ` | <span class="text-warning">No state assigned</span>`;
        }
        
        $('#province-info').html(infoHtml);
    }

    async handleBorderEdit(provinceId, stateId) {
        if (!stateId) {
            // Create new state - no confirmation
            const response = await fetch('/api/state_editor/create_state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ province_id: provinceId, owner_tag: 'XXX' })
            });
            
            const result = await response.json();
            if (result.success) {
                // Refresh our state data
                await this.initializeEditor();
            } else {
                alert('Error: ' + result.error);
            }
        } else {
            // Add to selected state or select state
            if (this.selectedState && this.selectedState !== stateId) {
                // Add to currently selected state - no confirmation
                const response = await fetch('/api/state_editor/add_province_to_state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state_id: this.selectedState, province_id: provinceId })
                });
                
                const result = await response.json();
                if (result.success) {
                    // Refresh our state data
                    await this.initializeEditor();
                } else {
                    alert('Error: ' + result.message);
                }
            } else {
                // Select this state for border editing
                this.selectedState = stateId;
                $('#state-info-content').html(`Editing state ${stateId}. Click other provinces to add them.`);
            }
        }
    }

    async handlePaintOwner(provinceId, stateId) {
        if (!this.currentOwnerTag) {
            alert('Please select an owner tag first from the dropdown.');
            return;
        }
        
        if (!stateId) {
            alert('This province is not part of any state. Use "Edit Borders" mode to create or assign a state first.');
            return;
        }
        
        // No confirmation - just paint immediately
        const response = await fetch('/api/state_editor/set_state_owner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state_id: stateId, owner_tag: this.currentOwnerTag })
        });
        
        const result = await response.json();
        if (result.success) {
            // Refresh our state data
            await this.initializeEditor();
        } else {
            alert('Error: ' + result.message);
        }
    }

    updateMouseInfo(mouseX, mouseY) {
        const worldX = Math.floor((mouseX - this.panX) / this.zoom);
        const worldY = Math.floor((mouseY - this.panY) / this.zoom);
        
        const provinceId = this.getProvinceAtPixel(worldX, worldY);
        let provinceText = '';
        if (provinceId) {
            provinceText = ` | Province: ${provinceId}`;
        }
        
        $('#mouse-info').text(`World: ${worldX}, ${worldY} | Screen: ${mouseX}, ${mouseY}${provinceText}`);
    }

    render() {
        if (!this.ctx) {
            console.log('Cannot render: ctx not available');
            return;
        }
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);
        
        // Draw the base map
        if (this.stylizedImage) {
            this.ctx.drawImage(this.stylizedImage, 0, 0);
        } else if (this.mapImage) {
            // Fallback
            this.ctx.drawImage(this.mapImage, 0, 0);
        }
        
        // Draw state borders if enabled
        if ($('#show-state-borders').is(':checked') && this.stateBordersImage) {
            this.ctx.drawImage(this.stateBordersImage, 0, 0);
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
            alert('✓ ' + result.message);
        } else {
            alert('✗ Error: ' + result.message);
        }
    }
}

// Add button to open state editor
function initStateEditor() {
    console.log('Initializing state editor button...');
    
    const stateEditorButton = $(`
        <button class="btn btn-danger w-100 mb-2" id="open-state-editor-btn">
            <i class="bi bi-map me-2"></i>State Editor
        </button>
    `);
    
    // Find the create-focus-tree-btn and insert after it
    const focusTreeBtn = $('#create-focus-tree-btn');
    if (focusTreeBtn.length) {
        focusTreeBtn.after(stateEditorButton);
    } else {
        // Fallback: insert after country creator button
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

// Initialize when document is ready
$(document).ready(() => {
    console.log('Document ready, initializing state editor...');
    // Wait a bit for the main editor to initialize
    setTimeout(initStateEditor, 1000);
});