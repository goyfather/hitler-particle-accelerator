import sys
import os

# Add embedded Python to path if running standalone
if getattr(sys, 'frozen', False):
    # Running as compiled exe
    application_path = os.path.dirname(sys.executable)
elif '__file__' in globals():
    # Running as script
    application_path = os.path.dirname(os.path.abspath(__file__))

python_embedded_path = os.path.join(application_path, 'python')
if os.path.exists(python_embedded_path):
    sys.path.insert(0, python_embedded_path)

# Now import Flask and other dependencies
try:
    from app import create_app
    import webbrowser
    import threading
    import time
except ImportError as e:
    print(f"Import error: {e}")
    print("Please run start.bat first to install dependencies")
    input("Press Enter to exit...")
    sys.exit(1)

def open_browser():
    if getattr(open_browser, 'launched', False):
        return
    """Wait a moment for the server to start, then open the browser"""
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000/')


if __name__ == '__main__':
    print("Starting Hitler Particle Accelerator...")
    
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        threading.Thread(target=open_browser).start()
    
    # Create and run the app
    app = create_app()
    app.run(debug=True, host='127.0.0.1', port=5000)
