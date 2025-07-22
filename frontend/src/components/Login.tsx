
import React, { useState } from 'react';
import * as Auth from '../lib/auth';
import { User } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  onSwitchToRegister: () => void;
  onNavigateToForgotPassword: () => void;
  loginError?: string;
  onClearError?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToRegister, onNavigateToForgotPassword, loginError, onClearError }) => {
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
      <div className="mb-8">
        <img
          src="https://www.platopotato.com/NFT/Tribes/assets/Tribeslogo.png"
          alt="Radix Tribes Logo"
          className="h-24 w-auto mx-auto"
        />
      </div>
      <Card title="Login" className="max-w-sm w-full">
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
      </Card>
    </div>
  );
};

export default Login;