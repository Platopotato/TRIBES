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
  highlightedHex?: {q: number, r: number} | null;
  selectedHexForAction?: {q: number, r: number} | null; // Currently selected hex for actions
  pendingHexSelection?: {q: number, r: number} | null; // Hex being previewed for selection
}

const MAP_RADIUS = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const VISIBILITY_RANGE = 1;
const HEX_SIZE = 12;

const JourneyIcon: React.FC<{ journey: Journey; tribe: Tribe | undefined; isPlayer: boolean; hexSize: number }> = ({ journey, tribe, isPlayer, hexSize }) => {
    const { q, r } = parseHexCoords(journey.currentLocation);
    const { x, y } = hexToPixel(q, r, hexSize);

    if (!tribe) {
        // Fallback to generic icon if tribe not found
        const iconColor = isPlayer ? 'text-green-400' : 'text-red-500';
        const circleFill = isPlayer ? 'fill-green-900/70' : 'fill-red-900/70';
        const circleStroke = isPlayer ? "stroke-green-400" : "stroke-red-500";
        const iconPath = <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />;

        return (
            <g transform={`translate(${x}, ${y})`}>
                <circle cx="0" cy="0" r={hexSize * 0.45} className={circleFill} stroke={circleStroke} strokeWidth="0.5" />
                <svg x={-hexSize * 0.25} y={-hexSize * 0.25} width={hexSize * 0.5} height={hexSize * 0.5} viewBox="0 0 24 24" className={`fill-current ${iconColor}`}>
                   {iconPath}
                </svg>
            </g>
        );
    }

    // Use actual tribe icon and color (similar to garrison display)
    const tribeIcon = TRIBE_ICONS[tribe.icon] || TRIBE_ICONS['skull'];
    const tribeColor = tribe.color;

    return (
        <g transform={`translate(${x}, ${y})`} className="pointer-events-none">
            {/* Tribe colored circle background */}
            <circle
                cx="0"
                cy="0"
                r={hexSize * 0.45}
                fill={tribeColor}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="1"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
            />
            {/* Tribe icon */}
            <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="central"
                className="select-none"
                fontSize={hexSize * 0.6}
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
            >
                {tribeIcon}
            </text>
            {/* Small movement indicator */}
            <circle
                cx={hexSize * 0.25}
                cy={-hexSize * 0.25}
                r={hexSize * 0.15}
                fill="rgba(255,255,255,0.9)"
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="0.5"
            />
            <text
                x={hexSize * 0.25}
                y={-hexSize * 0.25}
                textAnchor="middle"
                dominantBaseline="central"
                className="select-none"
                fontSize={hexSize * 0.25}
            >
                ➤
            </text>
        </g>
    );
};


