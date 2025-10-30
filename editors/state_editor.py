import os
import re
import csv
import shutil
from PIL import Image
from pathlib import Path

class StateEditor:
    def __init__(self, project_root):
        self.project_root = project_root
        self.map_dir = os.path.join(project_root, "map")
        self.states_dir = os.path.join(project_root, "history", "states")
        
        self.definition_csv = os.path.join(self.map_dir, "definition.csv")
        self.provinces_bmp = os.path.join(self.map_dir, "provinces.bmp")
        
        self.provinces = {}  # province_id -> {r, g, b, type, coastal, terrain, continent}
        self.states = {}  # state_id -> state data
        self.province_to_state = {}  # province_id -> state_id
        
    def check_required_files(self):
        """Check if required map files exist"""
        missing = []
        if not os.path.exists(self.definition_csv):
            missing.append("map/definition.csv")
        if not os.path.exists(self.provinces_bmp):
            missing.append("map/provinces.bmp")
        return missing
    
    def find_hoi4_directory(self, search_path):
        """Validate HOI4 directory by checking for hoi4.exe"""
        hoi4_exe = os.path.join(search_path, "hoi4.exe")
        return os.path.exists(hoi4_exe)
    
    def copy_files_from_game(self, hoi4_dir):
        """Copy required files from HOI4 game directory to mod"""
        try:
            # Create directories if they don't exist
            os.makedirs(self.map_dir, exist_ok=True)
            os.makedirs(self.states_dir, exist_ok=True)
            
            # Copy definition.csv
            game_definition = os.path.join(hoi4_dir, "map", "definition.csv")
            if os.path.exists(game_definition):
                shutil.copy2(game_definition, self.definition_csv)
            else:
                return False, "definition.csv not found in game directory"
            
            # Copy provinces.bmp
            game_provinces = os.path.join(hoi4_dir, "map", "provinces.bmp")
            if os.path.exists(game_provinces):
                shutil.copy2(game_provinces, self.provinces_bmp)
            else:
                return False, "provinces.bmp not found in game directory"
            
            # Copy history/states/ directory
            game_states = os.path.join(hoi4_dir, "history", "states")
            if os.path.exists(game_states):
                # Copy all state files
                for file in os.listdir(game_states):
                    if file.endswith('.txt'):
                        src = os.path.join(game_states, file)
                        dst = os.path.join(self.states_dir, file)
                        shutil.copy2(src, dst)
            else:
                return False, "history/states/ not found in game directory"
            
            return True, "Files copied successfully"
            
        except Exception as e:
            return False, f"Error copying files: {str(e)}"
    
    def parse_definition_csv(self):
        """Parse definition.csv to get province data"""
        self.provinces = {}
        
        try:
            with open(self.definition_csv, 'r', encoding='utf-8-sig') as f:
                reader = csv.reader(f, delimiter=';')
                next(reader)  # Skip header
                
                for row in reader:
                    if len(row) < 8:
                        continue
                    
                    try:
                        province_id = int(row[0])
                        r = int(row[1])
                        g = int(row[2])
                        b = int(row[3])
                        prov_type = row[4].strip()
                        coastal = row[5].strip().lower() == 'true'
                        terrain = row[6].strip()
                        continent = int(row[7])
                        
                        self.provinces[province_id] = {
                            'r': r,
                            'g': g,
                            'b': b,
                            'type': prov_type,
                            'coastal': coastal,
                            'terrain': terrain,
                            'continent': continent,
                            'color_key': (r, g, b)
                        }
                    except (ValueError, IndexError):
                        continue
            
            return True, f"Parsed {len(self.provinces)} provinces"
        except Exception as e:
            return False, f"Error parsing definition.csv: {str(e)}"
    
    def load_provinces_image(self):
        """Load and process provinces.bmp"""
        try:
            img = Image.open(self.provinces_bmp)
            img = img.convert('RGB')
            return True, img
        except Exception as e:
            return False, None, f"Error loading provinces.bmp: {str(e)}"
    
    def get_province_color_map(self):
        """Create a map of RGB color -> province ID"""
        color_map = {}
        for prov_id, data in self.provinces.items():
            color_key = (data['r'], data['g'], data['b'])
            # Convert tuple to string key for JSON serialization
            color_key_str = f"{color_key[0]},{color_key[1]},{color_key[2]}"
            color_map[color_key_str] = prov_id
        return color_map
    
    def parse_state_file(self, filepath):
        """Parse a single state file"""
        try:
            with open(filepath, 'r', encoding='utf-8-sig', errors='ignore') as f:
                content = f.read()
            
            # Extract state data using regex
            state_data = {
                'file': os.path.basename(filepath),
                'raw_content': content
            }
            
            # Extract state ID
            id_match = re.search(r'id\s*=\s*(\d+)', content)
            if id_match:
                state_data['id'] = int(id_match.group(1))
            
            # Extract state name
            name_match = re.search(r'name\s*=\s*"([^"]+)"', content)
            if name_match:
                state_data['name'] = name_match.group(1)
            
            # Extract manpower
            manpower_match = re.search(r'manpower\s*=\s*(\d+)', content)
            if manpower_match:
                state_data['manpower'] = int(manpower_match.group(1))
            
            # Extract state category
            category_match = re.search(r'state_category\s*=\s*(\w+)', content)
            if category_match:
                state_data['state_category'] = category_match.group(1)
            
            # Extract owner
            owner_match = re.search(r'owner\s*=\s*(\w+)', content)
            if owner_match:
                state_data['owner'] = owner_match.group(1)
            
            # Extract provinces
            provinces_match = re.search(r'provinces\s*=\s*\{([^}]+)\}', content)
            if provinces_match:
                province_str = provinces_match.group(1)
                provinces = [int(p) for p in province_str.split() if p.isdigit()]
                state_data['provinces'] = provinces
            else:
                state_data['provinces'] = []
            
            return state_data
            
        except Exception as e:
            return None
    
    def load_all_states(self):
        """Load all state files from history/states/"""
        self.states = {}
        self.province_to_state = {}
        
        if not os.path.exists(self.states_dir):
            return False, "States directory not found"
        
        try:
            for filename in os.listdir(self.states_dir):
                if filename.endswith('.txt'):
                    filepath = os.path.join(self.states_dir, filename)
                    state_data = self.parse_state_file(filepath)
                    
                    if state_data and 'id' in state_data:
                        state_id = state_data['id']
                        self.states[state_id] = state_data
                        
                        # Map provinces to states
                        for prov_id in state_data.get('provinces', []):
                            self.province_to_state[prov_id] = state_id
            
            return True, f"Loaded {len(self.states)} states"
        except Exception as e:
            return False, f"Error loading states: {str(e)}"
    
    def get_province_state(self, province_id):
        """Get which state a province belongs to"""
        return self.province_to_state.get(province_id)
    
    def create_new_state(self, province_id, owner_tag="XXX"):
        """Create a new state with a single province"""
        # Find next available state ID
        if self.states:
            new_id = max(self.states.keys()) + 1
        else:
            new_id = 1
        
        # Remove province from any existing state
        self.remove_province_from_states(province_id)
        
        # Create new state
        state_data = {
            'id': new_id,
            'name': f'STATE_{new_id}',
            'manpower': 1000,
            'state_category': 'rural',
            'owner': owner_tag,
            'provinces': [province_id],
            'file': f'{new_id}-New_State.txt'
        }
        
        # Generate content
        state_data['raw_content'] = self.generate_state_content(state_data)
        
        self.states[new_id] = state_data
        self.province_to_state[province_id] = new_id
        
        return new_id
    
    def add_province_to_state(self, state_id, province_id):
        """Add a province to a state"""
        if state_id not in self.states:
            return False, "State not found"
        
        # Remove from other states first
        self.remove_province_from_states(province_id)
        
        # Add to this state
        if province_id not in self.states[state_id]['provinces']:
            self.states[state_id]['provinces'].append(province_id)
            self.province_to_state[province_id] = state_id
        
        # Update raw content
        self.states[state_id]['raw_content'] = self.generate_state_content(self.states[state_id])
        
        return True, "Province added to state"
    
    def remove_province_from_states(self, province_id):
        """Remove a province from any state it belongs to"""
        if province_id in self.province_to_state:
            old_state_id = self.province_to_state[province_id]
            if old_state_id in self.states:
                self.states[old_state_id]['provinces'].remove(province_id)
                # Update raw content
                self.states[old_state_id]['raw_content'] = self.generate_state_content(self.states[old_state_id])
            del self.province_to_state[province_id]
    
    def set_state_owner(self, state_id, owner_tag):
        """Set the owner of a state"""
        if state_id not in self.states:
            return False, "State not found"
        
        self.states[state_id]['owner'] = owner_tag
        self.states[state_id]['raw_content'] = self.generate_state_content(self.states[state_id])
        
        return True, f"State owner set to {owner_tag}"
    
    def generate_state_content(self, state_data):
        """Generate state file content from state data"""
        provinces_str = ' '.join(str(p) for p in state_data.get('provinces', []))
        
        content = f"""state={{
\tid={state_data.get('id', 1)}
\tname="{state_data.get('name', 'STATE_1')}"
\tmanpower = {state_data.get('manpower', 1000)}
\tresources={{
\t}}
\tstate_category = {state_data.get('state_category', 'rural')}
\thistory={{
\t\towner = {state_data.get('owner', 'XXX')}
\t\tbuildings = {{
\t\t\tinfrastructure = 1
\t\t}}
\t}}
\tprovinces={{
\t\t{provinces_str}
\t}}
\tlocal_supplies=0.0 
}}
"""
        return content
    
    def save_state(self, state_id):
        """Save a single state to file"""
        if state_id not in self.states:
            return False, "State not found"
        
        state_data = self.states[state_id]
        filepath = os.path.join(self.states_dir, state_data['file'])
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(state_data['raw_content'])
            return True, "State saved successfully"
        except Exception as e:
            return False, f"Error saving state: {str(e)}"

    def get_province_outlines(self):
        outlines = {}    
        for province_id, province_data in self.provinces.items():
            # For now, return basic province data - we'll enhance this later
            outlines[province_id] = {
                'type': province_data['type'],
                'color': [province_data['r'], province_data['g'], province_data['b']],
                'state_id': self.province_to_state.get(province_id)
            }
        
        return outlines
    def get_province_outlines_vector(self):
        """Extract province outlines as vector paths from the provinces image"""
        import numpy as np
        from PIL import Image, ImageDraw
        
        success, img = self.load_provinces_image()
        if not success:
            return {}
        
        # Convert to numpy array for processing
        img_array = np.array(img)
        height, width = img_array.shape[:2]
        
        outlines = {}
        
        # For each province, find its boundary
        for province_id, province_data in self.provinces.items():
            color = (province_data['r'], province_data['g'], province_data['b'])
            
            # Create a mask for this province
            mask = np.all(img_array == color, axis=2)
            
            if not np.any(mask):
                continue
                
            # Find the bounding box of the province
            rows = np.any(mask, axis=1)
            cols = np.any(mask, axis=0)
            ymin, ymax = np.where(rows)[0][[0, -1]]
            xmin, xmax = np.where(cols)[0][[0, -1]]
            
            # Extract the province region
            province_region = mask[ymin:ymax+1, xmin:xmax+1]
            
            # Find the outline using edge detection
            outline_points = self.trace_province_outline(province_region, xmin, ymin)
            
            if outline_points:
                outlines[province_id] = {
                    'points': outline_points,
                    'bounds': [xmin, ymin, xmax, ymax],
                    'type': province_data['type']
                }
        
        return outlines

    def trace_province_outline(self, region, offset_x, offset_y):
        """Trace the outline of a province region using Moore-Neighbor tracing"""
        try:
            # Find a starting point on the edge
            height, width = region.shape
            points = []
            
            # Simple approach: find the first white pixel and trace around it
            for y in range(height):
                for x in range(width):
                    if region[y, x]:
                        # Found a pixel, now trace the boundary
                        return self.moore_neighbor_trace(region, x, y, offset_x, offset_y)
            
            return []
        except Exception as e:
            print(f"Error tracing outline: {e}")
            return []

    def moore_neighbor_trace(self, region, start_x, start_y, offset_x, offset_y):
        """Moore-Neighbor boundary tracing algorithm"""
        # Directions: right, down, left, up, and diagonals
        directions = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
        
        points = []
        current = (start_x, start_y)
        first = current
        previous_direction = 0
        
        while True:
            points.append((current[0] + offset_x, current[1] + offset_y))
            
            # Look for the next boundary pixel
            found = False
            for i in range(8):
                direction = (previous_direction + i) % 8
                dx, dy = directions[direction]
                nx, ny = current[0] + dx, current[1] + dy
                
                # Check if this neighbor is within bounds and is part of the province
                if (0 <= nx < region.shape[1] and 0 <= ny < region.shape[0] and 
                    region[ny, nx]):
                    current = (nx, ny)
                    previous_direction = (direction + 5) % 8  # Back 2 steps in clockwise order
                    found = True
                    break
            
            if not found:
                break
                
            # Stop if we've returned to start
            if current == first and len(points) > 1:
                break
                
            # Prevent infinite loops
            if len(points) > 10000:
                break
        
        return points

    def find_province_edges(self):
        """Find edges between provinces for vector borders"""
        # This is a placeholder - in a real implementation, you'd use
        # image processing to trace province boundaries
        edges = []
        
        # Simple edge detection between provinces
        success, img = self.load_provinces_image()
        if not success:
            return edges
        
        width, height = img.size
        pixels = img.load()
        
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                current_color = pixels[x, y]
                current_province = self.get_province_from_color(current_color)
                
                # Check neighbors
                neighbors = [
                    (x-1, y), (x+1, y), (x, y-1), (x, y+1)
                ]
                
                for nx, ny in neighbors:
                    if 0 <= nx < width and 0 <= ny < height:
                        neighbor_color = pixels[nx, ny]
                        neighbor_province = self.get_province_from_color(neighbor_color)
                        
                        if current_province != neighbor_province:
                            edges.append({
                                'x1': x, 'y1': y,
                                'x2': nx, 'y2': ny,
                                'province1': current_province,
                                'province2': neighbor_province
                            })
        
        return edges

    def get_province_from_color(self, color):
        """Get province ID from RGB color"""
        color_key = f"{color[0]},{color[1]},{color[2]}"
        return self.color_map.get(color_key)
    
    def save_all_states(self):
        """Save all modified states"""
        saved_count = 0
        errors = []
        
        for state_id, state_data in self.states.items():
            success, message = self.save_state(state_id)
            if success:
                saved_count += 1
            else:
                errors.append(f"State {state_id}: {message}")
        
        if errors:
            return False, f"Saved {saved_count} states with errors: {'; '.join(errors)}"
        return True, f"Saved {saved_count} states successfully"
    
    def get_state_info(self, state_id):
        """Get information about a specific state"""
        return self.states.get(state_id)
    
    def get_all_states_summary(self):
        """Get summary of all states for frontend"""
        summary = []
        for state_id, state_data in self.states.items():
            summary.append({
                'id': state_id,
                'name': state_data.get('name', 'Unknown'),
                'owner': state_data.get('owner', 'None'),
                'provinces': state_data.get('provinces', []),
                'province_count': len(state_data.get('provinces', []))
            })
        return summary
