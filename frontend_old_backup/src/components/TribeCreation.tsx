

/** @jsxImportSource react */
import React, { useState, useMemo } from 'react';
import { TribeStats, User } from '@radix-tribes/shared';
import { MAX_STAT_POINTS, MIN_STAT_VALUE, TRIBE_ICONS, TRIBE_COLORS } from '@radix-tribes/shared';
// import StatAllocator from './StatAllocator-fixed';
// import IconSelector from './IconSelector';
import Card from './ui/Card';
import Button from './ui/Button';

type TribeCreationData = {
    playerName: string;
    tribeName: string;
    icon: string;
    color: string;
    stats: TribeStats;
};

interface TribeCreationProps {
  onTribeCreate: (tribe: TribeCreationData) => void;
  user: User;
}

const ColorSelector: React.FC<{ selectedColor: string; onSelect: (color: string) => void; }> = ({ selectedColor, onSelect }) => (
    <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Choose Your Tribe's Color</label>
        <div className="flex justify-center items-center flex-wrap gap-2 p-3 bg-slate-700/50 rounded-lg">
            {TRIBE_COLORS.map(color => (
                <button
                    key={color}
                    type="button"
                    onClick={() => onSelect(color)}
                    className={`w-10 h-10 rounded-full transition-all duration-200 ${selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-amber-400' : ''}`}
                    style={{ backgroundColor: color }}
                />
            ))}
        </div>
    </div>
);

const TribeCreation: React.FC<TribeCreationProps> = ({ onTribeCreate, user }) => {
  const [playerName, setPlayerName] = useState(user.username);
  const [tribeName, setTribeName] = useState('');
  
  const [selectedIcon, setSelectedIcon] = useState<string>(Object.keys(TRIBE_ICONS)[0] || 'skull');
  const [selectedColor, setSelectedColor] = useState<string>(TRIBE_COLORS[0]);

  const [stats, setStats] = useState<TribeStats>({
    charisma: MIN_STAT_VALUE,
    intelligence: MIN_STAT_VALUE,
    leadership: MIN_STAT_VALUE,
    strength: MIN_STAT_VALUE,
  });

  const totalPointsUsed = useMemo(() => {
    return Object.values(stats).reduce((sum, value) => sum + value, 0);
  }, [stats]);

  const remainingPoints = MAX_STAT_POINTS - totalPointsUsed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (remainingPoints !== 0 || !playerName || !tribeName) {
      alert('Please fill out all fields and allocate all stat points.');
      return;
    }

    const newTribeData: TribeCreationData = {
      playerName,
      tribeName,
      icon: selectedIcon,
      color: selectedColor,
      stats,
    };
    onTribeCreate(newTribeData);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
      <Card title="Found a New Tribe" className="max-w-2xl w-full">
        <form onSubmit={handleSubmit} className="space-y-6">
          <p className="text-slate-400 text-center">The old world is gone, {user.username}. Lead your survivors to a new dawn.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="playerName" className="block text-sm font-medium text-slate-300 mb-1">Your Name</label>
              <input
                type="text"
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label htmlFor="tribeName" className="block text-sm font-medium text-slate-300 mb-1">Tribe Name</label>
              <input
                type="text"
                id="tribeName"
                value={tribeName}
                onChange={(e) => setTribeName(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
          </div>

          {/* Inline IconSelector to avoid preamble issues */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Choose Your Tribe's Icon</label>
            <div className="flex justify-center items-center flex-wrap gap-4 p-3 bg-slate-700/50 rounded-lg">
              {Object.entries(TRIBE_ICONS).map(([key, icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedIcon(key)}
                  className={`text-4xl p-3 rounded-lg border-2 transition-all duration-200 ${
                    selectedIcon === key
                      ? 'border-blue-500 bg-blue-500/20 shadow-lg'
                      : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <ColorSelector selectedColor={selectedColor} onSelect={setSelectedColor} />
          
          {/* Inline StatAllocator to avoid preamble issues */}
          <div className="bg-slate-700/50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-semibold text-slate-300">Allocate Attribute Points</h4>
              <div className="text-lg font-bold text-amber-400">
                {remainingPoints} <span className="text-sm font-normal text-slate-400">Points Left</span>
              </div>
            </div>
            <div className="space-y-3">
              {Object.keys(stats).map(statKey => {
                const key = statKey as keyof TribeStats;
                const handleStatChange = (delta: number) => {
                  setStats(prevStats => {
                    const currentTotal = Object.values(prevStats).reduce((sum, value) => sum + value, 0);
                    if (delta > 0 && currentTotal >= MAX_STAT_POINTS) return prevStats;
                    if (delta < 0 && prevStats[key] <= MIN_STAT_VALUE) return prevStats;
                    const newStats = { ...prevStats, [key]: prevStats[key] + delta };
                    const newTotal = Object.values(newStats).reduce((sum, value) => sum + value, 0);
                    if (newTotal > MAX_STAT_POINTS) return prevStats;
                    return newStats;
                  });
                };
                return (
                  <div key={key} className="flex items-center justify-between bg-slate-900/50 p-2 rounded-md">
                    <span className="capitalize font-medium text-slate-300">{key}</span>
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => handleStatChange(-1)}
                        disabled={stats[key] <= MIN_STAT_VALUE}
                        className="w-8 h-8 rounded-full bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-xl text-white">{stats[key]}</span>
                      <button
                        type="button"
                        onClick={() => handleStatChange(1)}
                        disabled={remainingPoints <= 0}
                        className="w-8 h-8 rounded-full bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Button type="submit" disabled={remainingPoints !== 0 || !playerName || !tribeName} className="w-full">
            Begin Survival
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default TribeCreation;