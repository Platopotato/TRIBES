# 🔄 REDIRECT PAGE - Tribes-Test Repository

## ⚠️ IMPORTANT: This is a REDIRECT service, NOT a working frontend

This repository serves as a **REDIRECT PAGE ONLY** - it should NOT serve the actual frontend application.

## 🎯 PURPOSE
- **Redirect users** from test URL to production frontend
- **Prevent confusion** between test and production environments
- **Cache-busting** to ensure redirect always works

## 🚀 REDIRECT TARGET
**Production Frontend:** `https://radix-tribes-frontend.onrender.com/`

## 📋 RENDER SERVICE CONFIGURATION

### Required Settings:
- **Service Type:** Static Site
- **Repository:** `https://github.com/Platopotato/Tribes-Test`
- **Build Command:** `./build-frontend.sh` or `powershell ./build-frontend.ps1`
- **Publish Directory:** `dist`
- **Environment Variables:** None required

### Build Process:
1. Creates `dist` directory
2. Copies `index.html` (redirect page) to `dist/index.html`
3. Verifies redirect URL is correct
4. **DOES NOT** build the actual frontend application

## ✨ REDIRECT FEATURES

### Epic Design:
- **Countdown Timer:** 5-second countdown with visual effects
- **Manual Override:** "Go to Production Now" button
- **Epic Styling:** Glowing borders, particles, animations
- **Cache Prevention:** Aggressive cache-busting headers

### Technical Features:
- **Cache-Busting:** Timestamp and random parameters in redirect URL
- **Back Button Prevention:** Prevents caching on browser back
- **Aggressive Headers:** Multiple cache prevention meta tags
- **Instant Redirect:** Option to skip countdown

## 🔧 TROUBLESHOOTING

### If Test URL Shows Frontend Instead of Redirect:

1. **Check Render Build Command:**
   ```bash
   ./build-frontend.sh
   ```

2. **Check Render Publish Directory:**
   ```
   dist
   ```

3. **Remove Environment Variables:**
   - Remove `VITE_API_URL` and any frontend-specific variables
   - Redirect page doesn't need environment variables

4. **Verify Files:**
   - Ensure `index.html` exists in repository root
   - Ensure `build-frontend.sh` exists and is executable

5. **Force Redeploy:**
   - Push any change to trigger rebuild
   - Check build logs for errors

## ✅ VERIFICATION

After deployment, visiting the Tribes-Test URL should:
1. Show epic redirect countdown page
2. Display "⚔️ RADIX TRIBES ⚔️" with glowing effects
3. Count down from 5 seconds
4. Automatically redirect to production frontend
5. Include cache-busting parameters in redirect URL

## 🚨 NEVER DO THIS:
- ❌ Don't set build command to build the actual frontend
- ❌ Don't set publish directory to `frontend/dist`
- ❌ Don't add `VITE_API_URL` environment variable
- ❌ Don't serve the working frontend from this repository
