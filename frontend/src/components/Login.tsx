
import React, { useState } from 'react';
import * as Auth from '../lib/auth';
import { User, LoginAnnouncement } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import LoginAnnouncements from './LoginAnnouncements';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  onSwitchToRegister: () => void;
  onNavigateToForgotPassword: () => void;
  loginError?: string;
  onClearError?: () => void;
  announcements?: LoginAnnouncement[];
  announcementsEnabled?: boolean;
  gameSuspended?: boolean;
  suspensionMessage?: string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToRegister, onNavigateToForgotPassword, loginError, onClearError, announcements = [], announcementsEnabled = false, gameSuspended = false, suspensionMessage }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Clear any previous errors
    if (onClearError) onClearError(); // Clear any previous login errors
    Auth.login(username, password);
    // Login success/failure will be handled by Socket.IO events
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">


      <div className="mb-8 max-w-sm w-full">
        <img
          src="https://www.platopotato.com/NFT/Tribes/assets/Tribeslogo.png"
          alt="Radix Tribes Logo"
          className="w-full h-32 object-contain rounded-lg border-2 border-amber-500 p-4 bg-slate-800/50"
        />
      </div>

      {/* Game Suspension Warning */}
      {gameSuspended && (
        <div className="max-w-sm w-full mb-6">
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-red-400 font-bold">Game Suspended</span>
            </div>
            <p className="text-red-200 text-sm mb-3">
              {suspensionMessage || 'The game is currently under maintenance.'}
            </p>
            <p className="text-orange-300 text-xs">
              🔑 Admin login is still available below
            </p>
          </div>
        </div>
      )}

      <LoginAnnouncements />

      <Card title={gameSuspended ? "🔑 Admin Login" : "Login"} className="max-w-sm w-full">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>
          {(error || loginError) && <p className="text-red-500 text-sm text-center">{error || loginError}</p>}
          <Button type="submit" className="w-full">
            Login
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={onNavigateToForgotPassword} className="font-medium text-amber-500 hover:text-amber-400">
              Forgot Password?
            </button>
            <button type="button" onClick={onSwitchToRegister} className="font-medium text-amber-500 hover:text-amber-400">
              Register
            </button>
          </div>
        </form>

        {/* Version Number */}
        <div className="text-center text-xs text-slate-500 mt-4">
          Version: 142-ADDED-MAP-KEY-TOGGLE-BUTTON
        </div>
      </Card>
    </div>
  );
};

export default Login;