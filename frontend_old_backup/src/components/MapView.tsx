import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { Tribe, POIType, HexData, TerrainType, Journey, JourneyType, DiplomaticStatus } from '@radix-tribes/shared';
import { POI_SYMBOLS, POI_COLORS, TRIBE_ICONS } from '@radix-tribes/shared';
import { Hexagon } from './Hexagon';
import TerrainPatterns from './map/TerrainPatterns';
import { parseHexCoords, getHexesInRange, formatHexCoords, hexToPixel } from '../lib/mapUtils';

interface MapViewProps {
  mapData: HexData[];
  playerTribe: Tribe | undefined;
  allTribes: Tribe[];
  journeys: Journey[];
  startingLocations: string[];
  selectionMode: boolean;
  onHexSelect: (q: number, r: number) => void;
  paintMode?: boolean;
  onHexPaintStart?: (q: number, r: number) => void;
  onHexPaint?: (q: number, r: number) => void;
  onHexPaintEnd?: () => void;
  homeBaseLocation?: string;
  territoryData?: Map<string, { color: string; tribeName: string }>;
}

const MAP_RADIUS = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const VISIBILITY_RANGE = 2;
const HEX_SIZE = 12;

const JourneyIcon: React.FC<{ journey: Journey; isPlayer: boolean; hexSize: number }> = ({ journey, isPlayer, hexSize }) => {
    const { q, r } = parseHexCoords(journey.currentLocation);
    const { x, y } = hexToPixel(q, r, hexSize);
    
    // Default journey icon settings
    let iconColor = isPlayer ? 'text-green-400' : 'text-red-500';
    let circleFill = isPlayer ? 'fill-green-900/70' : 'fill-red-900/70';
    let circleStroke = isPlayer ? "stroke-green-400" : "stroke-red-500";
    let iconPath = <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />;
    
    // A slightly larger, cleaner presentation for all journey icons
    return (
        <g transform={`translate(${x}, ${y})`}>
            <circle cx="0" cy="0" r={hexSize * 0.45} className={circleFill} stroke={circleStroke} strokeWidth="0.5" />
            <svg x={-hexSize * 0.25} y={-hexSize * 0.25} width={hexSize * 0.5} height={hexSize * 0.5} viewBox="0 0 24 24" className={`fill-current ${iconColor}`}>
               {iconPath}
            </svg>
        </g>
    );
};


