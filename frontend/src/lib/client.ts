import { io, Socket } from 'socket.io-client';
import { GameState, User, FullBackupState, GameAction, Tribe, HexData } from '@radix-tribes/shared';

let socket: Socket;

// Store current user for authentication restoration
let currentUser: User | null = null;

// Export function to get current user
export const getCurrentUser = (): User | null => currentUser;

// Export function to get socket for direct event handling
export const getSocket = (): Socket | null => socket;

// Helper function to create a typed emitter
const createEmitter = <T>(eventName: string) => (payload: T) => {
    console.log(`Attempting to emit ${eventName}:`, payload);
    if (socket && socket.connected) {
        console.log(`Socket connected (${socket.id}), emitting ${eventName}`);
        socket.emit(eventName, payload);
    } else {
        console.error(`Socket not connected or disconnected, cannot emit ${eventName}. Socket state:`, socket ? { id: socket.id, connected: socket.connected } : 'null');
    }
};

export const initClient = (
    onStateUpdate: (newState: GameState) => void,
    onUsersUpdate: (users: User[]) => void,
    onLoginSuccess: (user: User) => void,
    onLoginFail?: (error: string) => void,
    onRegisterSuccess?: (username: string) => void
) => {
    const serverUrl = import.meta.env.VITE_API_URL || 'https://radix-tribes-backend.onrender.com';
    console.log('Initializing Socket.IO client with server URL:', serverUrl);

    // Mobile-optimized Socket.IO configuration
    const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
    console.log('📱 Mobile client detected:', isMobile);

    socket = io(serverUrl, {
        // Mobile-optimized reconnection settings
        reconnectionAttempts: isMobile ? 10 : 5, // More attempts for mobile
        reconnectionDelay: isMobile ? 2000 : 1000, // Longer delay for mobile networks
        reconnectionDelayMax: isMobile ? 10000 : 5000,
        timeout: isMobile ? 30000 : 20000, // Longer timeout for mobile
        forceNew: true,
        transports: ['websocket', 'polling'],
        // Mobile-specific optimizations
        upgrade: true,
        rememberUpgrade: true,
        // Longer ping timeout for mobile networks
        ...(isMobile && {
            pingTimeout: 60000,
            pingInterval: 25000
        })
    });

    // Initialize currentUser from sessionStorage if available
    const storedUser = sessionStorage.getItem('radix_user');
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
            console.log('🔄 Restored user from session storage:', currentUser?.username);
        } catch (error) {
            console.error('❌ Failed to parse stored user:', error);
            sessionStorage.removeItem('radix_user');
        }
    }

    socket.on('connect', () => {
        console.log(`✅ Socket.IO Connected to server! Socket ID: ${socket.id}`);

        // Mobile-specific connection success handling
        if (isMobile) {
            console.log('📱 Mobile client successfully connected');
            // Clear any offline indicators
            document.body.classList.remove('offline');
        }

        socket.emit('get_initial_state');

        // Restore authentication if we have a current user
        if (currentUser) {
            console.log('🔄 Restoring authentication for:', currentUser.username);
            socket.emit('restore_auth', {
                userId: currentUser.id,
                username: currentUser.username
            });
        }
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);

        // Mobile-specific error handling
        if (isMobile) {
            console.log('📱 Mobile connection error, will retry...');
            // Could show a user-friendly offline indicator
            document.body.classList.add('offline');
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`🔌 Disconnected from server: ${reason}. Socket ID was: ${socket.id}`);

        // Mobile-specific disconnect handling
        if (isMobile) {
            console.log('📱 Mobile client disconnected:', reason);
            document.body.classList.add('offline');

            // Handle mobile-specific disconnect reasons
            if (reason === 'transport close' || reason === 'ping timeout') {
                console.log('📱 Network issue detected, will attempt reconnection');
                // Could queue actions for later sync
                queueOfflineActions();
            }
        }
    });

    // Mobile-specific reconnection handling
    socket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
        if (isMobile) {
            console.log('📱 Mobile client reconnected successfully');
            document.body.classList.remove('offline');
            // Sync any queued offline actions
            syncOfflineActions();
        }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt ${attemptNumber}`);
        if (isMobile) {
            console.log(`📱 Mobile reconnection attempt ${attemptNumber}`);
        }
    });

    socket.on('reconnect_failed', () => {
        console.error('❌ Failed to reconnect');
        if (isMobile) {
            console.log('📱 Mobile reconnection failed - entering offline mode');
            // Could show offline mode UI
        }
    });
    
    socket.on('initial_state', (data: { gameState: GameState, users: User[] }) => {
        onStateUpdate(data.gameState);
        onUsersUpdate(data.users);
    });

    socket.on('gamestate_updated', (newState: GameState) => {
        onStateUpdate(newState);
    });

    socket.on('users_updated', (newUsers: User[]) => {
        onUsersUpdate(newUsers);
    });

    socket.on('admin_notification', (notification: { type: string, message: string, tribeId?: string, playerId?: string }) => {
        console.log('🔔 Admin notification received:', notification);

        // Show notification to user
        if (notification.type === 'tribe_updated') {
            // Check if this notification is for the current user
            const currentUser = getCurrentUser();
            if (currentUser && notification.playerId === currentUser.id) {
                console.log('🎯 Tribe update notification for current user');
                alert(`🔧 Admin Update: ${notification.message}`);

                // Force a page refresh to ensure all changes are visible
                if (confirm('Would you like to refresh the page to ensure all changes are visible?')) {
                    window.location.reload();
                }
            }
        }
    });
    
    socket.on('login_success', (user: User) => {
        console.log('✅ Login successful:', user);
        // Store user in session storage immediately
        sessionStorage.setItem('radix_user', JSON.stringify(user));

        // Store user for socket authentication restoration
        currentUser = user;

        // Always call onLoginSuccess to set the current user
        // This ensures the user is logged in for both normal login and registration
        onLoginSuccess(user);

        // Clear the registration flag if it exists
        if ((window as any)._registeringUsername) {
            setTimeout(() => {
                (window as any)._registeringUsername = null;
            }, 100);
        }
    });

    // Handle authentication restoration (production backend format)
    socket.on('auth_restored', (response: any) => {
        console.log('✅ Authentication restored:', response);

        // Handle both formats: User object directly or {success: boolean, user?: User}
        if (response && typeof response === 'object') {
            if (response.id && response.username) {
                // Direct user object format
                const user = response as User;
                sessionStorage.setItem('radix_user', JSON.stringify(user));
                currentUser = user;
                onLoginSuccess(user);
            } else if (response.success && response.user) {
                // Wrapped format with success flag
                const user = response.user as User;
                sessionStorage.setItem('radix_user', JSON.stringify(user));
                currentUser = user;
                onLoginSuccess(user);
            } else if (response.success === false) {
                console.log('❌ Authentication restoration failed');
                currentUser = null;
                sessionStorage.removeItem('radix_user');
            }
        }
    });

    socket.on('auth_restore_failed', (error: string) => {
        console.log('❌ Authentication restoration failed:', error);
        // Clear invalid session data
        sessionStorage.removeItem('radix_user');
        currentUser = null;
        // Could redirect to login or show error message
    });

    socket.on('login_fail', (error: string) => {
        console.log('❌ Login failed:', error);
        // Clear any stored user data on login failure
        sessionStorage.removeItem('radix_user');
        if (onLoginFail) {
            onLoginFail(error);
        } else {
            alert(`Login Failed: ${error}`);
        }
    });
    socket.on('register_success', (message: string) => {
        console.log('✅ Registration successful:', message);
        // Call the registration success callback to show the success screen
        if (onRegisterSuccess) {
            // Extract username from the current registration attempt
            const username = (window as any)._registeringUsername || 'Player';
            onRegisterSuccess(username);
        }
    });
    socket.on('register_fail', (error: string) => {
        console.log('❌ Registration failed:', error);
        alert(`Registration Failed: ${error}`);
    });
    socket.on('reset_password_success', (message: string) => alert(message));
    socket.on('reset_password_fail', (error: string) => alert(error));
    socket.on('security_question', (question: string | null) => {
        if (!question) alert('Username not found.');
        // This is a simple implementation. A real app would update the UI.
        const answer = prompt(`Security Question: ${question}`);
        if(answer) {
            const username = (document.getElementById('username-forgot') as HTMLInputElement)?.value;
            if(username) verifySecurityAnswer({ username, answer });
        }
    });
    socket.on('answer_verified', (isCorrect: boolean) => {
        if (!isCorrect) {
            alert('Incorrect answer.');
            return;
        }
        const newPassword = prompt('Enter your new password:');
        if (newPassword) {
            const username = (document.getElementById('username-forgot') as HTMLInputElement)?.value;
             if(username) resetPassword({ username, newPassword });
        }
    });

    socket.on('alert', (message: string) => {
        alert(message);
    });

    socket.on('password_change_success', (message: string) => {
        alert(message);
    });

    socket.on('password_change_error', (message: string) => {
        alert(`Error: ${message}`);
    });

    socket.on('enhanced_backup_ready', (backupData: FullBackupState) => {
        // Download the enhanced backup
        const stateString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([stateString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        a.href = url;
        a.download = `radix-tribes-enhanced-backup-${date}-${time}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('📥 Enhanced backup downloaded with passwords and announcements');
    });

    socket.on('backup_download_ready', ({ filename, data }: { filename: string, data: FullBackupState }) => {
        // Download the auto-backup
        const stateString = JSON.stringify(data, null, 2);
        const blob = new Blob([stateString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`📥 Auto-backup downloaded: ${filename}`);
    });

    socket.on('backup_error', (message: string) => {
        alert(`Backup Error: ${message}`);
    });

    socket.on('admin_password_updated', (message: string) => {
        alert(`Success: ${message}`);
    });

    socket.on('admin_password_error', (message: string) => {
        alert(`Error: ${message}`);
    });

    socket.on('admin_debug_info', (info: any) => {
        console.log('🔍 Admin Debug Info:', info);
        alert(`Debug Info:\nHas Admin: ${info.hasAdmin}\nCurrent Hash: ${info.currentHash}\nSnoopy Hash: ${info.snoopyHash}\nEnv Password: ${info.envPassword}`);
    });

    socket.on('socket_debug_info', (info: any) => {
        console.log('🔍 Socket Debug Info:', info);
        alert(`Socket Debug:\nSocket ID: ${info.socketId}\nUser ID: ${info.userId}\nUsername: ${info.username}\nAuthenticated: ${info.authenticated}`);
    });



    socket.on('manual_backup_created', (filename: string) => {
        alert(`Manual backup created successfully: ${filename}`);
    });

    socket.on('backup_status', ({ status, backupList }: { status: any, backupList: any[] }) => {
        const callback = (window as any).backupStatusCallback;
        if (callback) {
            callback(status, backupList);
        }
    });
};

