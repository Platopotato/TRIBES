
import React from 'react';
import { Tribe, User, GamePhase, TRIBE_ICONS } from '@radix-tribes/shared';
import Button from './ui/Button';

interface HeaderProps {
  currentUser: User;
  playerTribe?: Tribe;
  onLogout: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToLeaderboard?: () => void;
  onOpenHelp: () => void;
  onOpenCodex: () => void;
  turn: number;
  gamePhase: GamePhase | 'observing' | 'waiting';
}

const Header: React.FC<HeaderProps> = ({ currentUser, playerTribe, onLogout, onNavigateToAdmin, onNavigateToLeaderboard, onOpenHelp, onOpenCodex, turn, gamePhase }) => {
  const phaseText: {[key in typeof gamePhase]: string} = {
      planning: 'Action Planning',
      processing: 'Processing...',
      results: 'Turn Results',
      observing: 'Observing',
      waiting: 'Waiting for Admin',
  }

  const getPhaseColor = () => {
      switch(gamePhase) {
          case 'processing':
          case 'waiting':
              return 'text-yellow-400 animate-pulse';
          default:
              return 'text-amber-400';
      }
  }


  return (
    <header className="bg-slate-800 p-4 rounded-lg shadow-lg flex flex-col sm:flex-row justify-between items-center border-b-4 border-amber-600">
      <div className="flex items-center space-x-4">
        {playerTribe && (
          <>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-white/20 shadow-lg"
              style={{ backgroundColor: playerTribe.color }}
            >
                <span className="text-2xl drop-shadow-sm">
                    {TRIBE_ICONS[playerTribe.icon]}
                </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">{playerTribe.tribeName}</h1>
              <p className="text-sm text-slate-400">Led by {playerTribe.playerName}</p>
            </div>
          </>
        )}
        {!playerTribe && (
             <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">Observer</h1>
              <p className="text-sm text-slate-400">User: {currentUser.username}</p>
            </div>
        )}
      </div>
      <div className="text-center sm:text-right mt-4 sm:mt-0 flex items-center space-x-4">
        <div>
            <h2 className="text-lg font-semibold text-slate-300">Turn {turn}</h2>
            <p className={`text-sm ${getPhaseColor()}`}>{phaseText[gamePhase]}</p>
        </div>
         {onNavigateToLeaderboard && (
             <Button onClick={onNavigateToLeaderboard} variant="secondary" className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Leaderboard</span>
            </Button>
         )}
         <Button onClick={onOpenCodex} variant="secondary" className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>Codex</span>
          </Button>
         <Button onClick={onOpenHelp} variant="secondary" className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.79 4 4 0 .863-.37 1.64-.945 2.201a3.978 3.978 0 01-2.122 1.015M12 18v.01M12 21a9 9 0 110-18 9 9 0 010 18z" />
            </svg>
            <span>Help</span>
          </Button>
         {currentUser.role === 'admin' && <Button onClick={onNavigateToAdmin} variant="secondary">Admin Panel</Button>}
         <Button onClick={onLogout}>Logout</Button>
      </div>
    </header>
  );
};

export default Header;