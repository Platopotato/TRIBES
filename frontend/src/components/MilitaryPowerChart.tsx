import React, { useMemo, useState } from 'react';
import { Tribe } from '@radix-tribes/shared';

interface MilitaryPowerChartProps {
    history: any[];
    tribes: Tribe[];
    currentTurn: number;
}

const MilitaryPowerChart: React.FC<MilitaryPowerChartProps> = ({ history, tribes, currentTurn }) => {
    const [hoveredTribeId, setHoveredTribeId] = useState<string | null>(null);

    // Create tribe color mapping
    const tribeColorMap = useMemo(() => {
        const map = new Map<string, string>();
        tribes.forEach(tribe => {
            map.set(tribe.id, tribe.color);
        });
        return map;
    }, [tribes]);

    // Create tribe name mapping
    const tribeNameMap = useMemo(() => {
        const map = new Map<string, string>();
        tribes.forEach(tribe => {
            map.set(tribe.id, tribe.tribeName);
        });
        return map;
    }, [tribes]);

    // Process chart data
    const chartData = useMemo(() => {
        console.log('⚔️ MILITARY CHART: Processing data with history length:', history.length);
        
        if (!history || history.length === 0) {
            console.log('⚔️ No historical data - showing current military only');
            // Show current data only
            const currentData = new Map<string, Array<{turn: number, troops: number}>>();
            tribes.forEach(tribe => {
                const currentTroops = Object.values(tribe.garrisons || {}).reduce((sum, g) => sum + g.troops, 0);
                currentData.set(tribe.id, [{
                    turn: currentTurn,
                    troops: currentTroops
                }]);
            });
            return currentData;
        }

        // Process historical data
        const data = new Map<string, Array<{turn: number, troops: number}>>();
        
        // Initialize data structure for all tribes
        tribes.forEach(tribe => {
            data.set(tribe.id, []);
        });

        // Process each turn's history
        history.forEach(turnRecord => {
            if (turnRecord.tribeRecords) {
                turnRecord.tribeRecords.forEach((tribeRecord: any) => {
                    const tribeData = data.get(tribeRecord.tribeId);
                    if (tribeData) {
                        tribeData.push({
                            turn: turnRecord.turn,
                            troops: tribeRecord.troops || 0
                        });
                    }
                });
            }
        });

        // Add current turn data if not already present
        tribes.forEach(tribe => {
            const tribeData = data.get(tribe.id);
            if (tribeData) {
                const hasCurrentTurn = tribeData.some(point => point.turn === currentTurn);
                if (!hasCurrentTurn) {
                    const currentTroops = Object.values(tribe.garrisons || {}).reduce((sum, g) => sum + g.troops, 0);
                    tribeData.push({
                        turn: currentTurn,
                        troops: currentTroops
                    });
                }
                // Sort by turn
                tribeData.sort((a, b) => a.turn - b.turn);
            }
        });

        console.log('⚔️ Military chart data processed:', {
            tribesWithData: data.size,
            sampleData: Array.from(data.entries())[0]
        });

        return data;
    }, [history, tribes, currentTurn]);

    // Calculate scales
    const { maxTroops, turnDomain } = useMemo(() => {
        let maxTroops = 0;
        let minTurn = currentTurn;
        let maxTurn = currentTurn;

        chartData.forEach(tribeData => {
            tribeData.forEach(point => {
                maxTroops = Math.max(maxTroops, point.troops);
                minTurn = Math.min(minTurn, point.turn);
                maxTurn = Math.max(maxTurn, point.turn);
            });
        });

        return {
            maxTroops: Math.max(maxTroops, 100), // Minimum scale
            turnDomain: [minTurn, maxTurn] as [number, number]
        };
    }, [chartData, currentTurn]);

    // Chart dimensions
    const chartWidth = 720;
    const chartHeight = 400;
    const margin = { top: 20, right: 120, bottom: 40, left: 80 };
    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;

    // Scale functions
    const xScale = (turn: number) => {
        const domainWidth = turnDomain[1] - turnDomain[0];
        if (domainWidth === 0) return innerWidth / 2;
        return ((turn - turnDomain[0]) / domainWidth) * innerWidth;
    };

    const yScale = (troops: number) => {
        return innerHeight - (troops / maxTroops) * innerHeight;
    };

    // Generate Y-axis ticks
    const yTicks = useMemo(() => {
        const tickCount = 6;
        const step = Math.ceil(maxTroops / tickCount);
        return Array.from({ length: tickCount + 1 }, (_, i) => i * step).filter(v => v <= maxTroops);
    }, [maxTroops]);

    // Generate X-axis ticks
    const xTicks = useMemo(() => {
        const domainWidth = turnDomain[1] - turnDomain[0];
        if (domainWidth <= 10) {
            return Array.from({ length: domainWidth + 1 }, (_, i) => turnDomain[0] + i);
        } else {
            const step = Math.ceil(domainWidth / 8);
            return Array.from({ length: 9 }, (_, i) => turnDomain[0] + i * step).filter(v => v <= turnDomain[1]);
        }
    }, [turnDomain]);

    return (
        <div className="w-full">
            <div className="mb-4 text-sm text-slate-400">
                Military buildup and troop deployment patterns over time
            </div>
            
            <div className="relative">
                <svg width={chartWidth} height={chartHeight} className="bg-slate-800 rounded">
                    <g transform={`translate(${margin.left}, ${margin.top})`}>
                        {/* Grid lines */}
                        <g className="opacity-20">
                            {yTicks.map(tick => (
                                <line
                                    key={`y-grid-${tick}`}
                                    x1={0}
                                    y1={yScale(tick)}
                                    x2={innerWidth}
                                    y2={yScale(tick)}
                                    stroke="#64748b"
                                    strokeWidth={1}
                                />
                            ))}
                            {xTicks.map(tick => (
                                <line
                                    key={`x-grid-${tick}`}
                                    x1={xScale(tick)}
                                    y1={0}
                                    x2={xScale(tick)}
                                    y2={innerHeight}
                                    stroke="#64748b"
                                    strokeWidth={1}
                                />
                            ))}
                        </g>

                        {/* Y-axis */}
                        <g>
                            <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="#94a3b8" strokeWidth={2} />
                            {yTicks.map(tick => (
                                <g key={`y-axis-${tick}`}>
                                    <line x1={-5} y1={yScale(tick)} x2={0} y2={yScale(tick)} stroke="#94a3b8" strokeWidth={1} />
                                    <text x={-10} y={yScale(tick)} dy="0.35em" textAnchor="end" fill="#94a3b8" fontSize="12">
                                        {tick.toLocaleString()}
                                    </text>
                                </g>
                            ))}
                            <text x={-50} y={innerHeight / 2} textAnchor="middle" fill="#94a3b8" fontSize="12" transform={`rotate(-90, -50, ${innerHeight / 2})`}>
                                Total Troops
                            </text>
                        </g>

                        {/* X-axis */}
                        <g>
                            <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#94a3b8" strokeWidth={2} />
                            {xTicks.map(tick => (
                                <g key={`x-axis-${tick}`}>
                                    <line x1={xScale(tick)} y1={innerHeight} x2={xScale(tick)} y2={innerHeight + 5} stroke="#94a3b8" strokeWidth={1} />
                                    <text x={xScale(tick)} y={innerHeight + 20} textAnchor="middle" fill="#94a3b8" fontSize="12">
                                        {tick}
                                    </text>
                                </g>
                            ))}
                            <text x={innerWidth / 2} y={innerHeight + 35} textAnchor="middle" fill="#94a3b8" fontSize="12">
                                Turn
                            </text>
                        </g>

                        {/* Data Lines */}
                        <g>
                            {Array.from(chartData.entries()).map(([tribeId, data]) => {
                                if (data.length < 2) return null;
                                const pathData = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.turn)},${yScale(p.troops)}`).join(' ');
                                const isHovered = hoveredTribeId === tribeId;
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
                            {Array.from(chartData.entries()).map(([tribeId, data]) => {
                                const isHovered = hoveredTribeId === tribeId;
                                return data.map((point, index) => (
                                    <circle
                                        key={`${tribeId}-${index}`}
                                        cx={xScale(point.turn)}
                                        cy={yScale(point.troops)}
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
                    </g>
                </svg>

                {/* Legend */}
                <div className="absolute top-4 right-4 bg-slate-700 rounded p-3 max-h-80 overflow-y-auto">
                    <div className="text-xs font-medium text-slate-300 mb-2">Tribes</div>
                    <div className="space-y-1">
                        {tribes.slice(0, 10).map(tribe => {
                            const tribeData = chartData.get(tribe.id);
                            const currentTroops = tribeData && tribeData.length > 0 ? tribeData[tribeData.length - 1].troops : 0;
                            const isHovered = hoveredTribeId === tribe.id;
                            
                            return (
                                <div
                                    key={tribe.id}
                                    className={`flex items-center space-x-2 text-xs cursor-pointer p-1 rounded transition-colors ${
                                        isHovered ? 'bg-slate-600' : 'hover:bg-slate-600'
                                    }`}
                                    onMouseEnter={() => setHoveredTribeId(tribe.id)}
                                    onMouseLeave={() => setHoveredTribeId(null)}
                                >
                                    <div
                                        className="w-3 h-3 rounded-full border border-white"
                                        style={{ backgroundColor: tribe.color }}
                                    />
                                    <span className="text-slate-200 truncate flex-1" title={tribe.tribeName}>
                                        {tribe.tribeName.length > 12 ? `${tribe.tribeName.substring(0, 12)}...` : tribe.tribeName}
                                    </span>
                                    <span className="text-slate-400 font-mono">
                                        {currentTroops.toLocaleString()}
                                    </span>
                                </div>
                            );
                        })}
                        {tribes.length > 10 && (
                            <div className="text-xs text-slate-500 pt-1">
                                +{tribes.length - 10} more tribes
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MilitaryPowerChart;
