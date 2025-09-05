// Test script to verify newsletter functionality
// This script will create and publish a test newsletter

const io = require('socket.io-client');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-admin-password';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

console.log('🧪 Testing Newsletter Functionality...');
console.log(`📡 Connecting to: ${SERVER_URL}`);

const socket = io(SERVER_URL);

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // First, authenticate as admin
  console.log('🔐 Authenticating as admin...');
  socket.emit('admin:login', { password: ADMIN_PASSWORD });
});

socket.on('admin:loginSuccess', () => {
  console.log('✅ Admin authentication successful');
  
  // Get current game state to find the current turn
  socket.emit('admin:getGameState');
});

socket.on('admin:gameState', (gameState) => {
  console.log(`📊 Current game state - Turn: ${gameState.turn}`);
  console.log(`📰 Current newsletter state:`, {
    hasNewsletter: !!gameState.newsletter,
    newsletterCount: gameState.newsletter?.newsletters?.length || 0,
    currentNewsletter: gameState.newsletter?.currentNewsletter?.title || 'None'
  });
  
  // Create a test newsletter for the current turn
  const testNewsletter = {
    turn: gameState.turn,
    title: `Test Newsletter - Turn ${gameState.turn}`,
    content: `# Welcome to Turn ${gameState.turn}!\n\nThis is a test newsletter to verify the newsletter functionality is working correctly.\n\n## Key Updates\n- Newsletter system has been restored\n- Admin can now create and publish newsletters\n- Players can read published newsletters\n\n**This newsletter was created automatically by the test script.**`,
    isPublished: false
  };
  
  console.log('📝 Creating test newsletter...');
  socket.emit('admin:saveNewsletter', testNewsletter);
});

socket.on('admin:newsletterSaved', (newsletter) => {
  console.log('✅ Newsletter saved successfully:', newsletter.title);
  console.log('📤 Publishing newsletter...');
  socket.emit('admin:publishNewsletter', newsletter.id);
});

socket.on('admin:newsletterPublished', (newsletter) => {
  console.log('✅ Newsletter published successfully:', newsletter.title);
  console.log('🔍 Verifying newsletter appears in game state...');
  
  // Wait a moment then check the game state again
  setTimeout(() => {
    socket.emit('admin:getGameState');
  }, 1000);
});

let verificationCount = 0;
socket.on('admin:gameState', (gameState) => {
  verificationCount++;
  
  if (verificationCount > 1) { // Skip the first gameState event
    console.log('🔍 Verification - Newsletter state after publish:');
    console.log({
      hasNewsletter: !!gameState.newsletter,
      newsletterCount: gameState.newsletter?.newsletters?.length || 0,
      currentNewsletter: gameState.newsletter?.currentNewsletter?.title || 'None',
      publishedNewsletters: gameState.newsletter?.newsletters?.filter(n => n.isPublished).length || 0
    });
    
    const publishedNewsletters = gameState.newsletter?.newsletters?.filter(n => n.isPublished) || [];
    if (publishedNewsletters.length > 0) {
      console.log('✅ SUCCESS: Newsletter functionality is working!');
      console.log('📰 Published newsletters:');
      publishedNewsletters.forEach(n => {
        console.log(`  - Turn ${n.turn}: ${n.title} (Published: ${new Date(n.publishedAt).toLocaleString()})`);
      });
    } else {
      console.log('❌ FAILED: No published newsletters found');
    }
    
    console.log('🏁 Test completed. Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }
});

socket.on('admin:loginFailed', (error) => {
  console.error('❌ Admin authentication failed:', error);
  process.exit(1);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('📡 Disconnected from server');
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Test timed out after 30 seconds');
  process.exit(1);
}, 30000);
