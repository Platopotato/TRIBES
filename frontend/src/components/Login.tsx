
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
          className="absolute bottom-0 w-full h-2/3 bg-black"
          style={{
            transform: `translateX(${mousePos.x * 0.05}px)`,
            clipPath: 'polygon(0 100%, 0 40%, 8% 45%, 15% 35%, 22% 40%, 30% 30%, 38% 35%, 45% 25%, 52% 30%, 60% 20%, 68% 25%, 75% 15%, 82% 20%, 90% 10%, 100% 15%, 100% 100%)',
            opacity: 0.9
          }}
        ></div>

        {/* Mid Mountains - Layer 2 */}
        <div
          className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-black to-gray-800"
          style={{
            transform: `translateX(${mousePos.x * 0.1}px)`,
            clipPath: 'polygon(0 100%, 0 60%, 12% 65%, 20% 50%, 28% 55%, 35% 45%, 42% 50%, 50% 40%, 58% 45%, 65% 35%, 72% 40%, 80% 30%, 88% 35%, 95% 25%, 100% 30%, 100% 100%)',
            opacity: 0.95
          }}
        ></div>

        {/* Ruined City Skyline */}
        <div
          className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-black to-gray-700"
          style={{
            transform: `translateX(${mousePos.x * 0.15}px)`,
            clipPath: 'polygon(0 100%, 0 70%, 5% 75%, 8% 65%, 12% 70%, 15% 60%, 18% 65%, 22% 55%, 25% 60%, 30% 50%, 35% 55%, 40% 45%, 45% 50%, 50% 40%, 55% 45%, 60% 35%, 65% 40%, 70% 30%, 75% 35%, 80% 25%, 85% 30%, 90% 20%, 95% 25%, 100% 15%, 100% 100%)',
            opacity: 1
          }}
        ></div>

        {/* Foreground Wasteland */}
        <div
          className="absolute bottom-0 w-full h-1/4 bg-gradient-to-t from-black via-gray-800 to-transparent"
          style={{
            transform: `translateX(${mousePos.x * 0.3}px)`,
            clipPath: 'polygon(0 100%, 0 85%, 10% 80%, 15% 85%, 25% 75%, 35% 80%, 45% 70%, 55% 75%, 65% 65%, 75% 70%, 85% 60%, 95% 65%, 100% 55%, 100% 100%)',
            opacity: 1
          }}
        ></div>

        {/* Tribal Settlement Elements */}
        <div
          className="absolute bottom-0 left-0 w-full h-1/5"
          style={{ transform: `translateX(${mousePos.x * 0.4}px)` }}
        >
          {/* MASSIVE Tribal Totems - Much Larger and More Visible */}
          <div className="absolute bottom-0 left-1/6 w-16 h-64 bg-gradient-to-t from-amber-900 via-amber-600 to-amber-300 transform rotate-12 shadow-2xl animate-glow"
               style={{
                 boxShadow: '0 0 40px rgba(251, 146, 60, 1), 0 0 80px rgba(251, 146, 60, 0.8), 0 0 120px rgba(251, 146, 60, 0.4)',
                 filter: 'drop-shadow(0 0 20px rgba(251, 146, 60, 0.8))'
               }}></div>
          <div className="absolute bottom-0 right-1/4 w-20 h-80 bg-gradient-to-t from-red-900 via-red-600 to-red-300 transform -rotate-6 shadow-2xl animate-shimmer"
               style={{
                 boxShadow: '0 0 50px rgba(239, 68, 68, 1), 0 0 100px rgba(239, 68, 68, 0.8), 0 0 150px rgba(239, 68, 68, 0.4)',
                 filter: 'drop-shadow(0 0 25px rgba(239, 68, 68, 0.8))'
               }}></div>
          <div className="absolute bottom-0 left-1/3 w-12 h-56 bg-gradient-to-t from-orange-900 via-orange-600 to-orange-300 transform rotate-3 shadow-xl animate-glow"
               style={{
                 boxShadow: '0 0 30px rgba(249, 115, 22, 1), 0 0 60px rgba(249, 115, 22, 0.8), 0 0 90px rgba(249, 115, 22, 0.4)',
                 filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.8))'
               }}></div>

          {/* HUGE Weapon Racks and Structures */}
          <div className="absolute bottom-0 left-1/8 w-8 h-48 bg-gradient-to-t from-gray-800 to-gray-600 shadow-2xl"></div>
          <div className="absolute bottom-0 left-1/8 w-32 h-6 bg-gradient-to-r from-gray-700 to-gray-500 transform rotate-45 translate-y-12 shadow-xl"></div>
          <div className="absolute bottom-0 right-1/6 w-8 h-40 bg-gradient-to-t from-gray-800 to-gray-600 shadow-2xl"></div>
          <div className="absolute bottom-0 right-1/6 w-28 h-6 bg-gradient-to-r from-gray-700 to-gray-500 transform -rotate-45 translate-y-10 shadow-xl"></div>

          {/* MASSIVE Campfire with Towering Flames */}
          <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-orange-500 rounded-full opacity-90 animate-pulse shadow-2xl"
               style={{
                 boxShadow: '0 0 60px rgba(249, 115, 22, 1), 0 0 120px rgba(249, 115, 22, 0.8), 0 0 180px rgba(249, 115, 22, 0.4)',
                 filter: 'drop-shadow(0 0 30px rgba(249, 115, 22, 1))'
               }}></div>
          <div className="absolute bottom-0 left-1/2 w-16 h-16 bg-yellow-300 rounded-full opacity-95 animate-pulse shadow-xl"
               style={{
                 boxShadow: '0 0 40px rgba(250, 204, 21, 1), 0 0 80px rgba(250, 204, 21, 0.9)',
                 filter: 'drop-shadow(0 0 20px rgba(250, 204, 21, 1))'
               }}></div>

          {/* TALL Tribal Banners */}
          <div className="absolute bottom-0 left-1/5 w-3 h-56 bg-gradient-to-t from-gray-800 to-gray-600 shadow-xl"></div>
          <div className="absolute bottom-40 left-1/5 w-16 h-24 bg-red-700 opacity-90 animate-pulse transform origin-left shadow-lg"
               style={{
                 clipPath: 'polygon(0 0, 100% 0, 80% 50%, 100% 100%, 0 100%)',
                 filter: 'drop-shadow(0 0 10px rgba(185, 28, 28, 0.8))'
               }}></div>
          <div className="absolute bottom-0 right-1/5 w-3 h-48 bg-gradient-to-t from-gray-800 to-gray-600 shadow-xl"></div>
          <div className="absolute bottom-32 right-1/5 w-12 h-20 bg-amber-700 opacity-90 animate-pulse transform origin-left shadow-lg"
               style={{
                 clipPath: 'polygon(0 0, 100% 0, 80% 50%, 100% 100%, 0 100%)',
                 filter: 'drop-shadow(0 0 8px rgba(180, 83, 9, 0.8))'
               }}></div>

          {/* Additional Tribal Structures */}
          <div className="absolute bottom-0 left-2/3 w-6 h-36 bg-gradient-to-t from-stone-800 to-stone-600 transform rotate-6 shadow-xl"></div>
          <div className="absolute bottom-0 left-3/4 w-4 h-28 bg-gradient-to-t from-stone-800 to-stone-600 transform -rotate-12 shadow-lg"></div>
        </div>

        {/* Atmospheric Haze */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
      </div>

      {/* Dramatic Floating Particles */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              bottom: `${particle.y}%`,
              opacity: particle.opacity,
              width: `${particle.size * 2}px`,
              height: `${particle.size * 2}px`,
              boxShadow: `0 0 ${particle.size * 4}px rgba(251, 146, 60, 1), 0 0 ${particle.size * 8}px rgba(251, 146, 60, 0.8), 0 0 ${particle.size * 12}px rgba(251, 146, 60, 0.4)`,
              background: `radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(251, 146, 60, 1) 30%, rgba(251, 146, 60, 0.8) 70%, rgba(251, 146, 60, 0.2) 100%)`,
              animation: `float ${3 + Math.random() * 2}s ease-in-out infinite alternate`,
              filter: 'blur(0.5px)'
            }}
          />
        ))}
      </div>

      {/* Large Ember Particles */}
      <div className="absolute inset-0 pointer-events-none z-25">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`ember-${i}`}
            className="absolute rounded-full animate-pulse"
            style={{
              left: `${20 + i * 10}%`,
              bottom: `${10 + (i % 3) * 15}%`,
              width: '8px',
              height: '8px',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(251, 146, 60, 1) 50%, rgba(239, 68, 68, 0.8) 100%)',
              boxShadow: '0 0 15px rgba(251, 146, 60, 1), 0 0 30px rgba(251, 146, 60, 0.6)',
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${2 + i * 0.3}s`
            }}
          />
        ))}
      </div>

      {/* Dramatic Atmospheric Effects */}
      <div className="absolute inset-0 pointer-events-none z-15">
        {/* Intense Heat Shimmer */}
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-orange-500/30 via-orange-400/10 to-transparent animate-pulse"
             style={{ animationDuration: '3s' }}></div>

        {/* Large Dust Clouds */}
        <div
          className="absolute bottom-1/4 left-1/6 w-48 h-24 bg-orange-400/40 rounded-full blur-2xl animate-pulse"
          style={{
            transform: `translateX(${mousePos.x * 0.3}px)`,
            animationDuration: '4s'
          }}
        ></div>
        <div
          className="absolute bottom-1/3 right-1/4 w-40 h-20 bg-red-400/35 rounded-full blur-xl animate-pulse"
          style={{
            transform: `translateX(${mousePos.x * -0.25}px)`,
            animationDuration: '5s'
          }}
        ></div>
        <div
          className="absolute bottom-1/5 center w-36 h-18 bg-amber-400/30 rounded-full blur-xl animate-pulse"
          style={{
            left: '40%',
            transform: `translateX(${mousePos.x * 0.15}px)`,
            animationDuration: '3.5s'
          }}
        ></div>

        {/* Smoke Effects */}
        <div
          className="absolute bottom-1/6 left-1/2 w-20 h-40 bg-gray-600/20 rounded-full blur-lg animate-pulse"
          style={{
            transform: `translateX(${mousePos.x * 0.1}px) translateY(-10px)`,
            animationDuration: '6s'
          }}
        ></div>

        {/* Atmospheric Haze */}
        <div className="absolute bottom-0 left-0 w-full h-3/4 bg-gradient-to-t from-black/20 via-orange-900/10 to-transparent"></div>
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