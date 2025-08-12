
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
  const [particles, setParticles] = useState<Array<{id: number, x: number, y: number, opacity: number, size: number, speed: number, drift: number}>>([]);

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

  // Enhanced particle system
  useEffect(() => {
    const createParticle = () => ({
      id: Math.random(),
      x: Math.random() * 100,
      y: 100,
      opacity: Math.random() * 0.8 + 0.3,
      size: Math.random() * 4 + 2,
      speed: Math.random() * 0.8 + 0.3,
      drift: (Math.random() - 0.5) * 0.2
    });

    const initialParticles = Array.from({ length: 25 }, createParticle);
    setParticles(initialParticles);

    const interval = setInterval(() => {
      setParticles(prev => {
        const updated = prev.map(p => ({
          ...p,
          y: p.y - p.speed,
          x: p.x + p.drift,
          opacity: p.y < 30 ? p.opacity - 0.02 : p.opacity
        })).filter(p => p.y > -10 && p.opacity > 0 && p.x > -5 && p.x < 105);

        // Add new particles more frequently
        if (Math.random() < 0.4 && updated.length < 30) {
          updated.push(createParticle());
        }

        return updated;
      });
    }, 80);

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

        {/* Tribal Settlement Elements */}
        <div
          className="absolute bottom-0 left-0 w-full h-1/5"
          style={{ transform: `translateX(${mousePos.x * 0.4}px)` }}
        >
          {/* Subtle Hex Grid Pattern - Strategic Game Motif */}
          <div className="absolute bottom-0 left-0 w-full h-32 opacity-20 pointer-events-none">
            {/* Large Hex Grid */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={`hex-${i}`}
                className="absolute border border-amber-500/30"
                style={{
                  left: `${5 + i * 8}%`,
                  bottom: `${2 + (i % 3) * 8}px`,
                  width: '24px',
                  height: '24px',
                  clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
                  transform: `translateX(${mousePos.x * (0.05 + i * 0.01)}px)`,
                  animation: `pulse ${3 + i * 0.2}s ease-in-out infinite alternate`
                }}
              />
            ))}

            {/* Medium Hex Grid */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`hex-med-${i}`}
                className="absolute border border-orange-500/25"
                style={{
                  left: `${10 + i * 11}%`,
                  bottom: `${8 + (i % 2) * 12}px`,
                  width: '18px',
                  height: '18px',
                  clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
                  transform: `translateX(${mousePos.x * (0.08 + i * 0.015)}px)`,
                  animation: `pulse ${4 + i * 0.3}s ease-in-out infinite alternate`
                }}
              />
            ))}

            {/* Small Hex Grid */}
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={`hex-small-${i}`}
                className="absolute border border-red-500/20"
                style={{
                  left: `${3 + i * 6.5}%`,
                  bottom: `${1 + (i % 4) * 6}px`,
                  width: '12px',
                  height: '12px',
                  clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
                  transform: `translateX(${mousePos.x * (0.1 + i * 0.008)}px)`,
                  animation: `pulse ${2.5 + i * 0.15}s ease-in-out infinite alternate`
                }}
              />
            ))}
          </div>

          {/* Subtle Strategic Markers */}
          <div className="absolute bottom-4 left-1/4 w-3 h-3 bg-amber-500/40 rounded-full animate-pulse"
               style={{
                 boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
                 transform: `translateX(${mousePos.x * 0.15}px)`
               }}></div>
          <div className="absolute bottom-6 right-1/3 w-2 h-2 bg-orange-500/40 rounded-full animate-pulse"
               style={{
                 boxShadow: '0 0 6px rgba(249, 115, 22, 0.6)',
                 transform: `translateX(${mousePos.x * 0.12}px)`,
                 animationDelay: '1s'
               }}></div>
          <div className="absolute bottom-8 left-2/3 w-2.5 h-2.5 bg-red-500/40 rounded-full animate-pulse"
               style={{
                 boxShadow: '0 0 7px rgba(239, 68, 68, 0.6)',
                 transform: `translateX(${mousePos.x * 0.18}px)`,
                 animationDelay: '2s'
               }}></div>
        </div>

        {/* Atmospheric Haze */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
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

      {/* Subtle Dust Motes */}
      <div className="absolute inset-0 pointer-events-none z-15">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={`dust-${i}`}
            className="absolute rounded-full animate-pulse"
            style={{
              left: `${5 + i * 8}%`,
              bottom: `${5 + (i % 4) * 20}%`,
              width: '3px',
              height: '3px',
              background: 'rgba(245, 158, 11, 0.4)',
              boxShadow: '0 0 6px rgba(245, 158, 11, 0.3)',
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${5 + i * 0.4}s`,
              transform: `translateX(${mousePos.x * (0.02 + i * 0.005)}px)`
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
        <div
          className="absolute bottom-1/4 right-1/3 w-28 h-14 bg-amber-400/15 rounded-full blur-xl animate-pulse"
          style={{
            transform: `translateX(${mousePos.x * -0.06}px)`,
            animationDuration: '7s'
          }}
        ></div>

        {/* Subtle Depth Gradient */}
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/15 via-gray-900/8 to-transparent"></div>
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

      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes float {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(180deg); }
            100% { transform: translateY(0px) rotate(360deg); }
          }

          @keyframes shimmer {
            0% { opacity: 0.3; }
            50% { opacity: 0.7; }
            100% { opacity: 0.3; }
          }

          @keyframes glow {
            0%, 100% {
              box-shadow: 0 0 5px rgba(251, 146, 60, 0.5), 0 0 10px rgba(251, 146, 60, 0.3), 0 0 15px rgba(251, 146, 60, 0.1);
            }
            50% {
              box-shadow: 0 0 10px rgba(251, 146, 60, 0.8), 0 0 20px rgba(251, 146, 60, 0.6), 0 0 30px rgba(251, 146, 60, 0.4);
            }
          }

          .animate-shimmer {
            animation: shimmer 4s ease-in-out infinite;
          }

          .animate-glow {
            animation: glow 3s ease-in-out infinite;
          }
        `
      }} />
    </div>
  );
};

export default Login;