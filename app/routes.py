from flask import Blueprint, render_template, request, jsonify
import os
import json
import sys

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
