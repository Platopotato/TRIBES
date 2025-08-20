
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { HexData, MapSettings, TerrainType, POIType } from '@radix-tribes/shared';
import MapView from './MapView';
import TerrainToolbar from './editor/TerrainToolbar';
import Button from './ui/Button';
import Card from './ui/Card';
import { generateMapData } from '../lib/mapGenerator';
import ConfirmationModal from './ui/ConfirmationModal';
import { POI_RARITY_MAP } from '@radix-tribes/shared';

interface MapEditorProps {
    initialMapData: HexData[];
    initialMapSettings?: MapSettings;
    initialMapSeed?: number;
    initialStartLocations: string[];
    onSave: (mapData: HexData[], startingLocations: string[]) => void;
    onCancel: () => void;
    gameState?: any; // Optional game state to detect existing fortified POIs
}

const MAP_RADIUS = 40;
const MAX_START_LOCATIONS = 50;

type Brush = TerrainType | POIType | 'clear_poi' | 'clear_terrain' | 'set_start_location' | 'fortify_poi' | 'unfortify_poi';
type BrushSize = 'single' | 'cluster';

const formatHexCoords = (q: number, r: number) => `${String(50 + q).padStart(3, '0')}.${String(50 + r).padStart(3, '0')}`;
const getNeighbors = (q: number, r: number) => {
    const directions = [
        { q: 1, r: 0 }, { q: -1, r: 0 },
        { q: 0, r: 1 }, { q: 0, r: -1 },
        { q: 1, r: -1 }, { q: -1, r: 1 },
    ];
    return directions.map(dir => ({ q: q + dir.q, r: r + dir.r }));
};

