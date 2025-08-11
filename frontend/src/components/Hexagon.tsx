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
    // poi.id is like "poi-outpost-<tribeId>-<hex>"
    const s = String(poi.id || '');
    const idx = s.indexOf('poi-outpost-');
    if (idx === -1) return null;
    const rest = s.slice(idx + 'poi-outpost-'.length);
    return rest.split('-')[0] || null;
  }, [poi]);
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
        const icon = TRIBE_ICONS[tribe.icon] || TRIBE_ICONS['castle'];

        // If this hex also has an Outpost, suppress the large garrison display in favor of the mini overlay on the POI
        if (poi?.type === POIType.Outpost) {
            return null;
        }

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
                {/* CHIEF INDICATOR: Small star when chiefs are present */}
                {garrison.chiefs && garrison.chiefs.length > 0 && (
                    <g transform={`translate(${size * 0.35}, ${-size * 0.35})`}>
                        <circle
                            cx="0"
                            cy="0"
                            r={size * 0.15}
                            fill="gold"
                            stroke="rgba(0,0,0,0.5)"
                            strokeWidth="0.5"
                            style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))' }}
                        />
                        <text
                            x="0"
                            y="0"
                            textAnchor="middle"
                            className="select-none"
                            fontSize={size * 0.2}
                            fill="black"
                            dy="0.1em"
                            style={{ fontWeight: 'bold' }}
                        >
                            ⭐
                        </text>
                    </g>
                )}
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

    // For multiple tribes, if an Outpost is present, skip the large multi-tribe icons to reduce clutter
    if (poi?.type === POIType.Outpost) {
      return <g className="pointer-events-none" />;
    }
    return (
        <g className="pointer-events-none">
            {tribesOnHex.map((tribe, index) => {
                const icon = TRIBE_ICONS[tribe.icon] || TRIBE_ICONS['castle'];
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
                {poi.type === POIType.Outpost && tribesOnHex && tribesOnHex.length > 0 && (() => {
              // Render a small stacked overlay for each tribe garrison present on this Outpost
              const overlays = [] as JSX.Element[];
              const hexCoords = formatHexCoords(q, r);
              const yStep = size * 0.3;
              const startY = -size * 0.45;
              (tribesOnHex || []).forEach((tribe, idx) => {
                const g = tribe.garrisons?.[hexCoords];
                const troops = g?.troops ?? 0;
                const chiefs = g?.chiefs?.length ?? 0;
                if (troops <= 0) return;
                const icon = TRIBE_ICONS[tribe.icon] || TRIBE_ICONS['castle'];
                overlays.push(
                  <g key={`op-g-${tribe.id}`} transform={`translate(${size * -0.45}, ${startY + idx * yStep})`}>
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
              return <>{overlays}</>;
            })()}

            {poi.type === POIType.Outpost && outpostOwnerId && (
              <g transform={`translate(${size * 0.45}, ${-size * 0.45})`}>
                <circle cx="0" cy="0" r={size * 0.22} fill="#111827" stroke="rgba(0,0,0,0.6)" strokeWidth="0.5" />
                {/* owner tribe badge if visible on hex */}
                {(() => {
                  const owner = (tribesOnHex || []).find(t => t.id === outpostOwnerId);
                  if (!owner) return null;
                  const icon = TRIBE_ICONS[owner.icon] || TRIBE_ICONS['castle'];
                  return (
                    <>
                      <circle cx="0" cy="0" r={size * 0.18} fill={owner.color} />
                      <text x="0" y="0" textAnchor="middle" dy=".3em" fontSize={size * 0.22} className="select-none">
                        {icon}
                      </text>
                    </>
                  );
                })()}
              </g>
            )}
        </g>
      )}

      {!isPoliticalMode && startOrder !== null && !isFogged && (
         <g className="pointer-events-none">
          {/* Large settlement symbol behind tribe icons for starting location/home base */}
          <text
            x="0"
            y="0"
            textAnchor="middle"
            dominantBaseline="central"
            className="select-none"
            fontSize={size * 1.4}
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
              fill: '#8b5cf6',
              opacity: 0.7
            }}
          >
            🏚️
          </text>
        </g>
      )}

      {!isPoliticalMode && !isFogged && getPresenceIndicator()}

       {!isPoliticalMode && isFogged && (
        <polygon
          points={points}
          fill="url(#fog-pattern)"
        />
      )}
    </g>
  );
};