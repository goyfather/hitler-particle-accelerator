class FocusEditor {
    constructor(container, filePath, fileName) {
        console.log('FocusEditor constructor called');
        this.container = container;
        this.filePath = filePath;
        this.fileName = fileName;
        this.focusNodes = new Map();
        this.branches = new Map();
        this.selectedNodes = new Set();
        this.nextFocusId = 1;
        this.gridSize = 80;
        
        // Viewport controls
        this.viewport = {
            x: 0,
            y: 0,
            scale: 1.0
        };
        
        // Canvas dimensions (1000x1000 grid)
        this.canvasWidth = 1000 * this.gridSize;
        this.canvasHeight = 1000 * this.gridSize;
        
        // Drag state
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.viewportStart = { x: 0, y: 0 };
        
        console.log('FocusEditor setup complete, calling init...');
        this.init();
    }
    
    async init() {
        console.log('FocusEditor init started');
        try {
            await this.loadFocusTree();
            console.log('Focus tree loaded successfully');
            this.render();
            console.log('Render completed');
            this.setupEventListeners();
            console.log('Event listeners setup');
            console.log('FocusEditor init finished successfully');
        } catch (error) {
            console.error('Error in FocusEditor init:', error);
            this.showError(`Failed to initialize focus editor: ${error.message}`);
        }
    }
    
    async loadFocusTree() {
        console.log('Loading focus tree...');
        try {
            const response = await fetch('/api/get_file_content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: this.filePath })
            });

            const result = await response.json();
            console.log('Load response:', result);
            
            if (result.success && result.content.trim()) {
                console.log('Parsing existing focus tree...');
                this.parseFocusTree(result.content);
            } else {
                console.log('Creating default focus tree...');
                this.createDefaultTree();
            }
        } catch (error) {
            console.error('Error loading focus tree:', error);
            this.createDefaultTree();
        }
    }
    
    parseFocusTree(content) {
        console.log('Parsing focus tree content...');
        this.focusNodes.clear();
        this.branches.clear();
        
        // Simple parser for HOI4 focus tree format
        const focusBlocks = content.match(/focus\s*=\s*\{[^}]+\}/g) || [];
        
        console.log(`Found ${focusBlocks.length} focus blocks`);
        
        focusBlocks.forEach(block => {
            try {
                const focus = this.parseFocusBlock(block);
                if (focus) {
                    this.focusNodes.set(focus.id, focus);
                    
                    // Add to branch
                    if (!this.branches.has(focus.branch)) {
                        this.branches.set(focus.branch, {
                            name: focus.branch,
                            nodes: new Set(),
                            color: this.getBranchColor(focus.branch),
                            collapsed: false
                        });
                    }
                    this.branches.get(focus.branch).nodes.add(focus.id);
                }
            } catch (error) {
                console.error('Error parsing focus block:', error);
            }
        });
        
        // If no focuses were parsed, create a default one
        if (this.focusNodes.size === 0) {
            console.log('No focuses parsed, creating default tree');
            this.createDefaultTree();
        } else {
            console.log(`Successfully parsed ${this.focusNodes.size} focuses`);
        }
    }
    
    parseFocusBlock(block) {
        const focus = {
            id: this.extractValue(block, 'id'),
            x: parseInt(this.extractValue(block, 'x')) || 0,
            y: parseInt(this.extractValue(block, 'y')) || 0,
            cost: parseInt(this.extractValue(block, 'cost')) || 10,
            icon: this.extractValue(block, 'icon') || 'GFX_goal_generic_production',
            prerequisite: this.extractPrerequisite(block),
            search_filters: this.extractSearchFilters(block),
            completion_reward: this.extractCompletionReward(block),
            branch: 'General', // Default branch
            relative_position_id: this.extractValue(block, 'relative_position_id'),
            mutually_exclusive: this.extractValue(block, 'mutually_exclusive'),
            available: this.extractValue(block, 'available'),
            bypass: this.extractValue(block, 'bypass'),
            ai_will_do: this.extractValue(block, 'ai_will_do')
        };
        
        if (!focus.id) {
            console.warn('Focus block missing ID:', block.substring(0, 100));
            return null;
        }
        
        // Set a readable name
        focus.name = this.formatFocusName(focus.id);
        
        return focus;
    }
    
    extractValue(block, key) {
        const regex = new RegExp(`${key}\\s*=\\s*([^\\s\\n]+)`, 'i');
        const match = block.match(regex);
        return match ? match[1].replace(/"/g, '') : null;
    }
    
    extractPrerequisite(block) {
        const regex = /prerequisite\s*=\s*\{\s*focus\s*=\s*([^\s}]+)/i;
        const match = block.match(regex);
        return match ? match[1] : null;
    }
    
    extractSearchFilters(block) {
        const regex = /search_filters\s*=\s*\{([^}]+)\}/i;
        const match = block.match(regex);
        if (match) {
            return match[1].trim();
        }
        return 'FOCUS_FILTER_RESEARCH'; // Default
    }
    
    extractCompletionReward(block) {
        const rewardStart = block.indexOf('completion_reward = {');
        if (rewardStart === -1) return 'add_political_power = 100';
        
        let braceCount = 0;
        let rewardContent = '';
        let inReward = false;
        
        for (let i = rewardStart; i < block.length; i++) {
            const char = block[i];
            if (char === '{') {
                braceCount++;
                if (braceCount === 1) {
                    inReward = true;
                    continue;
                }
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    break;
                }
            }
            
            if (inReward && braceCount >= 1) {
                rewardContent += char;
            }
        }
        
        return rewardContent.trim() || 'add_political_power = 100';
    }
    
    createDefaultTree() {
        console.log('Creating default tree...');
        const rootFocus = this.createFocusNode({
            id: 'industrial_effort',
            name: 'Industrial Effort',
            x: 0,
            y: 0,
            cost: 10,
            icon: 'GFX_goal_generic_production',
            search_filters: 'FOCUS_FILTER_INDUSTRY FOCUS_FILTER_RESEARCH',
            completion_reward: 'add_tech_bonus = {\n\tname = industrial_bonus\n\tbonus = 1.0\n\tuses = 1\n\tcategory = industry\n}',
            branch: 'Industry'
        });
        
        this.selectedNodes.add(rootFocus);
        console.log('Default tree created');
    }
    
    createFocusNode(data) {
        const focusId = data.id || `focus_${this.nextFocusId++}`;
        const node = {
            id: focusId,
            name: data.name || this.formatFocusName(focusId),
            x: data.x || 0,
            y: data.y || 0,
            cost: data.cost || 10,
            icon: data.icon || 'GFX_goal_generic_production',
            prerequisite: data.prerequisite || null,
            search_filters: data.search_filters || 'FOCUS_FILTER_RESEARCH',
            available_if_capitulated: true,
            completion_reward: data.completion_reward || 'add_political_power = 100',
            branch: data.branch || 'General',
            relative_position_id: data.relative_position_id || null,
            mutually_exclusive: data.mutually_exclusive || null,
            available: data.available || null,
            bypass: data.bypass || null,
            ai_will_do: data.ai_will_do || null
        };
        
        this.focusNodes.set(focusId, node);
        
        // Add to branch
        if (!this.branches.has(node.branch)) {
            this.branches.set(node.branch, {
                name: node.branch,
                nodes: new Set(),
                color: this.getBranchColor(node.branch),
                collapsed: false
            });
        }
        this.branches.get(node.branch).nodes.add(focusId);
        
        console.log('Created focus node:', node);
        return node;
    }
    
    formatFocusName(focusId) {
        return focusId.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    getBranchColor(branch) {
        const colors = {
            'Army': '#dc3545',
            'Navy': '#0d6efd', 
            'Air Force': '#0dcaf0',
            'Industry': '#ffc107',
            'Politics': '#6f42c1',
            'Research': '#20c997',
            'General': '#6c757d'
        };
        return colors[branch] || '#6c757d';
    }
    
    render() {
        console.log('Rendering focus editor...');
        try {
            this.container.html(`
                <div class="d-flex flex-column h-100">
                    <!-- Toolbar -->
                    <div class="bg-dark border-bottom border-secondary p-2">
                        <div class="d-flex align-items-center flex-wrap gap-2">
                            <button class="btn btn-success btn-sm" id="save-focus-tree">
                                <i class="bi bi-save me-1"></i>Save
                            </button>
                            <button class="btn btn-primary btn-sm" id="add-focus-node">
                                <i class="bi bi-plus-circle me-1"></i>Add Focus
                            </button>
                            <button class="btn btn-outline-warning btn-sm" id="delete-selected">
                                <i class="bi bi-trash me-1"></i>Delete
                            </button>
                            <span class="text-muted ms-2" id="selection-count">0 selected</span>
                            
                            <!-- Viewport Controls -->
                            <div class="ms-auto btn-group">
                                <button class="btn btn-outline-light btn-sm" id="zoom-out">
                                    <i class="bi bi-dash"></i>
                                </button>
                                <button class="btn btn-outline-light btn-sm" id="reset-view">
                                    <i class="bi bi-arrows-angle-expand"></i>
                                </button>
                                <button class="btn btn-outline-light btn-sm" id="zoom-in">
                                    <i class="bi bi-plus"></i>
                                </button>
                            </div>
                            
                            <div class="ms-2">
                                <span class="text-muted">${this.fileName}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex-grow-1 d-flex position-relative">
                        <!-- Focus Tree Canvas -->
                        <div class="flex-grow-1 position-relative bg-dark" id="focus-canvas-container" 
                             style="overflow: hidden;">
                            <div id="focus-canvas" class="position-relative" 
                                 style="width: ${this.canvasWidth}px; height: ${this.canvasHeight}px; cursor: grab;"></div>
                            
                            <!-- Coordinates Display -->
                            <div class="position-absolute bottom-0 start-0 p-2">
                                <div class="text-light small bg-dark bg-opacity-75 p-1 rounded">
                                    Drag background to pan | Mouse wheel to zoom | Drag nodes to move
                                </div>
                            </div>
                            
                            <!-- Viewport Info -->
                            <div class="position-absolute top-0 start-0 p-2">
                                <div class="text-light small bg-dark bg-opacity-75 p-1 rounded">
                                    Scale: ${Math.round(this.viewport.scale * 100)}% | 
                                    View: (${this.viewport.x}, ${this.viewport.y})
                                </div>
                            </div>
                        </div>
                        
                        <!-- Properties Panel -->
                        <div class="w-30 bg-dark border-start border-secondary d-flex flex-column position-relative" 
                             style="min-width: 400px; max-width: 500px; z-index: 10; background: #1a1d20 !important;">
                            <div class="p-3 border-bottom border-secondary" style="background: #1a1d20;">
                                <h6 class="mb-0"><i class="bi bi-gear me-2"></i>Focus Properties</h6>
                            </div>
                            <div class="flex-grow-1 overflow-auto" style="background: #1a1d20;">
                                <div id="node-properties" class="p-3" style="background: #1a1d20;">
                                    <div class="text-muted text-center py-4">
                                        <i class="bi bi-mouse2 display-6 d-block mb-2"></i>
                                        Select a focus node to edit its properties
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Status Bar -->
                    <div class="bg-dark border-top border-secondary px-3 py-1">
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted" id="selected-node-info">
                                ${this.selectedNodes.size === 0 ? 'No focus selected' : `Selected: ${Array.from(this.selectedNodes)[0].name}`}
                            </small>
                            <small class="text-muted" id="node-count">
                                ${this.focusNodes.size} focus${this.focusNodes.size !== 1 ? 'es' : ''}
                            </small>
                        </div>
                    </div>
                </div>
            `);
            
            console.log('HTML rendered, now rendering canvas...');
            this.renderCanvas();
            console.log('Canvas rendered, now rendering properties panel...');
            this.renderPropertiesPanel();
            console.log('Properties panel rendered, updating status bar...');
            this.updateStatusBar();
            console.log('Render completed successfully');
        } catch (error) {
            console.error('Error in render:', error);
            this.showError(`Rendering failed: ${error.message}`);
        }
    }
    
    renderCanvas() {
        console.log('Rendering canvas...');
        try {
            const canvas = this.container.find('#focus-canvas');
            canvas.empty();
            
            // Apply viewport transform
            canvas.css({
                'transform': `translate(${this.viewport.x}px, ${this.viewport.y}px) scale(${this.viewport.scale})`,
                'transform-origin': '0 0'
            });
            
            // Draw connections first (so they appear behind nodes)
            this.drawConnections(canvas);
            
            // Draw focus nodes
            this.drawFocusNodes(canvas);
            
            console.log('Canvas rendering completed');
        } catch (error) {
            console.error('Error rendering canvas:', error);
            throw error;
        }
    }
    
    drawConnections(canvas) {
        console.log('Drawing connections...');
        this.focusNodes.forEach((node, nodeId) => {
            if (node.prerequisite && this.focusNodes.has(node.prerequisite)) {
                const parentNode = this.focusNodes.get(node.prerequisite);
                this.drawConnection(canvas, parentNode, node);
            }
        });
    }
    
    drawConnection(canvas, fromNode, toNode) {
        const startX = (fromNode.x * this.gridSize) + (this.gridSize / 2);
        const startY = (fromNode.y * this.gridSize) + (this.gridSize / 2);
        const endX = (toNode.x * this.gridSize) + (this.gridSize / 2);
        const endY = (toNode.y * this.gridSize) + (this.gridSize / 2);
        
        // Create connection line
        const connection = $(`
            <div class="position-absolute" style="
                left: ${startX}px; 
                top: ${startY}px; 
                width: ${Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))}px;
                height: 2px;
                background: #0d6efd;
                transform-origin: 0 0;
                transform: rotate(${Math.atan2(endY - startY, endX - startX)}rad);
                z-index: 1;
            "></div>
        `);
        
        canvas.append(connection);
    }
    
    drawFocusNodes(canvas) {
        console.log('Drawing focus nodes...');
        this.focusNodes.forEach((node, nodeId) => {
            this.drawFocusNode(canvas, node);
        });
    }
    
    drawFocusNode(canvas, node) {
        const isSelected = this.selectedNodes.has(node);
        const branch = this.branches.get(node.branch);
        const branchColor = branch ? branch.color : '#6c757d';
        
        const nodeElement = $(`
            <div class="focus-node position-absolute rounded shadow" style="
                left: ${node.x * this.gridSize}px;
                top: ${node.y * this.gridSize}px;
                width: ${this.gridSize - 10}px;
                height: ${this.gridSize - 10}px;
                background: ${isSelected ? branchColor : '#495057'};
                border: 2px solid ${isSelected ? '#ffffff' : branchColor};
                cursor: pointer;
                z-index: 2;
            " data-node-id="${node.id}">
                <div class="w-100 h-100 d-flex flex-column align-items-center justify-content-center p-1">
                    <div class="text-white" style="font-size: 16px;">🎯</div>
                    <div class="text-white text-center small fw-bold mt-1" style="font-size: 9px; line-height: 1.1;">
                        ${node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name}
                    </div>
                </div>
                <div class="position-absolute top-0 end-0 m-1 bg-success rounded-circle d-flex align-items-center justify-content-center" 
                     style="width: 16px; height: 16px; font-size: 8px; color: white; font-weight: bold;">
                    ${node.cost}
                </div>
            </div>
        `);
        
        // Click handler
        nodeElement.on('click', (event) => {
            event.stopPropagation();
            this.selectNode(node);
        });
        
        // Drag handlers
        this.makeDraggable(nodeElement, node);
        
        canvas.append(nodeElement);
    }
    
    makeDraggable(element, node) {
        let isDragging = false;
        let startX, startY, startNodeX, startNodeY;
        
        element.on('mousedown', (event) => {
            isDragging = true;
            startX = event.clientX;
            startY = event.clientY;
            startNodeX = node.x;
            startNodeY = node.y;
            event.stopPropagation();
            
            // Change cursor
            element.css('cursor', 'grabbing');
        });
        
        const mouseMoveHandler = (event) => {
            if (!isDragging) return;
            
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            
            // Convert screen delta to grid delta considering viewport scale
            const gridDeltaX = Math.round(deltaX / (this.gridSize * this.viewport.scale));
            const gridDeltaY = Math.round(deltaY / (this.gridSize * this.viewport.scale));
            
            const newX = startNodeX + gridDeltaX;
            const newY = startNodeY + gridDeltaY;
            
            // Constrain to canvas bounds (0 to 999)
            const constrainedX = Math.max(0, Math.min(999, newX));
            const constrainedY = Math.max(0, Math.min(999, newY));
            
            if (constrainedX !== node.x || constrainedY !== node.y) {
                node.x = constrainedX;
                node.y = constrainedY;
                this.renderCanvas();
                this.updatePropertiesForm(node); // Update form in real-time
            }
        };
        
        const mouseUpHandler = () => {
            isDragging = false;
            element.css('cursor', 'pointer');
            $(document).off('mousemove', mouseMoveHandler);
            $(document).off('mouseup', mouseUpHandler);
        };
        
        $(document).on('mousemove', mouseMoveHandler);
        $(document).on('mouseup', mouseUpHandler);
    }
    
    selectNode(node) {
        console.log('Selecting node:', node.id);
        this.selectedNodes.clear();
        this.selectedNodes.add(node);
        this.renderCanvas();
        this.renderPropertiesPanel();
        this.updateStatusBar();
    }
    
    renderPropertiesPanel() {
        console.log('Rendering properties panel...');
        const propertiesDiv = this.container.find('#node-properties');
        propertiesDiv.empty();
        
        if (!this.selectedNodes.size) {
            propertiesDiv.html(`
                <div class="text-muted text-center py-4">
                    <i class="bi bi-mouse2 display-6 d-block mb-2"></i>
                    Select a focus node to edit its properties
                </div>
            `);
            return;
        }
        
        const node = Array.from(this.selectedNodes)[0];
        propertiesDiv.html(`
            <form id="focus-properties-form">
                <div class="mb-3">
                    <label class="form-label small fw-bold">Focus ID</label>
                    <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                           name="id" value="${node.id}" required>
                </div>
                
                <div class="mb-3">
                    <label class="form-label small fw-bold">Focus Name</label>
                    <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                           name="name" value="${node.name}" required>
                </div>
                
                <div class="row mb-3">
                    <div class="col-6">
                        <label class="form-label small fw-bold">X Position</label>
                        <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary" 
                               name="x" value="${node.x}" step="1" min="0" max="999">
                    </div>
                    <div class="col-6">
                        <label class="form-label small fw-bold">Y Position</label>
                        <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary" 
                               name="y" value="${node.y}" step="1" min="0" max="999">
                    </div>
                </div>
                
                <div class="mb-3">
                    <label class="form-label small fw-bold">Focus Cost</label>
                    <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary" 
                           name="cost" value="${node.cost}" min="1" max="100">
                </div>
                
                <div class="mb-3">
                    <label class="form-label small fw-bold">Icon</label>
                    <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                           name="icon" value="${node.icon}">
                </div>
                
                <div class="mb-3">
                    <label class="form-label small fw-bold">Prerequisite</label>
                    <select class="form-select form-select-sm bg-dark text-light border-secondary" name="prerequisite">
                        <option value="">None (Starting Focus)</option>
                        ${Array.from(this.focusNodes.entries())
                            .filter(([id, n]) => id !== node.id)
                            .map(([id, n]) => `<option value="${id}" ${node.prerequisite === id ? 'selected' : ''}>${n.name}</option>`)
                            .join('')}
                    </select>
                </div>
                
                <div class="mb-3">
                    <label class="form-label small fw-bold">Search Filters</label>
                    <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                           name="search_filters" value="${node.search_filters || ''}">
                    <div class="form-text text-muted">Space-separated filter names</div>
                </div>
                
                <div class="mb-3">
                    <label class="form-label small fw-bold">Completion Reward</label>
                    <textarea class="form-control form-control-sm bg-dark text-light border-secondary" 
                              name="completion_reward" rows="6" style="font-family: monospace; font-size: 12px;">${node.completion_reward || ''}</textarea>
                    <div class="form-text text-muted">HOI4 script code for completion reward</div>
                </div>
                
                <div class="mb-3">
                    <label class="form-label small fw-bold">Branch</label>
                    <select class="form-select form-select-sm bg-dark text-light border-secondary" name="branch">
                        <option value="General" ${node.branch === 'General' ? 'selected' : ''}>General</option>
                        <option value="Army" ${node.branch === 'Army' ? 'selected' : ''}>Army</option>
                        <option value="Navy" ${node.branch === 'Navy' ? 'selected' : ''}>Navy</option>
                        <option value="Air Force" ${node.branch === 'Air Force' ? 'selected' : ''}>Air Force</option>
                        <option value="Industry" ${node.branch === 'Industry' ? 'selected' : ''}>Industry</option>
                        <option value="Politics" ${node.branch === 'Politics' ? 'selected' : ''}>Politics</option>
                        <option value="Research" ${node.branch === 'Research' ? 'selected' : ''}>Research</option>
                    </select>
                </div>
                
                <div class="mt-4 pt-3 border-top border-secondary">
                    <button type="submit" class="btn btn-primary btn-sm w-100">
                        <i class="bi bi-check me-1"></i>Apply Changes
                    </button>
                </div>
            </form>
        `);
        
        // Form submission
        propertiesDiv.find('#focus-properties-form').on('submit', (e) => {
            e.preventDefault();
            this.updateNodeProperties(node, new FormData(e.target));
        });
    }
    
    updatePropertiesForm(node) {
        // Update form fields if they exist
        const form = this.container.find('#focus-properties-form');
        if (form.length) {
            form.find('input[name="x"]').val(node.x);
            form.find('input[name="y"]').val(node.y);
        }
    }
    
    updateNodeProperties(node, formData) {
        console.log('Updating node properties:', node.id);
        const oldId = node.id;
        
        node.id = formData.get('id');
        node.name = formData.get('name');
        node.x = parseInt(formData.get('x'));
        node.y = parseInt(formData.get('y'));
        node.cost = parseInt(formData.get('cost'));
        node.icon = formData.get('icon');
        node.prerequisite = formData.get('prerequisite') || null;
        node.search_filters = formData.get('search_filters');
        node.completion_reward = formData.get('completion_reward');
        node.branch = formData.get('branch');
        
        // Constrain coordinates to canvas bounds
        node.x = Math.max(0, Math.min(999, node.x));
        node.y = Math.max(0, Math.min(999, node.y));
        
        // Update the node in our map if ID changed
        if (oldId !== node.id) {
            this.focusNodes.delete(oldId);
            this.focusNodes.set(node.id, node);
        }
        
        this.renderCanvas();
        this.renderPropertiesPanel();
        this.updateStatusBar();
    }
    
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Add new focus node
        this.container.find('#add-focus-node').on('click', () => {
            console.log('Add focus node clicked');
            const newNode = this.createFocusNode({
                name: 'New Focus',
                x: this.selectedNodes.size ? Array.from(this.selectedNodes)[0].x + 2 : 0,
                y: this.selectedNodes.size ? Array.from(this.selectedNodes)[0].y : 0,
                cost: 10,
                icon: 'GFX_goal_generic_production'
            });
            this.selectNode(newNode);
            this.renderCanvas();
        });
        
        // Save focus tree
        this.container.find('#save-focus-tree').on('click', () => {
            console.log('Save focus tree clicked');
            this.saveFocusTree();
        });
        
        // Delete selected
        this.container.find('#delete-selected').on('click', () => {
            console.log('Delete selected clicked');
            this.deleteSelected();
        });
        
        // Viewport controls
        this.container.find('#zoom-in').on('click', () => {
            this.viewport.scale = Math.min(this.viewport.scale * 1.2, 3.0);
            this.renderCanvas();
        });
        
        this.container.find('#zoom-out').on('click', () => {
            this.viewport.scale = Math.max(this.viewport.scale / 1.2, 0.1);
            this.renderCanvas();
        });
        
        this.container.find('#reset-view').on('click', () => {
            this.viewport = { x: 0, y: 0, scale: 1.0 };
            this.renderCanvas();
        });
        
        // Canvas panning
        this.setupCanvasPanning();
        
        // Canvas click to deselect
        this.container.find('#focus-canvas-container').on('click', (e) => {
            if (e.target.id === 'focus-canvas-container' || e.target.id === 'focus-canvas') {
                this.selectedNodes.clear();
                this.renderPropertiesPanel();
                this.updateStatusBar();
            }
        });
        
        console.log('Event listeners setup completed');
    }
    
    setupCanvasPanning() {
        const container = this.container.find('#focus-canvas-container');
        const canvas = this.container.find('#focus-canvas');
        
        container.on('mousedown', (e) => {
            if (e.target.id === 'focus-canvas-container' || e.target.id === 'focus-canvas') {
                this.isDragging = true;
                this.dragStart = { x: e.clientX, y: e.clientY };
                this.viewportStart = { x: this.viewport.x, y: this.viewport.y };
                canvas.css('cursor', 'grabbing');
                e.preventDefault();
            }
        });
        
        $(document).on('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const deltaX = e.clientX - this.dragStart.x;
            const deltaY = e.clientY - this.dragStart.y;
            
            this.viewport.x = this.viewportStart.x + deltaX;
            this.viewport.y = this.viewportStart.y + deltaY;
            
            this.renderCanvas();
        });
        
        $(document).on('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                canvas.css('cursor', 'grab');
            }
        });
        
        // Mouse wheel zoom
        container.on('wheel', (e) => {
            e.preventDefault();
            const zoomIntensity = 0.1;
            const wheel = e.originalEvent.deltaY < 0 ? 1 : -1;
            const zoom = Math.exp(wheel * zoomIntensity);
            
            this.viewport.scale = Math.max(0.1, Math.min(3.0, this.viewport.scale * zoom));
            this.renderCanvas();
        });
    }
    
    deleteSelected() {
        if (this.selectedNodes.size === 0) return;
        
        if (!confirm(`Delete selected focus "${Array.from(this.selectedNodes)[0].name}"?`)) {
            return;
        }
        
        this.selectedNodes.forEach(node => {
            this.focusNodes.delete(node.id);
        });
        
        this.selectedNodes.clear();
        this.renderCanvas();
        this.renderPropertiesPanel();
        this.updateStatusBar();
    }
    
    updateStatusBar() {
        this.container.find('#selected-node-info').text(
            this.selectedNodes.size === 0 ? 'No focus selected' : 
            `Selected: ${Array.from(this.selectedNodes)[0].name}`
        );
        this.container.find('#node-count').text(
            `${this.focusNodes.size} focus${this.focusNodes.size !== 1 ? 'es' : ''}`
        );
        this.container.find('#selection-count').text(
            `${this.selectedNodes.size} selected`
        );
    }
    
    async saveFocusTree() {
        console.log('Saving focus tree...');
        const focusTreeCode = this.generateFocusTreeCode();
        
        try {
            const response = await fetch('/api/save_file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    path: this.filePath, 
                    content: focusTreeCode 
                })
            });

            const result = await response.json();
            if (result.success) {
                this.showNotification('Focus tree saved successfully!', 'success');
            } else {
                this.showNotification('Error saving focus tree: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('Failed to save focus tree: ' + error.message, 'error');
        }
    }
    
    generateFocusTreeCode() {
        console.log('Generating focus tree code...');
        let code = '';
        
        // Add search filter priorities (from the example you provided)
        code += `search_filter_prios = {\n`;
        code += `\tFOCUS_FILTER_POLITICAL = 1010\n`;
        code += `\tFOCUS_FILTER_RESEARCH = 522\n`;
        code += `\tFOCUS_FILTER_INDUSTRY = 509\n`;
        code += `\tFOCUS_FILTER_BALANCE_OF_POWER = 200\n`;
        code += `\tFOCUS_FILTER_SOV_POLITICAL_PARANOIA = 111\n`;
        code += `\tFOCUS_FILTER_PROPAGANDA = 110\n`;
        code += `\tFOCUS_FILTER_MISSIOLINI = 110\n`;
        code += `\tFOCUS_FILTER_ARMY_XP = 103\n`;
        code += `\tFOCUS_FILTER_NAVY_XP = 102\n`;
        code += `\tFOCUS_FILTER_AIR_XP = 101\n`;
        code += `}\n\n`;
        
        // Main focus tree definition
        code += `focus_tree = {\n`;
        code += `\tid = "${this.fileName.replace('.txt', '')}"\n\n`;
        code += `\tcountry = {\n`;
        code += `\t\tfactor = 1\n`;
        code += `\t}\n\n`;
        code += `\tdefault = yes\n`;
        code += `\treset_on_civilwar = no\n\n`;
        
        // Add each focus
        this.focusNodes.forEach((node, nodeId) => {
            code += this.generateFocusCode(node);
        });
        
        code += `}\n`;
        return code;
    }
    
    generateFocusCode(node) {
        let focusCode = `\tfocus = {\n`;
        focusCode += `\t\tid = ${node.id}\n`;
        focusCode += `\t\ticon = ${node.icon}\n`;
        focusCode += `\t\tx = ${node.x}\n`;
        focusCode += `\t\ty = ${node.y}\n`;
        focusCode += `\t\tcost = ${node.cost}\n`;
        
        if (node.prerequisite) {
            focusCode += `\t\tprerequisite = { focus = ${node.prerequisite} }\n`;
        }
        
        if (node.search_filters && node.search_filters.trim()) {
            focusCode += `\t\tsearch_filters = { ${node.search_filters} }\n`;
        }
        
        focusCode += `\t\tavailable_if_capitulated = yes\n\n`;
        
        focusCode += `\t\tcompletion_reward = {\n`;
        const rewardLines = node.completion_reward.split('\n');
        rewardLines.forEach(line => {
            if (line.trim()) {
                focusCode += `\t\t\t${line}\n`;
            }
        });
        focusCode += `\t\t}\n`;
        
        focusCode += `\t}\n\n`;
        return focusCode;
    }
    
    showNotification(message, type = 'info') {
        const alertClass = type === 'success' ? 'alert-success' : type === 'error' ? 'alert-danger' : 'alert-info';
        const iconClass = type === 'success' ? 'bi-check-circle' : type === 'error' ? 'bi-exclamation-triangle' : 'bi-info-circle';
        
        const notification = $(`
            <div class="alert ${alertClass} alert-dismissible fade show position-fixed top-0 end-0 m-3" style="z-index: 1060;">
                <i class="bi ${iconClass} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `);
        
        $('body').append(notification);
        setTimeout(() => {
            if (notification.is(':visible')) {
                notification.alert('close');
            }
        }, 5000);
    }
    
    showError(message) {
        this.container.html(`
            <div class="alert alert-danger m-3">
                <h5><i class="bi bi-exclamation-triangle me-2"></i>Focus Editor Error</h5>
                <p>${message}</p>
                <button class="btn btn-warning btn-sm" onclick="location.reload()">
                    <i class="bi bi-arrow-clockwise me-1"></i>Reload Page
                </button>
            </div>
        `);
    }
}

console.log('FocusEditor class defined and ready');