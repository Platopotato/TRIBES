# Frontend Environment Variables for Render.com

When setting up the frontend static site on Render.com, configure these environment variables:

## Required Environment Variables

### VITE_API_URL
- **Value**: `https://your-backend-service.onrender.com`
- **Description**: URL of the backend API service
- **Note**: This must be set at build time for Vite to include it in the bundle

## Build Command
```bash
cd shared && npm install --only=production && npm run build && cd ../frontend && npm install --only=production && npm run build
```

## Publish Directory
```
./frontend/dist
```

## Static Site Configuration

The frontend is built as a static site and served by Render's CDN. The nginx configuration is not used in this setup since Render handles routing automatically for static sites.

## CORS Configuration

Make sure the backend's FRONTEND_URL environment variable is set to match your frontend's URL to allow proper CORS handling.

## Socket.IO Configuration

The frontend will connect to the backend via Socket.IO. Make sure the VITE_API_URL points to the correct backend service URL.
