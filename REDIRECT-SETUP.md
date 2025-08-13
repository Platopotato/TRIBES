# 🔄 REDIRECT PAGE SETUP - Tribes-Test Repository

## 🎯 PURPOSE
This repository serves as a **REDIRECT PAGE ONLY** - it should NOT serve the actual frontend application.

## ⚠️ CRITICAL CONFIGURATION

### Render Service Settings:
- **Service Type:** Static Site
- **Repository:** `https://github.com/Platopotato/Tribes-Test`
- **Build Command:** `./build-frontend.sh`
- **Publish Directory:** `dist`

### What the Build Script Does:
1. Creates a `dist` directory
2. Copies `index.html` (redirect page) to `dist/index.html`
3. Verifies the redirect URL is correct
4. **DOES NOT** build the actual frontend application

## 🚀 REDIRECT TARGET
- **Production Frontend:** `https://radix-tribes-frontend.onrender.com/`
- **Cache-Busting:** Aggressive cache prevention with timestamps and random parameters

## 🔧 HOW TO FIX IF SERVING FRONTEND:

If the Tribes-Test service is accidentally serving the actual frontend instead of the redirect:

1. **Update Build Command in Render:**
   ```bash
   ./build-frontend.sh
   ```

2. **Update Publish Directory in Render:**
   ```
   dist
   ```

3. **Remove Environment Variables:**
   - Remove `VITE_API_URL` and any other frontend-specific variables
   - Redirect page doesn't need any environment variables

4. **Trigger Redeploy:**
   - Push any change to trigger a rebuild
   - Verify it serves the redirect page, not the frontend

## ✅ VERIFICATION
After deployment, visiting the Tribes-Test URL should:
1. Show a redirect countdown page
2. Automatically redirect to production frontend after 5 seconds
3. Include cache-busting parameters in the redirect URL

## 🚨 TROUBLESHOOTING
If users see the actual frontend instead of redirect:
- Check Render build logs for errors
- Verify build command is `./build-frontend.sh`
- Verify publish directory is `dist`
- Check that `index.html` contains redirect logic
