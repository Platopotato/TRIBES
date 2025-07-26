


import React from 'react';
import { TerrainType, POIType } from '../../types';
import Card from '../ui/Card';
import { POI_SYMBOLS, POI_COLORS } from '../../constants';

type Brush = TerrainType | POIType | 'clear_poi' | 'clear_terrain' | 'set_start_location';
type BrushSize = 'single' | 'cluster';

interface TerrainToolbarProps {
    activeBrush: Brush | null;
    onSelectBrush: (brush: Brush | null) => void;
    brushSize: BrushSize;
    onBrushSizeChange: (size: BrushSize) => void;
}

const BrushButton: React.FC<{
    brush: Brush;
    activeBrush: Brush | null;
    onSelect: (brush: Brush) => void;
    children: React.ReactNode;
    title: string;
}> = ({ brush, activeBrush, onSelect, children, title }) => {
    const isActive = activeBrush === brush;
    return (
        <button
            title={title}
            onClick={() => onSelect(brush)}
            className={`w-full flex items-center p-2 rounded-md transition-colors duration-150
                ${isActive ? 'bg-amber-600 text-white ring-2 ring-amber-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
        >
            {children}
        </button>
    );
};

const TerrainToolbar: React.FC<TerrainToolbarProps> = ({ activeBrush, onSelectBrush, brushSize, onBrushSizeChange }) => {
    
    const handleSelect = (brush: Brush) => {
        onSelectBrush(activeBrush === brush ? null : brush);
    };

    return (
        <Card title="Brushes" className="w-64 flex-shrink-0 flex flex-col">
            <div className='overflow-y-auto space-y-3 pr-2'>
                <p className="text-xs text-slate-400">Select a brush to paint on the map. Click again to disable.</p>
                
                <div>
                    <h4 className="text-sm font-bold text-amber-400 my-2">Brush Size</h4>
                    <div className="flex space-x-2">
                        <button 
                            onClick={() => onBrushSizeChange('single')}
                            className={`flex-1 py-1 px-2 text-sm rounded-md ${brushSize === 'single' ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            Single
                        </button>
                        <button 
                            onClick={() => onBrushSizeChange('cluster')}
                            className={`flex-1 py-1 px-2 text-sm rounded-md ${brushSize === 'cluster' ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            Cluster (7)
                        </button>
                    </div>
                </div>

                 <div>
                    <h4 className="text-sm font-bold text-amber-400 my-2">Tools</h4>
                     <div className="space-y-1">
                        <BrushButton brush="set_start_location" activeBrush={activeBrush} onSelect={handleSelect} title="Set Player Start Location">
                           <div className="w-6 h-6 mr-2 rounded-sm flex items-center justify-center font-bold text-lg bg-green-600">🏳️</div>
                            <span className="font-semibold">Set Start Point</span>
                        </BrushButton>
                        <BrushButton brush="clear_terrain" activeBrush={activeBrush} onSelect={handleSelect} title="Clear Terrain (Paint Water)">
                            <div className="w-6 h-6 mr-2 rounded-sm flex items-center justify-center font-bold text-lg bg-blue-500">💧</div>
                            <span className="font-semibold">Clear Terrain</span>
                        </BrushButton>
                        <BrushButton brush="clear_poi" activeBrush={activeBrush} onSelect={handleSelect} title="Clear POI">
                           <div className="w-6 h-6 mr-2 rounded-sm flex items-center justify-center font-bold text-lg bg-red-600">⌫</div>
                            <span className="font-semibold">Clear POI</span>
                        </BrushButton>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-amber-400 my-2">Terrain</h4>
                    <div className="space-y-1">
                        {Object.values(TerrainType).map(terrain => (
                            <BrushButton key={terrain} brush={terrain} activeBrush={activeBrush} onSelect={handleSelect} title={terrain}>
                                <div className="w-6 h-6 mr-2 rounded-sm" style={{ background: `url(#texture-${terrain})`, backgroundSize: 'cover' }}></div>
                                <span className="font-semibold">{terrain}</span>
                            </BrushButton>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-amber-400 my-2">Points of Interest</h4>
                     <div className="space-y-1">
                        {Object.values(POIType).map(poi => (
                            <BrushButton key={poi} brush={poi} activeBrush={activeBrush} onSelect={handleSelect} title={poi}>
                                <div className={`w-6 h-6 mr-2 rounded-sm flex items-center justify-center font-bold text-sm ${POI_COLORS[poi].bg.replace('fill-','bg-')} ${POI_COLORS[poi].text}`}>
                                    {POI_SYMBOLS[poi]}
                                </div>
                                <span className="font-semibold text-xs">{poi}</span>
                            </BrushButton>
                        ))}
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default TerrainToolbar;