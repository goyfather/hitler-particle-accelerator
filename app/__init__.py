from flask import Flask
import os

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'dev_hoi4_mod_tool'
    
    from app.routes import main
    app.register_blueprint(main)
    
    return app