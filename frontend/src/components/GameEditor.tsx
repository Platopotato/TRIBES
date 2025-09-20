import React, { useState, useMemo } from 'react';
import { GameState, User, Tribe, GlobalResources, Garrison, Chief, ALL_CHIEFS, getAsset, ALL_ASSETS, ResearchProject, ALL_TECHS, Journey, JourneyType } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import ConfirmationModal from './ui/ConfirmationModal';
import * as client from '../lib/client';

interface GameEditorProps {
  gameState: GameState;
  users: User[];
  onBack: () => void;
  onUpdateTribe: (tribe: Tribe) => void;
  onRemovePlayer: (userId: string) => void;
  onRemoveJourney?: (journeyId: string) => void;
}

// Helper function to extract fortified POI garrisons from a tribe
const extractFortifiedPOIGarrisons = (tribe: Tribe, gameState: GameState): Record<string, Garrison> => {
  const fortifiedPOIGarrisons: Record<string, Garrison> = {};

  console.log(`🔍 Extracting fortified POIs for tribe: ${tribe.tribeName} (${tribe.id})`);
  console.log(`🗺️ Total map hexes: ${gameState.mapData.length}`);

  // Count POIs for debugging
  let totalPOIs = 0;
  let fortifiedPOIs = 0;
  let ownedFortifiedPOIs = 0;

  // Find all fortified POIs owned by this tribe
  gameState.mapData.forEach(hex => {
    if (hex.poi) {
      totalPOIs++;
      if (hex.poi.fortified) {
        fortifiedPOIs++;
        console.log(`🏰 Found fortified POI: ${hex.poi.type} at (${hex.q}, ${hex.r}) owned by ${hex.poi.outpostOwner}`);

        if (hex.poi.outpostOwner === tribe.id) {
          ownedFortifiedPOIs++;
          const hexCoord = `${String(hex.q).padStart(3, '0')}.${String(hex.r).padStart(3, '0')}`;
          console.log(`✅ Tribe owns fortified POI at ${hexCoord}`);

          // Check if tribe has a garrison at this location
          if (tribe.garrisons[hexCoord]) {
            fortifiedPOIGarrisons[hexCoord] = { ...tribe.garrisons[hexCoord] };
            console.log(`🏕️ Found garrison at fortified POI: ${JSON.stringify(tribe.garrisons[hexCoord])}`);
          } else {
            console.log(`⚠️ No garrison found at fortified POI ${hexCoord}`);
            // Create empty garrison for editing
            fortifiedPOIGarrisons[hexCoord] = { troops: 0, weapons: 0, chiefs: [] };
          }
        }
      }
    }
  });

  console.log(`📊 POI Summary: ${totalPOIs} total, ${fortifiedPOIs} fortified, ${ownedFortifiedPOIs} owned by tribe`);
  console.log(`🏰 Fortified POI garrisons found: ${Object.keys(fortifiedPOIGarrisons).length}`);

  return fortifiedPOIGarrisons;
};

// Helper function to get POI info for a location
const getPOIInfo = (location: string, gameState: GameState) => {
  const [qStr, rStr] = location.split('.');
  const q = parseInt(qStr);
  const r = parseInt(rStr);

  const hex = gameState.mapData.find(h => h.q === q && h.r === r);
  return hex?.poi || null;
};

