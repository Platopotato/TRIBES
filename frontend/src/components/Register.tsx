import React, { useState } from 'react';
import * as Auth from '../lib/auth';
import { User } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { SECURITY_QUESTIONS } from '@radix-tribes/shared';

interface RegisterProps {
  onRegisterSuccess: (user: User) => void;
  onSwitchToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
    }
    if (!securityAnswer.trim()) {
      setError('Security answer is required.');
      return;
    }

    Auth.register(username, password, securityQuestion, securityAnswer);
    // Registration success/failure will be handled by Socket.IO events
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
      <Card title="Register a New Account" className="max-w-sm w-full">
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="username-reg" className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input
              type="text"
              id="username-reg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password-reg" className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              id="password-reg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>
          <div>
            <label htmlFor="confirm-password-reg" className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
            <input
              type="password"
              id="confirm-password-reg"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>

          <div className="pt-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-300 mb-2">Password Recovery</h3>
             <div>
                <label htmlFor="security-question" className="block text-sm font-medium text-slate-300 mb-1">Security Question</label>
                <select
                  id="security-question"
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500"
                >
                  {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
            </div>
            <div className="mt-4">
                <label htmlFor="security-answer" className="block text-sm font-medium text-slate-300 mb-1">Security Answer (case-insensitive)</label>
                <input
                  type="password"
                  id="security-answer"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full">
            Register
          </Button>
          <p className="text-sm text-center text-slate-400">
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToLogin} className="font-medium text-amber-500 hover:text-amber-400">
              Login
            </button>
          </p>
        </form>
      </Card>
    </div>
  );
};

export default Register;