// Auth emitters with timeout handling
export const login = (credentials: { username: string, password: string }) => {
    console.log(`Attempting to emit login:`, credentials);
    if (socket && socket.connected) {
        console.log(`Socket connected (${socket.id}), emitting login`);
        socket.emit('login', credentials);

        // Set a timeout to check if login was successful after 3 seconds
        setTimeout(() => {
            const user = sessionStorage.getItem('radix_user');
            if (user) {
                console.log('✅ Login appears to have succeeded (found user in session storage)');
                try {
                    const parsedUser = JSON.parse(user);
                    // Trigger the success callback manually if it wasn't triggered by socket
                    window.location.reload(); // Simple approach: reload the page to trigger re-initialization
                } catch (e) {
                    console.error('Error parsing stored user:', e);
                }
            } else {
                console.log('⏰ Login timeout - no response received');
            }
        }, 3000);
    } else {
        console.error(`Socket not connected or disconnected, cannot emit login. Socket state:`, socket ? { id: socket.id, connected: socket.connected } : 'null');
    }
};

// Test function for debugging
(window as any).testLogin = () => {
    console.log('🧪 Testing login with Admin/snoopy...');
    login({ username: 'Admin', password: 'snoopy' });
};

// Test function for registration debugging
(window as any).testRegister = () => {
    console.log('🧪 Testing registration with TestUser...');
    register({
        username: 'TestUser',
        password: 'password123',
        securityQuestion: 'What is your favorite color?',
        securityAnswer: 'blue'
    });
};
export const register = (data: { username: string, password: string, securityQuestion: string, securityAnswer: string }) => {
    console.log('📤 EMITTING REGISTER EVENT:', { username: data.username, password: '***', securityQuestion: data.securityQuestion, securityAnswer: '***' });
    // Store the username for the success callback
    (window as any)._registeringUsername = data.username;
    socket.emit('register', data);
};
export const getUserQuestion = createEmitter<string>('get_security_question');
export const verifySecurityAnswer = createEmitter<{ username: string, answer: string }>('verify_security_answer');
export const resetPassword = createEmitter<{ username: string, newPassword: string }>('reset_password');
export const adminResetPassword = createEmitter<{ userId: string, newPassword: string }>('admin:resetPassword');
export const changePassword = createEmitter<{ currentPassword: string, newPassword: string }>('change_password');