const GameEditor: React.FC<GameEditorProps> = ({ gameState, users, onBack, onUpdateTribe, onRemovePlayer, onRemoveJourney }) => {
  const [selectedTribe, setSelectedTribe] = useState<Tribe | null>(null);
  const [editingResources, setEditingResources] = useState<GlobalResources | null>(null);
  const [editingGarrisons, setEditingGarrisons] = useState<Record<string, Garrison> | null>(null);
  const [editingFortifiedPOIs, setEditingFortifiedPOIs] = useState<Record<string, Garrison> | null>(null);
  const [editingResearch, setEditingResearch] = useState<ResearchProject[]>([]);
  const [editingCompletedTechs, setEditingCompletedTechs] = useState<string[]>([]);
  const [editingMaxActions, setEditingMaxActions] = useState<number | undefined>(undefined);
  const [playerToEject, setPlayerToEject] = useState<{ userId: string; username: string } | null>(null);
  const [journeyToRemove, setJourneyToRemove] = useState<Journey | null>(null);
  const [showJourneyManager, setShowJourneyManager] = useState(false);
  const [garrisonToDelete, setGarrisonToDelete] = useState<{ location: string; tribeName: string } | null>(null);
  const [isFixingCoordinates, setIsFixingCoordinates] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const playerTribes = useMemo(() => {
    return gameState.tribes.filter(tribe => !tribe.isAI);
  }, [gameState.tribes]);

  const handleSelectTribe = (tribe: Tribe) => {
    setSelectedTribe(tribe);
    setEditingResources({ ...tribe.globalResources });
    setEditingGarrisons({ ...tribe.garrisons });
    setEditingResearch(tribe.currentResearch ? [...tribe.currentResearch] : []);
    setEditingCompletedTechs([...tribe.completedTechs]);
    setEditingMaxActions(tribe.maxActionsOverride);

    // Extract fortified POI garrisons
    const fortifiedPOIGarrisons = extractFortifiedPOIGarrisons(tribe, gameState);
    setEditingFortifiedPOIs(fortifiedPOIGarrisons);
  };

  const handleResourceChange = (resource: keyof GlobalResources, value: number) => {
    if (!editingResources) return;
    setEditingResources({
      ...editingResources,
      [resource]: Math.max(0, value)
    });
  };

  const handleGarrisonChange = (location: string, field: 'troops' | 'weapons', value: number) => {
    if (!editingGarrisons) return;
    setEditingGarrisons({
      ...editingGarrisons,
      [location]: {
        ...editingGarrisons[location],
        [field]: Math.max(0, value)
      }
    });
  };

  const handleFortifiedPOIChange = (location: string, field: 'troops' | 'weapons', value: number) => {
    if (!editingFortifiedPOIs) return;
    setEditingFortifiedPOIs({
      ...editingFortifiedPOIs,
      [location]: {
        ...editingFortifiedPOIs[location],
        [field]: Math.max(0, value)
      }
    });
  };

  const handleAddChief = (location: string, chiefName: string) => {
    if (!editingGarrisons || !selectedTribe) return;
    const chief = ALL_CHIEFS.find(c => c.name === chiefName);
    if (!chief) {
      console.error(`❌ Chief ${chiefName} not found in ALL_CHIEFS`);
      return;
    }

    const currentChiefs = editingGarrisons[location]?.chiefs || [];
    if (currentChiefs.some(c => c.name === chiefName)) {
      console.warn(`⚠️ Chief ${chiefName} already exists at ${location}`);
      return; // Already has this chief
    }

    console.log(`➕ Adding chief ${chiefName} to ${location}`);
    console.log('Before addition:', currentChiefs.map(c => c.name));

    setEditingGarrisons({
      ...editingGarrisons,
      [location]: {
        ...editingGarrisons[location],
        chiefs: [...currentChiefs, chief]
      }
    });
  };

  const handleAddChiefToPOI = (location: string, chiefName: string) => {
    if (!editingFortifiedPOIs || !selectedTribe) return;
    const chief = ALL_CHIEFS.find(c => c.name === chiefName);
    if (!chief) {
      console.error(`❌ Chief ${chiefName} not found in ALL_CHIEFS`);
      return;
    }

    const currentChiefs = editingFortifiedPOIs[location]?.chiefs || [];
    if (currentChiefs.some(c => c.name === chiefName)) {
      console.warn(`⚠️ Chief ${chiefName} already exists at fortified POI ${location}`);
      return; // Already has this chief
    }

    console.log(`➕ Adding chief ${chiefName} to fortified POI ${location}`);
    console.log('Before addition:', currentChiefs.map(c => c.name));

    setEditingFortifiedPOIs({
      ...editingFortifiedPOIs,
      [location]: {
        ...editingFortifiedPOIs[location],
        chiefs: [...currentChiefs, chief]
      }
    });
  };

  const handleRemoveChief = (location: string, chiefIndex: number) => {
    if (!editingGarrisons || !editingGarrisons[location]) return;

    const currentChiefs = editingGarrisons[location].chiefs || [];
    console.log(`🗑️ Removing chief at index ${chiefIndex} from ${location}`);
    console.log('Before removal:', currentChiefs.map((c, i) => `${i}: ${c.name}`));

    // Remove specific chief by index to handle duplicates properly
    const filteredChiefs = currentChiefs.filter((_, index) => index !== chiefIndex);

    console.log('After removal:', filteredChiefs.map((c, i) => `${i}: ${c.name}`));

    setEditingGarrisons({
      ...editingGarrisons,
      [location]: {
        ...editingGarrisons[location],
        chiefs: filteredChiefs
      }
    });
  };

  const handleRemoveAllDuplicateChiefs = (location: string, chiefName: string) => {
    if (!editingGarrisons || !editingGarrisons[location]) return;

    const currentChiefs = editingGarrisons[location].chiefs || [];
    console.log(`🗑️ Removing ALL ${chiefName} duplicates from ${location}`);
    console.log('Before removal:', currentChiefs.map(c => c.name));

    // Remove all instances of this chief name
    const filteredChiefs = currentChiefs.filter(c => c.name !== chiefName);

    console.log('After removal:', filteredChiefs.map(c => c.name));

    setEditingGarrisons({
      ...editingGarrisons,
      [location]: {
        ...editingGarrisons[location],
        chiefs: filteredChiefs
      }
    });
  };

  const handleClearAllChiefs = (location: string) => {
    if (!editingGarrisons || !editingGarrisons[location]) return;

    console.log(`🗑️ Clearing ALL chiefs from ${location}`);
    console.log('Before clearing:', editingGarrisons[location].chiefs?.map(c => c.name));

    setEditingGarrisons({
      ...editingGarrisons,
      [location]: {
        ...editingGarrisons[location],
        chiefs: []
      }
    });
  };

  // Fortified POI chief management functions
  const handleRemoveChiefFromPOI = (location: string, chiefIndex: number) => {
    if (!editingFortifiedPOIs || !editingFortifiedPOIs[location]) return;

    const currentChiefs = editingFortifiedPOIs[location].chiefs || [];
    console.log(`🗑️ Removing chief at index ${chiefIndex} from fortified POI ${location}`);
    console.log('Before removal:', currentChiefs.map((c, i) => `${i}: ${c.name}`));

    const filteredChiefs = currentChiefs.filter((_, index) => index !== chiefIndex);

    console.log('After removal:', filteredChiefs.map((c, i) => `${i}: ${c.name}`));

    setEditingFortifiedPOIs({
      ...editingFortifiedPOIs,
      [location]: {
        ...editingFortifiedPOIs[location],
        chiefs: filteredChiefs
      }
    });
  };

  const handleClearAllChiefsFromPOI = (location: string) => {
    if (!editingFortifiedPOIs || !editingFortifiedPOIs[location]) return;

    console.log(`🗑️ Clearing ALL chiefs from fortified POI ${location}`);
    console.log('Before clearing:', editingFortifiedPOIs[location].chiefs?.map(c => c.name));

    setEditingFortifiedPOIs({
      ...editingFortifiedPOIs,
      [location]: {
        ...editingFortifiedPOIs[location],
        chiefs: []
      }
    });
  };

  const handleAddAsset = (assetName: string) => {
    if (!selectedTribe) return;
    if (selectedTribe.assets.includes(assetName)) return; // Already has this asset

    const updatedTribe = {
      ...selectedTribe,
      assets: [...selectedTribe.assets, assetName]
    };
    setSelectedTribe(updatedTribe);
  };

  const handleRemoveAsset = (assetName: string) => {
    if (!selectedTribe) return;
    const updatedTribe = {
      ...selectedTribe,
      assets: selectedTribe.assets.filter(a => a !== assetName)
    };
    setSelectedTribe(updatedTribe);
  };

  const handleSaveChanges = () => {
    if (!selectedTribe || !editingResources || !editingGarrisons) return;

    // Merge regular garrisons with fortified POI garrisons
    const mergedGarrisons = { ...editingGarrisons };
    if (editingFortifiedPOIs) {
      Object.entries(editingFortifiedPOIs).forEach(([location, garrison]) => {
        mergedGarrisons[location] = garrison;
      });
    }

    const updatedTribe: Tribe = {
      ...selectedTribe,
      globalResources: editingResources,
      garrisons: mergedGarrisons,
      currentResearch: editingResearch,
      completedTechs: editingCompletedTechs,
      maxActionsOverride: editingMaxActions
    };

    onUpdateTribe(updatedTribe);
    setSelectedTribe(updatedTribe);

    // Enhanced success message with player notification info
    const playerName = selectedTribe.playerName;
    alert(`✅ Tribe "${updatedTribe.tribeName}" updated successfully!\n\n🔔 ${playerName} will receive a notification and be prompted to refresh their browser to see the changes.\n\n💡 If they don't see the changes immediately, ask them to refresh their page.`);
  };

  const handleResetTurnSubmission = (tribe: Tribe) => {
    const action = tribe.turnSubmitted ? 'reset' : 'refresh';
    const message = tribe.turnSubmitted
      ? `Reset turn submission for ${tribe.tribeName}? This will allow ${tribe.playerName} to submit their turn again.`
      : `Refresh turn state for ${tribe.tribeName}? This will clear any stuck frontend state and allow ${tribe.playerName} to try submitting again.`;

    if (confirm(message)) {
      const updatedTribe: Tribe = {
        ...tribe,
        turnSubmitted: false,
        actions: [], // Clear any stuck actions
        lastTurnResults: [] // CRITICAL FIX: Clear results to force planning phase (same as Force Refresh)
      };
      onUpdateTribe(updatedTribe);
      alert(`Turn submission ${action}ed for ${tribe.tribeName}. ${tribe.playerName} should now be able to add actions normally without refreshing.`);
    }
  };

  const handleForceRefreshPlayer = (tribe: Tribe) => {
    if (confirm(`Force refresh ${tribe.tribeName}? This will completely reset their turn state and clear any stuck frontend state.`)) {
      const updatedTribe: Tribe = {
        ...tribe,
        turnSubmitted: false,
        actions: [],
        lastTurnResults: [] // Clear results to force planning phase
      };
      onUpdateTribe(updatedTribe);
      alert(`Force refresh completed for ${tribe.tribeName}. ${tribe.playerName} should refresh their browser - they should now be able to add actions normally.`);
    }
  };

  const handleEjectPlayer = () => {
    if (!playerToEject) return;
    onRemovePlayer(playerToEject.userId);
    setPlayerToEject(null);
    setSelectedTribe(null);
    setEditingResources(null);
    setEditingGarrisons(null);
    setEditingResearch(null);
    setEditingCompletedTechs([]);
    alert(`Player ${playerToEject.username} has been ejected from the game.`);
  };

  const handleRemoveJourney = () => {
    if (!journeyToRemove || !onRemoveJourney) return;
    onRemoveJourney(journeyToRemove.id);
    setJourneyToRemove(null);
    alert(`Journey "${journeyToRemove.type}" has been removed from the game.`);
  };

  const handleDiagnoseCoordinateSystem = async () => {
    setIsDiagnosing(true);

    try {
      // Listen for the response
      const handleResponse = (response: { success: boolean; error?: string }) => {
        setIsDiagnosing(false);
        if (response.success) {
          alert('✅ Coordinate system diagnosis complete! Check server logs for detailed analysis.');
        } else {
          alert(`❌ Failed to diagnose coordinate system: ${response.error || 'Unknown error'}`);
        }
        const socket = client.getSocket();
        if (socket) {
          socket.off('admin:coordinateDiagnosisComplete', handleResponse);
        }
      };

      const socket = client.getSocket();
      if (socket) {
        socket.on('admin:coordinateDiagnosisComplete', handleResponse);
        client.diagnoseCoordinateSystem();
      } else {
        setIsDiagnosing(false);
        alert('❌ Socket not connected');
      }

    } catch (error) {
      setIsDiagnosing(false);
      alert(`❌ Error: ${(error as Error).message}`);
    }
  };

  const handleFixGarrisonCoordinates = async () => {
    if (!confirm('Fix garrison coordinates in database? This will:\n\n✅ Create a backup first\n✅ Only fix coordinates outside valid range\n✅ Convert string coordinates to proper map coordinates\n✅ Make Game Editor work properly\n\nThis is safe to run and can be undone.')) {
      return;
    }

    setIsFixingCoordinates(true);

    try {
      // Listen for the response
      const handleResponse = (response: { success: boolean; error?: string }) => {
        setIsFixingCoordinates(false);
        if (response.success) {
          alert('✅ Garrison coordinates fixed successfully!\n\n🎯 Game Editor should now work properly\n💾 Backup created for safe restoration\n🔄 Use "Undo Fix" if you need to restore');
        } else {
          alert(`❌ Failed to fix garrison coordinates: ${response.error || 'Unknown error'}`);
        }
        const socket = client.getSocket();
        if (socket) {
          socket.off('admin:garrisonCoordinatesFixed', handleResponse);
        }
      };

      const socket = client.getSocket();
      if (socket) {
        socket.on('admin:garrisonCoordinatesFixed', handleResponse);
        client.fixGarrisonCoordinates();
      } else {
        setIsFixingCoordinates(false);
        alert('❌ Socket not connected');
      }

    } catch (error) {
      setIsFixingCoordinates(false);
      alert(`❌ Error: ${(error as Error).message}`);
    }
  };

  const handleRestoreGarrisonCoordinates = async () => {
    if (!confirm('Restore garrison coordinates from backup? This will:\n\n🔄 Undo the coordinate fix\n📅 Restore coordinates to their previous state\n⚠️ Game Editor issues will return\n\nAre you sure you want to restore?')) {
      return;
    }

    setIsRestoring(true);

    try {
      // Listen for the response
      const handleResponse = (response: { success: boolean; error?: string }) => {
        setIsRestoring(false);
        if (response.success) {
          alert('✅ Garrison coordinates restored successfully!\n\n🔄 Coordinates reverted to backup state\n⚠️ Game Editor issues may have returned');
        } else {
          alert(`❌ Failed to restore garrison coordinates: ${response.error || 'Unknown error'}`);
        }
        const socket = client.getSocket();
        if (socket) {
          socket.off('admin:garrisonCoordinatesRestored', handleResponse);
        }
      };

      const socket = client.getSocket();
      if (socket) {
        socket.on('admin:garrisonCoordinatesRestored', handleResponse);
        client.restoreGarrisonCoordinates();
      } else {
        setIsRestoring(false);
        alert('❌ Socket not connected');
      }

    } catch (error) {
      setIsRestoring(false);
      alert(`❌ Error: ${(error as Error).message}`);
    }
  };

  const handleDeleteGarrison = () => {
    if (!garrisonToDelete || !editingGarrisons) return;

    const { location } = garrisonToDelete;
    console.log(`🗑️ Deleting garrison at ${location}`);

    // Create new garrisons object without the deleted location
    const updatedGarrisons = { ...editingGarrisons };
    delete updatedGarrisons[location];

    setEditingGarrisons(updatedGarrisons);
    setGarrisonToDelete(null);

    console.log(`✅ Garrison at ${location} deleted successfully`);
  };

  const getJourneysByTribe = useMemo(() => {
    const journeyMap: Record<string, Journey[]> = {};
    gameState.journeys.forEach(journey => {
      if (!journeyMap[journey.ownerTribeId]) {
        journeyMap[journey.ownerTribeId] = [];
      }
      journeyMap[journey.ownerTribeId].push(journey);
    });
    return journeyMap;
  }, [gameState.journeys]);

  const getTribeNameById = (tribeId: string): string => {
    const tribe = gameState.tribes.find(t => t.id === tribeId);
    return tribe ? tribe.tribeName : 'Unknown Tribe';
  };

  const availableChiefs = useMemo(() => {
    if (!selectedTribe || !editingGarrisons) return ALL_CHIEFS.sort((a, b) => a.name.localeCompare(b.name));
    const assignedChiefs = Object.values(editingGarrisons)
      .flatMap(g => g.chiefs || [])
      .map(c => c.name);
    return ALL_CHIEFS
      .filter(chief => !assignedChiefs.includes(chief.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedTribe, editingGarrisons]);

  const availableAssets = useMemo(() => {
    const assetNames = ALL_ASSETS.map(asset => asset.name);
    if (!selectedTribe) return assetNames;
    return assetNames.filter(asset => !selectedTribe.assets.includes(asset));
  }, [selectedTribe]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Game Editor</h1>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowJourneyManager(!showJourneyManager)}
            variant={showJourneyManager ? "primary" : "secondary"}
          >
            🚶 Journey Manager
          </Button>
          <Button
            onClick={handleDiagnoseCoordinateSystem}
            variant="secondary"
            disabled={isDiagnosing}
          >
            {isDiagnosing ? '🔍 Analyzing...' : '🔍 Diagnose Coords'}
          </Button>
          <Button
            onClick={handleFixGarrisonCoordinates}
            variant="secondary"
            disabled={isFixingCoordinates || isRestoring}
          >
            {isFixingCoordinates ? '🔧 Fixing...' : '🔧 Fix Coordinates'}
          </Button>
          <Button
            onClick={handleRestoreGarrisonCoordinates}
            variant="secondary"
            disabled={isFixingCoordinates || isRestoring}
          >
            {isRestoring ? '🔄 Restoring...' : '🔄 Undo Fix'}
          </Button>

          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="061.055"
              className="px-2 py-1 border rounded text-black"
              id="outpost-hex-input"
            />
            <Button
              onClick={() => {
                const input = document.getElementById('outpost-hex-input') as HTMLInputElement;
                if (input?.value) {
                  client.diagnoseOutpost(input.value);
                  alert(`Diagnosing outpost at ${input.value} - check server logs`);
                }
              }}
              variant="secondary"
            >
              🔍 Diagnose Outpost
            </Button>
            <Button
              onClick={() => {
                const input = document.getElementById('outpost-hex-input') as HTMLInputElement;
                if (input?.value) {
                  if (confirm(`Fix outpost ownership at ${input.value}?\n\nThis will transfer outpost ownership to the tribe with a garrison there.`)) {
                    client.fixOutpostOwnership(input.value);
                    alert(`Fixing outpost ownership at ${input.value} - check server logs`);
                  }
                }
              }}
              variant="secondary"
            >
              🔧 Fix Ownership
            </Button>
          </div>

          <Button
            onClick={() => {
              if (confirm(`Fix ALL outpost ownership mismatches across the entire game?\n\nThis will:\n• Check all fortified outposts\n• Transfer ownership to tribes with garrisons\n• Fix movement blocking issues\n\nThis is safe but affects the entire game.`)) {
                client.fixAllOutpostOwnership();
                alert(`Fixing all outpost ownership mismatches - check server logs for progress`);
              }
            }}
            variant="secondary"
            className="bg-orange-600 hover:bg-orange-700"
          >
            🔧 Fix ALL Outpost Ownership
          </Button>

          <Button onClick={onBack} variant="secondary">← Back to Admin</Button>
        </div>
      </div>

      {/* Turn Submission Status */}
      <Card title="📋 Turn Submission Status" className="mb-6">
        <div className="mb-4 p-3 bg-slate-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-blue-400">Turn {gameState.turn} Submissions</h3>
            <div className="text-sm text-slate-300">
              {gameState.tribes.filter(t => t.turnSubmitted).length} / {gameState.tribes.length} submitted
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(gameState.tribes.filter(t => t.turnSubmitted).length / gameState.tribes.length) * 100}%`
              }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {gameState.tribes.map(tribe => (
            <div
              key={tribe.id}
              className={`p-3 rounded-lg border-2 ${
                tribe.turnSubmitted
                  ? 'border-green-500 bg-green-900/20'
                  : 'border-red-500 bg-red-900/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-bold text-slate-200 text-sm">{tribe.tribeName}</h4>
                <div className={`px-2 py-1 rounded text-xs font-bold ${
                  tribe.turnSubmitted
                    ? 'bg-green-600 text-white'
                    : 'bg-red-600 text-white'
                }`}>
                  {tribe.turnSubmitted ? '✅ SUBMITTED' : '⏳ PENDING'}
                </div>
              </div>
              <div className="text-xs text-slate-400 mb-2">
                Player: {tribe.playerName}
              </div>
              <div className="space-y-1">
                <Button
                  onClick={() => handleResetTurnSubmission(tribe)}
                  variant="secondary"
                  className={`w-full text-xs py-1 text-white ${
                    tribe.turnSubmitted
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {tribe.turnSubmitted ? '🔄 Reset Turn' : '🔄 Allow Resubmit'}
                </Button>
                <Button
                  onClick={() => handleForceRefreshPlayer(tribe)}
                  variant="secondary"
                  className="w-full text-xs py-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  🔄 Force Refresh
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Journey Manager */}
      {showJourneyManager && (
        <Card title="🚶 Journey Manager" className="mb-6">
          <div className="mb-4 p-3 bg-slate-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-blue-400">Active Journeys</h3>
              <div className="text-sm text-slate-300">
                {gameState.journeys?.length || 0} total journeys
              </div>
            </div>
            <div className="text-xs text-slate-400 mb-3">
              View and manage all player journeys. Remove stuck or problematic journeys as needed.
            </div>
            {/* Debug info */}
            <div className="text-xs text-yellow-400 mb-2">
              Debug: journeys array exists: {gameState.journeys ? 'Yes' : 'No'},
              length: {gameState.journeys?.length || 0}
            </div>
          </div>

          {(!gameState.journeys || gameState.journeys.length === 0) ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-lg">No active journeys</p>
              <p className="text-sm">All tribes are currently at their home locations</p>
              <div className="text-xs text-yellow-400 mt-2">
                Debug: gameState.journeys = {JSON.stringify(gameState.journeys)}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(getJourneysByTribe).map(([tribeId, journeys]) => (
                <div key={tribeId} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h4 className="text-lg font-bold text-slate-200 mb-3">
                    {getTribeNameById(tribeId)} ({journeys.length} journey{journeys.length !== 1 ? 's' : ''})
                  </h4>

                  <div className="space-y-3">
                    {journeys.map(journey => (
                      <div key={journey.id} className="p-3 bg-slate-800 rounded border border-slate-600">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-semibold text-slate-200">{journey.type}</span>
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                journey.status === 'en_route' ? 'bg-blue-600 text-white' :
                                journey.status === 'awaiting_response' ? 'bg-yellow-600 text-white' :
                                'bg-green-600 text-white'
                              }`}>
                                {journey.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>

                            <div className="text-sm text-slate-400 space-y-1">
                              <div><strong>From:</strong> {journey.origin} → <strong>To:</strong> {journey.destination}</div>
                              <div><strong>Current:</strong> {journey.currentLocation}</div>
                              <div><strong>Arrival:</strong> {journey.arrivalTurn} turn{journey.arrivalTurn !== 1 ? 's' : ''} remaining</div>

                              {journey.force && (
                                <div>
                                  <strong>Force:</strong> {journey.force.troops} troops, {journey.force.weapons} weapons
                                  {journey.force.chiefs && journey.force.chiefs.length > 0 && (
                                    <span>, {journey.force.chiefs.length} chief{journey.force.chiefs.length !== 1 ? 's' : ''}</span>
                                  )}
                                </div>
                              )}

                              {journey.payload && (journey.payload.food > 0 || journey.payload.scrap > 0 || journey.payload.weapons > 0) && (
                                <div>
                                  <strong>Payload:</strong> {journey.payload.food} food, {journey.payload.scrap} scrap, {journey.payload.weapons} weapons
                                </div>
                              )}

                              {journey.scavengeType && (
                                <div><strong>Scavenging:</strong> {journey.scavengeType}</div>
                              )}

                              {journey.tradeOffer && (
                                <div>
                                  <strong>Trade Offer:</strong> Requesting {journey.tradeOffer.request.food} food, {journey.tradeOffer.request.scrap} scrap, {journey.tradeOffer.request.weapons} weapons
                                </div>
                              )}
                            </div>
                          </div>

                          <Button
                            onClick={() => setJourneyToRemove(journey)}
                            variant="secondary"
                            className="ml-3 text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tribe Selection */}
        <Card title="Select Tribe to Edit" className="lg:col-span-1">
          <div className="space-y-2">
            {playerTribes.map(tribe => {
              const user = users.find(u => u.id === tribe.playerId);
              return (
                <div key={tribe.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-md">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: tribe.color }}
                    >
                      <span className="text-sm">{tribe.icon}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">{tribe.tribeName}</p>
                      <p className="text-xs text-slate-400">{tribe.playerName}</p>
                      <div className={`text-xs font-bold ${tribe.turnSubmitted ? 'text-green-400' : 'text-red-400'}`}>
                        {tribe.turnSubmitted ? '✅ Turn Submitted' : '⏳ Turn Pending'}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => handleSelectTribe(tribe)}
                      variant={selectedTribe?.id === tribe.id ? "primary" : "secondary"}
                      className="text-xs px-2 py-1"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => setPlayerToEject({ userId: tribe.playerId, username: user?.username || 'Unknown' })}
                      variant="secondary"
                      className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      Eject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Resource Editor */}
        {selectedTribe && editingResources && (
          <Card title={`Edit Resources - ${selectedTribe.tribeName}`} className="lg:col-span-1">
            <div className="space-y-4">
              {Object.entries(editingResources).map(([resource, value]) => (
                <div key={resource} className="flex items-center justify-between">
                  <label className="text-slate-300 capitalize">{resource}</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => handleResourceChange(resource as keyof GlobalResources, parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-slate-700 text-white rounded border border-slate-600"
                    min="0"
                  />
                </div>
              ))}
              
              <div className="pt-4 border-t border-slate-600">
                <h4 className="text-slate-300 font-semibold mb-2">Assets</h4>
                <div className="space-y-2">
                  {selectedTribe.assets.map(asset => (
                    <div key={asset} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                      <span className="text-slate-200 text-sm">{asset}</span>
                      <Button
                        onClick={() => handleRemoveAsset(asset)}
                        variant="secondary"
                        className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {availableAssets.length > 0 && (
                    <select 
                      onChange={(e) => e.target.value && handleAddAsset(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600"
                      value=""
                    >
                      <option value="">Add Asset...</option>
                      {availableAssets.map(asset => (
                        <option key={asset} value={asset}>{asset}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Max Actions Editor */}
        {selectedTribe && (
          <Card title={`Action Limits - ${selectedTribe.tribeName}`} className="lg:col-span-1">
            <div className="space-y-4">
              <div className="p-3 bg-slate-900/50 rounded-md">
                <h4 className="text-slate-300 font-semibold mb-2">Actions Per Turn</h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 text-sm">Admin Override</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={editingMaxActions || ''}
                        onChange={(e) => setEditingMaxActions(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Auto"
                        className="w-20 px-2 py-1 bg-slate-700 text-white rounded border border-slate-600"
                        min="0"
                        max="20"
                      />
                      {editingMaxActions !== undefined && (
                        <Button
                          onClick={() => setEditingMaxActions(undefined)}
                          variant="secondary"
                          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <p>
                      <strong>Current:</strong> {editingMaxActions !== undefined ? `${editingMaxActions} (Admin Override)` : 'Auto-calculated'}
                    </p>
                    {editingMaxActions === undefined && (
                      <p className="text-slate-500">
                        Auto: 3 base + troop bonuses + leadership/10 + chiefs + bonus turns×2
                      </p>
                    )}
                    <p className="text-amber-400">
                      ⚠️ Override disables all automatic action calculations
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Garrison Editor */}
        {selectedTribe && editingGarrisons && (
          <Card title="Edit Garrisons" className="lg:col-span-1">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(editingGarrisons).map(([location, garrison]) => (
                <div key={location} className="p-3 bg-slate-900/50 rounded-md border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-slate-200 font-semibold">{location}</h4>
                    <Button
                      onClick={() => setGarrisonToDelete({ location, tribeName: selectedTribe?.tribeName || 'Unknown' })}
                      variant="secondary"
                      className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                      title="Delete this garrison"
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-xs text-slate-400">Troops</label>
                      <input
                        type="number"
                        value={garrison.troops}
                        onChange={(e) => handleGarrisonChange(location, 'troops', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Weapons</label>
                      <input
                        type="number"
                        value={garrison.weapons}
                        onChange={(e) => handleGarrisonChange(location, 'weapons', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-400">Chiefs ({garrison.chiefs?.length || 0})</label>
                      {garrison.chiefs && garrison.chiefs.length > 0 && (
                        <Button
                          onClick={() => handleClearAllChiefs(location)}
                          variant="secondary"
                          className="text-xs px-2 py-1 bg-red-700 hover:bg-red-800 text-white"
                          title="Remove all chiefs from this garrison"
                        >
                          Clear All
                        </Button>
                      )}
                    </div>

                    {garrison.chiefs && garrison.chiefs.length > 0 ? (
                      <>
                        {/* Show individual chiefs with index-based removal */}
                        {garrison.chiefs.map((chief, index) => {
                          const duplicateCount = garrison.chiefs!.filter(c => c.name === chief.name).length;
                          const isDuplicate = duplicateCount > 1;

                          return (
                            <div key={`${chief.name}-${index}`} className={`flex items-center justify-between p-1 rounded mb-1 ${isDuplicate ? 'bg-red-900/30 border border-red-600' : 'bg-slate-800'}`}>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-slate-200">{chief.name}</span>
                                {isDuplicate && (
                                  <span className="text-xs text-red-400 font-bold" title={`${duplicateCount} duplicates found`}>
                                    ⚠️ x{duplicateCount}
                                  </span>
                                )}
                              </div>
                              <div className="flex space-x-1">
                                <Button
                                  onClick={() => handleRemoveChief(location, index)}
                                  variant="secondary"
                                  className="text-xs px-1 py-0 bg-red-600 hover:bg-red-700 text-white"
                                  title="Remove this specific chief"
                                >
                                  ×
                                </Button>
                                {isDuplicate && (
                                  <Button
                                    onClick={() => handleRemoveAllDuplicateChiefs(location, chief.name)}
                                    variant="secondary"
                                    className="text-xs px-1 py-0 bg-red-800 hover:bg-red-900 text-white"
                                    title={`Remove all ${duplicateCount} copies of ${chief.name}`}
                                  >
                                    All
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="text-xs text-slate-500 italic">No chiefs assigned</div>
                    )}
                    {availableChiefs.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddChief(location, e.target.value);
                            e.target.value = ""; // Reset selection after adding
                          }
                        }}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-xs"
                        defaultValue=""
                      >
                        <option value="">Add Chief...</option>
                        {availableChiefs.map(chief => (
                          <option key={chief.name} value={chief.name}>{chief.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Fortified POI Editor */}
        {selectedTribe && editingFortifiedPOIs && (
          <Card title={`🏰 Edit Fortified POIs (${Object.keys(editingFortifiedPOIs).length})`} className="lg:col-span-1">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.keys(editingFortifiedPOIs).length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-blue-300 text-sm">This tribe has no fortified POIs.</p>
                  <p className="text-blue-400 text-xs mt-1">Fortified POIs are created by building outposts at POI locations.</p>
                </div>
              ) : (
                Object.entries(editingFortifiedPOIs).map(([location, garrison]) => {
                const poiInfo = getPOIInfo(location, gameState);
                const availableChiefs = ALL_CHIEFS.filter(chief =>
                  !garrison.chiefs?.some(c => c.name === chief.name)
                );

                return (
                  <div key={location} className="p-3 bg-blue-900/30 rounded-md border border-blue-600">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-blue-200 font-semibold">{location}</h4>
                        {poiInfo && (
                          <p className="text-xs text-blue-300">🏰 {poiInfo.type} ({poiInfo.rarity})</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-xs text-blue-300">Troops</label>
                        <input
                          type="number"
                          value={garrison.troops}
                          onChange={(e) => handleFortifiedPOIChange(location, 'troops', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-blue-800 text-white rounded border border-blue-500 text-sm"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-blue-300">Weapons</label>
                        <input
                          type="number"
                          value={garrison.weapons}
                          onChange={(e) => handleFortifiedPOIChange(location, 'weapons', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-blue-800 text-white rounded border border-blue-500 text-sm"
                          min="0"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-blue-300">Chiefs ({garrison.chiefs?.length || 0})</label>
                        {garrison.chiefs && garrison.chiefs.length > 0 && (
                          <Button
                            onClick={() => handleClearAllChiefsFromPOI(location)}
                            variant="secondary"
                            className="text-xs px-2 py-1 bg-red-700 hover:bg-red-800 text-white"
                            title="Remove all chiefs from this fortified POI"
                          >
                            Clear All
                          </Button>
                        )}
                      </div>

                      {garrison.chiefs && garrison.chiefs.length > 0 ? (
                        <>
                          {garrison.chiefs.map((chief, index) => (
                            <div key={`${chief.name}-${index}`} className="flex items-center justify-between p-1 rounded mb-1 bg-blue-800">
                              <span className="text-xs text-blue-200">{chief.name}</span>
                              <Button
                                onClick={() => handleRemoveChiefFromPOI(location, index)}
                                variant="secondary"
                                className="text-xs px-1 py-0 bg-red-600 hover:bg-red-700 text-white"
                                title="Remove this chief"
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="text-xs text-blue-400 italic">No chiefs assigned</div>
                      )}
                      {availableChiefs.length > 0 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddChiefToPOI(location, e.target.value);
                              e.target.value = ""; // Reset selection after adding
                            }
                          }}
                          className="w-full px-2 py-1 bg-blue-800 text-white rounded border border-blue-500 text-xs"
                          defaultValue=""
                        >
                          <option value="">Add Chief...</option>
                          {availableChiefs.map(chief => (
                            <option key={chief.name} value={chief.name}>{chief.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
                })
              )}
            </div>
          </Card>
        )}

        {/* Research Editing */}
        {selectedTribe && (
          <Card title="🔬 Research Management" className="mb-6">
            <div className="space-y-4">
              {/* Current Research */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Current Research Projects</label>
                <div className="text-sm text-slate-400">
                  {editingResearch && editingResearch.length > 0 ? (
                    <div className="space-y-2">
                      {editingResearch.map((project, index) => {
                        const tech = ALL_TECHS.find(t => t.id === project.techId);
                        return (
                          <div key={index} className="bg-slate-800 p-2 rounded">
                            <div><strong>{tech?.name || 'Unknown'}</strong></div>
                            <div>Progress: {project.progress} / {tech?.researchPoints || 0}</div>
                            <div>Troops: {project.assignedTroops} at {project.location}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div>No active research projects</div>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Note: Research editing not available in this interface. Use in-game tech tree to manage research.
                </div>
              </div>

              {/* Completed Technologies */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Completed Technologies</label>
                <div className="space-y-2">
                  {editingCompletedTechs.map(techId => {
                    const tech = ALL_TECHS.find(t => t.id === techId);
                    return (
                      <div key={techId} className="flex items-center justify-between p-2 bg-slate-700 rounded">
                        <span className="text-sm text-slate-200">
                          {tech ? `${tech.icon} ${tech.name}` : techId}
                        </span>
                        <Button
                          onClick={() => setEditingCompletedTechs(editingCompletedTechs.filter(id => id !== techId))}
                          variant="secondary"
                          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}

                  <select
                    onChange={(e) => {
                      if (e.target.value && !editingCompletedTechs.includes(e.target.value)) {
                        setEditingCompletedTechs([...editingCompletedTechs, e.target.value]);
                      }
                    }}
                    className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
                    value=""
                  >
                    <option value="">Add completed technology...</option>
                    {ALL_TECHS
                      .filter(tech => !editingCompletedTechs.includes(tech.id))
                      .map(tech => (
                        <option key={tech.id} value={tech.id}>{tech.icon} {tech.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {selectedTribe && (
        <div className="flex justify-center">
          <Button onClick={handleSaveChanges} className="px-8 py-3 text-lg">
            Save All Changes
          </Button>
        </div>
      )}

      {/* Eject Player Confirmation */}
      {playerToEject && (
        <ConfirmationModal
          title="Eject Player?"
          message={`Are you sure you want to eject ${playerToEject.username} from the game? This will remove their tribe and user account permanently.`}
          onConfirm={handleEjectPlayer}
          onCancel={() => setPlayerToEject(null)}
        />
      )}

      {/* Remove Journey Confirmation */}
      {journeyToRemove && (
        <ConfirmationModal
          title="Remove Journey?"
          message={`Are you sure you want to remove this ${journeyToRemove.type} journey from ${getTribeNameById(journeyToRemove.ownerTribeId)}? This will return the troops and resources to their origin location.`}
          onConfirm={handleRemoveJourney}
          onCancel={() => setJourneyToRemove(null)}
        />
      )}

      {/* Delete Garrison Confirmation */}
      {garrisonToDelete && (
        <ConfirmationModal
          title="Delete Garrison?"
          message={`Are you sure you want to delete the garrison at ${garrisonToDelete.location} from ${garrisonToDelete.tribeName}? This will permanently remove all troops, weapons, and chiefs at this location. This action cannot be undone.`}
          onConfirm={handleDeleteGarrison}
          onCancel={() => setGarrisonToDelete(null)}
        />
      )}
    </div>
  );
};

export default GameEditor;
