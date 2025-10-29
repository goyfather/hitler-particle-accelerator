class CountryEditor {
    constructor() {
        this.modal = null;
    }

    init() {
        this.createUI();
    }

    createUI() {
        // Add country editor button to sidebar - ONLY IF NOT EXISTS
        if (!$('#create-country-btn').length) {
            const countryButton = $(`
                <button class="btn btn-info w-100 mb-2" id="create-country-btn">
                    <i class="bi bi-flag me-2"></i>Create Country
                </button>
            `);
            
            $('#open-project-btn').after(countryButton);
            
            // Create modal for country creation
            this.createModal();
            
            // Bind event listeners
            $('#create-country-btn').on('click', () => this.openCountryCreator());
            $('#confirm-country-create').on('click', () => this.createCountry());
            $('#country-color-picker').on('input', (e) => this.updateColorPreview(e.target.value));
        }
    }

    createModal() {
        // Only create modal if it doesn't exist
        if (!$('#country-creator-modal').length) {
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
                            
                            <div class="alert alert-info">
                                <small>
                                    <i class="bi bi-info-circle me-1"></i>
                                    This will create a country file in <code>common/countries/</code> and 
                                    add the tag to <code>common/country_tags/00_countries.txt</code>
                                </small>
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
            this.modal = new bootstrap.Modal(document.getElementById('country-creator-modal'));
        }
    }

    openCountryCreator() {
        if (!window.editor?.currentProject) {
            alert('Please open a project first!');
            return;
        }
        
        // Reset form
        $('#country-tag').val('').prop('disabled', false);
        $('#country-name').val('');
        $('#country-color-picker').val('#3d85c6');
        $('#graphical-culture').val('western_european_gfx');
        $('#graphical-culture-2d').val('western_european_2d');
        this.updateColorPreview('#3d85c6');
        
        this.modal.show();
    }

    updateColorPreview(color) {
        $('#color-preview').css('background-color', color);
    }

    async createCountry() {
        // Prevent double submission
        if (this.isCreating) {
            return;
        }

        const tag = $('#country-tag').val().toUpperCase().trim();
        const name = $('#country-name').val().trim();
        const color = $('#country-color-picker').val();
        const graphicalCulture = $('#graphical-culture').val();
        const graphicalCulture2d = $('#graphical-culture-2d').val();

        // Validation
        if (!tag || !name) {
            alert('Please fill in all fields');
            return;
        }

        if (!/^[A-Z]{3}$/.test(tag)) {
            alert('Country tag must be exactly 3 uppercase letters');
            return;
        }

        this.isCreating = true;
        $('#confirm-country-create').prop('disabled', true).html('<i class="bi bi-hourglass me-1"></i>Creating...');

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
                this.modal.hide();
                
                // Refresh file tree to show new files
                if (window.editor.currentProject) {
                    // Re-open the project to refresh the file tree
                    const response = await fetch('/api/open_project', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: window.editor.currentProject })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        window.editor.renderFileTree(result.structure);
                    }
                }
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            alert('Failed to create country: ' + error.message);
        } finally {
            // Re-enable the button
            this.isCreating = false;
            $('#confirm-country-create').prop('disabled', false).html('<i class="bi bi-plus-circle me-1"></i>Create Country');
        }
    }
}