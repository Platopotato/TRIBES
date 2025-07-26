import { io, Socket } from 'socket.io-client';
import { GameState, User, FullBackupState, GameAction, Tribe, HexData } from '@radix-tribes/shared';

let socket: Socket;

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
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    console.log('Initializing Socket.IO client with server URL:', serverUrl);
    socket = io(serverUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: true,
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log(`✅ Socket.IO Connected to server! Socket ID: ${socket.id}`);
        socket.emit('get_initial_state');
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log(`🔌 Disconnected from server: ${reason}. Socket ID was: ${socket.id}`);
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
    
    socket.on('login_success', (user: User) => {
        console.log('✅ Login successful:', user);
        // Store user in session storage immediately
        sessionStorage.setItem('radix_user', JSON.stringify(user));

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

// Game action emitters
export const createTribe = createEmitter<any>('create_tribe');
export const submitTurn = createEmitter<{ tribeId: string; plannedActions: GameAction[]; journeyResponses: Tribe['journeyResponses'] }>('submit_turn');
export const processTurn = () => socket.emit('process_turn');
export const updateTribe = createEmitter<Tribe>('admin:updateTribe');
export const removePlayer = createEmitter<string>('admin:removePlayer');
export const startNewGame = () => socket.emit('start_new_game');
export const loadBackup = createEmitter<FullBackupState>('load_backup');
export const updateMap = createEmitter<{newMapData: HexData[], newStartingLocations: string[]}>('update_map');

// Chief/Asset emitters
export const requestChief = createEmitter<{ tribeId: string, chiefName: string, radixAddressSnippet: string }>('request_chief');
export const approveChief = createEmitter<string>('approve_chief');
export const denyChief = createEmitter<string>('deny_chief');
export const requestAsset = createEmitter<{ tribeId: string, assetName: string, radixAddressSnippet: string }>('request_asset');
export const approveAsset = createEmitter<string>('approve_asset');
export const denyAsset = createEmitter<string>('deny_asset');

// AI emitter
export const addAITribe = (aiType?: string) => socket.emit('add_ai_tribe', aiType);

// Diplomacy emitters
export const proposeAlliance = createEmitter<{ fromTribeId: string, toTribeId: string }>('propose_alliance');
export const sueForPeace = createEmitter<{ fromTribeId: string, toTribeId: string, reparations: any }>('sue_for_peace');
export const declareWar = createEmitter<{ fromTribeId: string, toTribeId: string }>('declare_war');
export const acceptProposal = createEmitter<string>('accept_proposal');
export const rejectProposal = createEmitter<string>('reject_proposal');
