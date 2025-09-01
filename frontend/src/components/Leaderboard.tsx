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
            const totalChiefs = Object.values(tribe.garrisons).reduce((sum, g) => sum + (g.chiefs?.length || 0), 0);

            // Get previous turn rank from history
            let previousRank = null;
            if (gameState.history && gameState.history.length > 0) {
                const lastTurnHistory = gameState.history[gameState.history.length - 1];
                // Calculate ranks from scores since TribeHistoryRecord doesn't store rank
                const sortedRecords = lastTurnHistory.tribeRecords
                    .sort((a, b) => b.score - a.score);
                const tribeRecord = sortedRecords.find(record => record.tribeId === tribe.id);
                if (tribeRecord) {
                    previousRank = sortedRecords.indexOf(tribeRecord) + 1;
                }
            }

            return {
                ...tribe,
                score: calculateTribeScore(tribe),
                totalTroops,
                totalChiefs,
                previousRank,
            };
        }).sort((a, b) => b.score - a.score).map((tribe, index) => {
            // Calculate rank change after sorting
            const currentRank = index + 1;
            let rankChange = null;
            if (tribe.previousRank !== null) {
                rankChange = tribe.previousRank - currentRank; // Positive = improved, negative = declined
            }

            return {
                ...tribe,
                currentRank,
                rankChange,
            };
        });
    }, [gameState.tribes, gameState.history]);

    const territoryData = useMemo(() => {
        const data = new Map<string, { color: string; tribeName: string }>();
        rankedTribes.forEach((tribe) => {
            // Show explored territory instead of just garrisons for a proper territory map
            (tribe.exploredHexes || []).forEach(location => {
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
        <div className="space-y-6">
            {/* Territory Map - Top Section */}
            <Card title="🗺️ Territorial Control">
              <div className="h-[800px]">
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
            </Card>

            {/* Tribal Rankings - Middle Section */}
            <Card title="🏆 Tribal Rankings">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b-2 border-slate-700">
                            <tr>
                                <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider">Rank</th>
                                <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider">Tribe</th>
                                <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider">Player</th>
                                <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider text-right">Score</th>
                                <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider text-right">Troops</th>
                                <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider text-right">Chiefs</th>
                                <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider text-right">Garrisons</th>
                                <th className="p-3 text-sm font-semibold text-slate-400 tracking-wider text-center">Trend</th>
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
                                        <td className="p-3 text-white font-mono text-right">{tribe.totalChiefs}</td>
                                        <td className="p-3 text-white font-mono text-center">{Object.keys(tribe.garrisons).length}</td>
                                        <td className="p-3 text-center">
                                            {tribe.rankChange !== null ? (
                                                <div className="flex items-center justify-center space-x-1">
                                                    {tribe.rankChange > 0 ? (
                                                        <>
                                                            <span className="text-green-400 font-bold">↗</span>
                                                            <span className="text-green-400 text-sm">+{tribe.rankChange}</span>
                                                        </>
                                                    ) : tribe.rankChange < 0 ? (
                                                        <>
                                                            <span className="text-red-400 font-bold">↘</span>
                                                            <span className="text-red-400 text-sm">{tribe.rankChange}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm">—</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center" title="Trends will appear after multiple turns">
                                                    <span className="text-slate-500 text-xs">📊</span>
                                                </div>
                                            )}
                                        </td>
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

            {/* Growth Chart - Bottom Section */}
            <Card title="📈 Tribal Growth Trends">
                {/* Debug info for troubleshooting */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mb-4 p-2 bg-slate-800 rounded text-xs text-slate-400">
                        Debug: History length: {gameState.history?.length || 0},
                        Tribes: {rankedTribes.length},
                        Tribes with trends: {rankedTribes.filter(t => t.rankChange !== null).length},
                        Turn: {gameState.turn}
                    </div>
                )}
                <TribeGrowthChart
                    history={gameState.history || []}
                    tribes={rankedTribes}
                    currentTurn={gameState.turn}
                />
            </Card>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;