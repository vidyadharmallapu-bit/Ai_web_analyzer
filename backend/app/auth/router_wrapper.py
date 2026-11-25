import importlib.util
import sys
import os

# Add backend to path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)

# Load auth routes using importlib to avoid null byte issue
auth_spec = importlib.util.spec_from_file_location(
    'app.auth.routes', 
    os.path.join(os.path.dirname(__file__), 'routes.py')
)
auth_module = importlib.util.module_from_spec(auth_spec)
sys.modules['app.auth.routes'] = auth_module
auth_spec.loader.exec_module(auth_module)

# Export the router
router = auth_module.router