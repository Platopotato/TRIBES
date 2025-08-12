
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

        {/* Far Mountains - Layer 1 */}
        <div
          className="absolute bottom-0 w-full h-2/3 bg-black opacity-60"
          style={{
            transform: `translateX(${mousePos.x * 0.05}px)`,
            clipPath: 'polygon(0 100%, 0 40%, 8% 45%, 15% 35%, 22% 40%, 30% 30%, 38% 35%, 45% 25%, 52% 30%, 60% 20%, 68% 25%, 75% 15%, 82% 20%, 90% 10%, 100% 15%, 100% 100%)'
          }}
        ></div>

        {/* Mid Mountains - Layer 2 */}
        <div
          className="absolute bottom-0 w-full h-1/2 bg-black opacity-70"
          style={{
            transform: `translateX(${mousePos.x * 0.1}px)`,
            clipPath: 'polygon(0 100%, 0 60%, 12% 65%, 20% 50%, 28% 55%, 35% 45%, 42% 50%, 50% 40%, 58% 45%, 65% 35%, 72% 40%, 80% 30%, 88% 35%, 95% 25%, 100% 30%, 100% 100%)'
          }}
        ></div>

        {/* Ruined City Skyline */}
        <div
          className="absolute bottom-0 w-full h-1/3 bg-black opacity-80"
          style={{
            transform: `translateX(${mousePos.x * 0.15}px)`,
            clipPath: 'polygon(0 100%, 0 70%, 5% 75%, 8% 65%, 12% 70%, 15% 60%, 18% 65%, 22% 55%, 25% 60%, 30% 50%, 35% 55%, 40% 45%, 45% 50%, 50% 40%, 55% 45%, 60% 35%, 65% 40%, 70% 30%, 75% 35%, 80% 25%, 85% 30%, 90% 20%, 95% 25%, 100% 15%, 100% 100%)'
          }}
        ></div>

        {/* Foreground Wasteland */}
        <div
          className="absolute bottom-0 w-full h-1/4 bg-gradient-to-t from-black/90 to-transparent"
          style={{
            transform: `translateX(${mousePos.x * 0.3}px)`,
            clipPath: 'polygon(0 100%, 0 85%, 10% 80%, 15% 85%, 25% 75%, 35% 80%, 45% 70%, 55% 75%, 65% 65%, 75% 70%, 85% 60%, 95% 65%, 100% 55%, 100% 100%)'
          }}
        ></div>

        {/* Tribal Settlement Elements */}
        <div
          className="absolute bottom-0 left-0 w-full h-1/5"
          style={{ transform: `translateX(${mousePos.x * 0.4}px)` }}
        >
          {/* Large Tribal Totems with Glow */}
          <div className="absolute bottom-0 left-1/6 w-4 h-24 bg-gradient-to-t from-amber-900 via-amber-700 to-amber-500 transform rotate-12 shadow-2xl animate-glow"></div>
          <div className="absolute bottom-0 right-1/4 w-5 h-32 bg-gradient-to-t from-red-900 via-red-700 to-red-500 transform -rotate-6 shadow-2xl animate-shimmer"></div>
          <div className="absolute bottom-0 left-1/3 w-3 h-20 bg-gradient-to-t from-orange-900 via-orange-700 to-orange-500 transform rotate-3 shadow-xl animate-glow"></div>

          {/* Weapon Racks and Structures */}
          <div className="absolute bottom-0 left-1/8 w-2 h-16 bg-gray-700 shadow-lg"></div>
          <div className="absolute bottom-0 left-1/8 w-12 h-2 bg-gray-600 transform rotate-45 translate-y-4 shadow-md"></div>
          <div className="absolute bottom-0 right-1/6 w-2 h-14 bg-gray-700 shadow-lg"></div>
          <div className="absolute bottom-0 right-1/6 w-10 h-2 bg-gray-600 transform -rotate-45 translate-y-3 shadow-md"></div>

          {/* Campfire Glow */}
          <div className="absolute bottom-0 left-1/2 w-8 h-8 bg-orange-500 rounded-full opacity-60 animate-pulse shadow-2xl"></div>
          <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-yellow-400 rounded-full opacity-80 animate-pulse shadow-xl"></div>
        </div>

        {/* Atmospheric Haze */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
      </div>

      {/* Enhanced Floating Particles */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute bg-orange-400 rounded-full"
            style={{
              left: `${particle.x}%`,
              bottom: `${particle.y}%`,
              opacity: particle.opacity,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              boxShadow: `0 0 ${particle.size * 2}px rgba(251, 146, 60, 0.9), 0 0 ${particle.size * 4}px rgba(251, 146, 60, 0.5)`,
              background: `radial-gradient(circle, rgba(251, 146, 60, 1) 0%, rgba(251, 146, 60, 0.8) 50%, rgba(251, 146, 60, 0.3) 100%)`,
              animation: `float ${3 + Math.random() * 2}s ease-in-out infinite alternate`
            }}
          />
        ))}
      </div>

      {/* Additional Atmospheric Effects */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Heat Shimmer Effect */}
        <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-orange-500/10 via-transparent to-transparent animate-pulse"></div>

        {/* Dust Clouds */}
        <div
          className="absolute bottom-1/4 left-1/4 w-32 h-16 bg-orange-300/20 rounded-full blur-xl animate-pulse"
          style={{ transform: `translateX(${mousePos.x * 0.2}px)` }}
        ></div>
        <div
          className="absolute bottom-1/3 right-1/3 w-24 h-12 bg-red-300/15 rounded-full blur-lg animate-pulse"
          style={{ transform: `translateX(${mousePos.x * -0.15}px)` }}
        ></div>
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