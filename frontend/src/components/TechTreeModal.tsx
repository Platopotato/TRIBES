import React, { useState, useMemo } from 'react';
import { Tribe, Garrison, Technology } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { TECHNOLOGY_TREE, getTechnology } from '@radix-tribes/shared';

interface TechTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tribe: Tribe;
  availableGarrisons: Record<string, Garrison>;
  onStartResearch: (techId: string, location: string, assignedTroops: number) => void;
  isDesktopWindow?: boolean;
}

const TechNode: React.FC<{
  tech: Technology;
  status: 'completed' | 'available' | 'locked' | 'researching';
  onClick: () => void;
  mobile?: boolean;
}> = ({ tech, status, onClick, mobile = false }) => {
  const baseClasses = mobile
    ? "p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center space-x-3 w-full mobile-touch-target touch-feedback haptic-light"
    : "p-3 rounded-lg border-2 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center aspect-video w-40";

  const statusClasses = {
    completed: 'bg-green-800/50 border-green-500 text-slate-300',
    available: 'bg-slate-700 border-amber-500 hover:bg-slate-600 hover:border-amber-400 text-slate-200',
    locked: 'bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed opacity-60',
    researching: 'bg-blue-800/50 border-blue-500 text-slate-300 cursor-not-allowed',
  };

  if (mobile) {
    return (
      <div className={`${baseClasses} ${statusClasses[status]}`} onClick={status === 'available' ? onClick : undefined}>
        <div className="text-xl flex-shrink-0">{tech.icon}</div>
        <div className="flex-grow min-w-0">
          <div className="font-bold text-sm truncate">{tech.name}</div>
          <div className="text-xs text-slate-400 mt-1">
            {tech.cost.scrap}🔧 • {tech.requiredTroops}👥
          </div>
          <div className="flex items-center justify-between mt-1">
            {status === 'completed' && <div className="text-xs text-green-400">✅ Done</div>}
            {status === 'locked' && <div className="text-xs text-red-400">🔒 Locked</div>}
            {status === 'researching' && <div className="text-xs text-blue-400">🔬 Active</div>}
            {status === 'available' && <div className="text-xs text-amber-400">⚡ Ready</div>}
            {tech.prerequisites.length > 0 && (
              <div className="text-xs text-slate-500">
                Req: {tech.prerequisites.length}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} ${statusClasses[status]}`} onClick={status === 'available' ? onClick : undefined}>
      <div className="text-4xl mb-2">{tech.icon}</div>
      <div className="font-bold text-sm">{tech.name}</div>
      {status === 'completed' && <div className="text-xs text-green-400 mt-1">(Completed)</div>}
      {status === 'researching' && <div className="text-xs text-blue-400 mt-1">(Researching)</div>}
    </div>
  );
};

const TechTreeModal: React.FC<TechTreeModalProps> = ({ isOpen, onClose, tribe, availableGarrisons, onStartResearch, isDesktopWindow = false }) => {
  if (!isOpen) return null;

  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [assignedTroops, setAssignedTroops] = useState(0);
  const [location, setLocation] = useState(Object.keys(availableGarrisons)[0] || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const completedSet = useMemo(() => new Set(tribe.completedTechs), [tribe.completedTechs]);
  const researchingSet = useMemo(() => new Set(tribe.currentResearch?.map(p => p.techId) || []), [tribe.currentResearch]);

  const getStatus = (tech: Technology): 'completed' | 'available' | 'locked' | 'researching' => {
    if (completedSet.has(tech.id)) return 'completed';
    if (researchingSet.has(tech.id)) return 'researching';
    if (tech.prerequisites.every(p => completedSet.has(p))) return 'available';
    return 'locked';
  };

  const selectedTech = selectedTechId ? getTechnology(selectedTechId) : null;
  const garrison = location ? availableGarrisons[location] : null;

  const handleSelectTech = (techId: string) => {
    setSelectedTechId(techId);
    const tech = getTechnology(techId);
    if(tech) {
      setAssignedTroops(tech.requiredTroops);
    }
  }

  // Filter technologies based on search and category
  const filteredTechTree = useMemo(() => {
    const filtered: { [key: string]: Technology[] } = {};

    Object.entries(TECHNOLOGY_TREE).forEach(([category, techs]) => {
      // Filter by selected category
      if (selectedCategory && category !== selectedCategory) {
        return;
      }

      // Filter by search term
      const filteredTechs = techs.filter(tech =>
        searchTerm === '' ||
        tech.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tech.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (filteredTechs.length > 0) {
        filtered[category] = filteredTechs;
      }
    });

    return filtered;
  }, [selectedCategory, searchTerm]);

  const categories = Object.keys(TECHNOLOGY_TREE);

  const handleStart = () => {
    if (!selectedTechId || !location || !garrison || !selectedTech || assignedTroops < selectedTech.requiredTroops || tribe.globalResources.scrap < selectedTech.cost.scrap) return;
    onStartResearch(selectedTechId, location, assignedTroops);
    setSelectedTechId(null);
  };
  
  const turnsToComplete = useMemo(() => {
    if (selectedTech && assignedTroops > 0) {
      return Math.ceil(selectedTech.researchPoints / assignedTroops);
    }
    return 'N/A';
  }, [selectedTech, assignedTroops]);

  const renderSidebar = () => {
      if (!selectedTech) {
          return (
              <div className="text-center p-8">
                  <h3 className="text-xl font-bold text-amber-400">Technology Tree</h3>
                  <p className="text-slate-400 mt-2">Select an available technology to view its details and begin research.</p>
              </div>
          );
      }
      
      const hasEnoughScrap = tribe.globalResources.scrap >= selectedTech.cost.scrap;
      const meetsTroopRequirement = garrison && assignedTroops >= selectedTech.requiredTroops && garrison.troops >= assignedTroops;
      const isAlreadyResearching = getStatus(selectedTech) === 'researching';

      return (
          <div className="p-6 flex flex-col h-full">
            <h3 className="text-2xl font-bold text-amber-400">{selectedTech.icon} {selectedTech.name}</h3>
            <p className="text-slate-400 mt-2 flex-grow">{selectedTech.description}</p>
            
            <div className="space-y-4 pt-4 border-t border-slate-700">
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><span className="font-semibold text-slate-300 block">Scrap Cost</span><span className={hasEnoughScrap ? 'text-white' : 'text-red-500'}>{selectedTech.cost.scrap} ⚙️</span></div>
                    <div><span className="font-semibold text-slate-300 block">Min. Troops</span><span className="text-white">{selectedTech.requiredTroops} 👥</span></div>
                    <div><span className="font-semibold text-slate-300 block">Total Points</span><span className="text-white">{selectedTech.researchPoints} pts</span></div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">Assign Troops From</label>
                    <select value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200">
                      {Object.keys(availableGarrisons).length > 0 ? Object.keys(availableGarrisons).map(loc => (
                          <option key={loc} value={loc}>{`Hex ${loc} (Available: ${availableGarrisons[loc].troops})`}</option>
                      )) : <option>No garrisons available</option>}
                    </select>
                </div>

                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-slate-300">Troops to Assign ({assignedTroops})</label>
                      <div className="text-sm">
                        <span className="text-amber-400 font-semibold">⏱️ {turnsToComplete} Turns</span>
                        <span className="text-slate-400 ml-2">({Math.round(selectedTech.researchPoints / Math.max(assignedTroops, 1))} pts/turn)</span>
                      </div>
                    </div>
                    <input type="range" min="0" max={garrison?.troops || 0} value={assignedTroops} onChange={e => setAssignedTroops(parseInt(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                 </div>

                <Button
                    className="w-full"
                    onClick={handleStart}
                    disabled={!meetsTroopRequirement || !hasEnoughScrap || isAlreadyResearching}
                >
                    {isAlreadyResearching ? 'Already Researching This Technology' :
                     !hasEnoughScrap ? `Need ${selectedTech.cost.scrap - tribe.globalResources.scrap} more scrap` :
                     !garrison || garrison.troops < assignedTroops ? `Not enough troops in garrison` :
                     assignedTroops < selectedTech.requiredTroops ? `Need at least ${selectedTech.requiredTroops} troops` :
                     'Start Research Project'}
                </Button>
            </div>
          </div>
      );
  }

  // Check if mobile device
  const isMobileDevice = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);

  // Desktop window mode - render content only without modal wrapper
  if (isDesktopWindow) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Compact tech tree for desktop window */}
        <div className="flex-1 p-3 overflow-auto">
          {/* Compact filters for desktop window */}
          <div className="mb-4 space-y-2">
            <input
              type="text"
              placeholder="Search technologies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-2 py-1 rounded text-xs ${
                  selectedCategory === null ? 'bg-amber-500 text-black' : 'bg-slate-600 text-slate-300'
                }`}
              >
                All
              </button>
              {categories.slice(0, 6).map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-2 py-1 rounded text-xs ${
                    selectedCategory === category ? 'bg-amber-500 text-black' : 'bg-slate-600 text-slate-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(filteredTechTree).map(([category, techs]) => (
              <div key={category} className="bg-slate-700/30 p-3 rounded">
                <h4 className="text-sm font-bold text-purple-400 mb-2">{category} ({techs.length})</h4>
                <div className="grid grid-cols-2 gap-2">
                  {techs.map(tech => (
                    <TechNode
                      key={tech.id}
                      tech={tech}
                      status={getStatus(tech)}
                      onClick={() => setSelectedTechId(tech.id)}
                      mobile={true}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Research details for desktop */}
        {selectedTechId && (
          <div className="border-t border-slate-600 p-3 bg-slate-700/20">
            {renderSidebar()}
          </div>
        )}
      </div>
    );
  }

  // Mobile/fullscreen modal mode
  return (
    <div className="fixed z-20"
         style={{
           top: isMobileDevice ? '8rem' : '0',
           left: '0',
           right: '0',
           bottom: '0',
           backgroundColor: isMobileDevice ? 'transparent' : 'rgba(0,0,0,0.7)',
           backdropFilter: isMobileDevice ? 'none' : 'blur(4px)',
           pointerEvents: isMobileDevice ? 'none' : 'auto'
         }}>
      <div className="w-full h-full flex items-center justify-center p-2 md:p-4"
           onClick={isMobileDevice ? undefined : onClose}
           style={{ pointerEvents: 'auto' }}>
        <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg w-full max-w-7xl h-full md:h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header - Desktop only */}
        <div className="flex-shrink-0 flex justify-between items-center px-4 py-3 border-b border-neutral-700 hidden md:flex bg-slate-800">
          <h2 className="text-xl font-bold text-purple-400">🔬 Technology Research</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mobile Layout: Stacked */}
        {isMobileDevice ? (
          <>
            {/* Mobile Header with Close */}
            <div className="flex-shrink-0 flex justify-between items-center p-3 border-b border-neutral-700 bg-neutral-900">
              <h2 className="text-lg font-bold text-purple-400">🔬 Technology Research</h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mobile Tech Tree with Filters */}
            <div className="flex-grow flex flex-col overflow-hidden bg-slate-800/50">
              {/* Mobile Filters */}
              <div className="p-3 border-b border-slate-600 space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search technologies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCategory === null
                        ? 'bg-amber-500 text-black'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }`}
                  >
                    All
                  </button>
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedCategory === category
                          ? 'bg-amber-500 text-black'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtered Tech List */}
              <div className="flex-grow p-3 overflow-auto">
                <div className="space-y-6">
                  {Object.entries(filteredTechTree).map(([category, techs]) => (
                    <div key={category} className="space-y-3">
                      <h3 className="text-center font-bold text-lg text-amber-500 tracking-wider uppercase border-b border-amber-500/30 pb-2">
                        {category} ({techs.length})
                      </h3>
                      <div className="space-y-3">
                        {techs.map((tech) => (
                          <TechNode
                            key={tech.id}
                            tech={tech}
                            status={getStatus(tech)}
                            onClick={() => handleSelectTech(tech.id)}
                            mobile={true}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {Object.keys(filteredTechTree).length === 0 && (
                    <div className="text-center text-slate-400 py-8">
                      <div className="text-4xl mb-2">🔍</div>
                      <p>No technologies found</p>
                      <p className="text-sm">Try adjusting your search or category filter</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Research Panel - Centered Modal */}
            {selectedTech && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center p-4 border-b border-neutral-700">
                    <h3 className="text-lg font-bold text-purple-400">Research Details</h3>
                    <button
                      onClick={() => setSelectedTechId(null)}
                      className="p-2 hover:bg-slate-700 rounded text-slate-400"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-4">
                    {renderSidebar()}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Desktop Layout: Full Width Tech Tree with Bottom Details */
          <div className="flex flex-col h-full">
            {/* Tech Tree - Full Width */}
            <div className="flex-grow p-6 overflow-auto bg-slate-800/30">
              {/* Desktop Filters */}
              <div className="mb-6 max-w-6xl mx-auto">
                <div className="flex flex-wrap gap-4 items-center justify-center">
                  <input
                    type="text"
                    placeholder="Search technologies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategory === null ? 'bg-amber-500 text-black' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map(category => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedCategory === category ? 'bg-amber-500 text-black' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-center items-start gap-12 max-w-6xl mx-auto">
                {Object.entries(filteredTechTree).map(([category, techs]) => (
                  <div key={category} className="space-y-8 relative flex-1 max-w-xs">
                    <h3 className="text-center font-bold text-xl text-amber-500 tracking-wider uppercase">
                      {category} ({techs.length})
                    </h3>
                    {techs.map((tech, index) => (
                      <React.Fragment key={tech.id}>
                        {index > 0 && <div className="absolute left-1/2 -translate-x-1/2 h-8 border-l-2 border-dashed border-slate-600" style={{ top: `${index * 11.5 - 2}rem`}}></div>}
                        <TechNode tech={tech} status={getStatus(tech)} onClick={() => handleSelectTech(tech.id)} />
                      </React.Fragment>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Research Details - Bottom Panel (only when tech selected) */}
            {selectedTech && (
              <div className="flex-shrink-0 bg-neutral-900 border-t border-neutral-700 max-h-64 overflow-y-auto">
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold text-purple-400">Research Details</h3>
                    <button
                      onClick={() => setSelectedTechId(null)}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {renderSidebar()}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default TechTreeModal;