// Newsletter functions
export const saveNewsletter = createEmitter<any>('admin:saveNewsletter');
export const publishNewsletter = createEmitter<string>('admin:publishNewsletter');
export const unpublishNewsletter = createEmitter<string>('admin:unpublishNewsletter');

// Newsletter backup and restore functions
export const exportAllNewsletters = () => socket.emit('admin:exportAllNewsletters');
export const importAllNewsletters = createEmitter<any>('admin:importAllNewsletters');

// AI Management emitters
export const addAITribe = createEmitter<any>('admin:addAITribe');
export const removeAITribe = createEmitter<string>('admin:removeAITribe');

// AI Management helper functions
export const addAITribeAdvanced = (aiData: {
    aiType: string;
    spawnLocation: string;
    customName?: string;
    backstory?: string;
}) => {
    console.log('🤖 CLIENT: Sending addAITribe request:', aiData);
    console.log('🔌 CLIENT: Socket connected:', socket.connected);
    console.log('🔌 CLIENT: Socket ID:', socket.id);
    socket.emit('admin:addAITribe', aiData);

    // Add a test event to verify connection
    socket.emit('admin:test', { message: 'Testing admin connection' });
};

export const addAITribeSimple = (aiType?: string) => {
    console.log('🤖 CLIENT: Sending simple addAITribe request:', aiType);
    socket.emit('add_ai_tribe', aiType);
};