const MapView: React.FC<MapViewProps> = (props) => {
  const { mapData, playerTribe, allTribes, journeys, startingLocations, selectionMode, onHexSelect, paintMode = false, onHexPaintStart, onHexPaint, onHexPaintEnd, homeBaseLocation, territoryData } = props;
  
  const svgRef = useRef<SVGSVGElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const panGroupRef = useRef<SVGGElement>(null);
  
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const viewRef = useRef(view);

  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [hoveredHexInfo, setHoveredHexInfo] = useState<{ content: string; x: number; y: number } | null>(null);
  
  const isPoliticalMode = !!territoryData;

  const mapWidth = HEX_SIZE * Math.sqrt(3) * (MAP_RADIUS + 2);
  const mapHeight = HEX_SIZE * 2 * (MAP_RADIUS + 2);
  
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const handleCenterOnHome = useCallback(() => {
    if (homeBaseLocation && svgRef.current) {
        const { q, r } = parseHexCoords(homeBaseLocation);
        const { x: targetX, y: targetY } = hexToPixel(q, r, HEX_SIZE);
        
        const zoom = 3.0;
        
        const newX = (mapWidth / 2 - targetX) * zoom;
        const newY = (mapHeight / 2 - targetY) * zoom;
        
        setView({ x: newX, y: newY, zoom: zoom });
    }
  }, [homeBaseLocation, mapWidth, mapHeight]);

  // --- FOG OF WAR & VISIBILITY CALCULATION ---
  const { exploredSet, influenceSet, visibleTribesByLocation } = useMemo(() => {
    if (isPoliticalMode) {
      return { exploredSet: new Set(), influenceSet: new Set(), visibleTribesByLocation: new Map() };
    }
    const explored = new Set<string>(playerTribe?.exploredHexes || []);
    const influence = new Set<string>();
    const visibleTribes = new Map<string, Tribe[]>();

    if (playerTribe) {
      // Find all allies of the player tribe
      const allies = allTribes.filter(t => playerTribe.diplomacy[t.id]?.status === DiplomaticStatus.Alliance);
      const playerAndAllies = [playerTribe, ...allies];

      // Calculate combined influence of player and allies
      playerAndAllies.forEach(tribe => {
        Object.keys(tribe.garrisons || {}).forEach(loc => {
          const { q, r } = parseHexCoords(loc);
          const visibleHexes = getHexesInRange({q, r}, VISIBILITY_RANGE);
          visibleHexes.forEach(hex => influence.add(hex));
        });
      });
    }

    // Determine which tribes are visible
    allTribes.forEach(t => {
      if (!t.garrisons) return;
      Object.keys(t.garrisons).forEach(loc => {
        if ((t.garrisons[loc].troops > 0 || (t.garrisons[loc].chiefs?.length || 0) > 0)) {
            // A tribe is visible if they are the player, an ally, or in an influence hex.
            // Admins (no playerTribe) see everyone.
            const isPlayerOrAlly = playerTribe && (t.id === playerTribe.id || playerTribe.diplomacy[t.id]?.status === DiplomaticStatus.Alliance);
            if (!playerTribe || isPlayerOrAlly || influence.has(loc)) {
                if (!visibleTribes.has(loc)) {
                    visibleTribes.set(loc, []);
                }
                visibleTribes.get(loc)!.push(t);
                console.log(`🎯 Tribe ${t.tribeName} visible at ${loc} - troops: ${t.garrisons[loc].troops}, isPlayer: ${t.id === playerTribe?.id}`);
            }
        }
      });
    });

    return { exploredSet: explored, influenceSet: influence, visibleTribesByLocation: visibleTribes };
  }, [playerTribe, allTribes, isPoliticalMode]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleCenterOnHome();
    }, 100);

    return () => clearTimeout(timer);
  }, [homeBaseLocation, handleCenterOnHome]);


  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;

    const { clientX, clientY, deltaY } = e;
    const { left, top } = svgRef.current.getBoundingClientRect();

    const x = clientX - left;
    const y = clientY - top;

    const zoomFactor = 1.1;
    const newZoom = deltaY < 0 ? view.zoom * zoomFactor : view.zoom / zoomFactor;
    const clampedZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);
    
    const newX = x - (x - view.x) * (clampedZoom / view.zoom);
    const newY = y - (y - view.y) * (clampedZoom / view.zoom);

    setView({ x: newX, y: newY, zoom: clampedZoom });
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (selectionMode || paintMode || e.button !== 0) return;
    e.preventDefault();
    setIsPanning(true);
    setStartPoint({ 
      x: e.clientX,
      y: e.clientY 
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning || !panGroupRef.current) return;
    e.preventDefault();
    
    const dx = e.clientX - startPoint.x;
    const dy = e.clientY - startPoint.y;

    const newX = viewRef.current.x + dx;
    const newY = viewRef.current.y + dy;

    panGroupRef.current.setAttribute('transform', `translate(${newX}, ${newY}) scale(${viewRef.current.zoom})`);
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      const dx = e.clientX - startPoint.x;
      const dy = e.clientY - startPoint.y;
      setView({
        x: viewRef.current.x + dx,
        y: viewRef.current.y + dy,
        zoom: viewRef.current.zoom,
      });
    }
    if (paintMode && onHexPaintEnd) {
      onHexPaintEnd();
    }
  };
  
  const handleZoomButtonClick = (direction: 'in' | 'out' | 'reset') => {
      if (direction === 'reset') {
          setView({x: 0, y: 0, zoom: 1});
          return;
      }
      const zoomFactor = 1.5;
      const newZoom = direction === 'in' ? view.zoom * zoomFactor : view.zoom / zoomFactor;
      const clampedZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);
      
       if (svgRef.current) {
        const { width, height } = svgRef.current.getBoundingClientRect();
        const centerX = width / 2;
        const centerY = height / 2;
        const newX = centerX - (centerX - view.x) * (clampedZoom / view.zoom);
        const newY = centerY - (centerY - view.y) * (clampedZoom / view.zoom);
        setView({ x: newX, y: newY, zoom: clampedZoom });
      }
  }

  const handleHexMouseEnter = (q: number, r: number, event: React.MouseEvent) => {
    if (isPanning || paintMode || selectionMode) return;
    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const hexCoords = formatHexCoords(q, r);

      let content = `Hex: ${hexCoords}`;
      const territoryInfo = territoryData?.get(hexCoords);

      if (isPoliticalMode) {
          if (territoryInfo) {
              content = territoryInfo.tribeName;
          } else {
              const hex = mapData.find(h => formatHexCoords(h.q, h.r) === hexCoords);
              if (hex?.terrain === TerrainType.Water) {
                  content = "Impassable Water";
              } else {
                  content = "Unclaimed Land";
              }
          }
      } else {
         if (!exploredSet.has(hexCoords) && playerTribe) {
          return;
        }
      }

      setHoveredHexInfo({
        content,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const handleHexMouseLeave = () => {
    setHoveredHexInfo(null);
  };
  
  const mapContainerClasses = [
    "bg-black rounded-md overflow-hidden relative",
    isPanning ? "cursor-grabbing" : !selectionMode && !paintMode ? "cursor-grab" : "",
    paintMode ? "cursor-crosshair" : "",
    selectionMode ? "border-2 border-amber-400 ring-4 ring-amber-400/50" : ""
  ].join(' ');

  const visibleJourneys = useMemo(() => {
      if (isPoliticalMode || !playerTribe) return []; // No journeys in political mode or for observers
      return journeys.filter(j => j.ownerTribeId === playerTribe.id || influenceSet.has(j.currentLocation));
  }, [journeys, playerTribe, influenceSet, isPoliticalMode]);

  return (
    <div className="bg-neutral-900/70 border border-neutral-700 rounded-lg shadow-lg p-2 md:p-4 relative overflow-hidden h-full flex flex-col">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <TerrainPatterns />
          </defs>
      </svg>
      <h3 className="text-sm md:text-lg font-bold text-amber-400 tracking-wider mb-2 md:mb-4 flex-shrink-0">{isPoliticalMode ? 'Territory Map' : 'Wasteland Map'}</h3>
      <div ref={mapContainerRef} className={mapContainerClasses} style={{ flexGrow: 1 }}>
        {selectionMode && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-slate-900/80 text-amber-400 px-3 py-1 rounded-md border border-slate-600 font-bold animate-pulse">
                SELECT A TARGET HEX
            </div>
        )}
        {hoveredHexInfo && (
            <div 
                className="absolute z-30 p-2 text-sm font-bold bg-slate-900/80 text-amber-400 rounded-md pointer-events-none"
                style={{ top: `${hoveredHexInfo.y + 15}px`, left: `${hoveredHexInfo.x + 15}px` }}
            >
                {hoveredHexInfo.content}
            </div>
        )}
        <div className="absolute top-2 right-2 z-20 flex flex-col space-y-1">
            <button onClick={() => handleZoomButtonClick('in')} className="w-8 h-8 bg-slate-800/80 text-white rounded-md font-bold text-lg hover:bg-slate-700">+</button>
            <button onClick={() => handleZoomButtonClick('out')} className="w-8 h-8 bg-slate-800/80 text-white rounded-md font-bold text-lg hover:bg-slate-700">-</button>
            <button onClick={() => handleZoomButtonClick('reset')} className="w-8 h-8 bg-slate-800/80 text-white rounded-md font-bold text-xs hover:bg-slate-700">RST</button>
            {!isPoliticalMode && homeBaseLocation && (
                <button onClick={handleCenterOnHome} title="Center on Home Base" className="w-8 h-8 bg-slate-800/80 text-white rounded-md font-bold text-lg hover:bg-slate-700">🎯</button>
            )}
        </div>

        <svg
            ref={svgRef}
            viewBox={`${-mapWidth / 2} ${-mapHeight / 2} ${mapWidth} ${mapHeight}`}
            className="w-full h-full touch-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={(e) => handleMouseDown(e as any)}
            onTouchMove={(e) => handleMouseMove(e as any)}
            onTouchEnd={(e) => handleMouseUp(e as any)}
        >
          <g 
            ref={panGroupRef}
            transform={`translate(${view.x}, ${view.y}) scale(${view.zoom})`}
           >
              <g transform={`translate(${-mapWidth/2}, ${-mapHeight/2})`}>
                {mapData.map(hex => {
                  const hexCoords = formatHexCoords(hex.q, hex.r);
                  const isExplored = playerTribe ? exploredSet.has(hexCoords) : true;
                  const isInInfluence = playerTribe ? influenceSet.has(hexCoords) : false;
                  
                  const tribesOnHex = visibleTribesByLocation.get(hexCoords);
                  const startLocationIndex = startingLocations.indexOf(hexCoords);
                  const politicalData = territoryData?.get(hexCoords);

                  return (
                    <Hexagon
                      key={hexCoords}
                      hexData={hex}
                      size={HEX_SIZE}
                      tribesOnHex={tribesOnHex}
                      playerTribe={playerTribe}
                      isInPlayerInfluence={isInInfluence}
                      isFogged={!isPoliticalMode && !isExplored}
                      isSelectable={(selectionMode || paintMode) && hex.terrain !== 'Water'}
                      startOrder={startLocationIndex !== -1 ? startLocationIndex + 1 : null}
                      isPoliticalMode={isPoliticalMode}
                      politicalData={politicalData}
                      onClick={() => { if(selectionMode && hex.terrain !== 'Water') onHexSelect(hex.q, hex.r)}}
                      onMouseDown={() => {if(paintMode && onHexPaintStart) onHexPaintStart(hex.q, hex.r)}}
                      onMouseOver={() => {if(paintMode && onHexPaint) onHexPaint(hex.q, hex.r)}}
                      onMouseEnter={(e) => handleHexMouseEnter(hex.q, hex.r, e)}
                      onMouseLeave={handleHexMouseLeave}
                    />
                  );
                })}
                {/* Render Journeys on top of hexes */}
                {!isPoliticalMode && visibleJourneys.map(journey => (
                    <JourneyIcon 
                        key={journey.id}
                        journey={journey}
                        isPlayer={journey.ownerTribeId === playerTribe?.id}
                        hexSize={HEX_SIZE}
                    />
                ))}
              </g>
          </g>
        </svg>
      </div>
      {!isPoliticalMode && (
          <div className="absolute top-6 left-6 bg-neutral-900/80 p-3 rounded-md border border-neutral-700 max-h-[calc(100vh-4rem)] w-56 hidden md:block z-10 overflow-y-auto">
            
            {/* POI Legend */}
            <h4 className="text-sm font-bold text-amber-400 mb-2">POI Legend</h4>
            <div className="grid grid-cols-1 gap-y-1">
              {Object.entries(POI_SYMBOLS).map(([type, symbol]) => (
                <div key={type} className="flex items-center space-x-2">
                  <div className={`w-5 h-5 rounded-sm flex items-center justify-center text-xs font-bold shrink-0 ${POI_COLORS[type as POIType].bg.replace('fill-','bg-')} ${POI_COLORS[type as POIType].text}`}>
                    {symbol}
                  </div>
                  <span className="text-xs text-slate-300">{type}</span>
                </div>
              ))}
            </div>

            {/* Terrain Legend */}
            <div className="mt-3 pt-3 border-t border-neutral-700">
                <h4 className="text-sm font-bold text-amber-400 mb-2">Terrain Key</h4>
                <div className="grid grid-cols-1 gap-y-1">
                    {Object.values(TerrainType).map(terrain => (
                        <div key={terrain} className="flex items-center space-x-2">
                            <svg className="w-5 h-5 rounded-sm border border-slate-600 shrink-0" viewBox="0 0 20 20">
                                <rect width="20" height="20" fill={`url(#texture-${terrain})`} />
                            </svg>
                            <span className="text-xs text-slate-300">{terrain}</span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default MapView;
