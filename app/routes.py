from flask import Blueprint, render_template, request, jsonify
import os
import json
import sys
from editors.state_editor import StateEditor
from io import BytesIO
import base64

# Add the editors directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from editors.country_editor import CountryCreator

main = Blueprint('main', __name__)

class ProjectManager:
    def __init__(self):
        self.current_project = None
    
    def open_project(self, folder_path):
        """Open a mod project folder identified by .mod file"""
        if not os.path.exists(folder_path):
            return False, "Path does not exist"
        
        # Look for .mod file
        mod_files = [f for f in os.listdir(folder_path) if f.endswith('.mod')]
        if not mod_files:
            return False, "No .mod file found in folder"
        
        self.current_project = folder_path
        return True, f"Project loaded: {os.path.basename(folder_path)}"
    
    def get_project_structure(self):
        """Get the file structure - SIMPLE AND WORKING VERSION"""
        if not self.current_project:
            return {}
        
        def build_tree(path):
            """Recursively build file tree"""
            name = os.path.basename(path)
            if path == self.current_project:
                name = "Root"
            
            item = {
                'name': name,
                'path': os.path.relpath(path, self.current_project),
                'type': 'folder',
                'children': []
            }
            
            try:
                # Get all items in this directory
                for entry in os.listdir(path):
                    # Skip hidden files and cache directories
                    if entry.startswith('.') or entry in ['__pycache__', 'cache']:
                        continue
                    
                    full_path = os.path.join(path, entry)
                    rel_path = os.path.relpath(full_path, self.current_project)
                    
                    if os.path.isdir(full_path):
                        # It's a folder - recurse into it
                        item['children'].append(build_tree(full_path))
                    else:
                        # It's a file - only include relevant types
                        if any(entry.endswith(ext) for ext in ['.txt', '.yml', '.yaml', '.gfx', '.gui', '.dds', '.tga', '.mod']):
                            item['children'].append({
                                'name': entry,
                                'path': rel_path,
                                'type': 'file'
                            })
            except PermissionError:
                pass
            
            # Sort: folders first, then files, both alphabetically
            item['children'].sort(key=lambda x: (x['type'] != 'folder', x['name'].lower()))
            
            return item
        
        return build_tree(self.current_project)

project_manager = ProjectManager()

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/api/open_project', methods=['POST'])
def open_project():
    data = request.get_json()
    folder_path = data.get('path', '').strip()
    
    if not folder_path:
        return jsonify({'success': False, 'error': 'No path provided'})
    
    success, message = project_manager.open_project(folder_path)
    
    if success:
        structure = project_manager.get_project_structure()
        return jsonify({
            'success': True,
            'message': message,
            'structure': structure
        })
    
    return jsonify({'success': False, 'error': message})

@main.route('/api/get_file_content', methods=['POST'])
def get_file_content():
    data = request.get_json()
    file_path = data.get('path')
    
    if project_manager.current_project:
        full_path = os.path.join(project_manager.current_project, file_path)
        if os.path.exists(full_path) and os.path.isfile(full_path):
            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                return jsonify({'success': True, 'content': content})
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)})
    
    return jsonify({'success': False, 'error': 'File not found'})

