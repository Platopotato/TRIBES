# REDIRECT PAGE BUILD SCRIPT for Render.com
# This script ensures only the redirect page is served, not the actual frontend

Write-Host "🔄 Building Redirect Page for Tribes-Test Repository..." -ForegroundColor Yellow
Write-Host "🎯 This should redirect to: https://radix-tribes-frontend.onrender.com/" -ForegroundColor Cyan

# Create a simple dist directory with just the redirect page
Write-Host "📁 Creating redirect-only build..." -ForegroundColor Green
if (!(Test-Path "dist")) { New-Item -ItemType Directory -Name "dist" }

# Copy the redirect page as the main index
Write-Host "📄 Copying redirect page..." -ForegroundColor Green
Copy-Item "index.html" "dist/index.html" -Force

# Verify the redirect page exists and contains the redirect logic
if (Select-String -Path "dist/index.html" -Pattern "radix-tribes-frontend.onrender.com" -Quiet) {
    Write-Host "✅ Redirect page verified - points to production frontend" -ForegroundColor Green
} else {
    Write-Host "❌ ERROR: Redirect page does not contain production URL!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Redirect build completed successfully!" -ForegroundColor Green
Write-Host "📁 Redirect page is in dist/" -ForegroundColor Cyan
Write-Host "🚀 This will redirect users to the production frontend" -ForegroundColor Yellow
Get-ChildItem "dist" | Format-Table
