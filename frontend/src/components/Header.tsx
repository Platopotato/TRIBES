
import React from 'react';
import { Tribe, User, GamePhase, TRIBE_ICONS, TurnDeadline as TurnDeadlineType } from '@radix-tribes/shared';
import Button from './ui/Button';
import TurnDeadline from './TurnDeadline';

interface HeaderProps {
  currentUser: User;
  playerTribe?: Tribe;
  onLogout: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToLeaderboard?: () => void;
  onOpenHelp: () => void;
  onOpenCodex: () => void;
  onChangePassword: () => void;
  onOpenNewspaper: () => void;
  turn: number;
  gamePhase: GamePhase | 'observing' | 'waiting';
  turnDeadline?: TurnDeadlineType;
}

const Header: React.FC<HeaderProps> = ({ currentUser, playerTribe, onLogout, onNavigateToAdmin, onNavigateToLeaderboard, onOpenHelp, onOpenCodex, onChangePassword, onOpenNewspaper, turn, gamePhase, turnDeadline }) => {
  // CRITICAL DEBUG: Log what gamePhase we're receiving
  console.log('🔍 HEADER: Received gamePhase:', gamePhase, 'turnSubmitted:', playerTribe?.turnSubmitted);

  const phaseText: {[key in typeof gamePhase]: string} = {
      planning: 'Action Planning',
      processing: 'Processing...',
      results: 'Turn Results',
      observing: 'Observing',
      waiting: 'Waiting for Admin',
  }

  // CRITICAL FIX: Override text based on actual server state
  const getPhaseText = () => {
    if (playerTribe?.turnSubmitted) {
      return 'Waiting for Admin';
    }
    if (playerTribe?.lastTurnResults && playerTribe.lastTurnResults.length > 0) {
      return 'Turn Results';
    }
    return phaseText[gamePhase] || 'Action Planning';
  };

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
        <div className="flex flex-col items-end space-y-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-300">Turn {turn}</h2>
            <p className={`text-sm ${getPhaseColor()}`}>{getPhaseText()}</p>
          </div>
          <TurnDeadline turnDeadline={turnDeadline} currentTurn={turn} />
        </div>
         {onNavigateToLeaderboard && (
             <Button onClick={onNavigateToLeaderboard} variant="secondary" className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Leaderboard</span>
            </Button>
         )}
         <Button onClick={onOpenNewspaper} variant="secondary" className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <span>Newspaper</span>
          </Button>
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
         <Button onClick={onChangePassword} variant="secondary" className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3a1 1 0 011-1h2.586l6.414-6.414a6 6 0 015.743-7.743z" />
            </svg>
            <span>Change Password</span>
          </Button>
         <Button onClick={onLogout}>Logout</Button>
      </div>
    </header>
  );
};

export default Header;