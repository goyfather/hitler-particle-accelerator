import os
import re
from PIL import Image  # We have Pillow now!

class HOI4FileParser:
    def __init__(self):
        self.parsed_data = {}
    
    def parse_file(self, file_path):
        """Basic HOI4 file parser - handles common formats"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Simple detection of file type by extension and content
            if file_path.endswith('.txt'):
                return self.parse_txt_file(content)
            elif file_path.endswith('.yml') or file_path.endswith('.yaml'):
                return self.parse_yaml_file(content)
            else:
                return {'type': 'unknown', 'content': content}
                
        except Exception as e:
            return {'type': 'error', 'error': str(e)}
    
    def parse_txt_file(self, content):
        """Parse HOI4 .txt files (often key=value pairs)"""
        data = {}
        lines = content.split('\n')
        
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#'):
                # Simple key=value parsing
                if '=' in line:
                    key, value = line.split('=', 1)
                    data[key.strip()] = value.strip()
        
        return {'type': 'txt', 'data': data}
    
    def parse_yaml_file(self, content):
        """Basic YAML-like parsing for HOI4 files"""
        # HOI4 uses a simplified YAML-like format
        data = {}
        lines = content.split('\n')
        current_key = None
        
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#'):
                if ':' in line and not line.startswith(' '):
                    # New key
                    key = line.split(':', 1)[0].strip()
                    value = line.split(':', 1)[1].strip() if ':' in line else ''
                    data[key] = value
                    current_key = key
                elif line.startswith(' ') and current_key:
                    # Continuation of previous key
                    data[current_key] += ' ' + line.strip()
        
        return {'type': 'yaml', 'data': data}
    
    def validate_image(self, image_path):
        """Validate HOI4 image files using Pillow"""
        try:
            with Image.open(image_path) as img:
                return {
                    'valid': True,
                    'format': img.format,
                    'size': img.size,
                    'mode': img.mode
                }
        except Exception as e:
            return {'valid': False, 'error': str(e)}
