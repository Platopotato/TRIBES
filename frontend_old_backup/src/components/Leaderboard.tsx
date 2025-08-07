import React, { useMemo } from 'react';
import { GameState, Tribe, DiplomaticStatus, DiplomaticRelation, TerrainType } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { TRIBE_ICONS } from '@radix-tribes/shared';
import MapView from './MapView';
import { calculateTribeScore } from '../lib/statsUtils';
import TribeGrowthChart from './TribeGrowthChart';

interface LeaderboardProps {
  gameState: GameState;
  playerTribe?: Tribe;
  onBack: () => void;
}

const getStatusPill = (relation?: DiplomaticRelation) => {
    const status = relation?.status || DiplomaticStatus.Neutral;
    const styles = {
      [DiplomaticStatus.Alliance]: 'bg-blue-600 text-blue-100',
      [DiplomaticStatus.Neutral]: 'bg-slate-500 text-slate-100',
      [DiplomaticStatus.War]: 'bg-red-700 text-red-100',
    };
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${styles[status]}`}>{status}</span>;
  };

const Leaderboard: React.FC<LeaderboardProps> = ({ gameState, playerTribe, onBack }) => {

    const rankedTribes = useMemo(() => {
        return gameState.tribes.map(tribe => {
            const totalTroops = Object.values(tribe.garrisons).reduce((sum, g) => sum + g.troops, 0);
            return {
                ...tribe,
                score: calculateTribeScore(tribe),
                totalTroops,
            };
        }).sort((a, b) => b.score - a.score);
    }, [gameState.tribes]);

    const territoryData = useMemo(() => {
        const data = new Map<string, { color: string; tribeName: string }>();
        rankedTribes.forEach((tribe) => {
            Object.keys(tribe.garrisons).forEach(location => {
                data.set(location, { color: tribe.color, tribeName: tribe.tribeName });
            });
        });
        return data;
    }, [rankedTribes]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-amber-400">Wasteland Leaderboard</h1>
          <Button onClick={onBack}>Back to Game</Button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b-2 border-slate-700">
                                <tr>
                                    <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider">Rank</th>
                                    <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider">Tribe</th>
                                    <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider">Player</th>
                                    <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider text-right">Score</th>
                                    <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider text-right">Troops</th>
                                    <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider text-right">Garrisons</th>
                                    {playerTribe && <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider text-center">Diplomacy</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {rankedTribes.map((tribe, index) => {
                                    const isPlayerRow = playerTribe && tribe.id === playerTribe.id;
                                    const relation = playerTribe ? playerTribe.diplomacy[tribe.id] : undefined;
                                    
                                    return (
                                        <tr key={tribe.id} className={`border-b border-slate-800 ${isPlayerRow ? 'bg-amber-900/20' : 'hover:bg-slate-800/50'}`}>
                                            <td className="p-3 text-lg font-bold text-slate-300">#{index + 1}</td>
                                            <td className="p-3">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tribe.color }}>
                                                        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-white">
                                                            {TRIBE_ICONS[tribe.icon]}
                                                        </svg>
                                                    </div>
                                                    <span className="font-semibold text-white">{tribe.tribeName}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-slate-400">{tribe.playerName}</td>
                                            <td className="p-3 text-lg font-bold text-amber-400 text-right">{tribe.score}</td>
                                            <td className="p-3 text-white font-mono text-right">{tribe.totalTroops}</td>
                                            <td className="p-3 text-white font-mono text-center">{Object.keys(tribe.garrisons).length}</td>
                                            {playerTribe && (
                                                <td className="p-3 text-center">
                                                    {tribe.id === playerTribe.id ? <span className="text-xs italic text-slate-500">You</span> : getStatusPill(relation)}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
            <div className="xl:col-span-1 h-96 xl:h-auto">
                <MapView
                    mapData={gameState.mapData}
                    territoryData={territoryData}
                    playerTribe={undefined}
                    allTribes={[]}
                    journeys={[]}
                    startingLocations={[]}
                    selectionMode={false}
                    onHexSelect={() => {}}
                />
            </div>
            <div className="xl:col-span-3">
                <TribeGrowthChart
                    history={gameState.history || []}
                    tribes={rankedTribes}
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;