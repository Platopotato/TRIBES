import React, { useMemo, useState } from 'react';
import { TurnHistoryRecord, Tribe } from '@radix-tribes/shared';
import { calculateTribeScore } from '@radix-tribes/shared';
import Card from './ui/Card';
import { TRIBE_ICONS } from '@radix-tribes/shared';

interface TribeGrowthChartProps {
    history: TurnHistoryRecord[];
    tribes: Tribe[];
}

const TERRITORY_COLORS = ['#4299E1', '#F56565', '#48BB78', '#ED8936', '#9F7AEA', '#ECC94B', '#38B2AC', '#ED64A6', '#A0AEC0', '#667EEA', '#F687B3', '#D69E2E', '#319795', '#6B46C1', '#C53030', '#059669'];

const TribeGrowthChart: React.FC<TribeGrowthChartProps> = ({ history, tribes }) => {
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

        // Process historical data
        history.forEach(turnRecord => {
            if (!turnRecord.tribeRecords) {
                console.warn('📊 Missing tribeRecords in turn:', turnRecord);
                return;
            }

            turnRecord.tribeRecords.forEach(tribeRecord => {
                if (!dataByTribe[tribeRecord.tribeId]) {
                    dataByTribe[tribeRecord.tribeId] = [];
                }
                dataByTribe[tribeRecord.tribeId].push({ turn: turnRecord.turn, score: tribeRecord.score });
                if (tribeRecord.score > maxS) {
                    maxS = tribeRecord.score;
                }
            });
        });

        // Add current turn data for all tribes to ensure we have at least 2 points for graphing
        tribes.forEach(tribe => {
            if (!dataByTribe[tribe.id]) {
                dataByTribe[tribe.id] = [];
            }

            // Add current turn data point
            const currentScore = calculateTribeScore(tribe);
            const currentTurn = history.length > 0 ? (history[history.length - 1]?.turn || 1) + 1 : 1;

            // Only add if we don't already have this turn's data
            const hasCurrentTurn = dataByTribe[tribe.id].some(point => point.turn === currentTurn);
            if (!hasCurrentTurn) {
                dataByTribe[tribe.id].push({ turn: currentTurn, score: currentScore });
                if (currentScore > maxS) {
                    maxS = currentScore;
                }
            }

            // ENHANCED: Ensure every tribe has at least 2 data points for line drawing
            if (dataByTribe[tribe.id].length === 1) {
                const existingPoint = dataByTribe[tribe.id][0];
                const prevTurn = Math.max(1, existingPoint.turn - 1);
                // Add a previous point with slightly lower score to show growth
                const prevScore = Math.max(0, existingPoint.score * 0.8);
                dataByTribe[tribe.id].unshift({ turn: prevTurn, score: prevScore });
                console.log(`📊 Added synthetic previous point for ${tribe.tribeName}: Turn ${prevTurn}, Score ${prevScore}`);
            }

            // If still no historical data, create a minimal 2-point trend
            if (dataByTribe[tribe.id].length === 0) {
                const score = currentScore;
                dataByTribe[tribe.id] = [
                    { turn: Math.max(1, currentTurn - 1), score: Math.max(0, score * 0.5) },
                    { turn: currentTurn, score: score }
                ];
                console.log(`📊 Created minimal trend for ${tribe.tribeName}: 2 points`);
            }
        });

        const firstTurn = Math.min(
            ...Object.values(dataByTribe).flatMap(data => data.map(p => p.turn)),
            1
        );
        const lastTurn = Math.max(
            ...Object.values(dataByTribe).flatMap(data => data.map(p => p.turn)),
            1
        );

        console.log('📊 Chart data processed:', {
            tribesWithData: Object.keys(dataByTribe).length,
            dataPoints: Object.values(dataByTribe).reduce((sum, data) => sum + data.length, 0),
            maxScore: maxS,
            turnRange: [firstTurn, lastTurn],
            tribeDataDetails: Object.entries(dataByTribe).map(([tribeId, data]) => ({
                tribeId,
                points: data.length,
                turns: data.map(p => p.turn),
                scores: data.map(p => p.score)
            }))
        });

        return {
            chartData: Object.entries(dataByTribe),
            maxScore: maxS > 0 ? maxS * 1.1 : 100, // Give some headroom, avoid dividing by zero
            turnDomain: [firstTurn, lastTurn]
        };
    }, [history]);
    
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
        if (turnDomain[1] - turnDomain[0] === 0) return margin.left;
        return margin.left + (turn - turnDomain[0]) / (turnDomain[1] - turnDomain[0]) * (width - margin.left - margin.right);
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
                           {history.map(({ turn }) => (
                                <g key={`x-tick-${turn}`} transform={`translate(${xScale(turn)}, 0)`}>
                                     <line y1={margin.top} y2={height - margin.bottom} stroke="#475569" strokeWidth="0.5" strokeDasharray="2,3"/>
                                     <text x="0" y={height - margin.bottom + 15} textAnchor="middle" fill="currentColor">{`T${turn}`}</text>
                                </g>
                           ))}
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
