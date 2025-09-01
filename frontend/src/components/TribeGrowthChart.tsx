import React, { useMemo, useState } from 'react';
import { TurnHistoryRecord, Tribe } from '@radix-tribes/shared';
import { calculateTribeScore } from '@radix-tribes/shared';
import Card from './ui/Card';
import { TRIBE_ICONS } from '@radix-tribes/shared';

interface TribeGrowthChartProps {
    history: TurnHistoryRecord[];
    tribes: Tribe[];
    currentTurn: number;
}

const TERRITORY_COLORS = ['#4299E1', '#F56565', '#48BB78', '#ED8936', '#9F7AEA', '#ECC94B', '#38B2AC', '#ED64A6', '#A0AEC0', '#667EEA', '#F687B3', '#D69E2E', '#319795', '#6B46C1', '#C53030', '#059669'];

const TribeGrowthChart: React.FC<TribeGrowthChartProps> = ({ history, tribes, currentTurn }) => {
    const [hoveredTribeId, setHoveredTribeId] = useState<string | null>(null);

    const tribeColorMap = useMemo(() => {
        const map = new Map<string, string>();
        tribes.forEach((tribe, index) => {
            map.set(tribe.id, TERRITORY_COLORS[index % TERRITORY_COLORS.length]);
        });
        return map;
    }, [tribes]);

    const { chartData, maxScore, turnDomain } = useMemo(() => {
        const dataByTribe: { [key: string]: { turn: number, score: number }[] } = {};
        let maxS = 0;
        let minTurn = Infinity;
        let maxTurn = -Infinity;

        // Process historical data from turn history
        history.forEach(turnRecord => {
            if (!turnRecord.tribeRecords) {
                console.warn('📊 Missing tribeRecords in turn:', turnRecord);
                return;
            }

            minTurn = Math.min(minTurn, turnRecord.turn);
            maxTurn = Math.max(maxTurn, turnRecord.turn);

            turnRecord.tribeRecords.forEach(tribeRecord => {
                if (!dataByTribe[tribeRecord.tribeId]) {
                    dataByTribe[tribeRecord.tribeId] = [];
                }
                dataByTribe[tribeRecord.tribeId].push({
                    turn: turnRecord.turn,
                    score: tribeRecord.score
                });
                if (tribeRecord.score > maxS) {
                    maxS = tribeRecord.score;
                }
            });
        });

        // Add current turn data for tribes that exist now
        tribes.forEach(tribe => {
            const currentScore = calculateTribeScore(tribe);

            if (!dataByTribe[tribe.id]) {
                dataByTribe[tribe.id] = [];
            }

            // Add current turn data if not already present
            const hasCurrentTurn = dataByTribe[tribe.id].some(d => d.turn === currentTurn);
            if (!hasCurrentTurn) {
                dataByTribe[tribe.id].push({
                    turn: currentTurn,
                    score: currentScore
                });
                maxTurn = Math.max(maxTurn, currentTurn);
            }

            // Sort data by turn for each tribe
            dataByTribe[tribe.id].sort((a, b) => a.turn - b.turn);

            if (currentScore > maxS) {
                maxS = currentScore;
            }
        });

        // If no historical data, create minimal data with current turn
        if (history.length === 0) {
            console.log('📊 No historical data found, using current turn data only');
            minTurn = Math.max(1, currentTurn);
            maxTurn = currentTurn;
            tribes.forEach(tribe => {
                const currentScore = calculateTribeScore(tribe);
                dataByTribe[tribe.id] = [{ turn: currentTurn, score: currentScore }];
                if (currentScore > maxS) {
                    maxS = currentScore;
                }
            });
        }

        // If we have very little data, create some interpolated points for better visualization
        if (maxTurn - minTurn < 2 && currentTurn > 1) {
            console.log('📊 Limited historical data, creating interpolated points');
            tribes.forEach(tribe => {
                const currentScore = calculateTribeScore(tribe);
                if (!dataByTribe[tribe.id] || dataByTribe[tribe.id].length < 2) {
                    // Create a simple progression from turn 1 to current turn
                    const startScore = Math.max(10, currentScore * 0.3); // Reasonable starting score
                    dataByTribe[tribe.id] = [
                        { turn: 1, score: startScore },
                        { turn: currentTurn, score: currentScore }
                    ];
                    // Update the turn domain to include turn 1
                    minTurn = Math.min(minTurn, 1);
                    maxTurn = Math.max(maxTurn, currentTurn);
                    if (currentScore > maxS) {
                        maxS = currentScore;
                    }
                }
            });
        }

        // Ensure reasonable turn domain
        const turnStart = minTurn === Infinity ? 1 : Math.min(1, minTurn); // Always start from 1 if we have interpolated data
        const turnEnd = Math.max(turnStart + 1, maxTurn); // Ensure at least 1 turn difference

        console.log('📊 Chart data processed:', {
            tribesWithData: Object.keys(dataByTribe).length,
            dataPoints: Object.values(dataByTribe).reduce((sum, data) => sum + data.length, 0),
            maxScore: maxS,
            turnRange: [turnStart, turnEnd],
            domainWidth: turnEnd - turnStart,
            currentTurn: currentTurn,
            minTurn: minTurn,
            maxTurn: maxTurn,
            historyLength: history.length,
            rawHistory: history.map(h => ({ turn: h.turn, tribeCount: h.tribeRecords?.length || 0 })),
            tribeDataDetails: Object.entries(dataByTribe).map(([tribeId, data]) => ({
                tribeId,
                points: data.length,
                turns: data.map(p => p.turn),
                scores: data.map(p => p.score)
            }))
        });

        return {
            chartData: Object.entries(dataByTribe),
            maxScore: maxS > 0 ? maxS * 1.1 : 100,
            turnDomain: [turnStart, turnEnd]
        };
    }, [history, tribes, currentTurn]);
    
    // Debug logging for chart data
    console.log('📊 TribeGrowthChart Debug:', {
        historyLength: history.length,
        chartDataLength: chartData.length,
        maxScore,
        turnDomain,
        sampleHistory: history.slice(0, 2)
    });

    if (chartData.length < 1) {
        return (
            <Card title="📈 Tribal Growth Trends">
                <div className="h-96 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-slate-400 italic mb-2">No tribal data available.</p>
                        <p className="text-slate-500 text-sm">Charts will appear when tribes are present.</p>
                    </div>
                </div>
            </Card>
        );
    }


    
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const width = 800; // Fixed width for SVG coordinate system
    const height = 400; // Fixed height

    const xScale = (turn: number) => {
        const domainWidth = turnDomain[1] - turnDomain[0];
        const chartWidth = width - margin.left - margin.right;

        console.log(`📊 X-scale debug: turn=${turn}, domain=[${turnDomain[0]}, ${turnDomain[1]}], domainWidth=${domainWidth}, chartWidth=${chartWidth}`);

        if (domainWidth === 0) {
            console.warn('🚨 X-axis domain width is 0! Forcing minimum width', { turnDomain, turn });
            // Force a minimum domain width to prevent division by zero
            const forcedWidth = 1;
            const scaledX = margin.left + (turn - turnDomain[0]) / forcedWidth * chartWidth;
            return scaledX;
        }

        const scaledX = margin.left + (turn - turnDomain[0]) / domainWidth * chartWidth;
        console.log(`📊 X-scale result: turn ${turn} → x ${scaledX}`);
        return scaledX;
    };

    const yScale = (score: number) => {
        return height - margin.bottom - (score / maxScore) * (height - margin.top - margin.bottom);
    };
    
    const yAxisTicks = useMemo(() => {
        const ticks = [];
        const tickCount = 5;
        for (let i = 0; i <= tickCount; i++) {
            ticks.push(Math.round((maxScore / tickCount) * i));
        }
        return ticks;
    }, [maxScore]);

    // Additional validation for chart rendering
    if (chartData.length === 0) {
        return (
            <Card title="📈 Tribal Growth Trends">
                <div className="h-96 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-slate-400 italic mb-2">No tribe data available for charting.</p>
                        <p className="text-slate-500 text-sm">History: {history.length} turns recorded</p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card title="📈 Tribal Growth Trends">
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-grow relative h-96">
                    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
                        {/* Y Axis */}
                        <g className="text-xs text-slate-400">
                            {yAxisTicks.map(tick => (
                                <g key={`y-tick-${tick}`} transform={`translate(0, ${yScale(tick)})`}>
                                    <line x1={margin.left} x2={width - margin.right} stroke="#475569" strokeWidth="0.5" strokeDasharray="2,3" />
                                    <text x={margin.left - 8} y="3" textAnchor="end" fill="currentColor">{tick}</text>
                                </g>
                            ))}
                            <text transform={`translate(${margin.left / 3}, ${height/2}) rotate(-90)`} textAnchor="middle" fill="currentColor" className="font-semibold">Score</text>
                        </g>

                        {/* X Axis */}
                        <g className="text-xs text-slate-400">
                           {/* Show ticks for actual turns in the data */}
                           {(() => {
                               const [minTurn, maxTurn] = turnDomain;
                               const turnRange = maxTurn - minTurn;
                               const maxTicks = 8; // Maximum number of ticks to show

                               let tickInterval = 1;
                               if (turnRange > maxTicks) {
                                   tickInterval = Math.ceil(turnRange / maxTicks);
                               }

                               const ticks = [];
                               for (let turn = minTurn; turn <= maxTurn; turn += tickInterval) {
                                   ticks.push(turn);
                               }

                               // Always include the last turn if it's not already included
                               if (ticks[ticks.length - 1] !== maxTurn) {
                                   ticks.push(maxTurn);
                               }

                               return ticks.map(turn => (
                                   <g key={`x-tick-${turn}`} transform={`translate(${xScale(turn)}, 0)`}>
                                       <line y1={margin.top} y2={height - margin.bottom} stroke="#475569" strokeWidth="0.5" strokeDasharray="2,3"/>
                                       <text x="0" y={height - margin.bottom + 15} textAnchor="middle" fill="currentColor">{`T${turn}`}</text>
                                   </g>
                               ));
                           })()}
                           <text x={width/2} y={height - 5} textAnchor="middle" fill="currentColor" className="font-semibold">Turn</text>
                        </g>

                        {/* Data Lines */}
                        <g>
                            {chartData.map(([tribeId, data]) => {
                                // ENHANCED: Draw lines even with just 2 points, and log when we skip
                                if (data.length < 2) {
                                    console.log(`📊 Skipping line for ${tribeId}: only ${data.length} points`);
                                    return null;
                                }

                                const pathData = data
                                    .sort((a, b) => a.turn - b.turn) // Ensure points are in turn order
                                    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.turn)},${yScale(p.score)}`)
                                    .join(' ');

                                const isHovered = hoveredTribeId === tribeId;

                                console.log(`📊 Drawing line for ${tribeId}: ${data.length} points, path: ${pathData}`);

                                return (
                                    <path
                                        key={tribeId}
                                        d={pathData}
                                        fill="none"
                                        stroke={tribeColorMap.get(tribeId) || '#A0AEC0'}
                                        strokeWidth={isHovered ? 4 : 2}
                                        className="transition-all duration-200"
                                        opacity={hoveredTribeId === null || isHovered ? 1 : 0.3}
                                    />
                                );
                            })}
                        </g>

                        {/* Data Points */}
                        <g>
                            {chartData.map(([tribeId, data]) => {
                                const isHovered = hoveredTribeId === tribeId;
                                return data.map((point, index) => (
                                    <circle
                                        key={`${tribeId}-${index}`}
                                        cx={xScale(point.turn)}
                                        cy={yScale(point.score)}
                                        r={isHovered ? 6 : 4}
                                        fill={tribeColorMap.get(tribeId) || '#A0AEC0'}
                                        stroke="white"
                                        strokeWidth={isHovered ? 2 : 1}
                                        className="transition-all duration-200"
                                        opacity={hoveredTribeId === null || isHovered ? 1 : 0.7}
                                    />
                                ));
                            })}
                        </g>
                    </svg>
                </div>
                <aside className="lg:w-56 flex-shrink-0">
                    <h4 className="font-bold text-slate-300 mb-2">Tribes</h4>
                    <ul className="space-y-1 max-h-96 overflow-y-auto">
                        {tribes.map(tribe => (
                            <li
                                key={tribe.id}
                                onMouseEnter={() => setHoveredTribeId(tribe.id)}
                                onMouseLeave={() => setHoveredTribeId(null)}
                                className="flex items-center space-x-2 p-1.5 rounded-md cursor-pointer hover:bg-slate-700/50"
                            >
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tribeColorMap.get(tribe.id) }}></div>
                                <span className="text-sm text-slate-300">{tribe.tribeName}</span>
                            </li>
                        ))}
                    </ul>
                </aside>
            </div>
        </Card>
    );
};

export default TribeGrowthChart;