const MapView: React.FC<MapViewProps> = (props) => {
  const { mapData, playerTribe, allTribes, journeys, startingLocations, selectionMode, onHexSelect, paintMode = false, onHexPaintStart, onHexPaint, onHexPaintEnd, homeBaseLocation, territoryData, highlightedHex, selectedHexForAction, pendingHexSelection } = props;
  
  const svgRef = useRef<SVGSVGElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const panGroupRef = useRef<SVGGElement>(null);
  
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const viewRef = useRef(view);

  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [hoveredHexInfo, setHoveredHexInfo] = useState<{ content: string; x: number; y: number } | null>(null);
  const [showMapKey, setShowMapKey] = useState(true);

  // Touch and gesture state
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [isMultiTouch, setIsMultiTouch] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [touchMoved, setTouchMoved] = useState(false);
  
  const isPoliticalMode = !!territoryData;

  const mapWidth = HEX_SIZE * Math.sqrt(3) * (MAP_RADIUS + 2);
  const mapHeight = HEX_SIZE * 2 * (MAP_RADIUS + 2);
  
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Original centering for home page map (uses map dimensions)
  const handleCenterOnHome = useCallback(() => {
    if (homeBaseLocation && svgRef.current) {
        const { q, r } = parseHexCoords(homeBaseLocation);
        const { x: targetX, y: targetY } = hexToPixel(q, r, HEX_SIZE);

        const zoom = 3.0;

        // Original logic for home page map with 8-hex upward adjustment
        const hexOffsetY = HEX_SIZE * 8 * zoom; // Move up by 8 hexes (scaled by zoom)
        const newX = (mapWidth / 2 - targetX) * zoom;
        const newY = (mapHeight / 2 - targetY) * zoom - hexOffsetY; // SUBTRACT to move UP

        console.log('🏠 Home page centering:', {
          homeBase: { q, r },
          targetPixel: { x: targetX, y: targetY },
          mapDimensions: { width: mapWidth, height: mapHeight },
          newView: { x: newX, y: newY, zoom }
        });

        setView({ x: newX, y: newY, zoom: zoom });
    }
  }, [homeBaseLocation, mapWidth, mapHeight]);

  // Destination selection centering (uses viewport dimensions)
  const handleCenterOnHomeForDestinationSelection = useCallback(() => {
    if (homeBaseLocation && svgRef.current) {
        const { q, r } = parseHexCoords(homeBaseLocation);
        const { x: targetX, y: targetY } = hexToPixel(q, r, HEX_SIZE);

        let viewportWidth = 800; // Default fallback
        let viewportHeight = 600; // Default fallback

        // Try to get actual viewport dimensions
        if (mapContainerRef.current) {
          const containerRect = mapContainerRef.current.getBoundingClientRect();
          if (containerRect.width > 0 && containerRect.height > 0) {
            viewportWidth = containerRect.width;
            viewportHeight = containerRect.height;
          }
        }

        // If still no dimensions, try SVG dimensions
        if ((viewportWidth === 800 || viewportHeight === 600) && svgRef.current) {
          const svgRect = svgRef.current.getBoundingClientRect();
          if (svgRect.width > 0 && svgRect.height > 0) {
            viewportWidth = svgRect.width;
            viewportHeight = svgRect.height;
          }
        }

        const zoom = 2.5;

        // Viewport-based centering for destination selection
        const newX = viewportWidth / 2 - targetX * zoom;
        const newY = viewportHeight / 2 - targetY * zoom;

        console.log('🎯 Destination selection centering:', {
          homeBase: { q, r },
          targetPixel: { x: targetX, y: targetY },
          viewport: { width: viewportWidth, height: viewportHeight },
          calculation: {
            targetXScaled: targetX * zoom,
            targetYScaled: targetY * zoom,
            viewportCenterX: viewportWidth / 2,
            viewportCenterY: viewportHeight / 2
          },
          newView: { x: newX, y: newY, zoom },
          containerAvailable: !!mapContainerRef.current,
          svgAvailable: !!svgRef.current,
          containerRect: mapContainerRef.current?.getBoundingClientRect()
        });

        setView({ x: newX, y: newY, zoom: zoom });
    }
  }, [homeBaseLocation]);

  // Auto-center on home base when selection mode is activated (destination selection)
  // Only center ONCE when selection mode first activates, no delayed jumping
  useEffect(() => {
    if (selectionMode && homeBaseLocation) {
      // Detect if mobile device
      const isMobileDevice = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);

      if (!isMobileDevice) {
        // Use regular home centering instead of destination-specific centering
        console.log('🎯 Centering on home base for destination selection (desktop only)...');
        handleCenterOnHome();
      } else {
        console.log('📱 Mobile device detected - skipping auto-centering for destination selection');
      }
    }
  }, [selectionMode, homeBaseLocation, handleCenterOnHomeForDestinationSelection]);

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
          visibleHexes.forEach(hex => {
            influence.add(hex);
            // Add ally vision hexes to explored set so terrain and POIs are visible
            explored.add(hex);
          });
        });
      });

      // Also add ally's own explored hexes to show their discovered terrain
      allies.forEach(ally => {
        ally.exploredHexes?.forEach(hex => explored.add(hex));
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
    // For desktop users, allow normal left-click panning even in selection mode
    // Only prevent panning if it's paint mode or not left/middle/right click
    if (paintMode || (e.button !== 0 && e.button !== 1 && e.button !== 2)) return;

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

  // Helper function to find hex at screen position
  const findHexAtPosition = (mapX: number, mapY: number) => {
    const HEX_SIZE = 20;
    const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
    const HEX_HEIGHT = 2 * HEX_SIZE;

    console.log('🔥 FINDING HEX AT:', { mapX, mapY, HEX_SIZE, HEX_WIDTH, HEX_HEIGHT });

    let closestHex = null;
    let closestDistance = Infinity;

    // Find the closest hex using axial coordinates
    for (const hex of mapData) {
      const hexX = HEX_WIDTH * (hex.q + hex.r / 2);
      const hexY = HEX_HEIGHT * 3/4 * hex.r;

      // Check if the point is within this hex (rough approximation)
      const distance = Math.sqrt((mapX - hexX) ** 2 + (mapY - hexY) ** 2);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestHex = hex;
      }

      // If within hex size, return immediately
      if (distance < HEX_SIZE) {
        console.log('🔥 HEX FOUND WITHIN SIZE:', {
          hex: `${hex.q},${hex.r}`,
          hexX,
          hexY,
          distance,
          terrain: hex.terrain
        });
        return hex;
      }
    }

    // If no exact match, return closest hex if within reasonable distance
    if (closestDistance < HEX_SIZE * 2) {
      console.log('🔥 CLOSEST HEX FOUND:', {
        hex: closestHex ? `${closestHex.q},${closestHex.r}` : null,
        distance: closestDistance,
        terrain: closestHex?.terrain
      });
      return closestHex;
    }

    console.log('🔥 NO HEX FOUND - closest distance:', closestDistance);
    return null;
  };

  // Touch event handlers for mobile support
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length === 1) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    const touch1 = touches[0];
    const touch2 = touches[1];
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();

    console.log('🔥 TOUCH START:', {
      selectionMode,
      paintMode,
      touchCount: e.touches.length,
      timestamp: Date.now()
    });

    setTouchStartTime(Date.now());
    setTouchMoved(false);

    if (e.touches.length === 1) {
      // Single touch
      const touch = e.touches[0];
      setStartPoint({ x: touch.clientX, y: touch.clientY });

      console.log('🔥 SINGLE TOUCH START:', {
        x: touch.clientX,
        y: touch.clientY,
        selectionMode,
        paintMode
      });

      if (paintMode) {
        // In paint mode, don't start panning
        setIsPanning(false);
        setIsMultiTouch(false);
        console.log('🔥 PAINT MODE - No panning');
      } else {
        // Normal mode OR selection mode - allow panning
        setIsPanning(true);
        setIsMultiTouch(false);
        console.log('🔥 NORMAL/SELECTION MODE - Start panning');
      }
    } else if (e.touches.length === 2) {
      // Multi-touch - start pinch zoom
      setIsMultiTouch(true);
      setIsPanning(false);
      const distance = getTouchDistance(e.touches);
      setLastTouchDistance(distance);
      console.log('🔥 MULTI-TOUCH START - Pinch zoom');
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    // Only prevent default if we're actually panning, not in selection mode
    if (!selectionMode && !paintMode) {
      try {
        e.preventDefault();
      } catch (err) {
        // Ignore passive event listener errors
      }
    }

    // Track if touch moved significantly
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startPoint.x);
      const dy = Math.abs(touch.clientY - startPoint.y);
      if (dx > 10 || dy > 10) {
        if (!touchMoved) {
          console.log('🔥 TOUCH MOVED:', { dx, dy, selectionMode, paintMode });
        }
        setTouchMoved(true);

        // Start panning if we moved and not in paint mode
        if (!paintMode && !isPanning) {
          setIsPanning(true);
          console.log('🔥 STARTED PANNING due to movement');
        }
      }
    }

    if (e.touches.length === 1 && isPanning && !isMultiTouch && panGroupRef.current) {
      // Single touch panning
      const touch = e.touches[0];
      const dx = touch.clientX - startPoint.x;
      const dy = touch.clientY - startPoint.y;

      const newX = viewRef.current.x + dx;
      const newY = viewRef.current.y + dy;

      panGroupRef.current.setAttribute('transform', `translate(${newX}, ${newY}) scale(${viewRef.current.zoom})`);
    } else if (e.touches.length === 2 && isMultiTouch && lastTouchDistance && svgRef.current) {
      // Pinch zoom
      const currentDistance = getTouchDistance(e.touches);
      if (currentDistance) {
        const zoomFactor = currentDistance / lastTouchDistance;
        const newZoom = Math.min(Math.max(viewRef.current.zoom * zoomFactor, MIN_ZOOM), MAX_ZOOM);

        const center = getTouchCenter(e.touches);
        const { width, height } = svgRef.current.getBoundingClientRect();
        const rect = svgRef.current.getBoundingClientRect();
        const x = center.x - rect.left;
        const y = center.y - rect.top;

        const newX = x - (x - viewRef.current.x) * (newZoom / viewRef.current.zoom);
        const newY = y - (y - viewRef.current.y) * (newZoom / viewRef.current.zoom);

        setView({ x: newX, y: newY, zoom: newZoom });
        setLastTouchDistance(currentDistance);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    // DON'T preventDefault if we're in selection mode - let clicks through
    if (!selectionMode && !paintMode) {
      e.preventDefault();
    }

    const touchDuration = Date.now() - touchStartTime;
    const isQuickTap = touchDuration < 300 && !touchMoved;

    console.log('🔥 TOUCH END:', {
      touchDuration,
      touchMoved,
      isQuickTap,
      selectionMode,
      paintMode,
      isPanning,
      isMultiTouch
    });

    // Handle hex selection on quick tap (not pan)
    if (isQuickTap && (selectionMode || paintMode)) {
      console.log('🔥 ATTEMPTING HEX SELECTION');
      const touch = e.changedTouches[0];
      const rect = svgRef.current?.getBoundingClientRect();

      console.log('🔥 TOUCH DETAILS:', {
        touchX: touch.clientX,
        touchY: touch.clientY,
        rect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null
      });

      if (rect && touch) {
        // Convert touch coordinates to SVG coordinates
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        console.log('🔥 SVG COORDINATES:', { x, y });

        // Convert to map coordinates accounting for pan and zoom
        const mapX = (x - viewRef.current.x) / viewRef.current.zoom;
        const mapY = (y - viewRef.current.y) / viewRef.current.zoom;

        console.log('🔥 MAP COORDINATES:', {
          mapX,
          mapY,
          viewX: viewRef.current.x,
          viewY: viewRef.current.y,
          zoom: viewRef.current.zoom
        });

        // Find the hex at this position
        const hexAtPosition = findHexAtPosition(mapX, mapY);
        console.log('🔥 HEX FOUND:', hexAtPosition);
        console.log('🔥 SELECTION MODE:', selectionMode);
        console.log('🔥 PAINT MODE:', paintMode);

        if (hexAtPosition && hexAtPosition.terrain !== 'Water') {
          console.log('🔥 ✅ VALID HEX SELECTED:', hexAtPosition.q, hexAtPosition.r);
          if (selectionMode) {
            console.log('🔥 CALLING onHexSelect with:', hexAtPosition.q, hexAtPosition.r);
            onHexSelect(hexAtPosition.q, hexAtPosition.r);
            console.log('🔥 onHexSelect CALLED');
          } else {
            console.log('🔥 ❌ SELECTION MODE IS FALSE - not calling onHexSelect');
          }
          if (paintMode && onHexPaintStart) {
            console.log('🔥 CALLING onHexPaintStart');
            onHexPaintStart(hexAtPosition.q, hexAtPosition.r);
          }
          return; // Don't process as pan
        } else {
          console.log('🔥 ❌ NO VALID HEX FOUND or Water terrain');
          if (hexAtPosition) {
            console.log('🔥 ❌ Hex terrain was:', hexAtPosition.terrain);
          }
        }
      } else {
        console.log('🔥 ❌ NO RECT OR TOUCH');
      }
    } else {
      console.log('🔥 NOT A QUICK TAP - skipping hex selection');
    }

    if (isPanning && !isMultiTouch) {
      setIsPanning(false);
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startPoint.x;
      const dy = touch.clientY - startPoint.y;
      setView({
        x: viewRef.current.x + dx,
        y: viewRef.current.y + dy,
        zoom: viewRef.current.zoom,
      });
    }

    if (e.touches.length === 0) {
      setIsMultiTouch(false);
      setLastTouchDistance(null);
    }

    if (paintMode && onHexPaintEnd) {
      onHexPaintEnd();
    }
  };

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
    selectionMode ? "border-2 border-amber-400 ring-4 ring-amber-400/50 cursor-pointer" : ""
  ].join(' ');

  const visibleJourneys = useMemo(() => {
      if (isPoliticalMode || !playerTribe) return []; // No journeys in political mode or for observers
      return journeys.filter(j => j.ownerTribeId === playerTribe.id || influenceSet.has(j.currentLocation));
  }, [journeys, playerTribe, influenceSet, isPoliticalMode]);

  return (
    <div className="bg-neutral-900/70 border border-neutral-700 rounded-lg shadow-lg p-4 relative overflow-hidden h-full flex flex-col">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <TerrainPatterns />
          </defs>
      </svg>
      <h3 className="text-lg font-bold text-amber-400 tracking-wider mb-4 flex-shrink-0 text-center">{isPoliticalMode ? 'Territory Map' : 'Wasteland Map'}</h3>
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
            className="w-full h-full"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'none' }}
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
                      onClick={() => {
                        console.log('🔥 HEXAGON CLICK:', hex.q, hex.r, 'selectionMode:', selectionMode);
                        if(selectionMode && hex.terrain !== 'Water') {
                          console.log('🔥 HEXAGON CALLING onHexSelect');
                          onHexSelect(hex.q, hex.r);
                        }
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        console.log('🔥 HEXAGON TOUCH END:', hex.q, hex.r, 'selectionMode:', selectionMode);
                        if(selectionMode && hex.terrain !== 'Water') {
                          console.log('🔥 HEXAGON TOUCH CALLING onHexSelect');
                          onHexSelect(hex.q, hex.r);
                        }
                      }}
                      onMouseDown={() => {if(paintMode && onHexPaintStart) onHexPaintStart(hex.q, hex.r)}}
                      onMouseOver={() => {if(paintMode && onHexPaint) onHexPaint(hex.q, hex.r)}}
                      onMouseEnter={(e) => handleHexMouseEnter(hex.q, hex.r, e)}
                      onMouseLeave={handleHexMouseLeave}
                    />
                  );
                })}

                {/* Highlighted Hex Overlay */}
                {highlightedHex && (
                  (() => {
                    const width = Math.sqrt(3) * HEX_SIZE;
                    const height = 2 * HEX_SIZE;
                    const x = width * (highlightedHex.q + highlightedHex.r / 2);
                    const y = (height * 3 / 4) * highlightedHex.r;
                    const points = [
                      [0, -HEX_SIZE],
                      [width / 2, -HEX_SIZE / 2],
                      [width / 2, HEX_SIZE / 2],
                      [0, HEX_SIZE],
                      [-width / 2, HEX_SIZE / 2],
                      [-width / 2, -HEX_SIZE / 2],
                    ].map(p => `${p[0]},${p[1]}`).join(' ');

                    return (
                      <g transform={`translate(${x}, ${y})`} className="pointer-events-none">
                        <polygon
                          points={points}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth="3"
                          className="animate-pulse"
                        />
                        <polygon
                          points={points}
                          fill="#fbbf24"
                          fillOpacity="0.2"
                          className="animate-pulse"
                        />
                      </g>
                    );
                  })()
                )}

                {/* Selected Hex for Action Overlay - Bright Green */}
                {selectedHexForAction && (
                  (() => {
                    const width = Math.sqrt(3) * HEX_SIZE;
                    const height = 2 * HEX_SIZE;
                    const x = width * (selectedHexForAction.q + selectedHexForAction.r / 2);
                    const y = (height * 3 / 4) * selectedHexForAction.r;
                    const points = [
                      [0, -HEX_SIZE],
                      [width / 2, -HEX_SIZE / 2],
                      [width / 2, HEX_SIZE / 2],
                      [0, HEX_SIZE],
                      [-width / 2, HEX_SIZE / 2],
                      [-width / 2, -HEX_SIZE / 2],
                    ].map(p => `${p[0]},${p[1]}`).join(' ');

                    return (
                      <g transform={`translate(${x}, ${y})`} className="pointer-events-none">
                        {/* Bright green pulsing border */}
                        <polygon
                          points={points}
                          fill="none"
                          stroke="#00ff00"
                          strokeWidth="4"
                          className="animate-pulse"
                        />
                        {/* Bright green fill */}
                        <polygon
                          points={points}
                          fill="#00ff00"
                          fillOpacity="0.3"
                          className="animate-pulse"
                        />
                        {/* Selection indicator text */}
                        <text
                          x="0"
                          y="0"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="8"
                          fill="#ffffff"
                          fontWeight="bold"
                          className="pointer-events-none"
                        >
                          ✓
                        </text>
                      </g>
                    );
                  })()
                )}

                {/* Pending Hex Selection Overlay - Orange Preview */}
                {pendingHexSelection && (
                  (() => {
                    const width = Math.sqrt(3) * HEX_SIZE;
                    const height = 2 * HEX_SIZE;
                    const x = width * (pendingHexSelection.q + pendingHexSelection.r / 2);
                    const y = (height * 3 / 4) * pendingHexSelection.r;
                    const points = [
                      [0, -HEX_SIZE],
                      [width / 2, -HEX_SIZE / 2],
                      [width / 2, HEX_SIZE / 2],
                      [0, HEX_SIZE],
                      [-width / 2, HEX_SIZE / 2],
                      [-width / 2, -HEX_SIZE / 2],
                    ].map(p => `${p[0]},${p[1]}`).join(' ');

                    return (
                      <g transform={`translate(${x}, ${y})`} className="pointer-events-none">
                        {/* Orange pulsing border for preview */}
                        <polygon
                          points={points}
                          fill="none"
                          stroke="#ff8800"
                          strokeWidth="4"
                          className="animate-pulse"
                        />
                        {/* Orange fill for preview */}
                        <polygon
                          points={points}
                          fill="#ff8800"
                          fillOpacity="0.4"
                          className="animate-pulse"
                        />
                        {/* Preview indicator text */}
                        <text
                          x="0"
                          y="0"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="8"
                          fill="#ffffff"
                          fontWeight="bold"
                          className="pointer-events-none"
                        >
                          ?
                        </text>
                      </g>
                    );
                  })()
                )}

                {/* Render Journeys on top of hexes */}
                {!isPoliticalMode && visibleJourneys.map(journey => {
                    const journeyTribe = allTribes.find(t => t.id === journey.ownerTribeId);
                    return (
                        <JourneyIcon
                            key={journey.id}
                            journey={journey}
                            tribe={journeyTribe}
                            isPlayer={journey.ownerTribeId === playerTribe?.id}
                            hexSize={HEX_SIZE}
                        />
                    );
                })}
              </g>
          </g>
        </svg>
      </div>

      {/* Map Key Toggle Button */}
      {!isPoliticalMode && (
        <button
          onClick={() => setShowMapKey(!showMapKey)}
          className="absolute top-4 left-4 bg-neutral-900/90 hover:bg-neutral-800/90 p-2 rounded-md border border-neutral-600 hover:border-neutral-500 transition-colors duration-200 z-20 hidden md:block"
          title={showMapKey ? "Hide Map Key" : "Show Map Key"}
        >
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {showMapKey ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            )}
          </svg>
        </button>
      )}

      {/* Map Key Panel */}
      {!isPoliticalMode && showMapKey && (
          <div className="absolute top-4 left-16 bg-neutral-900/80 p-3 rounded-md border border-neutral-700 max-h-[calc(100vh-4rem)] w-56 hidden md:block z-10 overflow-y-auto">

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
