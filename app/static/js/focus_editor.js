class FocusEditor {
    constructor(container, filePath, fileName) {
        this.container = container;
        this.filePath = filePath;
        this.fileName = fileName;
        this.content = '';
        this.originalContent = '';
        this.nodes = [];
        this.connections = [];
        
        this.init();
    }
    
    async init() {
        // Load the file content
        const response = await fetch('/api/get_file_content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: this.filePath })
        });

        const result = await response.json();
        if (result.success) {
            this.content = result.content;
            this.originalContent = result.content;
            this.render();
        } else {
            alert('Error loading focus tree file: ' + result.error);
        }
    }
    
    render() {
        this.container.html(`
            <div class="d-flex flex-column h-100">
                <div class="bg-dark border-bottom border-secondary p-2">
                    <button class="btn btn-success btn-sm save-tab-btn">
                        <i class="bi bi-save me-1"></i>Save
                    </button>
                    <span class="text-muted ms-2">Visual Focus Tree Editor for ${this.fileName}</span>
                    
                    <div class="btn-group ms-3">
                        <button class="btn btn-outline-info btn-sm" id="add-focus-node">
                            <i class="bi bi-plus-circle me-1"></i>Add Focus
                        </button>
                        <button class="btn btn-outline-warning btn-sm" id="connect-focuses">
                            <i class="bi bi-arrow-left-right me-1"></i>Connect
                        </button>
                    </div>
                </div>
                <div class="flex-grow-1 d-flex">
                    <!-- Focus Tree Canvas -->
                    <div class="flex-grow-1 bg-secondary position-relative" id="focus-canvas">
                        <div class="text-center text-light p-5">
                            <i class="bi bi-diagram-3 display-1"></i>
                            <h4>Visual Focus Tree Editor</h4>
                            <p>Drag to pan | Scroll to zoom | Click to add nodes</p>
                        </div>
                    </div>
                    
                    <!-- Properties Panel -->
                    <div class="w-25 bg-dark border-start border-secondary p-3">
                        <h6><i class="bi bi-gear me-2"></i>Focus Properties</h6>
                        <div class="text-muted">
                            Select a focus node to edit its properties
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        // Set up save button
        this.container.find('.save-tab-btn').on('click', () => this.save());
        
        // Set up canvas interactions
        this.setupCanvas();
    }
    
    setupCanvas() {
        const canvas = this.container.find('#focus-canvas');
        
        // Basic demo - in reality we'd use SVG or Canvas for the visual editor
        canvas.on('click', (e) => {
            if (e.target === canvas[0]) {
                this.addNode(e.offsetX, e.offsetY);
            }
        });
    }
    
    addNode(x, y) {
        // Create a visual focus node
        const nodeId = 'focus_' + Date.now();
        const node = $(`
            <div class="focus-node position-absolute bg-primary text-white rounded p-2 shadow"
                 style="left: ${x}px; top: ${y}px; min-width: 100px; cursor: move;"
                 data-node-id="${nodeId}">
                <div class="text-center">
                    <i class="bi bi-bullseye"></i>
                    <div>New Focus</div>
                </div>
            </div>
        `);
        
        this.container.find('#focus-canvas').append(node);
        this.makeDraggable(node);
        this.nodes.push({ id: nodeId, x, y, element: node });
    }
    
    makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        element.on('mousedown', dragMouseDown);
        
        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        
        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            element.css({
                top: (element.offset().top - pos2) + "px",
                left: (element.offset().left - pos1) + "px"
            });
        }
        
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
    
    async save() {
        // For now, just save the original content
        // In reality, we'd generate the focus tree code from the visual nodes
        const response = await fetch('/api/save_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: this.filePath, content: this.content })
        });

        const result = await response.json();
        if (result.success) {
            this.originalContent = this.content;
            alert('Saved successfully!');
        } else {
            alert('Error saving file: ' + result.error);
        }
    }
}