// Login announcement emitters
export const addLoginAnnouncement = createEmitter<any>('admin:addLoginAnnouncement');
export const toggleLoginAnnouncement = createEmitter<string>('admin:toggleLoginAnnouncement');
export const deleteLoginAnnouncement = createEmitter<string>('admin:deleteLoginAnnouncement');
export const toggleLoginAnnouncements = () => socket.emit('admin:toggleLoginAnnouncements');

// Turn deadline emitters
export const setTurnDeadline = createEmitter<any>('admin:setTurnDeadline');
export const clearTurnDeadline = () => socket.emit('admin:clearTurnDeadline');

// Admin password management
export const updateAdminPassword = createEmitter<string>('admin:updateAdminPassword');
export const resetAdminPassword = () => socket.emit('admin:resetAdminPassword');
export const syncPasswordWithEnv = () => socket.emit('admin:syncPasswordWithEnv');
export const debugAdminPassword = () => socket.emit('admin:debugPassword');
export const debugSocket = () => socket.emit('debug_socket');

// Game suspension
export const toggleGameSuspension = (suspended: boolean, message: string) => {
  console.log('🚨 Emitting toggleGameSuspension:', { suspended, message });
  socket.emit('admin:toggleGameSuspension', { suspended, message });
};

// Game action emitters
export const createTribe = createEmitter<any>('create_tribe');
export const submitTurn = createEmitter<{ tribeId: string; plannedActions: GameAction[]; journeyResponses: Tribe['journeyResponses'] }>('submit_turn');
export const processTurn = () => {
  console.log('🚨 FRONTEND: Emitting process_turn event to backend');
  socket.emit('process_turn');
};
export const updateTribe = createEmitter<Tribe>('admin:updateTribe');
export const removePlayer = createEmitter<string>('admin:removePlayer');
export const removeJourney = createEmitter<string>('admin:removeJourney');
export const startNewGame = () => socket.emit('start_new_game');
export const loadBackup = createEmitter<FullBackupState>('load_backup');
export const requestEnhancedBackup = () => socket.emit('admin:requestEnhancedBackup');

