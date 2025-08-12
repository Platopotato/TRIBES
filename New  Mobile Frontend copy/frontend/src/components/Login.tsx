
import React, { useState, useEffect } from 'react';
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
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToRegister, onNavigateToForgotPassword, loginError, onClearError, announcements = [], announcementsEnabled = false }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    opacity: number;
  }>>([]);

  // Mouse tracking for parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Initialize particles
  useEffect(() => {
    const newParticles = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 80,
      size: 2 + Math.random() * 4,
      opacity: 0.3 + Math.random() * 0.4
    }));
    setParticles(newParticles);

    // Animate particles
    const interval = setInterval(() => {
      setParticles(prev => prev.map(particle => ({
        ...particle,
        y: particle.y > 100 ? -10 : particle.y + 0.2 + Math.random() * 0.3,
        x: particle.x + (Math.random() - 0.5) * 0.1
      })));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Clear any previous errors
    if (onClearError) onClearError(); // Clear any previous login errors
    Auth.login(username, password);
    // Login success/failure will be handled by Socket.IO events
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Epic Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-900 via-red-900 to-black"></div>

      {/* Realistic Mountain Ranges with Parallax */}
      <div className="absolute inset-0 z-5">
        {/* Far Mountains - Layer 1 - More Realistic */}
        <div
          className="absolute bottom-0 w-full h-3/4 bg-gradient-to-t from-black via-gray-900 to-gray-800"
          style={{
            transform: `translateX(${mousePos.x * 0.02}px)`,
            clipPath: 'polygon(0 100%, 0 45%, 5% 42%, 12% 38%, 18% 35%, 25% 32%, 32% 28%, 38% 25%, 45% 22%, 52% 18%, 58% 15%, 65% 12%, 72% 15%, 78% 18%, 85% 22%, 92% 25%, 100% 28%, 100% 100%)',
            opacity: 0.85
          }}
        ></div>

        {/* Mid Mountains - Layer 2 - More Realistic */}
        <div
          className="absolute bottom-0 w-full h-3/5 bg-gradient-to-t from-black via-gray-800 to-gray-700"
          style={{
            transform: `translateX(${mousePos.x * 0.05}px)`,
            clipPath: 'polygon(0 100%, 0 55%, 8% 52%, 15% 48%, 22% 45%, 28% 42%, 35% 38%, 42% 35%, 48% 32%, 55% 28%, 62% 25%, 68% 28%, 75% 32%, 82% 35%, 88% 38%, 95% 42%, 100% 45%, 100% 100%)',
            opacity: 0.9
          }}
        ></div>

        {/* Near Mountains - Layer 3 - More Realistic */}
        <div
          className="absolute bottom-0 w-full h-2/5 bg-gradient-to-t from-black via-gray-700 to-gray-600"
          style={{
            transform: `translateX(${mousePos.x * 0.08}px)`,
            clipPath: 'polygon(0 100%, 0 65%, 10% 62%, 18% 58%, 25% 55%, 32% 52%, 40% 48%, 47% 45%, 55% 42%, 62% 38%, 70% 35%, 77% 38%, 85% 42%, 92% 45%, 100% 48%, 100% 100%)',
            opacity: 0.95
          }}
        ></div>

        {/* Foreground Hills - More Realistic */}
        <div
          className="absolute bottom-0 w-full h-1/4 bg-gradient-to-t from-black via-gray-800 to-transparent"
          style={{
            transform: `translateX(${mousePos.x * 0.12}px)`,
            clipPath: 'polygon(0 100%, 0 75%, 15% 72%, 25% 68%, 35% 65%, 45% 62%, 55% 58%, 65% 55%, 75% 58%, 85% 62%, 95% 65%, 100% 68%, 100% 100%)',
            opacity: 1
          }}
        ></div>

        {/* Subtle Hex Grid Pattern - Strategic Game Motif */}
        <div className="absolute bottom-0 left-0 w-full h-32 opacity-15 pointer-events-none">
          {/* Mobile-optimized hex grid */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`hex-${i}`}
              className="absolute border border-amber-500/40"
              style={{
                left: `${8 + i * 12}%`,
                bottom: `${4 + (i % 2) * 12}px`,
                width: '16px',
                height: '16px',
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
                transform: `translateX(${mousePos.x * (0.05 + i * 0.01)}px)`,
                animation: `pulse ${3 + i * 0.3}s ease-in-out infinite alternate`
              }}
            />
          ))}
        </div>
      </div>

      {/* Content Container */}
      <div className="relative z-30 flex flex-col items-center justify-center min-h-screen p-4">
        {/* Epic Logo with Glow */}
        <div className="mb-8 max-w-sm w-full">
          <img
            src="https://www.platopotato.com/NFT/Tribes/assets/Tribeslogo.png"
            alt="Radix Tribes Logo"
            className="w-full h-32 object-contain rounded-lg border-2 border-amber-500 p-4 bg-slate-800/70 backdrop-blur-sm"
            style={{
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.5), 0 0 40px rgba(245, 158, 11, 0.2)',
              filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.3))'
            }}
          />
        </div>

        <LoginAnnouncements
          announcements={announcements}
          isEnabled={announcementsEnabled}
        />

        <div
          className="max-w-sm w-full bg-slate-800/80 backdrop-blur-md border border-amber-500/30 rounded-lg p-6"
          style={{
            boxShadow: '0 0 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(245, 158, 11, 0.2)',
            backdropFilter: 'blur(12px)'
          }}
        >
          <h2 className="text-xl font-bold text-amber-500 mb-4 text-center">Login</h2>
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
        </div>
      </div>

      {/* Refined Atmospheric Particles */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              bottom: `${particle.y}%`,
              opacity: particle.opacity * 0.6,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              boxShadow: `0 0 ${particle.size * 2}px rgba(251, 146, 60, 0.8), 0 0 ${particle.size * 4}px rgba(251, 146, 60, 0.4)`,
              background: `radial-gradient(circle, rgba(251, 146, 60, 0.9) 0%, rgba(251, 146, 60, 0.6) 50%, rgba(251, 146, 60, 0.2) 100%)`,
              animation: `float ${4 + Math.random() * 3}s ease-in-out infinite alternate`,
              filter: 'blur(1px)'
            }}
          />
        ))}
      </div>

      {/* Refined Atmospheric Effects */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Subtle Heat Shimmer */}
        <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-orange-500/15 via-orange-400/5 to-transparent animate-pulse"
             style={{ animationDuration: '4s' }}></div>

        {/* Gentle Atmospheric Haze */}
        <div
          className="absolute bottom-1/5 left-1/4 w-32 h-16 bg-orange-400/20 rounded-full blur-2xl animate-pulse"
          style={{
            transform: `translateX(${mousePos.x * 0.08}px)`,
            animationDuration: '6s'
          }}
        ></div>

        {/* Subtle Depth Gradient */}
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/15 via-gray-900/8 to-transparent"></div>
      </div>
    </div>
  );
};

export default Login;