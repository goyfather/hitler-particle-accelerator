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
        
        self.provinces = {}
        self.states = {}
        self.province_to_state = {}
        
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
            os.makedirs(self.map_dir, exist_ok=True)
            os.makedirs(self.states_dir, exist_ok=True)
            
            game_definition = os.path.join(hoi4_dir, "map", "definition.csv")
            if os.path.exists(game_definition):
                shutil.copy2(game_definition, self.definition_csv)
            else:
                return False, "definition.csv not found in game directory"
            
            game_provinces = os.path.join(hoi4_dir, "map", "provinces.bmp")
            if os.path.exists(game_provinces):
                shutil.copy2(game_provinces, self.provinces_bmp)
            else:
                return False, "provinces.bmp not found in game directory"
            
            game_states = os.path.join(hoi4_dir, "history", "states")
            if os.path.exists(game_states):
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
                next(reader)
                
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
            return False, None
    
    def get_province_color_map(self):
        """Create a map of RGB color -> province ID"""
        color_map = {}
        for prov_id, data in self.provinces.items():
            color_key_str = f"{data['r']},{data['g']},{data['b']}"
            color_map[color_key_str] = prov_id
        return color_map
    
    def parse_state_file(self, filepath):
        """Parse a single state file with enhanced data extraction"""
        try:
            with open(filepath, 'r', encoding='utf-8-sig', errors='ignore') as f:
                content = f.read()
            
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
            else:
                state_data['manpower'] = 1000
            
            # Extract state category
            category_match = re.search(r'state_category\s*=\s*(\w+)', content)
            if category_match:
                state_data['state_category'] = category_match.group(1)
            else:
                state_data['state_category'] = 'rural'
            
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
            
            # Extract resources
            resources = {}
            resources_match = re.search(r'resources\s*=\s*\{([^}]*)\}', content)
            if resources_match:
                res_content = resources_match.group(1)
                for res_line in res_content.split('\n'):
                    res_match = re.search(r'(\w+)\s*=\s*(\d+(?:\.\d+)?)', res_line)
                    if res_match:
                        resources[res_match.group(1)] = float(res_match.group(2))
            state_data['resources'] = resources
            
            # Extract cores
            cores = []
            for core_match in re.finditer(r'add_core_of\s*=\s*(\w+)', content):
                cores.append(core_match.group(1))
            state_data['cores'] = cores
            
            # Extract claims
            claims = []
            for claim_match in re.finditer(r'add_claim_by\s*=\s*(\w+)', content):
                claims.append(claim_match.group(1))
            state_data['claims'] = claims
            
            # Extract buildings
            buildings = {'infrastructure': 0, 'industrial_complex': 0, 'air_base': 0, 
                        'naval_base': 0, 'synthetic_refinery': 0, 'fuel_silo': 0}
            
            # General buildings
            for building_type in buildings.keys():
                building_match = re.search(rf'{building_type}\s*=\s*(\d+)', content)
                if building_match:
                    buildings[building_type] = int(building_match.group(1))
            
            state_data['buildings'] = buildings
            
            # Extract victory points
            victory_points = []
            for vp_match in re.finditer(r'victory_points\s*=\s*\{\s*(\d+)\s+(\d+)\s*\}', content):
                victory_points.append({
                    'province': int(vp_match.group(1)),
                    'value': int(vp_match.group(2))
                })
            state_data['victory_points'] = victory_points
            
            return state_data
            
        except Exception as e:
            print(f"Error parsing state file {filepath}: {e}")
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
                        
                        for prov_id in state_data.get('provinces', []):
                            self.province_to_state[prov_id] = state_id
            
            return True, f"Loaded {len(self.states)} states"
        except Exception as e:
            return False, f"Error loading states: {str(e)}"
    
    def get_province_state(self, province_id):
        """Get which state a province belongs to"""
        return self.province_to_state.get(province_id)
    
    def create_new_state(self, province_id=None, owner_tag="XXX", name=None):
        """Create a new state"""
        # Find next available state ID
        if self.states:
            new_id = max(self.states.keys()) + 1
        else:
            new_id = 1
        
        provinces = []
        if province_id:
            self.remove_province_from_states(province_id)
            provinces = [province_id]
        
        state_data = {
            'id': new_id,
            'name': name or f'STATE_{new_id}',
            'manpower': 1000,
            'state_category': 'rural',
            'owner': owner_tag,
            'provinces': provinces,
            'file': f'{new_id}-New_State.txt',
            'resources': {},
            'cores': [],
            'claims': [],
            'buildings': {'infrastructure': 1, 'industrial_complex': 0, 'air_base': 0,
                         'naval_base': 0, 'synthetic_refinery': 0, 'fuel_silo': 0},
            'victory_points': []
        }
        
        state_data['raw_content'] = self.generate_state_content(state_data)
        
        self.states[new_id] = state_data
        if province_id:
            self.province_to_state[province_id] = new_id
        
        return new_id
    
    def update_state_properties(self, state_id, properties):
        """Update state properties"""
        if state_id not in self.states:
            return False, "State not found"
        
        state = self.states[state_id]
        
        # Update all provided properties
        if 'name' in properties:
            state['name'] = properties['name']
        if 'manpower' in properties:
            state['manpower'] = int(properties['manpower'])
        if 'state_category' in properties:
            state['state_category'] = properties['state_category']
        if 'owner' in properties:
            state['owner'] = properties['owner']
        if 'resources' in properties:
            state['resources'] = properties['resources']
        if 'cores' in properties:
            state['cores'] = properties['cores']
        if 'claims' in properties:
            state['claims'] = properties['claims']
        if 'buildings' in properties:
            state['buildings'] = properties['buildings']
        if 'victory_points' in properties:
            state['victory_points'] = properties['victory_points']
        
        # Regenerate file content
        state['raw_content'] = self.generate_state_content(state)
        
        return True, "State updated successfully"
    
    def add_province_to_state(self, state_id, province_id):
        """Add a province to a state, removing it from any previous state"""
        if state_id not in self.states:
            return False, "Target state not found"
        
        # Check if province is already in this state
        if province_id in self.states[state_id]['provinces']:
            return True, f"Province {province_id} is already in state {state_id}"
        
        # Remove province from old state if it exists
        old_state_id = self.province_to_state.get(province_id)
        if old_state_id and old_state_id in self.states:
            # Remove from old state
            if province_id in self.states[old_state_id]['provinces']:
                self.states[old_state_id]['provinces'].remove(province_id)
                # Regenerate and save old state
                self.states[old_state_id]['raw_content'] = self.generate_state_content(
                    self.states[old_state_id]
                )
                self.save_state(old_state_id)
                print(f"Removed province {province_id} from state {old_state_id}")
        
        # Add to new state
        self.states[state_id]['provinces'].append(province_id)
        self.province_to_state[province_id] = state_id
        
        # Regenerate new state content
        self.states[state_id]['raw_content'] = self.generate_state_content(self.states[state_id])
        
        # Save new state
        success, message = self.save_state(state_id)
        
        if success:
            return True, f"Province {province_id} moved to state {state_id}"
        else:
            return False, f"Failed to save state: {message}"
    
    def remove_province_from_states(self, province_id):
        """Remove a province from any state it belongs to"""
        if province_id in self.province_to_state:
            old_state_id = self.province_to_state[province_id]
            if old_state_id in self.states:
                self.states[old_state_id]['provinces'].remove(province_id)
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
        
        # Build resources section
        resources_str = ""
        if state_data.get('resources'):
            resources_str = "\tresources={\n"
            for resource, amount in state_data['resources'].items():
                resources_str += f"\t\t{resource} = {amount}\n"
            resources_str += "\t}\n"
        else:
            resources_str = "\tresources={\n\t}\n"
        
        # Build buildings section
        buildings = state_data.get('buildings', {})
        buildings_str = "\t\tbuildings = {\n"
        if buildings.get('infrastructure', 0) > 0:
            buildings_str += f"\t\t\tinfrastructure = {buildings['infrastructure']}\n"
        if buildings.get('industrial_complex', 0) > 0:
            buildings_str += f"\t\t\tindustrial_complex = {buildings['industrial_complex']}\n"
        if buildings.get('air_base', 0) > 0:
            buildings_str += f"\t\t\tair_base = {buildings['air_base']}\n"
        if buildings.get('naval_base', 0) > 0:
            buildings_str += f"\t\t\tnaval_base = {buildings['naval_base']}\n"
        if buildings.get('synthetic_refinery', 0) > 0:
            buildings_str += f"\t\t\tsynthetic_refinery = {buildings['synthetic_refinery']}\n"
        if buildings.get('fuel_silo', 0) > 0:
            buildings_str += f"\t\t\tfuel_silo = {buildings['fuel_silo']}\n"
        buildings_str += "\t\t}\n"
        
        # Build cores/claims section
        cores_str = ""
        for core in state_data.get('cores', []):
            cores_str += f"\t\tadd_core_of = {core}\n"
        
        claims_str = ""
        for claim in state_data.get('claims', []):
            claims_str += f"\t\tadd_claim_by = {claim}\n"
        
        # Build victory points section
        vp_str = ""
        for vp in state_data.get('victory_points', []):
            vp_str += f"\t\tvictory_points = {{\n\t\t\t{vp['province']} {vp['value']}\n\t\t}}\n"
        
        content = f"""state={{
\tid={state_data.get('id', 1)}
\tname="{state_data.get('name', 'STATE_1')}"
{resources_str}\thistory={{
\t\towner = {state_data.get('owner', 'XXX')}
{cores_str}{claims_str}{vp_str}{buildings_str}\t}}
\tprovinces={{
\t\t{provinces_str}
\t}}
\tmanpower = {state_data.get('manpower', 1000)}
\tstate_category = {state_data.get('state_category', 'rural')}
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
                'province_count': len(state_data.get('provinces', [])),
                'manpower': state_data.get('manpower', 0),
                'state_category': state_data.get('state_category', 'rural'),
                'resources': state_data.get('resources', {}),
                'cores': state_data.get('cores', []),
                'claims': state_data.get('claims', []),
                'buildings': state_data.get('buildings', {}),
                'victory_points': state_data.get('victory_points', [])
            })
        return summary
