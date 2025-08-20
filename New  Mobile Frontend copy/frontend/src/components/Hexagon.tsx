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
  onTouchEnd?: (event: React.TouchEvent) => void;
  isPoliticalMode?: boolean;
  politicalData?: { color: string; tribeName: string };
}

export const Hexagon: React.FC<HexagonProps> = (props) => {
  const { hexData, size, tribesOnHex, playerTribe, isInPlayerInfluence, isFogged, isSelectable, startOrder, onClick, onMouseDown, onMouseOver, onMouseEnter, onMouseLeave, onTouchEnd, isPoliticalMode, politicalData } = props;

  const { q, r, terrain, poi } = hexData;

  const outpostOwnerId: string | null = React.useMemo(() => {
    if (!poi || poi.type !== POIType.Outpost) return null;
    const s = String(poi.id || '');
    const prefix = 'poi-outpost-';
    const idx = s.indexOf(prefix);
    if (idx === -1) return null;
    const rest = s.slice(idx + prefix.length);
    // Tribe IDs may contain hyphens; take everything before the last '-' as tribeId
    const lastDash = rest.lastIndexOf('-');
    if (lastDash === -1) return null;
    return rest.slice(0, lastDash) || null;
  }, [poi]);

  const ownerTribe: Tribe | undefined = React.useMemo(() => {
    if (!outpostOwnerId) return undefined;
    if (playerTribe && String(playerTribe.id) === String(outpostOwnerId)) return playerTribe;
    const fromVisible = (tribesOnHex || []).find(t => String(t.id) === String(outpostOwnerId));
    return fromVisible;
  }, [outpostOwnerId, playerTribe, tribesOnHex]);
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
                <circle
                    cx="0"
                    cy={-size * 0.1}
                    r={size * 0.5}
                    fill={tribe.color}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth="1"
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                />
                <text x="0" y={-size * 0.1} textAnchor="middle" className="select-none" fontSize={size * 0.6} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))' }}>
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
                        <circle
                            cx="0"
                            cy={iconSize * 0.1}
                            r={iconSize * 0.4}
                            fill={tribe.color}
                            stroke="rgba(0,0,0,0.3)"
                            strokeWidth="0.5"
                            style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }}
                        />
                        <text x="0" y={iconSize * 0.1} textAnchor="middle" className="select-none" fontSize={iconSize * 0.5} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))' }}>
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
      onTouchEnd={onTouchEnd}
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
                className={`${POI_COLORS[poi.type].bg} ${poi.fortified ? 'stroke-amber-400 stroke-2' : 'stroke-black/50 stroke-1'}`}
            />
            {/* Fortification indicator - defensive spikes around the POI */}
            {poi.fortified && (
              <g className="pointer-events-none">
                {/* Defensive spikes/walls around the POI */}
                <polygon
                  points={diamondPoints}
                  className="fill-none stroke-amber-300 stroke-1"
                  strokeDasharray="2,1"
                  transform="scale(1.2)"
                />
                {/* Small fortress symbol in corner */}
                <text
                  x={size * 0.25}
                  y={-size * 0.25}
                  textAnchor="middle"
                  className="text-amber-300 font-bold"
                  style={{ fontSize: `${size * 0.3}px` }}
                >
                  🛡️
                </text>
              </g>
            )}
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
                {poi.type === POIType.Outpost && (() => {
              // Render a small stacked overlay for each tribe garrison present on this Outpost
              const overlays = [] as JSX.Element[];
              const hexCoords = formatHexCoords(q, r);
              const yStep = size * 0.3;
              const startY = -size * 0.45;
              // start with visible tribes, but ensure ownerTribe is included if not already present (string-safe compare)
              const base = [...(tribesOnHex || [])];
              if (ownerTribe && !base.some(t => String(t.id) === String(ownerTribe.id))) base.push(ownerTribe);
              base.forEach((tribe, idx) => {
                const g = tribe.garrisons?.[hexCoords];
                const troops = g?.troops ?? 0;
                const chiefs = g?.chiefs?.length ?? 0;
                if (troops <= 0) return;
                const icon = TRIBE_ICONS[tribe.icon] || TRIBE_ICONS['castle'];
                overlays.push(
                  <g key={`op-g-${tribe.id}`} transform={`translate(${size * -0.45}, ${startY + overlays.length * yStep})`}>
                    <circle cx="0" cy="0" r={size * 0.22} fill={tribe.color} stroke="rgba(0,0,0,0.6)" strokeWidth="0.5" />
                    <text x="0" y="0" textAnchor="middle" dy=".3em" fontSize={size * 0.22} className="select-none">{icon}</text>
                    <rect x={-size*0.28} y={size*0.12} width={size*0.56} height={size*0.26} rx="2" fill="rgba(17,24,39,0.9)" stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" />
                    <text x="0" y={size*0.25} dy=".05em" textAnchor="middle" className="font-bold fill-white" fontSize={size*0.18}>{troops}</text>
                    {chiefs > 0 && (
                      <text x={size*0.3} y={-size*0.15} textAnchor="middle" dy=".05em" className="font-bold" fontSize={size*0.2}>
                        ★
                      </text>
                    )}
                  </g>
                );
              });
              return <g key="outpost-overlays">{overlays}</g>;
            })()}
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