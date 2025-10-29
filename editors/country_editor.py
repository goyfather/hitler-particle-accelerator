import os
import re
from pathlib import Path

class CountryCreator:
    def __init__(self, project_root):
        self.project_root = project_root
        self.countries_dir = os.path.join(project_root, "common", "countries")
        self.tags_file = os.path.join(project_root, "common", "country_tags", "00_countries.txt")
        
        # Available graphical cultures (from HOI4)
        self.graphical_cultures = [
            "western_european_gfx", "western_european_2d",
            "eastern_european_gfx", "eastern_european_2d", 
            "middle_eastern_gfx", "middle_eastern_2d",
            "asian_gfx", "asian_2d",
            "south_american_gfx", "south_american_2d",
            "african_gfx", "african_2d",
            "neutral_gfx", "neutral_2d",
            "generic_gfx", "generic_2d"
        ]
    
    def create_country(self, tag, name, color, graphical_culture, graphical_culture_2d=None):
        """Create a new country with given parameters"""
        if not graphical_culture_2d:
            graphical_culture_2d = graphical_culture.replace('_gfx', '_2d')
        
        # Validate tag
        if not re.match(r'^[A-Z]{3}$', tag):
            return False, "Tag must be exactly 3 uppercase letters"
        
        # Create countries directory if it doesn't exist
        os.makedirs(self.countries_dir, exist_ok=True)
        
        # Create country file
        country_file = os.path.join(self.countries_dir, f"{name.replace(' ', '_')}.txt")
        country_content = self._generate_country_file(color, graphical_culture, graphical_culture_2d)
        
        try:
            with open(country_file, 'w', encoding='utf-8') as f:
                f.write(country_content)
        except Exception as e:
            return False, f"Failed to create country file: {str(e)}"
        
        # Add to country tags
        tags_dir = os.path.dirname(self.tags_file)
        os.makedirs(tags_dir, exist_ok=True)
        
        tag_entry = f'{tag} = "countries/{os.path.basename(country_file)}"\n'
        
        try:
            # Read existing tags if file exists
            existing_tags = ""
            if os.path.exists(self.tags_file):
                with open(self.tags_file, 'r', encoding='utf-8') as f:
                    existing_tags = f.read()
            
            # Check if tag already exists
            if f'{tag} = ' in existing_tags:
                return False, f"Tag {tag} already exists in 00_countries.txt"
            
            # Append new tag
            with open(self.tags_file, 'a', encoding='utf-8') as f:
                f.write(tag_entry)
                
        except Exception as e:
            return False, f"Failed to update country tags: {str(e)}"
        
        return True, f"Country {name} ({tag}) created successfully!"
    
    def _generate_country_file(self, color, graphical_culture, graphical_culture_2d):
        """Generate the country file content"""
        r, g, b = color
        return f"""graphical_culture = {graphical_culture}
graphical_culture_2d = {graphical_culture_2d}

color = {{ {r} {g} {b} }}
"""
    
    def get_available_graphical_cultures(self):
        """Get list of available graphical cultures"""
        return [gc for gc in self.graphical_cultures if gc.endswith('_gfx')]
    
    def validate_color(self, color_string):
        """Validate and parse color string (can be RGB tuple or hex)"""
        try:
            if isinstance(color_string, str) and color_string.startswith('#'):
                # Hex color
                hex_color = color_string.lstrip('#')
                if len(hex_color) == 6:
                    r = int(hex_color[0:2], 16)
                    g = int(hex_color[2:4], 16) 
                    b = int(hex_color[4:6], 16)
                    return (r, g, b)
            elif isinstance(color_string, (list, tuple)) and len(color_string) == 3:
                # RGB tuple
                return tuple(int(c) for c in color_string)
        except:
            pass
        return None
    
    def get_existing_tags(self):
        """Get list of existing country tags"""
        if not os.path.exists(self.tags_file):
            return []
        
        try:
            with open(self.tags_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract tags using regex
            tags = re.findall(r'^(\w{3})\s*=', content, re.MULTILINE)
            return tags
        except:
            return []
