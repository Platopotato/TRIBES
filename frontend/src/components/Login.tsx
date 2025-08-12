
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
  gameSuspended?: boolean;
  suspensionMessage?: string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToRegister, onNavigateToForgotPassword, loginError, onClearError, announcements = [], announcementsEnabled = false, gameSuspended = false, suspensionMessage }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState<Array<{id: number, x: number, y: number, opacity: number, size: number, speed: number}>>([]);

  // Mouse tracking for parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Particle system
  useEffect(() => {
    const createParticle = () => ({
      id: Math.random(),
      x: Math.random() * 100,
      y: 100,
      opacity: Math.random() * 0.6 + 0.2,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 0.5 + 0.2
    });

    const initialParticles = Array.from({ length: 15 }, createParticle);
    setParticles(initialParticles);

    const interval = setInterval(() => {
      setParticles(prev => {
        const updated = prev.map(p => ({
          ...p,
          y: p.y - p.speed,
          opacity: p.y < 20 ? p.opacity - 0.01 : p.opacity
        })).filter(p => p.y > -10 && p.opacity > 0);

        // Add new particles occasionally
        if (Math.random() < 0.3 && updated.length < 20) {
          updated.push(createParticle());
        }

        return updated;
      });
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
      <div className="absolute inset-0">
        {/* Sky Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-orange-400 via-red-500 to-purple-900"></div>

        {/* Mountain Silhouettes - Far Background */}
        <div
          className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-black/80 to-transparent"
          style={{
            transform: `translateX(${mousePos.x * 0.1}px)`,
            clipPath: 'polygon(0 100%, 0 60%, 15% 65%, 25% 45%, 40% 55%, 60% 35%, 75% 50%, 90% 40%, 100% 45%, 100% 100%)'
          }}
        ></div>

        {/* Distant Ruins */}
        <div
          className="absolute bottom-0 w-full h-1/4 bg-gradient-to-t from-black/60 to-transparent"
          style={{
            transform: `translateX(${mousePos.x * 0.2}px)`,
            clipPath: 'polygon(0 100%, 0 80%, 10% 75%, 12% 70%, 18% 72%, 25% 65%, 35% 70%, 45% 60%, 55% 65%, 70% 55%, 80% 60%, 90% 50%, 100% 55%, 100% 100%)'
          }}
        ></div>

        {/* Foreground Elements */}
        <div
          className="absolute bottom-0 left-0 w-full h-1/5"
          style={{ transform: `translateX(${mousePos.x * 0.5}px)` }}
        >
          {/* Tribal Totems */}
          <div className="absolute bottom-0 left-1/4 w-2 h-16 bg-gradient-to-t from-amber-800 to-amber-600 transform rotate-12"></div>
          <div className="absolute bottom-0 right-1/3 w-3 h-20 bg-gradient-to-t from-red-900 to-red-700 transform -rotate-6"></div>

          {/* Weapon Racks */}
          <div className="absolute bottom-0 left-1/6 w-1 h-12 bg-gray-600"></div>
          <div className="absolute bottom-0 left-1/6 w-8 h-1 bg-gray-700 transform rotate-45 translate-y-2"></div>
        </div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute w-1 h-1 bg-orange-300 rounded-full animate-pulse"
            style={{
              left: `${particle.x}%`,
              bottom: `${particle.y}%`,
              opacity: particle.opacity,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              boxShadow: '0 0 4px rgba(251, 146, 60, 0.8)'
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        {/* Epic Title */}
        <div className="mb-12 text-center">
          <h1 className="text-6xl md:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 drop-shadow-2xl mb-4 tracking-wider">
            RADIX
          </h1>
          <h2 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-500 to-orange-400 drop-shadow-2xl tracking-widest">
            TRIBES
          </h2>
          <div className="mt-4 text-amber-300 text-lg md:text-xl font-semibold tracking-wide opacity-90">
            ⚔️ Survive • Conquer • Rule the Wasteland ⚔️
          </div>
        </div>

        {/* Game Suspension Warning */}
        {gameSuspended && (
          <div className="max-w-md w-full mb-8">
            <div className="bg-red-900/80 border-2 border-red-500 rounded-lg p-6 text-center backdrop-blur-sm shadow-2xl">
              <div className="flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-red-300 font-bold text-xl">Game Suspended</span>
              </div>
              <p className="text-red-100 text-base mb-4">
                {suspensionMessage || 'The wasteland is under maintenance. The tribes await your return.'}
              </p>
              <p className="text-amber-300 text-sm">
                🔑 Chieftain access remains available
              </p>
            </div>
          </div>
        )}

        <LoginAnnouncements />

        {/* Epic Login Panel */}
        <div className="max-w-md w-full">
          <div className="bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-md border-2 border-amber-500/50 rounded-xl shadow-2xl p-8 relative overflow-hidden">
            {/* Tribal Decorations */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"></div>
            <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500"></div>

            {/* Corner Decorations */}
            <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-amber-400"></div>
            <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-amber-400"></div>
            <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-amber-400"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-amber-400"></div>

            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                {gameSuspended ? "🔑 Chieftain Access" : "⚔️ Enter the Wasteland"}
              </h3>
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-bold text-amber-300 mb-2 tracking-wide">
                      🏴‍☠️ Tribal Leader
                    </label>
                    <input
                      type="text"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-800/80 border-2 border-slate-600 rounded-lg p-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 hover:border-amber-600"
                      placeholder="Enter your tribal name..."
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-bold text-amber-300 mb-2 tracking-wide">
                      🗝️ Sacred Code
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-800/80 border-2 border-slate-600 rounded-lg p-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 hover:border-amber-600"
                      placeholder="Enter your secret..."
                      required
                    />
                  </div>
                </div>
                {(error || loginError) && (
                  <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 text-center">
                    <div className="text-red-300 text-sm font-medium">
                      ⚠️ {error || loginError}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl border-2 border-amber-500"
                >
                  ⚔️ Enter the Wasteland ⚔️
                </Button>

                <div className="flex justify-between text-sm">
                  <button type="button" onClick={onNavigateToForgotPassword} className="font-medium text-amber-400 hover:text-amber-300 transition-colors duration-200">
                    🔍 Lost Sacred Code?
                  </button>
                  <button type="button" onClick={onSwitchToRegister} className="font-medium text-amber-400 hover:text-amber-300 transition-colors duration-200">
                    🏕️ Forge New Tribe
                  </button>
                </div>
              </form>

              {/* Version Number */}
              <div className="text-center text-xs text-slate-400 mt-4 opacity-70">
                Wasteland Build: 142-EPIC-CINEMATIC-LOGIN
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Atmospheric Effects */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
    </div>
  );
};

export default Login;