const MapEditor: React.FC<MapEditorProps> = (props) => {
    const { initialMapData, initialMapSettings, initialStartLocations, onSave, onCancel, gameState } = props;
    
    const [editedMap, setEditedMap] = useState<HexData[]>(() => JSON.parse(JSON.stringify(initialMapData)));
    const [startLocations, setStartLocations] = useState<string[]>(initialStartLocations);
    const [activeBrush, setActiveBrush] = useState<Brush | null>(null);
    const [isPainting, setIsPainting] = useState(false);
    const [brushSize, setBrushSize] = useState<BrushSize>('single');
    
    const [mapSettings, setMapSettings] = useState<MapSettings | undefined>(initialMapSettings);
    const [showGenConfirm, setShowGenConfirm] = useState(false);
    const [showClearStartsConfirm, setShowClearStartsConfirm] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mapFileToLoad, setMapFileToLoad] = useState<string | null>(null);
    
    const mapDataMap = useMemo(() => {
        const newMap = new Map<string, HexData>();
        editedMap.forEach(hex => newMap.set(`${hex.q},${hex.r}`, hex));
        return newMap;
    }, [editedMap]);

    const handlePaintAction = useCallback((q: number, r: number) => {
        if (!activeBrush) return;

        const hexesToPaint = (brushSize === 'cluster' && activeBrush !== 'set_start_location')
            ? [{q, r}, ...getNeighbors(q, r)]
            : [{q, r}];
        
        const newMapDataMap = new Map(mapDataMap.entries());
        let mapWasUpdated = false;

        hexesToPaint.forEach(hexCoords => {
            const key = `${hexCoords.q},${hexCoords.r}`;
            const hexToUpdate = newMapDataMap.get(key);
            if (!hexToUpdate) return;
            
            if (hexToUpdate.terrain === TerrainType.Water && !Object.values(TerrainType).includes(activeBrush as TerrainType)) {
                return;
            }
            
            const newHex = {...hexToUpdate};
            let hexUpdated = false;

            if (Object.values(TerrainType).includes(activeBrush as TerrainType)) {
                if (newHex.terrain !== activeBrush) {
                     newHex.terrain = activeBrush as TerrainType;
                     hexUpdated = true;
                }
            } else if (Object.values(POIType).includes(activeBrush as POIType)) {
                const poiType = activeBrush as POIType;
                if (newHex.poi?.type !== poiType) {
                    newHex.poi = { id: `poi-${hexCoords.q}-${hexCoords.r}`, type: poiType, difficulty: 5, rarity: POI_RARITY_MAP[poiType] || 'Common' };
                    hexUpdated = true;
                }
            } else if (activeBrush === 'clear_poi') {
                if (newHex.poi) {
                    newHex.poi = undefined;
                    hexUpdated = true;
                }
            } else if (activeBrush === 'fortify_poi') {
                if (newHex.poi && !newHex.poi.fortified) {
                    newHex.poi = { ...newHex.poi, fortified: true, outpostOwner: 'admin' };
                    hexUpdated = true;
                }
            } else if (activeBrush === 'unfortify_poi') {
                if (newHex.poi && newHex.poi.fortified) {
                    const { fortified, outpostOwner, ...poiWithoutFortification } = newHex.poi;
                    newHex.poi = poiWithoutFortification;
                    hexUpdated = true;
                }
            } else if (activeBrush === 'clear_terrain') {
                 if (newHex.terrain !== TerrainType.Water) {
                    newHex.terrain = TerrainType.Water;
                    hexUpdated = true;
                }
            }
            
            if (hexUpdated) {
                newMapDataMap.set(key, newHex);
                mapWasUpdated = true;
            }
        });

        if (mapWasUpdated) {
            setEditedMap(Array.from(newMapDataMap.values()));
        }

        // Handle start locations separately as it's not a map data change
        if (activeBrush === 'set_start_location') {
            const hexCoords = formatHexCoords(q, r);
            const index = startLocations.indexOf(hexCoords);
            if (index > -1) {
                setStartLocations(prev => prev.filter(loc => loc !== hexCoords));
            } else {
                if (startLocations.length < MAX_START_LOCATIONS) {
                    setStartLocations(prev => [...prev, hexCoords]);
                } else {
                    alert(`Cannot add more than ${MAX_START_LOCATIONS} starting locations.`);
                }
            }
        }
    }, [activeBrush, mapDataMap, startLocations, brushSize]);

    const handlePaintStart = (q: number, r: number) => {
        setIsPainting(true);
        handlePaintAction(q, r);
    };

    const handleHexPaint = useCallback((q: number, r: number) => {
        if (!isPainting) return;
        handlePaintAction(q, r);
    }, [isPainting, handlePaintAction]);

    const handlePaintEnd = () => {
        setIsPainting(false);
    };

    const handleGenerateNewMap = () => {
        if (!mapSettings) return;
        const { map: newMap, startingLocations: newStartLocations } = generateMapData(MAP_RADIUS, Date.now(), mapSettings);
        setEditedMap(newMap);
        setStartLocations(newStartLocations);
        setShowGenConfirm(false);
    }
    
    const handleBiasChange = (terrain: TerrainType, value: number) => {
      setMapSettings(prev => {
          if (!prev) return prev;
          return {
              ...prev,
              biases: {
                  ...prev.biases,
                  [terrain]: value
              }
          }
      })
    }

    // Function to detect and apply existing fortified POIs from game state
    const applyExistingFortifications = () => {
        if (!gameState) return;

        let updatedMap = [...editedMap];
        let fortificationsFound = 0;

        // Check current game state map data for fortified POIs
        if (gameState.mapData) {
            gameState.mapData.forEach((gameHex: any) => {
                if (gameHex.poi && gameHex.poi.fortified) {
                    // Find corresponding hex in editor map
                    const editorHexIndex = updatedMap.findIndex(hex => hex.q === gameHex.q && hex.r === gameHex.r);
                    if (editorHexIndex !== -1) {
                        const editorHex = updatedMap[editorHexIndex];
                        if (editorHex.poi) {
                            // Apply fortification to existing POI
                            updatedMap[editorHexIndex] = {
                                ...editorHex,
                                poi: {
                                    ...editorHex.poi,
                                    fortified: true,
                                    outpostOwner: gameHex.poi.outpostOwner || 'unknown'
                                }
                            };
                            fortificationsFound++;
                        }
                    }
                }
            });
        }

        setEditedMap(updatedMap);
        alert(`Applied ${fortificationsFound} existing fortifications to the map!`);
    }
    
    const handleClearStartLocations = () => {
        setStartLocations([]);
        setShowClearStartsConfirm(false);
    }

    const handleSaveMapFile = () => {
        const mapFileContent = {
            mapData: editedMap,
            startingLocations: startLocations,
        };
        const stateString = JSON.stringify(mapFileContent, null, 2);
        const blob = new Blob([stateString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `radix-map-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoadMapClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (text) {
                setMapFileToLoad(text);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const executeLoadMap = () => {
        if (!mapFileToLoad) return;
        try {
            const loadedData = JSON.parse(mapFileToLoad);
            if (!loadedData.mapData || !Array.isArray(loadedData.mapData) || !loadedData.startingLocations || !Array.isArray(loadedData.startingLocations)) {
                throw new Error('Invalid map file structure. Missing mapData or startingLocations.');
            }
            const firstHex = loadedData.mapData[0];
            if (firstHex && (typeof firstHex.q !== 'number' || typeof firstHex.r !== 'number' || typeof firstHex.terrain !== 'string')) {
                throw new Error('Invalid mapData format in file.');
            }
            setEditedMap(loadedData.mapData);
            setStartLocations(loadedData.startingLocations);
            alert('Map loaded successfully!');
        } catch (error) {
            console.error('Failed to load map file:', error);
            alert(`Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setMapFileToLoad(null);
        }
    };

    return (
        <div className="h-screen w-screen bg-slate-900 flex flex-col p-4 gap-4">
            <header className="flex-shrink-0 flex justify-between items-center bg-slate-800 p-3 rounded-lg border-b-2 border-amber-600">
                <h1 className="text-xl font-bold text-amber-400">Map Editor</h1>
                <div className="flex items-center gap-4">
                    {gameState && (
                        <Button variant="secondary" onClick={applyExistingFortifications} title="Apply fortifications from current game state">
                            🏰 Apply Existing Fortifications
                        </Button>
                    )}
                    <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button onClick={() => onSave(editedMap, startLocations)}>Save Changes</Button>
                </div>
            </header>
            <main className="flex-grow flex gap-4 overflow-hidden">
                <TerrainToolbar 
                    activeBrush={activeBrush} 
                    onSelectBrush={setActiveBrush}
                    brushSize={brushSize}
                    onBrushSizeChange={setBrushSize}
                />
                <div className="flex-grow h-full">
                    <MapView 
                        mapData={editedMap}
                        playerTribe={undefined}
                        allTribes={[]}
                        journeys={[]}
                        startingLocations={startLocations}
                        selectionMode={false}
                        onHexSelect={() => {}}
                        paintMode={activeBrush !== null}
                        onHexPaintStart={handlePaintStart}
                        onHexPaint={handleHexPaint}
                        onHexPaintEnd={handlePaintEnd}
                    />
                </div>
                <div className="w-80 flex-shrink-0 flex flex-col gap-4">
                     <Card title="Start Locations" className="flex-shrink-0">
                        <div className='flex justify-between items-center mb-2'>
                            <p className="text-sm text-slate-400">
                               {startLocations.length} / {MAX_START_LOCATIONS} placed
                            </p>
                            <Button 
                                className="text-xs bg-red-800 hover:bg-red-700 py-1 px-2"
                                onClick={() => setShowClearStartsConfirm(true)}
                                disabled={startLocations.length === 0}
                            >
                                Clear All
                            </Button>
                        </div>
                        <ol className="list-decimal list-inside text-mono text-sm space-y-1 max-h-40 overflow-y-auto">
                           {startLocations.map(loc => <li key={loc} className="text-slate-300 bg-slate-800 px-2 py-1 rounded">{loc}</li>)}
                        </ol>
                    </Card>

                    <Card title="Map File Management" className="flex-shrink-0">
                        <div className="space-y-4">
                            <p className="text-sm text-slate-400">Save the current map layout to a file, or load a previously saved map.</p>
                            <Button className="w-full" variant="secondary" onClick={handleSaveMapFile}>
                                Save Map File
                            </Button>
                            <Button className="w-full" variant="secondary" onClick={handleLoadMapClick}>
                                Load Map File
                            </Button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                        </div>
                    </Card>

                    {mapSettings && (
                        <Card title="Generation Settings" className="h-full flex flex-col flex-grow">
                            <p className="text-sm text-slate-400 mb-4 flex-shrink-0">Generate a new base map using these procedural settings.</p>
                            <div className="space-y-3 overflow-y-auto pr-2 flex-grow">
                                {Object.entries(mapSettings.biases).sort(([a], [b]) => a.localeCompare(b)).map(([terrain, bias]) => (
                                    <div key={terrain}>
                                        <label className="flex justify-between items-center text-slate-300 font-medium text-sm">
                                            <span className="capitalize">{terrain}</span>
                                            <span className="text-amber-400 font-mono">{Number(bias).toFixed(2)}</span>
                                        </label>
                                        <input 
                                            type="range" min="0" max="5" step="0.1" value={bias}
                                            onChange={(e) => handleBiasChange(terrain as TerrainType, parseFloat(e.target.value))}
                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                            disabled={terrain === 'Water'}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-700 flex-shrink-0">
                                <Button className="w-full bg-red-800 hover:bg-red-700" onClick={() => setShowGenConfirm(true)}>Generate New Map</Button>
                            </div>
                        </Card>
                    )}
                </div>
            </main>
             {showGenConfirm && (
                <ConfirmationModal
                    title="Generate New Map?"
                    message="This will overwrite all your manual edits and clear all starting locations. This cannot be undone."
                    onConfirm={handleGenerateNewMap}
                    onCancel={() => setShowGenConfirm(false)}
                />
            )}
            {showClearStartsConfirm && (
                <ConfirmationModal
                    title="Clear All Start Locations?"
                    message="This will remove all placed starting points from the map. Are you sure?"
                    onConfirm={handleClearStartLocations}
                    onCancel={() => setShowClearStartsConfirm(false)}
                />
            )}
            {mapFileToLoad && (
                <ConfirmationModal
                    title="Load Map File?"
                    message="This will overwrite all current unsaved edits on the map. Are you sure you want to proceed?"
                    onConfirm={executeLoadMap}
                    onCancel={() => setMapFileToLoad(null)}
                />
            )}
        </div>
    );
};

export default MapEditor;