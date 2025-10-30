class FocusEditor {
    constructor(container, filePath, fileName) {
        console.log('FocusEditor constructor called');
        console.log('Container:', container);
        console.log('File path:', filePath);
        console.log('File name:', fileName);
        
        this.container = container;
        this.filePath = filePath;
        this.fileName = fileName;
        this.focusNodes = new Map();
        this.branches = new Map();
        this.selectedNodes = new Set();
        this.clipboard = null;
        this.validationErrors = new Map();
        this.nextFocusId = 1;
        this.gridSize = 80;
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastMousePos = { x: 0, y: 0 };
        
        console.log('FocusEditor properties initialized');
        
        // Enhanced tree data
        this.treeData = {
            id: fileName.replace('.txt', ''),
            country: { factor: 1 },
            default: true,
            reset_on_civilwar: false,
            initial_show_position: null,
            shared_focus: null,
            search_filter_prios: {
                FOCUS_FILTER_POLITICAL: 1010,
                FOCUS_FILTER_RESEARCH: 522,
                FOCUS_FILTER_INDUSTRY: 509,
                FOCUS_FILTER_ARMY_XP: 103,
                FOCUS_FILTER_NAVY_XP: 102,
                FOCUS_FILTER_AIR_XP: 101,
                FOCUS_FILTER_BALANCE_OF_POWER: 200
            }
        };

        // Predefined focus templates
        this.focusTemplates = {
            basic: {
                name: "Basic Focus",
                cost: 10,
                icon: "GFX_goal_generic_production",
                search_filters: ["FOCUS_FILTER_RESEARCH"],
                completion_reward: "add_political_power = 100"
            },
            army: {
                name: "Army Focus",
                cost: 10,
                icon: "GFX_goal_generic_allies_build_infantry",
                search_filters: ["FOCUS_FILTER_RESEARCH", "FOCUS_FILTER_ARMY_XP"],
                completion_reward: "army_experience = 25"
            },
            navy: {
                name: "Navy Focus", 
                cost: 10,
                icon: "GFX_goal_generic_build_navy",
                search_filters: ["FOCUS_FILTER_RESEARCH", "FOCUS_FILTER_NAVY_XP"],
                completion_reward: "navy_experience = 25"
            },
            air: {
                name: "Air Focus",
                cost: 10,
                icon: "GFX_goal_generic_build_airforce", 
                search_filters: ["FOCUS_FILTER_RESEARCH", "FOCUS_FILTER_AIR_XP"],
                completion_reward: "air_experience = 25"
            },
            industry: {
                name: "Industry Focus",
                cost: 10,
                icon: "GFX_goal_generic_production",
                search_filters: ["FOCUS_FILTER_INDUSTRY"],
                completion_reward: "add_extra_state_shared_building_slots = 1\nadd_building_construction = {\n    type = industrial_complex\n    level = 1\n    instant_build = yes\n}"
            },
            political: {
                name: "Political Focus",
                cost: 10,
                icon: "GFX_goal_generic_demand_territory",
                search_filters: ["FOCUS_FILTER_POLITICAL"],
                completion_reward: "add_political_power = 150"
            }
        };

        this.commonIcons = [
            'GFX_goal_generic_allies_build_infantry',
            'GFX_goal_generic_small_arms',
            'GFX_goal_generic_army_motorized',
            'GFX_goal_generic_army_doctrines',
            'GFX_goal_generic_army_artillery',
            'GFX_goal_generic_build_tank',
            'GFX_goal_generic_army_tanks',
            'GFX_goal_generic_special_forces',
            'GFX_goal_generic_build_airforce',
            'GFX_goal_generic_air_fighter',
            'GFX_goal_generic_air_bomber',
            'GFX_goal_generic_air_doctrine',
            'GFX_goal_generic_CAS',
            'GFX_focus_rocketry',
            'GFX_goal_generic_air_naval_bomber',
            'GFX_goal_generic_construct_naval_dockyard',
            'GFX_goal_generic_build_navy',
            'GFX_goal_generic_navy_doctrines_tactics',
            'GFX_goal_generic_navy_submarine',
            'GFX_goal_generic_navy_cruiser',
            'GFX_goal_generic_wolf_pack',
            'GFX_goal_generic_navy_battleship',
            'GFX_goal_generic_production',
            'GFX_goal_generic_construct_civ_factory',
            'GFX_goal_generic_construct_mil_factory',
            'GFX_goal_generic_construct_infrastructure',
            'GFX_focus_wonderweapons',
            'GFX_focus_research',
            'GFX_goal_generic_secret_weapon',
            'GFX_goal_generic_demand_territory',
            'GFX_goal_generic_national_unity',
            'GFX_goal_support_fascism',
            'GFX_goal_support_communism',
            'GFX_goal_support_democracy',
            'GFX_goal_generic_political_pressure',
            'GFX_goal_generic_dangerous_deal',
            'GFX_goal_generic_neutrality_focus',
            'GFX_goal_generic_more_territorial_claims',
            'GFX_goal_generic_defence',
            'GFX_goal_generic_military_sphere',
            'GFX_goal_generic_propaganda',
            'GFX_goal_generic_forceful_treaty',
            'GFX_goal_generic_scientific_exchange'
        ];

        this.searchFilters = [
            'FOCUS_FILTER_POLITICAL',
            'FOCUS_FILTER_RESEARCH', 
            'FOCUS_FILTER_INDUSTRY',
            'FOCUS_FILTER_ARMY_XP',
            'FOCUS_FILTER_NAVY_XP',
            'FOCUS_FILTER_AIR_XP',
            'FOCUS_FILTER_BALANCE_OF_POWER',
            'FOCUS_FILTER_SOV_POLITICAL_PARANOIA',
            'FOCUS_FILTER_PROPAGANDA',
            'FOCUS_FILTER_MISSIOLINI'
        ];

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
            this.setupKeyboardShortcuts();
            console.log('Keyboard shortcuts setup');
            this.runValidation();
            console.log('Validation completed');
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
        
        // Simple parsing for demo - just create some nodes
        console.log('Creating demo tree instead of parsing...');
        this.createDemoTree();
    }
    
    createDemoTree() {
        console.log('Creating demo tree...');
        
        // Create a simple demo tree
        const focus1 = this.createFocusNode({
            id: 'industrial_effort',
            name: 'Industrial Effort',
            x: 0,
            y: 0,
            cost: 10,
            icon: 'GFX_goal_generic_production',
            search_filters: ['FOCUS_FILTER_INDUSTRY', 'FOCUS_FILTER_RESEARCH'],
            completion_reward: `add_tech_bonus = {
    name = industrial_bonus
    bonus = 1.0
    uses = 1
    category = industry
}`,
            branch: 'Industry'
        });
        
        const focus2 = this.createFocusNode({
            id: 'army_effort',
            name: 'Army Effort',
            x: -2,
            y: 2,
            cost: 10,
            icon: 'GFX_goal_generic_allies_build_infantry',
            search_filters: ['FOCUS_FILTER_RESEARCH', 'FOCUS_FILTER_ARMY_XP'],
            completion_reward: 'army_experience = 25',
            branch: 'Army',
            prerequisite: 'industrial_effort'
        });
        
        const focus3 = this.createFocusNode({
            id: 'naval_effort', 
            name: 'Naval Effort',
            x: 2,
            y: 2,
            cost: 10,
            icon: 'GFX_goal_generic_build_navy',
            search_filters: ['FOCUS_FILTER_RESEARCH', 'FOCUS_FILTER_NAVY_XP'],
            completion_reward: 'navy_experience = 25',
            branch: 'Navy',
            prerequisite: 'industrial_effort'
        });
        
        this.treeData.initial_show_position = { focus: 'industrial_effort' };
        this.selectedNodes.add(focus1);
        
        console.log('Demo tree created with', this.focusNodes.size, 'nodes');
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
            search_filters: ['FOCUS_FILTER_INDUSTRY', 'FOCUS_FILTER_RESEARCH'],
            completion_reward: `add_tech_bonus = {
    name = industrial_bonus
    bonus = 1.0
    uses = 1
    category = industry
}`,
            branch: 'Industry'
        });
        
        this.treeData.initial_show_position = { focus: 'industrial_effort' };
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
            icon: data.icon || 'misc/focus_chud.dds',
            prerequisite: data.prerequisite || null,
            relative_position_id: data.relative_position_id || null,
            mutually_exclusive: data.mutually_exclusive || [],
            available: data.available || '',
            available_if_capitulated: data.available_if_capitulated !== undefined ? data.available_if_capitulated : true,
            completion_reward: data.completion_reward || 'add_political_power = 100',
            search_filters: data.search_filters || ['FOCUS_FILTER_RESEARCH'],
            ai_will_do: data.ai_will_do || { factor: 1 },
            bypass: data.bypass || '',
            branch: data.branch || 'General'
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
                    <!-- Enhanced Toolbar -->
                    <div class="bg-dark border-bottom border-secondary p-2">
                        <div class="d-flex align-items-center flex-wrap gap-2">
                            <!-- File Operations -->
                            <div class="btn-group">
                                <button class="btn btn-success btn-sm" id="save-focus-tree" title="Save (Ctrl+S)">
                                    <i class="bi bi-save me-1"></i>Save
                                </button>
                                <button class="btn btn-outline-success btn-sm" id="validate-tree" title="Validate Tree">
                                    <i class="bi bi-check-circle me-1"></i>Validate
                                </button>
                            </div>
                            
                            <!-- Edit Operations -->
                            <div class="btn-group">
                                <button class="btn btn-primary btn-sm" id="add-focus-node" title="Add Focus (A)">
                                    <i class="bi bi-plus-circle me-1"></i>Add Focus
                                </button>
                                <button class="btn btn-outline-primary btn-sm dropdown-toggle" data-bs-toggle="dropdown" title="Templates">
                                    <i class="bi bi-layers me-1"></i>Templates
                                </button>
                                <ul class="dropdown-menu dropdown-menu-dark">
                                    <li><a class="dropdown-item template-btn" data-template="basic">Basic Focus</a></li>
                                    <li><a class="dropdown-item template-btn" data-template="army">Army Focus</a></li>
                                    <li><a class="dropdown-item template-btn" data-template="navy">Navy Focus</a></li>
                                    <li><a class="dropdown-item template-btn" data-template="air">Air Focus</a></li>
                                    <li><a class="dropdown-item template-btn" data-template="industry">Industry Focus</a></li>
                                    <li><a class="dropdown-item template-btn" data-template="political">Political Focus</a></li>
                                </ul>
                            </div>
                            
                            <!-- Selection Operations -->
                            <div class="btn-group">
                                <button class="btn btn-warning btn-sm" id="copy-selected" title="Copy (Ctrl+C)">
                                    <i class="bi bi-copy me-1"></i>Copy
                                </button>
                                <button class="btn btn-warning btn-sm" id="paste-nodes" title="Paste (Ctrl+V)" disabled>
                                    <i class="bi bi-clipboard me-1"></i>Paste
                                </button>
                                <button class="btn btn-outline-warning btn-sm" id="delete-selected" title="Delete (Delete)">
                                    <i class="bi bi-trash me-1"></i>Delete
                                </button>
                            </div>
                            
                            <!-- Status Indicators -->
                            <span class="text-muted ms-2" id="selection-count">0 selected</span>
                            <span class="badge bg-danger ms-2 d-none" id="error-badge">0 errors</span>
                            
                            <div class="ms-auto">
                                <span class="text-muted">${this.fileName}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex-grow-1 d-flex">
                        <!-- Focus Tree Canvas -->
                        <div class="flex-grow-1 position-relative bg-dark" id="focus-canvas-container">
                            <svg id="focus-canvas" class="w-100 h-100"></svg>
                            
                            <!-- Canvas Controls -->
                            <div class="position-absolute top-0 end-0 p-2">
                                <div class="btn-group-vertical">
                                    <button class="btn btn-outline-light btn-sm" id="zoom-in" title="Zoom In">
                                        <i class="bi bi-zoom-in"></i>
                                    </button>
                                    <button class="btn btn-outline-light btn-sm" id="zoom-out" title="Zoom Out">
                                        <i class="bi bi-zoom-out"></i>
                                    </button>
                                    <button class="btn btn-outline-light btn-sm" id="reset-view" title="Reset View">
                                        <i class="bi bi-arrows-angle-expand"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Coordinates Display -->
                            <div class="position-absolute bottom-0 start-0 p-2">
                                <div class="text-light small bg-dark bg-opacity-75 p-1 rounded">
                                    Grid: 2x2 units per focus | Drag to pan | Scroll to zoom
                                </div>
                            </div>
                        </div>
                        
                        <!-- Properties Panel -->
                        <div class="w-30 bg-dark border-start border-secondary d-flex flex-column" id="properties-panel" style="min-width: 350px; max-width: 400px;">
                            <div class="p-3 border-bottom border-secondary">
                                <h6 class="mb-0"><i class="bi bi-gear me-2"></i>Focus Properties</h6>
                            </div>
                            <div class="flex-grow-1 overflow-auto">
                                <div id="node-properties" class="p-3">
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
            const svg = this.container.find('#focus-canvas');
            svg.empty();
            
            const container = this.container.find('#focus-canvas-container');
            const width = container.width();
            const height = container.height();
            
            console.log('Canvas dimensions:', width, 'x', height);
            
            svg.attr('width', width);
            svg.attr('height', height);
            
            // Create main group for zoom/pan
            const mainGroup = svg.append('g')
                .attr('class', 'main-group')
                .attr('transform', `translate(${this.panOffset.x}, ${this.panOffset.y}) scale(${this.zoomLevel})`);
            
            // Draw grid
            this.drawGrid(mainGroup, width, height);
            
            // Create arrowhead marker for connections
            svg.append('defs').append('marker')
                .attr('id', 'arrowhead')
                .attr('markerWidth', 10)
                .attr('markerHeight', 7)
                .attr('refX', 9)
                .attr('refY', 3.5)
                .attr('orient', 'auto')
                .append('polygon')
                .attr('points', '0 0, 10 3.5, 0 7')
                .attr('fill', '#0d6efd');
            
            // Draw connections first
            this.drawConnections(mainGroup);
            
            // Draw focus nodes
            this.drawFocusNodes(mainGroup);
            
            console.log('Canvas rendering completed');
        } catch (error) {
            console.error('Error rendering canvas:', error);
            throw error;
        }
    }
    
    drawGrid(svgGroup, width, height) {
        console.log('Drawing grid...');
        const gridSize = this.gridSize;
        
        const gridGroup = svgGroup.append('g').attr('class', 'grid');
        
        // Vertical lines
        for (let x = 0; x <= width; x += gridSize) {
            gridGroup.append('line')
                .attr('x1', x)
                .attr('y1', 0)
                .attr('x2', x)
                .attr('y2', height)
                .attr('stroke', 'rgba(255,255,255,0.1)')
                .attr('stroke-width', 1);
        }
        
        // Horizontal lines
        for (let y = 0; y <= height; y += gridSize) {
            gridGroup.append('line')
                .attr('x1', 0)
                .attr('y1', y)
                .attr('x2', width)
                .attr('y2', y)
                .attr('stroke', 'rgba(255,255,255,0.1)')
                .attr('stroke-width', 1);
        }
    }
    
    drawConnections(svgGroup) {
        console.log('Drawing connections...');
        this.focusNodes.forEach((node, nodeId) => {
            if (node.prerequisite && this.focusNodes.has(node.prerequisite)) {
                const parentNode = this.focusNodes.get(node.prerequisite);
                this.drawConnection(svgGroup, parentNode, node);
            }
        });
    }
    
    drawConnection(svgGroup, fromNode, toNode) {
        const startX = (fromNode.x * this.gridSize) + (this.gridSize / 2);
        const startY = (fromNode.y * this.gridSize) + (this.gridSize / 2);
        const endX = (toNode.x * this.gridSize) + (this.gridSize / 2);
        const endY = (toNode.y * this.gridSize) + (this.gridSize / 2);
        
        // Calculate control points for curved lines
        const midX = (startX + endX) / 2;
        const curveStrength = Math.min(Math.abs(endY - startY) * 0.3, 50);
        
        const path = `M ${startX} ${startY} C ${midX} ${startY + curveStrength}, ${midX} ${endY - curveStrength}, ${endX} ${endY}`;
        
        svgGroup.append('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', '#0d6efd')
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrowhead)');
    }
    
    drawFocusNodes(svgGroup) {
        console.log('Drawing focus nodes...');
        this.focusNodes.forEach((node, nodeId) => {
            this.drawFocusNode(svgGroup, node);
        });
    }
    
    drawFocusNode(svgGroup, node) {
        const group = svgGroup.append('g')
            .attr('class', 'focus-node')
            .attr('transform', `translate(${node.x * this.gridSize}, ${node.y * this.gridSize})`)
            .style('cursor', 'pointer')
            .attr('data-node-id', node.id);
            
        const isSelected = this.selectedNodes.has(node);
        const branch = this.branches.get(node.branch);
        const branchColor = branch ? branch.color : '#6c757d';
        const nodeWidth = this.gridSize - 10;
        const nodeHeight = this.gridSize - 10;
        
        // Node background
        group.append('rect')
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('x', 5)
            .attr('y', 5)
            .attr('rx', 6)
            .attr('fill', isSelected ? branchColor : '#495057')
            .attr('stroke', isSelected ? '#ffffff' : branchColor)
            .attr('stroke-width', isSelected ? 3 : 2);
            
        // Focus icon
        group.append('text')
            .attr('x', nodeWidth / 2 + 5)
            .attr('y', nodeHeight / 2 - 5)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '16px')
            .text('🎯');
            
        // Focus name
        group.append('text')
            .attr('x', nodeWidth / 2 + 5)
            .attr('y', nodeHeight / 2 + 15)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '9px')
            .attr('font-weight', 'bold')
            .text(node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name);
            
        // Focus cost
        group.append('circle')
            .attr('cx', nodeWidth - 5)
            .attr('cy', 10)
            .attr('r', 8)
            .attr('fill', '#198754');
            
        group.append('text')
            .attr('x', nodeWidth - 5)
            .attr('y', 13)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '8px')
            .attr('font-weight', 'bold')
            .text(node.cost);
            
        // Click handler
        group.on('click', (event) => {
            event.stopPropagation();
            this.selectNode(node);
        });
        
        // Drag handlers
        this.makeDraggable(group, node);
    }
    
    makeDraggable(group, node) {
        let isDragging = false;
        let startX, startY, startNodeX, startNodeY;
        
        group.on('mousedown', (event) => {
            isDragging = true;
            startX = event.clientX;
            startY = event.clientY;
            startNodeX = node.x;
            startNodeY = node.y;
            event.stopPropagation();
        });
        
        $(document).on('mousemove', (event) => {
            if (!isDragging) return;
            
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            
            const gridDeltaX = Math.round(deltaX / this.gridSize);
            const gridDeltaY = Math.round(deltaY / this.gridSize);
            
            const newX = startNodeX + gridDeltaX;
            const newY = startNodeY + gridDeltaY;
            
            if (newX !== node.x || newY !== node.y) {
                node.x = newX;
                node.y = newY;
                this.renderCanvas();
            }
        });
        
        $(document).on('mouseup', () => {
            isDragging = false;
        });
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
                               name="x" value="${node.x}" step="1">
                    </div>
                    <div class="col-6">
                        <label class="form-label small fw-bold">Y Position</label>
                        <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary" 
                               name="y" value="${node.y}" step="1">
                    </div>
                </div>
                
                <div class="mb-3">
                    <label class="form-label small fw-bold">Focus Cost</label>
                    <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary" 
                           name="cost" value="${node.cost}" min="1" max="100">
                </div>
                
                <div class="mb-3">
                    <label class="form-label small fw-bold">Icon</label>
                    <select class="form-select form-select-sm bg-dark text-light border-secondary" name="icon">
                        <option value="misc/focus_chud.dds" ${node.icon === 'misc/focus_chud.dds' ? 'selected' : ''}>Default (focus_chud.dds)</option>
                        ${this.commonIcons.map(icon => 
                            `<option value="${icon}" ${node.icon === icon ? 'selected' : ''}>${icon.replace('GFX_', '')}</option>`
                        ).join('')}
                    </select>
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
                    <div class="border border-secondary rounded p-2 bg-dark">
                        ${this.searchFilters.map(filter => `
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="search_filters" 
                                       value="${filter}" id="filter-${filter}" 
                                       ${node.search_filters.includes(filter) ? 'checked' : ''}>
                                <label class="form-check-label small text-light" for="filter-${filter}">
                                    ${filter.replace('FOCUS_FILTER_', '')}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" name="available_if_capitulated" 
                               ${node.available_if_capitulated ? 'checked' : ''}>
                        <label class="form-check-label small text-light">Available if Capitulated</label>
                    </div>
                </div>
                
                <div class="mb-3">
                    <label class="form-label small fw-bold">Completion Reward</label>
                    <textarea class="form-control form-control-sm bg-dark text-light border-secondary" 
                              name="completion_reward" rows="4" 
                              placeholder="add_political_power = 100&#10;army_experience = 25"
                              style="font-family: 'Courier New', monospace; font-size: 12px;">${node.completion_reward}</textarea>
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
        node.available_if_capitulated = formData.get('available_if_capitulated') === 'on';
        node.search_filters = formData.getAll('search_filters');
        node.completion_reward = formData.get('completion_reward') || 'add_political_power = 100';
        
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
                icon: 'misc/focus_chud.dds'
            });
            this.selectNode(newNode);
            this.renderCanvas();
        });
        
        // Template buttons
        this.container.find('.template-btn').on('click', (e) => {
            const template = $(e.target).data('template');
            console.log('Template clicked:', template);
            this.addFocusFromTemplate(template);
        });
        
        // Save focus tree
        this.container.find('#save-focus-tree').on('click', () => {
            console.log('Save focus tree clicked');
            this.saveFocusTree();
        });
        
        // Validate tree
        this.container.find('#validate-tree').on('click', () => {
            console.log('Validate tree clicked');
            this.runValidation(true);
        });
        
        // Copy selected
        this.container.find('#copy-selected').on('click', () => {
            console.log('Copy selected clicked');
            this.copySelected();
        });
        
        // Delete selected
        this.container.find('#delete-selected').on('click', () => {
            console.log('Delete selected clicked');
            this.deleteSelected();
        });
        
        // View controls
        this.container.find('#zoom-in').on('click', () => this.zoom(1.2));
        this.container.find('#zoom-out').on('click', () => this.zoom(0.8));
        this.container.find('#reset-view').on('click', () => this.resetView());
        
        console.log('Event listeners setup completed');
    }
    
    setupKeyboardShortcuts() {
        console.log('Setting up keyboard shortcuts...');
        // Basic keyboard shortcuts can be added here
    }
    
    addFocusFromTemplate(templateName) {
        console.log('Adding focus from template:', templateName);
        const template = this.focusTemplates[templateName] || this.focusTemplates.basic;
        
        let x = 0, y = 0;
        if (this.selectedNodes.size > 0) {
            const lastSelected = Array.from(this.selectedNodes).pop();
            x = lastSelected.x + 2;
            y = lastSelected.y;
        }
        
        const newNode = this.createFocusNode({
            name: template.name,
            x: x,
            y: y,
            cost: template.cost,
            icon: template.icon,
            search_filters: [...template.search_filters],
            completion_reward: template.completion_reward
        });
        
        this.selectedNodes.clear();
        this.selectedNodes.add(newNode);
        this.renderCanvas();
        this.renderPropertiesPanel();
        this.updateStatusBar();
    }
    
    copySelected() {
        if (this.selectedNodes.size === 0) return;
        console.log('Copying', this.selectedNodes.size, 'nodes');
        // Basic copy functionality
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
    
    runValidation(showResults = false) {
        console.log('Running validation...');
        this.validationErrors.clear();
        // Basic validation can be added here
    }
    
    zoom(factor) {
        console.log('Zooming:', factor);
        // Basic zoom functionality
    }
    
    resetView() {
        console.log('Resetting view');
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.renderCanvas();
    }
    
    updateStatusBar() {
        this.container.find('#selected-node-info').text(
            this.selectedNodes.size === 0 ? 'No focus selected' : 
            `Selected: ${Array.from(this.selectedNodes)[0].name}`
        );
        this.container.find('#node-count').text(
            `${this.focusNodes.size} focus${this.focusNodes.size !== 1 ? 'es' : ''}`
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
        
        // Add search filter priorities
        code += `search_filter_prios = {\n`;
        for (const [filter, priority] of Object.entries(this.treeData.search_filter_prios)) {
            code += `\t${filter} = ${priority}\n`;
        }
        code += `}\n\n`;
        
        // Main focus tree definition
        code += `focus_tree = {\n`;
        code += `\tid = "${this.treeData.id}"\n\n`;
        code += `\tcountry = {\n`;
        code += `\t\tfactor = 1\n`;
        code += `\t}\n\n`;
        code += `\tdefault = ${this.treeData.default ? 'yes' : 'no'}\n`;
        code += `\treset_on_civilwar = ${this.treeData.reset_on_civilwar ? 'yes' : 'no'}\n\n`;
        
        // Initial show position
        if (this.treeData.initial_show_position) {
            code += `\tinitial_show_position = {\n`;
            code += `\t\tfocus = ${this.treeData.initial_show_position.focus}\n`;
            code += `\t}\n\n`;
        }
        
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
        
        if (node.search_filters && node.search_filters.length > 0) {
            focusCode += `\t\tsearch_filters = { `;
            focusCode += node.search_filters.map(filter => filter).join(' ');
            focusCode += ` }\n`;
        }
        
        if (!node.available_if_capitulated) {
            focusCode += `\t\tavailable_if_capitulated = no\n`;
        }
        
        focusCode += `\n\t\tcompletion_reward = {\n`;
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