import React, { useState, useMemo } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { Tribe, ChiefRequest, AssetRequest, TerrainType, POIType, Chief, Technology, GameAsset, TechnologyEffectType } from '@radix-tribes/shared';
import { TERRAIN_DESCRIPTIONS, POI_DESCRIPTIONS, ASSET_DESCRIPTIONS } from '@radix-tribes/shared';
import { POI_SYMBOLS, POI_COLORS } from '@radix-tribes/shared';
import { ALL_CHIEFS } from '@radix-tribes/shared';
import { ALL_ASSETS } from '@radix-tribes/shared';
import { ALL_TECHS } from '@radix-tribes/shared';

interface CodexModalProps {
  onClose: () => void;
  allTribes: Tribe[];
  allChiefRequests: ChiefRequest[];
  allAssetRequests: AssetRequest[];
}

type CodexCategory = 'terrain' | 'poi' | 'chiefs' | 'assets' | 'tech';

const CategoryButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; icon: string }> = ({ label, isActive, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center p-2 rounded-t-lg transition-colors duration-200 focus:outline-none ${
      isActive ? 'bg-neutral-800 text-amber-400 border-b-2 border-amber-400' : 'bg-neutral-900 text-slate-400 hover:bg-neutral-800'
    }`}
  >
    <span className="text-2xl">{icon}</span>
    <span className="text-xs font-bold">{label}</span>
  </button>
);

const CodexModal: React.FC<CodexModalProps> = ({ onClose, allTribes, allChiefRequests, allAssetRequests }) => {
  const [activeCategory, setActiveCategory] = useState<CodexCategory>('terrain');
  const [selectedItem, setSelectedItem] = useState<string | null>(Object.keys(TERRAIN_DESCRIPTIONS)[0]);

  const chiefStatusMap = useMemo(() => {
    const statusMap = new Map<string, { status: string; owner?: string }>();
    allTribes.forEach(tribe => {
      if (!tribe.garrisons) return;
      Object.values(tribe.garrisons).forEach(garrison => {
        (garrison.chiefs || []).forEach(chief => {
          statusMap.set(chief.name, { status: 'Owned', owner: tribe.playerName });
        });
      });
    });
    (allChiefRequests || []).forEach(req => {
      if (req.status === 'pending') {
        const tribe = allTribes.find(t => t.id === req.tribeId);
        statusMap.set(req.chiefName, { status: 'Pending', owner: tribe?.playerName });
      }
    });
    return statusMap;
  }, [allTribes, allChiefRequests]);
  
  const assetStatusMap = useMemo(() => {
    const statusMap = new Map<string, { status: string; owner?: string }>();
    allTribes.forEach(tribe => {
      (tribe.assets || []).forEach(assetName => {
        statusMap.set(assetName, { status: 'Owned', owner: tribe.playerName });
      });
    });
    (allAssetRequests || []).forEach(req => {
      if (req.status === 'pending') {
        const tribe = allTribes.find(t => t.id === req.tribeId);
        statusMap.set(req.assetName, { status: 'Pending', owner: tribe?.playerName });
      }
    });
    return statusMap;
  }, [allTribes, allAssetRequests]);

  const handleSelectCategory = (category: CodexCategory) => {
    setActiveCategory(category);
    // Auto-select the first item in the new category
    switch (category) {
        case 'terrain': setSelectedItem(Object.keys(TERRAIN_DESCRIPTIONS)[0]); break;
        case 'poi': setSelectedItem(Object.keys(POI_DESCRIPTIONS)[0]); break;
        case 'chiefs': setSelectedItem(ALL_CHIEFS[0]?.name || null); break;
        case 'assets': setSelectedItem(ALL_ASSETS[0]?.name || null); break;
        case 'tech': setSelectedItem(ALL_TECHS[0]?.id || null); break;
        default: setSelectedItem(null);
    }
  };

  const renderSidebarList = () => {
    const listItems: { id: string; content: React.ReactNode }[] = [];
    switch (activeCategory) {
      case 'terrain':
        Object.entries(TERRAIN_DESCRIPTIONS).forEach(([key, value]) => {
          listItems.push({
            id: key,
            content: (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 mr-2 rounded-sm flex-shrink-0" style={{ background: `url(#texture-${key})`, backgroundSize: 'cover' }}></div>
                <span className="font-semibold">{key}</span>
              </div>
            ),
          });
        });
        break;
      case 'poi':
        Object.entries(POI_DESCRIPTIONS).forEach(([key]) => {
            const poiType = key as POIType;
          listItems.push({
            id: key,
            content: (
              <div className="flex items-center space-x-3">
                 <div className={`w-8 h-8 mr-2 rounded-sm flex items-center justify-center font-bold text-lg flex-shrink-0 ${POI_COLORS[poiType].bg.replace('fill-','bg-')} ${POI_COLORS[poiType].text}`}>
                    {POI_SYMBOLS[poiType]}
                </div>
                <span className="font-semibold">{key}</span>
              </div>
            ),
          });
        });
        break;
      case 'chiefs':
        ALL_CHIEFS.forEach(chief => {
          listItems.push({
            id: chief.name,
            content: (
              <div className="flex items-center space-x-3">
                <img src={chief.key_image_url} alt={chief.name} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                <span className="font-semibold">{chief.name}</span>
              </div>
            ),
          });
        });
        break;
    case 'assets':
        ALL_ASSETS.forEach(asset => {
          listItems.push({
            id: asset.name,
            content: (
              <div className="flex items-center space-x-3">
                <img src={asset.key_image_url} alt={asset.name} className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-slate-700" />
                <span className="font-semibold">{asset.name}</span>
              </div>
            ),
          });
        });
        break;
      case 'tech':
        ALL_TECHS.forEach(tech => {
          listItems.push({
            id: tech.id,
            content: (
              <div className="flex items-center space-x-3">
                <span className="text-2xl w-8 text-center">{tech.icon}</span>
                <span className="font-semibold">{tech.name}</span>
              </div>
            ),
          });
        });
        break;
    }
    
    return listItems.map(item => (
        <button key={item.id} onClick={() => setSelectedItem(item.id)} className={`w-full text-left p-2 rounded-md transition-colors duration-150 ${selectedItem === item.id ? 'bg-amber-800/50 text-white' : 'hover:bg-slate-700/50 text-slate-300'}`}>
            {item.content}
        </button>
    ));
  };
  
  const renderDetails = () => {
    if (!selectedItem) {
        return <div className="p-8 text-center text-slate-400">Select an item from the list to see details.</div>;
    }

    let content = null;
    switch (activeCategory) {
        case 'terrain':
            const terrainData = TERRAIN_DESCRIPTIONS[selectedItem as TerrainType];
            content = (
                <div className="p-6">
                    <h3 className="text-3xl font-bold text-amber-400 mb-4">{selectedItem}</h3>
                    <div className="w-full h-24 rounded-lg mb-4" style={{ background: `url(#texture-${selectedItem})`, backgroundSize: 'cover' }}></div>
                    <p className="text-slate-300 mb-4">{terrainData.description}</p>
                    <h4 className="font-bold text-slate-200 mt-4">Gameplay Modifiers:</h4>
                    <p className="text-slate-400">{terrainData.modifiers}</p>
                </div>
            );
            break;
        case 'poi':
            const poiType = selectedItem as POIType;
            content = (
                 <div className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center font-bold text-4xl flex-shrink-0 ${POI_COLORS[poiType].bg.replace('fill-','bg-')} ${POI_COLORS[poiType].text}`}>
                            {POI_SYMBOLS[poiType]}
                        </div>
                        <h3 className="text-3xl font-bold text-amber-400">{selectedItem}</h3>
                    </div>
                    <p className="text-slate-300">{POI_DESCRIPTIONS[poiType]}</p>
                </div>
            );
            break;
        case 'chiefs':
            const chief = ALL_CHIEFS.find(c => c.name === selectedItem);
            if (!chief) return null;
            const chiefStatus = chiefStatusMap.get(chief.name);
            content = (
                 <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center space-x-6 mb-4">
                        <img src={chief.key_image_url} alt={chief.name} className="w-32 h-32 rounded-lg object-cover flex-shrink-0 border-2 border-slate-600" />
                        <div>
                            <h3 className="text-3xl font-bold text-amber-400">{chief.name}</h3>
                            <p className="text-slate-400 italic mt-2">"{chief.description}"</p>
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4 text-center py-4 border-y border-slate-700">
                        {Object.entries(chief.stats).map(([key, value]) => (
                            <div key={key}>
                                <div className="text-sm uppercase text-slate-400 tracking-wider">{key}</div>
                                <div className="text-2xl font-bold text-white">{value}</div>
                            </div>
                        ))}
                     </div>
                     <div className="mt-auto pt-4 text-center">
                        <h4 className="text-sm uppercase text-slate-400 tracking-wider">Status</h4>
                        {chiefStatus ? (
                             <p className={`text-xl font-bold ${chiefStatus.status === 'Owned' ? 'text-red-500' : 'text-yellow-500'}`}>
                                {chiefStatus.status === 'Owned' ? `Owned by ${chiefStatus.owner}` : `Pending for ${chiefStatus.owner}`}
                            </p>
                        ) : (
                            <p className="text-xl font-bold text-green-500">Available</p>
                        )}
                    </div>
                </div>
            );
            break;
        case 'assets':
            const asset = ALL_ASSETS.find(a => a.name === selectedItem);
            if (!asset) return null;
            const assetStatus = assetStatusMap.get(asset.name);
            content = (
                 <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center space-x-6 mb-4">
                        <img src={asset.key_image_url} alt={asset.name} className="w-32 h-32 rounded-lg object-cover flex-shrink-0 border-2 border-slate-600 bg-slate-700" />
                        <div>
                            <h3 className="text-3xl font-bold text-amber-400">{asset.name}</h3>
                            <p className="text-slate-400 italic mt-2">"{asset.description}"</p>
                        </div>
                    </div>
                     <div className="py-4 border-y border-slate-700">
                        <h4 className="font-bold text-slate-200 mb-2">Effects:</h4>
                        <ul className="list-disc list-inside text-slate-300 space-y-1">
                            {asset.effects.map((e, i) => {
                                let effectStr = ``;
                                const bonusValue = e.value * 100;
                                effectStr += `${bonusValue > 0 ? '+' : ''}${e.value.toFixed(2).replace('0.','.')} `;
                                if(e.type === TechnologyEffectType.MovementSpeedBonus) effectStr += 'Movement Speed';
                                else {
                                    effectStr += e.type.replace(/_/g, ' ').replace('BONUS','').toLowerCase()
                                }

                                if (e.resource) effectStr += ` to ${e.resource}`;
                                if (e.terrain) effectStr += ` in ${e.terrain}`;
                                return <li key={i} className="capitalize">{effectStr}</li>
                            })}
                        </ul>
                     </div>
                     <div className="mt-auto pt-4 text-center">
                        <h4 className="text-sm uppercase text-slate-400 tracking-wider">Status</h4>
                        {assetStatus ? (
                             <p className={`text-xl font-bold ${assetStatus.status === 'Owned' ? 'text-red-500' : 'text-yellow-500'}`}>
                                {assetStatus.status === 'Owned' ? `Owned by ${assetStatus.owner}` : `Pending for ${assetStatus.owner}`}
                            </p>
                        ) : (
                            <p className="text-xl font-bold text-green-500">Available</p>
                        )}
                    </div>
                </div>
            );
            break;
        case 'tech':
            const tech = ALL_TECHS.find(t => t.id === selectedItem);
            if (!tech) return null;
             content = (
                <div className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                        <span className="text-6xl">{tech.icon}</span>
                        <h3 className="text-3xl font-bold text-amber-400">{tech.name}</h3>
                    </div>
                    <p className="text-slate-300 mb-4">{tech.description}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm py-4 border-y border-slate-700">
                        <div><span className="font-semibold text-slate-300 block">Scrap Cost</span><span className="text-white">{tech.cost.scrap} ⚙️</span></div>
                        <div><span className="font-semibold text-slate-300 block">Min. Troops</span><span className="text-white">{tech.requiredTroops} 👥</span></div>
                        <div><span className="font-semibold text-slate-300 block">Total Points</span><span className="text-white">{tech.researchPoints} pts</span></div>
                    </div>
                    {tech.prerequisites.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-bold text-slate-200">Prerequisites:</h4>
                            <ul className="list-disc list-inside text-slate-400">
                                {tech.prerequisites.map(p => <li key={p}>{ALL_TECHS.find(t => t.id === p)?.name || p}</li>)}
                            </ul>
                        </div>
                    )}
                     <div className="mt-4">
                        <h4 className="font-bold text-slate-200">Effects:</h4>
                        <ul className="list-disc list-inside text-slate-400">
                           {tech.effects.map((e, i) => <li key={i}>{e.type.replace(/_/g, ' ').toLowerCase()}: +{e.value}{e.type.includes('BONUS') ? '%' : ''} {e.resource || ''}</li>)}
                           {tech.effects.length === 0 && <li>Special effect (see description)</li>}
                        </ul>
                    </div>
                </div>
            );
            break;
    }

    return <Card className="h-full bg-neutral-800/50" key={selectedItem}>{content}</Card>;
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex-shrink-0 flex justify-between items-center px-4 border-b-2 border-slate-700">
          <h2 className="text-2xl font-bold text-amber-500">Wasteland Codex</h2>
          <Button onClick={onClose} variant="secondary" className="bg-transparent hover:bg-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </header>
        <div className="flex flex-grow overflow-hidden">
          <aside className="w-72 flex-shrink-0 bg-neutral-900/80 flex flex-col border-r border-slate-700">
            <div className="p-2 flex-shrink-0">
                <div className="flex bg-neutral-900 rounded-lg">
                    <CategoryButton label="Terrain" icon="🏞️" isActive={activeCategory === 'terrain'} onClick={() => handleSelectCategory('terrain')} />
                    <CategoryButton label="POIs" icon="📍" isActive={activeCategory === 'poi'} onClick={() => handleSelectCategory('poi')} />
                    <CategoryButton label="Chiefs" icon="👤" isActive={activeCategory === 'chiefs'} onClick={() => handleSelectCategory('chiefs')} />
                    <CategoryButton label="Assets" icon="⚙️" isActive={activeCategory === 'assets'} onClick={() => handleSelectCategory('assets')} />
                    <CategoryButton label="Tech" icon="🔬" isActive={activeCategory === 'tech'} onClick={() => handleSelectCategory('tech')} />
                </div>
            </div>
            <div className="flex-grow overflow-y-auto p-2 space-y-1">
              {renderSidebarList()}
            </div>
          </aside>
          <main className="flex-grow p-4 bg-slate-800/30 overflow-y-auto">
            {renderDetails()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default CodexModal;