@main.route('/api/create_focus_tree', methods=['POST'])
def create_focus_tree():
    if not project_manager.current_project:
        return jsonify({'success': False, 'error': 'No project loaded'})
    
    data = request.get_json()
    name = data.get('name', '').strip()
    
    if not name:
        return jsonify({'success': False, 'error': 'Name is required'})
    
    # Create the national_focus directory if it doesn't exist
    focus_dir = os.path.join(project_manager.current_project, "common", "national_focus")
    os.makedirs(focus_dir, exist_ok=True)
    
    # Create the focus tree file
    file_path = os.path.join(focus_dir, f"{name}.txt")
    
    # Basic template for a focus tree file
    template = f"""focus_tree = {{
    id = "{name}"
    
    country = {{
        # Define which countries can use this focus tree
    }}
    
    # Add your focuses here
}}
"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(template)
        return jsonify({'success': True, 'message': f'Focus tree {name} created successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/create_country', methods=['POST'])
def create_country():
    """Create a new country using the CountryCreator class"""
    if not project_manager.current_project:
        return jsonify({'success': False, 'message': 'No project loaded'})
    
    data = request.get_json()
    tag = data.get('tag', '').strip()
    name = data.get('name', '').strip()
    color_hex = data.get('color', '#3d85c6').strip()
    graphical_culture = data.get('graphical_culture', 'western_european_gfx')
    graphical_culture_2d = data.get('graphical_culture_2d', 'western_european_2d')
    
    if not tag or not name:
        return jsonify({'success': False, 'message': 'Tag and name are required'})
    
    # Initialize country creator
    country_creator = CountryCreator(project_manager.current_project)
    
    # Validate and convert color
    color_rgb = country_creator.validate_color(color_hex)
    if not color_rgb:
        return jsonify({'success': False, 'message': 'Invalid color format'})
    
    # Create the country
    success, message = country_creator.create_country(
        tag=tag,
        name=name,
        color=color_rgb,
        graphical_culture=graphical_culture,
        graphical_culture_2d=graphical_culture_2d
    )
    
    return jsonify({'success': success, 'message': message})
state_editor = None

@main.route('/api/state_editor/check_files', methods=['POST'])
def check_state_files():
    """Check if required map files exist"""
    if not project_manager.current_project:
        return jsonify({'success': False, 'error': 'No project loaded'})
    
    global state_editor
    state_editor = StateEditor(project_manager.current_project)
    
    missing = state_editor.check_required_files()
    
    return jsonify({
        'success': True,
        'files_exist': len(missing) == 0,
        'missing_files': missing
    })

@main.route('/api/state_editor/validate_hoi4_dir', methods=['POST'])
def validate_hoi4_dir():
    """Validate HOI4 game directory"""
    data = request.get_json()
    hoi4_dir = data.get('path', '').strip()
    
    if not hoi4_dir:
        return jsonify({'success': False, 'error': 'No path provided'})
    
    global state_editor
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    is_valid = state_editor.find_hoi4_directory(hoi4_dir)
    
    return jsonify({'success': True, 'valid': is_valid})

@main.route('/api/state_editor/copy_game_files', methods=['POST'])
def copy_game_files():
    """Copy required files from HOI4 game directory"""
    data = request.get_json()
    hoi4_dir = data.get('path', '').strip()
    
    if not hoi4_dir:
        return jsonify({'success': False, 'error': 'No path provided'})
    
    global state_editor
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    success, message = state_editor.copy_files_from_game(hoi4_dir)
    
    return jsonify({'success': success, 'message': message})

@main.route('/api/state_editor/initialize', methods=['POST'])
def initialize_state_editor():
    """Initialize the state editor - parse files and load data"""
    global state_editor
    
    if not project_manager.current_project:
        return jsonify({'success': False, 'error': 'No project loaded'})
    
    if not state_editor:
        state_editor = StateEditor(project_manager.current_project)
    
    # Parse definition.csv
    success, message = state_editor.parse_definition_csv()
    if not success:
        return jsonify({'success': False, 'error': message})
    
    # Load all states
    success, message = state_editor.load_all_states()
    if not success:
        return jsonify({'success': False, 'error': message})
    
    # Get summary data
    states_summary = state_editor.get_all_states_summary()
    
    return jsonify({
        'success': True,
        'province_count': len(state_editor.provinces),
        'state_count': len(state_editor.states),
        'states': states_summary
    })

@main.route('/api/state_editor/get_map_image', methods=['POST'])
def get_map_image():
    """Get the provinces.bmp as base64 for frontend rendering"""
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        success, img = state_editor.load_provinces_image()
        if not success:
            return jsonify({'success': False, 'error': 'Failed to load image'})
        
        # Convert to base64
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_str}',
            'width': img.width,
            'height': img.height
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/get_province_data', methods=['POST'])
def get_province_data():
    """Get all province data for frontend"""
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    return jsonify({
        'success': True,
        'provinces': state_editor.provinces,
        'color_map': state_editor.get_province_color_map()
    })

@main.route('/api/state_editor/get_province_at_pixel', methods=['POST'])
def get_province_at_pixel():
    """Get province ID at specific pixel coordinates"""
    data = request.get_json()
    x = data.get('x')
    y = data.get('y')
    
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        success, img = state_editor.load_provinces_image()
        if not success:
            return jsonify({'success': False, 'error': 'Failed to load image'})
        
        # Get pixel color
        pixel = img.getpixel((x, y))
        
        # Find matching province
        color_map = state_editor.get_province_color_map()
        province_id = color_map.get(pixel)
        
        if province_id:
            # Get state info
            state_id = state_editor.get_province_state(province_id)
            state_info = None
            if state_id:
                state_info = state_editor.get_state_info(state_id)
            
            return jsonify({
                'success': True,
                'province_id': province_id,
                'state_id': state_id,
                'state_info': state_info
            })
        else:
            return jsonify({'success': False, 'error': 'No province at this location'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/create_state', methods=['POST'])
def create_state():
    """Create a new state with a province"""
    data = request.get_json()
    province_id = data.get('province_id')
    owner_tag = data.get('owner_tag', 'XXX')
    
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        new_state_id = state_editor.create_new_state(province_id, owner_tag)
        success, message = state_editor.save_state(new_state_id)
        
        return jsonify({
            'success': True,
            'state_id': new_state_id,
            'message': f'Created state {new_state_id}'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/get_country_colors', methods=['POST'])
def get_country_colors():
    """Get country colors from country definition files"""
    if not project_manager.current_project:
        return jsonify({'success': False, 'error': 'No project loaded'})
    
    colors = {}
    countries_dir = os.path.join(project_manager.current_project, 'common', 'countries')
    
    try:
        # First, read the country tags file
        tags_file = os.path.join(project_manager.current_project, 'common', 'country_tags', '00_countries.txt')
        if os.path.exists(tags_file):
            with open(tags_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Parse country tag assignments
            import re
            tag_pattern = re.compile(r'(\w{3})\s*=\s*"countries/([^"]+)"')
            matches = tag_pattern.findall(content)
            
            for tag, country_file in matches:
                country_path = os.path.join(countries_dir, country_file)
                if os.path.exists(country_path):
                    with open(country_path, 'r', encoding='utf-8') as cf:
                        country_content = cf.read()
                    
                    # Extract color
                    color_match = re.search(r'color\s*=\s*{\s*(\d+)\s*(\d+)\s*(\d+)\s*}', country_content)
                    if color_match:
                        r, g, b = map(int, color_match.groups())
                        colors[tag] = [r, g, b]
        
        return jsonify({'success': True, 'colors': colors})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/add_province_to_state', methods=['POST'])
def add_province_to_state():
    """Add a province to an existing state"""
    data = request.get_json()
    state_id = data.get('state_id')
    province_id = data.get('province_id')
    
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        success, message = state_editor.add_province_to_state(state_id, province_id)
        if success:
            state_editor.save_state(state_id)
        
        return jsonify({'success': success, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/set_state_owner', methods=['POST'])
def set_state_owner():
    """Set the owner of a state"""
    data = request.get_json()
    state_id = data.get('state_id')
    owner_tag = data.get('owner_tag')
    
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        success, message = state_editor.set_state_owner(state_id, owner_tag)
        if success:
            state_editor.save_state(state_id)
        
        return jsonify({'success': success, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/get_available_tags', methods=['POST'])
def get_available_tags():
    """Get list of available country tags"""
    if not project_manager.current_project:
        return jsonify({'success': False, 'error': 'No project loaded'})
    
    tags_file = os.path.join(project_manager.current_project, 'common', 'country_tags', '00_countries.txt')
    
    tags = []
    if os.path.exists(tags_file):
        try:
            with open(tags_file, 'r', encoding='utf-8') as f:
                content = f.read()
            # Extract tags
            import re
            tags = re.findall(r'^(\w{3})\s*=', content, re.MULTILINE)
        except:
            pass
    
    return jsonify({'success': True, 'tags': tags})

@main.route('/api/state_editor/get_province_outlines', methods=['POST'])
def get_province_outlines():
    """Get vector outlines for all provinces"""
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        # Generate outlines if not already done
        if not state_editor.province_outlines:
            success, message = state_editor.generate_province_outlines()
            if not success:
                return jsonify({'success': False, 'error': message})
        
        return jsonify({
            'success': True,
            'outlines': state_editor.province_outlines,
            'map_width': 5632,  # Standard HOI4 map dimensions
            'map_height': 2048
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/generate_outlines', methods=['POST'])
def generate_province_outlines():
    """Generate province outlines using vectorization"""
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        success, message = state_editor.generate_province_outlines()
        return jsonify({'success': success, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/save_all', methods=['POST'])
def save_all_states():
    """Save all modified states"""
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    success, message = state_editor.save_all_states()
    return jsonify({'success': success, 'message': message})

@main.route('/api/state_editor/update_state', methods=['POST'])
def update_state():
    """Update state properties"""
    data = request.get_json()
    state_id = data.get('state_id')
    properties = data.get('properties', {})
    
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        success, message = state_editor.update_state_properties(state_id, properties)
        
        if success:
            # Save the state immediately
            state_editor.save_state(state_id)
        
        return jsonify({'success': success, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/delete_state', methods=['POST'])
def delete_state():
    """Delete a state"""
    data = request.get_json()
    state_id = data.get('state_id')
    
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        if state_id not in state_editor.states:
            return jsonify({'success': False, 'error': 'State not found'})
        
        # Remove the state file
        state_data = state_editor.states[state_id]
        filepath = os.path.join(state_editor.states_dir, state_data['file'])
        
        if os.path.exists(filepath):
            os.remove(filepath)
        
        # Remove from memory
        for prov_id in state_data.get('provinces', []):
            if prov_id in state_editor.province_to_state:
                del state_editor.province_to_state[prov_id]
        
        del state_editor.states[state_id]
        
        return jsonify({'success': True, 'message': f'State {state_id} deleted'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/remove_province_from_state', methods=['POST'])
def remove_province_from_state():
    """Remove a province from a state"""
    data = request.get_json()
    state_id = data.get('state_id')
    province_id = data.get('province_id')
    
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        # Check if state exists
        if state_id not in state_editor.states:
            return jsonify({'success': False, 'error': 'State not found'})
        
        # Check if province is in the state
        if province_id not in state_editor.states[state_id]['provinces']:
            return jsonify({'success': False, 'error': 'Province not in this state'})
        
        # Remove the province
        state_editor.states[state_id]['provinces'].remove(province_id)
        
        # Update province-to-state mapping
        if province_id in state_editor.province_to_state:
            del state_editor.province_to_state[province_id]
        
        # Regenerate state file content
        state_editor.states[state_id]['raw_content'] = state_editor.generate_state_content(
            state_editor.states[state_id]
        )
        
        # Save the state
        success, message = state_editor.save_state(state_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Province {province_id} removed from state {state_id}'
            })
        else:
            return jsonify({'success': False, 'error': message})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/get_province_borders', methods=['POST'])
def get_province_borders():
    """Get province border data for rendering"""
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        success, img = state_editor.load_provinces_image()
        if not success:
            return jsonify({'success': False, 'error': 'Failed to load provinces image'})
        
        # Create a border detection image
        from PIL import Image, ImageDraw
        import numpy as np
        
        img_array = np.array(img)
        height, width = img_array.shape[:2]
        
        border_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(border_img)
        
        # Detect province borders
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                pixel = tuple(img_array[y, x, :3])
                
                # Check 4-directional neighbors
                neighbors = [
                    tuple(img_array[y-1, x, :3]),
                    tuple(img_array[y+1, x, :3]),
                    tuple(img_array[y, x-1, :3]),
                    tuple(img_array[y, x+1, :3])
                ]
                
                # If any neighbor is different, this is a border pixel
                if any(n != pixel for n in neighbors):
                    # Light gray for province borders
                    draw.point((x, y), fill=(180, 180, 180, 255))
        
        # Convert to base64
        buffered = BytesIO()
        border_img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_str}'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/state_editor/get_state_borders', methods=['POST'])
def get_state_borders():
    """Get state border data for rendering"""
    global state_editor
    
    if not state_editor:
        return jsonify({'success': False, 'error': 'State editor not initialized'})
    
    try:
        success, img = state_editor.load_provinces_image()
        if not success:
            return jsonify({'success': False, 'error': 'Failed to load provinces image'})
        
        from PIL import Image, ImageDraw
        import numpy as np
        
        img_array = np.array(img)
        height, width = img_array.shape[:2]
        
        border_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(border_img)
        
        # Create color to province mapping
        color_to_province = {}
        for prov_id, prov_data in state_editor.provinces.items():
            color = (prov_data['r'], prov_data['g'], prov_data['b'])
            color_to_province[color] = prov_id
        
        # Detect state borders
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                pixel = tuple(img_array[y, x, :3])
                prov_id = color_to_province.get(pixel)
                
                if not prov_id:
                    continue
                
                current_state = state_editor.province_to_state.get(prov_id)
                
                # Check 4-directional neighbors
                neighbors = [
                    (tuple(img_array[y-1, x, :3]), x, y-1),
                    (tuple(img_array[y+1, x, :3]), x, y+1),
                    (tuple(img_array[y, x-1, :3]), x-1, y),
                    (tuple(img_array[y, x+1, :3]), x+1, y)
                ]
                
                for neighbor_color, nx, ny in neighbors:
                    neighbor_prov = color_to_province.get(neighbor_color)
                    if not neighbor_prov:
                        continue
                    
                    neighbor_state = state_editor.province_to_state.get(neighbor_prov)
                    
                    # If different states, draw black border
                    if current_state != neighbor_state:
                        draw.point((x, y), fill=(0, 0, 0, 255))
                        break
        
        # Convert to base64
        buffered = BytesIO()
        border_img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_str}'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@main.route('/api/save_file', methods=['POST'])
def save_file():
    data = request.get_json()
    file_path = data.get('path')
    content = data.get('content')
    
    if project_manager.current_project and file_path:
        full_path = os.path.join(project_manager.current_project, file_path)
        try:
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    
    return jsonify({'success': False, 'error': 'No project loaded or invalid path'})
