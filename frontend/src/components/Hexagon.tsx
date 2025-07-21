import React from 'react';
import { HexData, POIType, Tribe, DiplomaticStatus, TerrainType } from '@radix-tribes/shared';
import { POI_SYMBOLS, POI_COLORS, TRIBE_ICONS } from '@radix-tribes/shared';
import { formatHexCoords } from '../lib/mapUtils';

interface HexagonProps {
  hexData: HexData;
  size: number;
  tribesOnHex: Tribe[] | undefined;
  playerTribe: Tribe | undefined;
  isInPlayerInfluence: boolean;
  isFogged: boolean;
  isSelectable: boolean;
  startOrder: number | null;
  onClick: () => void;
  onMouseDown: () => void;
  onMouseOver: () => void;
  onMouseEnter: (event: React.MouseEvent) => void;
  onMouseLeave: () => void;
  isPoliticalMode?: boolean;
  politicalData?: { color: string; tribeName: string };
}

export const Hexagon: React.FC<HexagonProps> = (props) => {
  const { hexData, size, tribesOnHex, playerTribe, isInPlayerInfluence, isFogged, isSelectable, startOrder, onClick, onMouseDown, onMouseOver, onMouseEnter, onMouseLeave, isPoliticalMode, politicalData } = props;

  const { q, r, terrain, poi } = hexData;
  const width = Math.sqrt(3) * size;
  const height = 2 * size;

  const x = width * (q + r / 2);
  const y = (height * 3 / 4) * r;

  const points = [
    [0, -size],
    [width / 2, -size / 2],
    [width / 2, size / 2],
    [0, size],
    [-width / 2, size / 2],
    [-width / 2, -size / 2],
  ].map(p => `${p[0]},${p[1]}`).join(' ');
  
  const getPresenceIndicator = () => {
    if (!tribesOnHex || tribesOnHex.length === 0) return null;
    const hexCoords = formatHexCoords(q, r);

    const getTroopBoxStyle = (tribe: Tribe) => {
        if (!playerTribe) return 'bg-slate-600/80';
        if (tribe.id === playerTribe.id) return 'bg-green-700/80';
        
        const status = playerTribe.diplomacy[tribe.id]?.status;
        if (status === DiplomaticStatus.Alliance) return 'bg-blue-800/80';
        if (status === DiplomaticStatus.War) return 'bg-red-800/80';
        return 'bg-yellow-800/80';
    };
    
    // Simple rendering for single tribe
    if (tribesOnHex.length === 1) {
        const tribe = tribesOnHex[0];
        const garrison = tribe.garrisons[hexCoords];
        const troops = garrison?.troops ?? 0;
        const chiefCount = garrison?.chiefs?.length ?? 0;
        const icon = TRIBE_ICONS[tribe.icon] || TRIBE_ICONS['skull'];
        
        return (
            <g className="pointer-events-none transform-gpu transition-transform group-hover:-translate-y-1 duration-200">
                <text x="0" y={-size * 0.1} textAnchor="middle" className="select-none" fontSize={size * 0.8} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))' }}>
                    {icon}
                </text>
                {troops > 0 && (
                     <g transform={`translate(0, ${size * 0.5})`}>
                        <rect x={-size*0.4} y="0" width={size*0.8} height={size*0.4} rx="2" className={`${getTroopBoxStyle(tribe)} stroke-black/50`} strokeWidth="0.5" />
                        <text x="0" y={size*0.2} dy=".05em" textAnchor="middle" className="font-bold fill-white" fontSize={size*0.3}>
                            {troops}
                        </text>
                    </g>
                )}
                {chiefCount > 0 && (
                    <text x="0" y={-size * 0.45} textAnchor="middle" className="font-bold fill-yellow-300" fontSize={size*0.8} style={{ filter: 'drop-shadow(0 0 2px black)' }}>
                        ★
                    </text>
                )}
            </g>
        )
    }

    // Advanced rendering for multiple tribes
    const iconSize = size * 0.8;
    const totalWidth = tribesOnHex.length * iconSize - (tribesOnHex.length - 1) * (iconSize / 2);
    const startX = -totalWidth / 2;

    return (
        <g className="pointer-events-none">
            {tribesOnHex.map((tribe, index) => {
                const icon = TRIBE_ICONS[tribe.icon] || TRIBE_ICONS['skull'];
                const xOffset = startX + index * (iconSize / 1.8);
                return (
                    <g key={tribe.id} transform={`translate(${xOffset}, 0)`}>
                         <text x="0" y={iconSize * 0.1} textAnchor="middle" className="select-none" fontSize={iconSize * 0.8} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))' }}>
                            {icon}
                        </text>
                    </g>
                );
            })}
        </g>
    );
  };
  
  const getFillColor = () => {
    if (isPoliticalMode) {
        if (politicalData) {
            return politicalData.color;
        }
        if (terrain === TerrainType.Water) {
            return '#1f2937'; // slate-800, for water outline
        }
        return '#4b5563'; // slate-600, for unclaimed land
    }
    return `url(#texture-${terrain})`;
  };

  const poiSize = size * 0.4;
  const diamondPoints = [
      [0, -poiSize],
      [poiSize, 0],
      [0, poiSize],
      [-poiSize, 0],
  ].map(p => p.join(',')).join(' ');

  const groupClasses = [
    "group",
    isSelectable ? 'cursor-pointer' : '',
    isFogged && !isPoliticalMode ? 'pointer-events-none' : ''
  ].filter(Boolean).join(' ');

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseOver={onMouseOver}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={groupClasses}
    >
      {isPoliticalMode && politicalData && <title>{`${politicalData.tribeName}'s Territory`}</title>}
      <polygon
        points={points}
        fill={getFillColor()}
        className={`transition-colors duration-100 stroke-black/50 group-hover:stroke-amber-400`}
        strokeWidth={isSelectable ? 1.2 : 0.5}
      />
      
      {!isPoliticalMode && isInPlayerInfluence && hexData.terrain !== 'Water' && (
        <polygon 
            points={points}
            className="fill-green-400/10 stroke-green-400/30 pointer-events-none"
            strokeWidth="0.5"
        />
      )}
      
      {!isPoliticalMode && poi && !isFogged && (
        <g className="pointer-events-none" style={poi.rarity === 'Very Rare' ? { filter: 'url(#poi-glow)' } : {}}>
            <polygon 
                points={diamondPoints}
                className={`${POI_COLORS[poi.type].bg} stroke-black/50 stroke-1`}
            />
            <text
                x="0"
                y="0"
                dy=".3em"
                textAnchor="middle"
                className={`font-bold ${POI_COLORS[poi.type].text}`}
                style={{ fontSize: `${size*0.4}px`}}
            >
                {POI_SYMBOLS[poi.type]}
            </text>
        </g>
      )}

      {!isPoliticalMode && !isFogged && getPresenceIndicator()}

      {!isPoliticalMode && startOrder !== null && !isFogged && (
         <g className="pointer-events-none">
          <path 
            d={`M ${-size*0.6} ${size*0.5} L 0 ${-size*0.5} L ${size*0.6} ${size*0.5} Z`}
            className="fill-amber-200 stroke-slate-800"
            strokeWidth="0.7"
          />
           <path 
            d={`M 0 ${-size*0.5} L 0 ${size*0.5}`} 
            className="stroke-slate-800"
            strokeWidth="0.7"
          />
        </g>
      )}

       {!isPoliticalMode && isFogged && (
        <polygon
          points={points}
          fill="url(#fog-pattern)"
        />
      )}
    </g>
  );
};