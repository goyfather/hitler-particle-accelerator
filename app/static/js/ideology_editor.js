class IdeologyEditor {
    constructor(container, filePath, fileName) {
        this.container = container;
        this.filePath = filePath;
        this.fileName = fileName;
        this.ideologies = {};
        this.localization = {};
        this.currentIdeology = null;
        this.projectRoot = this.filePath.split('/common/ideologies/')[0];
        this.editingSubtype = null;

        this.init();
        this.loadFiles();
    }

    async loadFiles() {
        await this.loadIdeologiesFile();
        await this.loadLocalizationFile();
    }

    async loadIdeologiesFile() {
        try {
            const response = await fetch('/api/get_file_content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: this.filePath })
            });

            const result = await response.json();
            if (result.success) {
                console.log('Raw file content:', result.content);
                this.parseIdeologiesFile(result.content);
                this.renderIdeologyList();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.container.find('#ideology-list').html(`
                <div class="alert alert-danger">
                    Failed to load ideologies file: ${error.message}
                </div>
            `);
        }
    }

    async loadLocalizationFile() {
        const localizationPath = 'localization/ideologies_l_english.yml';
        try {
            const response = await fetch('/api/get_file_content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: localizationPath })
            });

            const result = await response.json();
            if (result.success) {
                this.parseLocalizationFile(result.content);
            }
        } catch (error) {
            console.log('Localization file not found or error loading:', error);
        }
    }

    parseIdeologiesFile(content) {
        this.ideologies = {};

        console.log('Raw content:', content);

        // Find the main ideologies block more flexibly
        const ideologiesStart = content.indexOf('ideologies = {');
        if (ideologiesStart === -1) {
            console.error('No ideologies block found');
            return;
        }

        // Extract everything after "ideologies = {"
        let ideologiesContent = content.substring(ideologiesStart + 'ideologies = {'.length);

        // Find the closing brace for the main ideologies block
        let braceCount = 1;
        let endIndex = 0;

        for (let i = 0; i < ideologiesContent.length; i++) {
            if (ideologiesContent[i] === '{') braceCount++;
            if (ideologiesContent[i] === '}') braceCount--;

            if (braceCount === 0) {
                endIndex = i;
                break;
            }
        }

        ideologiesContent = ideologiesContent.substring(0, endIndex);
        console.log('Extracted ideologies content:', ideologiesContent);

        // Now parse individual ideology blocks
        this.parseIndividualIdeologies(ideologiesContent);
    }

    parseIndividualIdeologies(content) {
        let currentIndex = 0;

        while (currentIndex < content.length) {
            // Look for ideology name pattern: "name = {"
            const ideologyMatch = content.substring(currentIndex).match(/(\w+)\s*=\s*{/);
            if (!ideologyMatch) break;

            const ideologyName = ideologyMatch[1];
            const blockStart = currentIndex + ideologyMatch.index + ideologyMatch[0].length;

            // Find the matching closing brace for this ideology
            let braceCount = 1;
            let blockEnd = blockStart;

            for (let i = blockStart; i < content.length; i++) {
                if (content[i] === '{') braceCount++;
                if (content[i] === '}') braceCount--;

                if (braceCount === 0) {
                    blockEnd = i;
                    break;
                }
            }

            if (braceCount === 0) {
                const ideologyContent = content.substring(blockStart, blockEnd);
                console.log(`Found ideology: ${ideologyName}`, ideologyContent);

                this.ideologies[ideologyName] = this.parseSingleIdeology(ideologyName, ideologyContent);

                // Move to the next position
                currentIndex = blockEnd + 1;
            } else {
                // If we didn't find a closing brace, move forward
                currentIndex = blockStart + 1;
            }
        }

        console.log('Parsed ideologies:', Object.keys(this.ideologies));
    }

    parseSingleIdeology(ideologyName, content) {
        console.log(`Parsing ideology: ${ideologyName}`);

        const ideology = {
            rawContent: content,
            types: this.extractTypes(content),
            color: this.extractColor(content),
            rules: this.extractBlock(content, 'rules'),
            modifiers: this.extractBlock(content, 'modifiers'),
            can_collaborate: content.includes('can_collaborate = yes'),
            dynamic_faction_names: this.extractArray(content, 'dynamic_faction_names'),
            war_impact: this.extractNumber(content, 'war_impact_on_world_tension', 0.5),
            faction_impact: this.extractNumber(content, 'faction_impact_on_world_tension', 0.5),
            ai_neutral: content.includes('ai_neutral = yes'),
            ai_democratic: content.includes('ai_democratic = yes'),
            ai_communist: content.includes('ai_communist = yes'),
            ai_fascist: content.includes('ai_fascist = yes'),
            wanted_units_factor: this.extractNumber(content, 'ai_ideology_wanted_units_factor', 1.0),
            core_control_threshold: this.extractNumber(content, 'ai_give_core_state_control_threshold', 0)
        };

        return ideology;
    }

    extractTypes(content) {
        console.log('Extracting types from:', content);

        const types = {};

        // Find the types block
        const typesStart = content.indexOf('types = {');
        if (typesStart === -1) {
            console.log('No types block found');
            return types;
        }

        let typesContent = content.substring(typesStart + 'types = {'.length);

        // Find the closing brace for the types block
        let braceCount = 1;
        let endIndex = 0;

        for (let i = 0; i < typesContent.length; i++) {
            if (typesContent[i] === '{') braceCount++;
            if (typesContent[i] === '}') braceCount--;

            if (braceCount === 0) {
                endIndex = i;
                break;
            }
        }

        typesContent = typesContent.substring(0, endIndex);
        console.log('Types content:', typesContent);

        // Now parse individual subtypes
        let currentIndex = 0;

        while (currentIndex < typesContent.length) {
            // Look for subtype pattern: "subtype_name = {"
            const subtypeMatch = typesContent.substring(currentIndex).match(/(\w+)\s*=\s*{/);
            if (!subtypeMatch) break;

            const subtypeName = subtypeMatch[1];
            const blockStart = currentIndex + subtypeMatch.index + subtypeMatch[0].length;

            // Find the matching closing brace for this subtype
            let subtypeBraceCount = 1;
            let blockEnd = blockStart;

            for (let i = blockStart; i < typesContent.length; i++) {
                if (typesContent[i] === '{') subtypeBraceCount++;
                if (typesContent[i] === '}') subtypeBraceCount--;

                if (subtypeBraceCount === 0) {
                    blockEnd = i;
                    break;
                }
            }

            if (subtypeBraceCount === 0) {
                const subtypeContent = typesContent.substring(blockStart, blockEnd);
                console.log(`Found subtype: ${subtypeName}`, subtypeContent);

                types[subtypeName] = {
                    can_be_randomly_selected: !subtypeContent.includes('can_be_randomly_selected = no')
                };

                // Move to the next position
                currentIndex = blockEnd + 1;
            } else {
                // If we didn't find a closing brace, move forward
                currentIndex = blockStart + 1;
            }
        }

        console.log('Parsed subtypes:', Object.keys(types));
        return types;
    }

    extractColor(content) {
        const colorMatch = content.match(/color\s*=\s*\{\s*(\d+)\s*(\d+)\s*(\d+)\s*\}/);
        if (colorMatch) {
            const [r, g, b] = colorMatch.slice(1, 4).map(Number);
            return this.rgbToHex(r, g, b);
        }
        return '#808080';
    }

    extractBlock(content, blockName) {
        const regex = new RegExp(blockName + '\\s*=\\s*{', 'g');
        let match;
        let blocks = [];

        while ((match = regex.exec(content)) !== null) {
            let braceCount = 1;
            let start = match.index + match[0].length;
            let end = start;

            while (braceCount > 0 && end < content.length) {
                if (content[end] === '{') braceCount++;
                if (content[end] === '}') braceCount--;
                end++;
            }

            if (braceCount === 0) {
                const blockContent = content.substring(start, end - 1).trim();
                blocks.push(blockContent);
            }
        }

        return blocks.length > 0 ? blocks[0] : '';
    }

    extractArray(content, arrayName) {
        const regex = new RegExp(arrayName + '\\s*=\\s*{', 'g');
        let match;
        let arrays = [];

        while ((match = regex.exec(content)) !== null) {
            let braceCount = 1;
            let start = match.index + match[0].length;
            let end = start;

            while (braceCount > 0 && end < content.length) {
                if (content[end] === '{') braceCount++;
                if (content[end] === '}') braceCount--;
                end++;
            }

            if (braceCount === 0) {
                const arrayContent = content.substring(start, end - 1);
                const items = arrayContent.split('\n')
                    .map(line => line.trim().replace(/"/g, ''))
                    .filter(line => line && !line.startsWith('#'));
                arrays.push(...items);
            }
        }

        return arrays;
    }

    extractNumber(content, key, defaultValue = 0) {
        const regex = new RegExp(key + '\\s*=\\s*([0-9.]+)');
        const match = content.match(regex);
        return match ? parseFloat(match[1]) : defaultValue;
    }

    parseLocalizationFile(content) {
        this.localization = {};
        const lines = content.split('\n');

        lines.forEach(line => {
            // Handle both .yml and .txt formats
            if (line.includes(':0 "') || line.includes(':0"')) {
                const parts = line.split(/:\d+"?/);
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts[1].replace(/"/g, '').trim();
                    if (key && value) {
                        this.localization[key] = value;
                    }
                }
            }
        });
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 128, g: 128, b: 128 };
    }

    init() {
        this.container.html(`
            <div class="d-flex flex-column h-100">
                <div class="bg-dark border-bottom border-secondary p-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">
                            <i class="bi bi-journal-text me-2"></i>Ideology Editor
                        </h5>
                        <div>
                            <button class="btn btn-success btn-sm me-2" id="save-ideologies-btn">
                                <i class="bi bi-save me-1"></i>Save All
                            </button>
                            <button class="btn btn-primary btn-sm" id="new-ideology-btn">
                                <i class="bi bi-plus-circle me-1"></i>New Ideology
                            </button>
                        </div>
                    </div>
                </div>

                <!-- SUBTYPE EDIT MODAL -->
                <div class="modal fade" id="subtype-edit-modal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content bg-dark text-light">
                            <div class="modal-header border-secondary">
                                <h5 class="modal-title">Edit Subtype</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label">Display Name</label>
                                    <input type="text" class="form-control bg-dark text-light border-secondary"
                                           id="edit-subtype-name" placeholder="Display name in game">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Description</label>
                                    <textarea class="form-control bg-dark text-light border-secondary"
                                              id="edit-subtype-description" rows="3" placeholder="Description shown in game"></textarea>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="edit-subtype-random">
                                    <label class="form-check-label">Can be randomly selected</label>
                                </div>
                            </div>
                            <div class="modal-footer border-secondary">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" id="save-subtype-changes">
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="d-flex flex-grow-1">
                    <!-- Sidebar - Ideology List -->
                    <div class="col-md-3 bg-dark border-end border-secondary p-3">
                        <div class="list-group" id="ideology-list">
                            <div class="text-muted text-center">Loading...</div>
                        </div>
                    </div>

                    <!-- Main Editor -->
                    <div class="col-md-9 bg-dark p-3" id="ideology-editor">
                        <div class="text-center text-muted mt-5">
                            <i class="bi bi-journal-text display-4"></i>
                            <p>Select an ideology to edit</p>
                        </div>
                    </div>
                </div>
            </div>
        `);

        this.setupEventListeners();
        this.setupSubtypeModal();
    }

    setupEventListeners() {
        $('#new-ideology-btn').on('click', () => this.createNewIdeology());
        $('#save-ideologies-btn').on('click', () => this.saveAll());
    }

    setupSubtypeModal() {
        this.subtypeModal = new bootstrap.Modal(document.getElementById('subtype-edit-modal'));
        this.editingSubtype = null;

        $('#save-subtype-changes').on('click', () => this.saveSubtypeChanges());
    }

    renderIdeologyList() {
        const list = $('#ideology-list');
        list.empty();

        if (Object.keys(this.ideologies).length === 0) {
            list.html('<div class="text-muted text-center">No ideologies found</div>');
            return;
        }

        Object.keys(this.ideologies).forEach(ideologyName => {
            const item = $(`
                <button class="list-group-item list-group-item-action bg-dark text-light border-secondary ideology-item"
                        data-ideology="${ideologyName}">
                    <div class="d-flex align-items-center">
                        <div class="color-preview me-2" style="width: 16px; height: 16px; background-color: ${this.ideologies[ideologyName].color}; border: 1px solid #666;"></div>
                        ${ideologyName}
                    </div>
                </button>
            `);

            item.on('click', () => this.editIdeology(ideologyName));
            list.append(item);
        });
    }

    editIdeology(ideologyName) {
        this.currentIdeology = ideologyName;
        const ideology = this.ideologies[ideologyName];

        $('#ideology-editor').html(`
            <div class="ideology-form">
                <h4 class="mb-3">Editing: ${ideologyName}</h4>

                <div class="row mb-3">
                    <div class="col-md-6">
                        <label class="form-label">Color</label>
                        <input type="color" class="form-control form-control-color"
                               id="ideology-color" value="${ideology.color}">
                    </div>
                </div>

                <!-- AI Behavior -->
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label class="form-label">AI Behavior</label>
                        <select class="form-select bg-dark text-light border-secondary" id="ai-behavior">
                            <option value="neutral" ${ideology.ai_neutral ? 'selected' : ''}>Neutral</option>
                            <option value="democratic" ${ideology.ai_democratic ? 'selected' : ''}>Democratic</option>
                            <option value="communist" ${ideology.ai_communist ? 'selected' : ''}>Communist</option>
                            <option value="fascist" ${ideology.ai_fascist ? 'selected' : ''}>Fascist</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Wanted Units Factor</label>
                        <input type="number" step="0.01" class="form-control bg-dark text-light border-secondary"
                               id="wanted-units-factor" value="${ideology.wanted_units_factor}">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Core Control Threshold</label>
                        <input type="number" class="form-control bg-dark text-light border-secondary"
                               id="core-control-threshold" value="${ideology.core_control_threshold}">
                    </div>
                </div>

                <!-- World Tension Impacts -->
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label class="form-label">War Impact on World Tension</label>
                        <input type="number" step="0.01" class="form-control bg-dark text-light border-secondary"
                               id="war-impact" value="${ideology.war_impact || 0.5}">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Faction Impact on World Tension</label>
                        <input type="number" step="0.01" class="form-control bg-dark text-light border-secondary"
                               id="faction-impact" value="${ideology.faction_impact || 0.5}">
                    </div>
                </div>

                <!-- Subtypes -->
                <div class="mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <label class="form-label">Subtypes</label>
                        <button class="btn btn-sm btn-outline-primary" id="add-subtype-btn">
                            <i class="bi bi-plus me-1"></i>Add Subtype
                        </button>
                    </div>
                    <div id="subtypes-list" class="border border-secondary rounded p-2 bg-dark">
                        ${this.renderSubtypesWithDescriptions(ideology.types, ideologyName)}
                    </div>
                </div>

                <!-- Rules and Modifiers (smaller textareas) -->
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label class="form-label">Rules</label>
                        <textarea class="form-control bg-dark text-light border-secondary"
                                  rows="3" id="ideology-rules" placeholder="can_force_government = yes&#10;can_send_volunteers = no">${ideology.rules}</textarea>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Modifiers</label>
                        <textarea class="form-control bg-dark text-light border-secondary"
                                  rows="3" id="ideology-modifiers" placeholder="generate_wargoal_tension = 1.0&#10;join_faction_tension = 0.8">${ideology.modifiers}</textarea>
                    </div>
                </div>

                <!-- Collaboration -->
                <div class="mb-3 form-check">
                    <input type="checkbox" class="form-check-input" id="ideology-can-collaborate"
                           ${ideology.can_collaborate ? 'checked' : ''}>
                    <label class="form-check-label" for="ideology-can-collaborate">
                        Can Collaborate (can_collaborate = yes)
                    </label>
                </div>
            </div>
        `);

        this.setupIdeologyEventListeners();
    }

    renderSubtypesWithDescriptions(types, ideologyName) {
        if (Object.keys(types).length === 0) {
            return '<div class="text-muted">No subtypes - first one will be created automatically</div>';
        }

        let html = '';
        Object.keys(types).forEach(subtypeName => {
            const displayName = this.getSubtypeDisplayName(subtypeName);
            const canBeRandom = types[subtypeName].can_be_randomly_selected;

            html += `
                <div class="subtype-item border border-secondary rounded p-2 mb-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <strong>${subtypeName}</strong>
                            <br>
                            <small class="text-muted">
                                ${displayName}
                                ${canBeRandom ? '(random)' : '(not random)'}
                            </small>
                        </div>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary edit-subtype" data-subtype="${subtypeName}">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button class="btn btn-outline-danger remove-subtype" data-subtype="${subtypeName}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        return html;
    }

    getSubtypeDisplayName(subtypeName) {
        return this.localization[subtypeName] || subtypeName.replace(/_/g, ' ').replace(/_subtype$/, '');
    }

    getSubtypeDescription(subtypeName) {
        return this.localization[subtypeName + '_desc'] || 'Placeholder for user to edit later.';
    }

    setupIdeologyEventListeners() {
        $('#add-subtype-btn').on('click', () => this.addSubtype());
        $('.remove-subtype').on('click', (e) => {
            const subtypeName = $(e.target).closest('button').data('subtype');
            this.removeSubtype(subtypeName);
        });

        // Handle edit subtype buttons
        $('.edit-subtype').on('click', (e) => {
            const subtypeName = $(e.target).closest('button').data('subtype');
            this.openSubtypeEditor(subtypeName);
        });
    }

    openSubtypeEditor(subtypeName) {
        this.editingSubtype = subtypeName;

        const displayName = this.getSubtypeDisplayName(subtypeName);
        const description = this.getSubtypeDescription(subtypeName);
        const canBeRandom = this.ideologies[this.currentIdeology].types[subtypeName].can_be_randomly_selected;

        $('#edit-subtype-name').val(displayName);
        $('#edit-subtype-description').val(description);
        $('#edit-subtype-random').prop('checked', canBeRandom);

        this.subtypeModal.show();
    }

    saveSubtypeChanges() {
        if (!this.editingSubtype) return;

        const newDisplayName = $('#edit-subtype-name').val();
        const newDescription = $('#edit-subtype-description').val();
        const canBeRandom = $('#edit-subtype-random').is(':checked');

        // Update localization
        this.localization[this.editingSubtype] = newDisplayName;
        this.localization[this.editingSubtype + '_desc'] = newDescription;

        // Update random selection
        this.ideologies[this.currentIdeology].types[this.editingSubtype].can_be_randomly_selected = canBeRandom;

        this.subtypeModal.hide();
        this.editIdeology(this.currentIdeology); // Refresh the view
    }

    addSubtype() {
        const subtypeName = prompt('Enter subtype name (will be converted to lowercase with underscores):');
        if (!subtypeName) return;

        const formattedName = subtypeName.toLowerCase().replace(/\s+/g, '_') + '_subtype';

        if (this.ideologies[this.currentIdeology].types[formattedName]) {
            alert('Subtype already exists!');
            return;
        }

        // Add to ideology types
        this.ideologies[this.currentIdeology].types[formattedName] = {
            can_be_randomly_selected: false
        };

        // Add to localization with proper defaults
        this.localization[formattedName] = subtypeName.replace(/_/g, ' ');
        this.localization[formattedName + '_desc'] = 'Placeholder description - edit me!';

        // Refresh the editor to show the new subtype with editable fields
        this.editIdeology(this.currentIdeology);
    }

    removeSubtype(subtypeName) {
        if (confirm(`Remove subtype ${subtypeName}? This will also remove its localization.`)) {
            delete this.ideologies[this.currentIdeology].types[subtypeName];
            delete this.localization[subtypeName];
            delete this.localization[subtypeName + '_desc'];
            this.editIdeology(this.currentIdeology);
        }
    }

    updateCurrentIdeologyFromForm() {
        if (!this.currentIdeology) return;

        const ideology = this.ideologies[this.currentIdeology];

        // Read all form values
        ideology.color = $('#ideology-color').val();
        ideology.rules = $('#ideology-rules').val();
        ideology.modifiers = $('#ideology-modifiers').val();
        ideology.can_collaborate = $('#ideology-can-collaborate').is(':checked');
        ideology.war_impact = parseFloat($('#war-impact').val()) || 0.5;
        ideology.faction_impact = parseFloat($('#faction-impact').val()) || 0.5;
        ideology.wanted_units_factor = parseFloat($('#wanted-units-factor').val()) || 1.0;
        ideology.core_control_threshold = parseInt($('#core-control-threshold').val()) || 0;

        // AI behavior
        const aiBehavior = $('#ai-behavior').val();
        ideology.ai_neutral = aiBehavior === 'neutral';
        ideology.ai_democratic = aiBehavior === 'democratic';
        ideology.ai_communist = aiBehavior === 'communist';
        ideology.ai_fascist = aiBehavior === 'fascist';
    }

    createNewIdeology() {
        const ideologyName = prompt('Enter new ideology name (will be converted to lowercase):');
        if (!ideologyName) return;

        const formattedName = ideologyName.toLowerCase().replace(/\s+/g, '_');

        if (this.ideologies[formattedName]) {
            alert('Ideology already exists!');
            return;
        }

        // Create new ideology with proper template
        this.ideologies[formattedName] = {
            rawContent: '',
            types: {
                [`${formattedName}_subtype`]: { can_be_randomly_selected: false }
            },
            color: '#808080',
            rules: 'can_force_government = no\ncan_puppet = no\ncan_send_volunteers = no',
            modifiers: 'generate_wargoal_tension = 1.0\njoin_faction_tension = 0.8',
            can_collaborate: false,
            dynamic_faction_names: [`"FACTION_NAME_${formattedName.toUpperCase()}_1"`],
            war_impact: 0.5,
            faction_impact: 0.5,
            ai_neutral: true,
            ai_democratic: false,
            ai_communist: false,
            ai_fascist: false,
            wanted_units_factor: 1.0,
            core_control_threshold: 0
        };

        // Add to localization
        this.localization[`${formattedName}_subtype`] = ideologyName;
        this.localization[`${formattedName}_subtype_desc`] = 'Placeholder for user to edit later.';

        this.renderIdeologyList();
        this.editIdeology(formattedName);
    }

    async saveAll() {
        try {
            // Update current ideology from form before saving
            this.updateCurrentIdeologyFromForm();

            await this.saveIdeologiesFile();
            await this.saveLocalizationFile();
            alert('Ideologies and localization saved successfully!');
        } catch (error) {
            alert('Failed to save: ' + error.message);
        }
    }

    async saveIdeologiesFile() {
        let content = "ideologies = {\n\n";

        Object.keys(this.ideologies).forEach(ideologyName => {
            const ideology = this.ideologies[ideologyName];
            const rgb = this.hexToRgb(ideology.color);

            content += `\t${ideologyName} = {\n`;

            // Types
            if (Object.keys(ideology.types).length > 0) {
                content += `\t\ttypes = {\n`;
                Object.keys(ideology.types).forEach(subtypeName => {
                    content += `\t\t\t${subtypeName} = {`;
                    if (!ideology.types[subtypeName].can_be_randomly_selected) {
                        content += ` can_be_randomly_selected = no`;
                    }
                    content += ` }\n`;
                });
                content += `\t\t}\n\n`;
            }

            // Dynamic faction names
            if (ideology.dynamic_faction_names && ideology.dynamic_faction_names.length > 0) {
                content += `\t\tdynamic_faction_names = {\n`;
                ideology.dynamic_faction_names.forEach(name => {
                    content += `\t\t\t"${name.replace(/"/g, '')}"\n`;
                });
                content += `\t\t}\n\n`;
            }

            // Color
            content += `\t\tcolor = { ${rgb.r} ${rgb.g} ${rgb.b} }\n\n`;

            // World tension impacts
            content += `\t\twar_impact_on_world_tension = ${ideology.war_impact}\n`;
            content += `\t\tfaction_impact_on_world_tension = ${ideology.faction_impact}\n\n`;

            // Rules
            if (ideology.rules.trim()) {
                content += `\t\trules = {\n`;
                ideology.rules.split('\n').forEach(line => {
                    if (line.trim()) content += `\t\t\t${line.trim()}\n`;
                });
                content += `\t\t}\n\n`;
            }

            // Modifiers
            if (ideology.modifiers.trim()) {
                content += `\t\tmodifiers = {\n`;
                ideology.modifiers.split('\n').forEach(line => {
                    if (line.trim()) content += `\t\t\t${line.trim()}\n`;
                });
                content += `\t\t}\n\n`;
            }

            // Collaboration
            if (ideology.can_collaborate) {
                content += `\t\tcan_collaborate = yes\n\n`;
            }

            // AI behavior
            if (ideology.ai_neutral) content += `\t\tai_neutral = yes\n`;
            if (ideology.ai_democratic) content += `\t\tai_democratic = yes\n`;
            if (ideology.ai_communist) content += `\t\tai_communist = yes\n`;
            if (ideology.ai_fascist) content += `\t\tai_fascist = yes\n`;

            // AI factors
            content += `\t\tai_ideology_wanted_units_factor = ${ideology.wanted_units_factor}\n`;
            content += `\t\tai_give_core_state_control_threshold = ${ideology.core_control_threshold}\n`;

            content += `\t}\n\n`;
        });

        content += "}";

        const response = await fetch('/api/save_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: this.filePath,
                content: content
            })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error);
        }
    }

    async saveLocalizationFile() {
        let content = 'l_english:\n';

        // Add all localization entries
        Object.keys(this.localization).forEach(key => {
            content += ` ${key}:0 "${this.localization[key]}"\n`;
        });

        const localizationPath = 'localization/ideologies_l_english.yml';
        const response = await fetch('/api/save_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: localizationPath,
                content: content
            })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error);
        }
    }
}