// Auto-backup management emitters
export const getBackupStatus = () => socket.emit('admin:getBackupStatus');
export const downloadBackup = createEmitter<string>('admin:downloadBackup');
export const deleteBackup = createEmitter<string>('admin:deleteBackup');
export const createManualBackup = () => socket.emit('admin:createManualBackup');

// Backup status callback management
export const setBackupStatusCallback = (callback: ((status: any, backupList: any[]) => void) | null) => {
    (window as any).backupStatusCallback = callback;
};
export const updateMap = createEmitter<{newMapData: HexData[], newStartingLocations: string[]}>('update_map');

// Chief/Asset emitters
export const requestChief = createEmitter<{ tribeId: string, chiefName: string, radixAddressSnippet: string }>('request_chief');
export const approveChief = createEmitter<string>('approve_chief');
export const denyChief = createEmitter<string>('deny_chief');
export const requestAsset = createEmitter<{ tribeId: string, assetName: string, radixAddressSnippet: string }>('request_asset');
export const approveAsset = createEmitter<string>('approve_asset');
export const denyAsset = createEmitter<string>('deny_asset');

// Legacy AI emitter (keeping for backward compatibility)
export const addAITribeLegacy = (aiType?: string) => socket.emit('add_ai_tribe', aiType);

// Diplomacy emitters
export const proposeAlliance = createEmitter<{ fromTribeId: string, toTribeId: string }>('propose_alliance');
export const sueForPeace = createEmitter<{ fromTribeId: string, toTribeId: string, reparations: any }>('sue_for_peace');
export const declareWar = createEmitter<{ fromTribeId: string, toTribeId: string }>('declare_war');
export const acceptProposal = createEmitter<string>('accept_proposal');
export const rejectProposal = createEmitter<string>('reject_proposal');
export const toggleMapSharing = createEmitter<{ tribeId: string, enable: boolean }>('toggle_map_sharing');

// Mobile offline action queuing
const queueOfflineActions = () => {
    if (typeof window !== 'undefined') {
        console.log('📱 Entering offline mode - queuing actions');
        // Could implement IndexedDB storage for offline actions
        localStorage.setItem('offlineMode', 'true');
    }
};

const syncOfflineActions = () => {
    if (typeof window !== 'undefined') {
        console.log('📱 Syncing offline actions');
        localStorage.removeItem('offlineMode');

        // Get pending actions from localStorage
        const pendingActions = localStorage.getItem('pendingGameActions');
        if (pendingActions) {
            try {
                const actions = JSON.parse(pendingActions);
                console.log('📱 Found', actions.length, 'pending actions to sync');

                // Trigger background sync if available
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        // Check if sync is supported before using it
                        if ('sync' in registration) {
                            return (registration as any).sync.register('game-actions-sync');
                        } else {
                            console.log('📱 Background sync not supported, will sync on reconnect');
                        }
                    }).catch(error => {
                        console.error('📱 Background sync registration failed:', error);
                    });
                }
            } catch (error) {
                console.error('📱 Failed to parse pending actions:', error);
            }
        }
    }
};

// Check if currently offline
export const isOffline = () => {
    return localStorage.getItem('offlineMode') === 'true';
};

// Queue action for offline sync
export const queueAction = (action: any) => {
    if (isOffline()) {
        const pending = JSON.parse(localStorage.getItem('pendingGameActions') || '[]');
        pending.push({
            ...action,
            timestamp: Date.now(),
            id: `offline_${Date.now()}_${Math.random()}`
        });
        localStorage.setItem('pendingGameActions', JSON.stringify(pending));
        console.log('📱 Action queued for offline sync:', action);
        return true;
    }
    return false;
};

// Logout function
export const logout = () => {
    sessionStorage.removeItem('radix_user');
    currentUser = null; // Clear current user for socket authentication
};
