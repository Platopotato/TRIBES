
/** @jsxImportSource react */
import React, { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import { ActionType, GameAction, Tribe, Garrison, Chief, HexData } from '../../types';
import { ACTION_DEFINITIONS, ActionField } from './actionDefinitions';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { findPath, parseHexCoords, formatHexCoords } from '../../lib/mapUtils';
// Helper that tolerates both "051.044" and "q,r" style coords
const parseAnyCoords = (coords: string): { q: number, r: number } => {
  if (!coords || typeof coords !== 'string') return { q: NaN as any, r: NaN as any };
  if (coords.includes('.')) {
    return parseHexCoords(coords);
  }
  if (coords.includes(',')) {
    const [qStr, rStr] = coords.split(',');
    return { q: parseInt(qStr.trim()), r: parseInt(rStr.trim()) };
  }
  // Fallback: try direct numbers separated by space
  const parts = coords.trim().split(/\s+/);
  if (parts.length === 2) {
    return { q: parseInt(parts[0]), r: parseInt(parts[1]) };
  }
  throw new Error(`Unsupported coordinate format: ${coords}`);
};


interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAction: (action: GameAction) => void;
  tribe: Tribe;
  allTribes: Tribe[];
  mapData: HexData[];
  availableGarrisons: Record<string, Garrison>;
  setMapSelectionMode: (mode: { active: boolean; onSelect: (location: string) => void }) => void;
  draftAction: Partial<GameAction> | null;
  setDraftAction: React.Dispatch<React.SetStateAction<Partial<GameAction> | null>>;
  onEnterMapSelectionMode: () => void;
  selectedLocationForAction?: string | null;
  setSelectedLocationForAction?: (location: string | null) => void;
  pendingHexSelection?: {q: number, r: number} | null;
  setPendingHexSelection?: (selection: {q: number, r: number} | null) => void;
}

const ActionModal: React.FC<ActionModalProps> = (props) => {
    const renderStartTime = Date.now();
    console.log('🎬 ActionModal RENDER START at:', renderStartTime);

    const { isOpen, onClose, onAddAction, tribe, allTribes, mapData, availableGarrisons, setMapSelectionMode, draftAction, setDraftAction, onEnterMapSelectionMode, selectedLocationForAction, setSelectedLocationForAction, pendingHexSelection, setPendingHexSelection } = props;

    // Debug pending selection state
    console.log('🔥 ActionModal pendingHexSelection:', pendingHexSelection);
    console.log('🔥 ActionModal setPendingHexSelection:', !!setPendingHexSelection);
    const [travelTime, setTravelTime] = useState<number | null>(null);
    const [pathPreview, setPathPreview] = useState<string[] | null>(null);
    const [selectedHexForDisplay, setSelectedHexForDisplay] = useState<string | null>(null);

    console.log('📊 Props extracted at:', Date.now() - renderStartTime, 'ms');

    // Simplified effect - just handle the selected location prop
    useEffect(() => {
        if (selectedLocationForAction && setSelectedLocationForAction) {
            console.log('🚀 SIMPLE EFFECT: Setting location:', selectedLocationForAction);

            // Set display state immediately
            setSelectedHexForDisplay(selectedLocationForAction);

            // Clear the prop immediately to prevent re-triggering
            setSelectedLocationForAction(null);

            console.log('✅ SIMPLE EFFECT COMPLETE');
        }
    }, [selectedLocationForAction, setSelectedLocationForAction]);

  if (!isOpen) return null;

  const selectedActionType = draftAction?.actionType ?? null;

  useEffect(() => {
    if (draftAction?.actionData?.start_location && draftAction?.actionData?.finish_location) {
        const start = parseAnyCoords(draftAction.actionData.start_location);
        const end = parseAnyCoords(draftAction.actionData.finish_location);
        const pathInfo = findPath(start, end, mapData);
        let movementSpeedBonus = 1.0;
        // Apply movement speed bonuses based on assets (mirrors server behavior)
        if (tribe.assets?.includes('Dune_Buggy')) movementSpeedBonus *= 1.2;
        const eta = pathInfo ? Math.ceil(pathInfo.cost / movementSpeedBonus) : null;
        setTravelTime(eta);
        setPathPreview(pathInfo ? pathInfo.path : null);
    } else if (draftAction?.actionData?.start_location && draftAction?.actionData?.target_location) {
        const start = parseAnyCoords(draftAction.actionData.start_location);
        const end = parseAnyCoords(draftAction.actionData.target_location);
        const pathInfo = findPath(start, end, mapData);
        let movementSpeedBonus = 1.0;
        if (draftAction?.actionType === ActionType.Move && tribe.assets?.includes('Dune_Buggy')) movementSpeedBonus *= 1.2;
        const eta = pathInfo ? Math.ceil(pathInfo.cost / movementSpeedBonus) : null;
        setTravelTime(eta);
        setPathPreview(pathInfo ? pathInfo.path : null);
    } else {
        setTravelTime(null);
        setPathPreview(null);
    }
  }, [draftAction, mapData]);

  const otherTribesWithGarrisons = useMemo(() => {
    return allTribes
        .filter(t => t.id !== tribe.id)
        .flatMap(t =>
            Object.keys(t.garrisons).map(loc => ({
                tribeId: t.id,
                tribeName: t.tribeName,
                location: loc,
            }))
        );
  }, [allTribes, tribe.id]);


	  // Show ETA as soon as a destination is selected (even before submitting)
	  useEffect(() => {
	    if (![ActionType.Move, ActionType.Attack, ActionType.Scout, ActionType.Scavenge].includes(draftAction?.actionType as ActionType)) return;
	    const start = draftAction?.actionData?.start_location;
	    const dest = selectedHexForDisplay && selectedHexForDisplay !== 'Selecting...' ? selectedHexForDisplay : null;
	    if (start && dest) {
	      const pathInfo = findPath(parseAnyCoords(start), parseAnyCoords(dest), mapData);
	      let movementSpeedBonus = 1.0;
	      // Apply movement speed bonuses based on assets (mirrors server behavior)
	      if (tribe.assets?.includes('Dune_Buggy')) movementSpeedBonus *= 1.2;
	      const eta = pathInfo ? Math.ceil(pathInfo.cost / movementSpeedBonus) : null;
	      setTravelTime(eta);
	      setPathPreview(pathInfo ? pathInfo.path : null);
	    } else {
	      setTravelTime(null);
	      setPathPreview(null);
	    }
	  }, [draftAction?.actionType, draftAction?.actionData?.start_location, selectedHexForDisplay, mapData, tribe.assets]);

  const handleSelectActionType = (actionType: ActionType) => {

    const definition = ACTION_DEFINITIONS[actionType];
    const initialData: { [key: string]: any } = {};

    const validGarrisonLocations = Object.keys(availableGarrisons).filter(loc => {
        const g = availableGarrisons[loc];
        return g.troops > 0 || (g.chiefs?.length || 0) > 0;
    });
    const firstGarrison = validGarrisonLocations[0] || Object.keys(tribe.garrisons)[0] || tribe.location;

    if (definition) {
      definition.fields.forEach(field => {
        if (field.type === 'garrison_select') {
          initialData[field.name] = firstGarrison;
        } else if (field.name === 'start_location' || field.name === 'location') {
          initialData[field.name] = tribe.location;
        } else if (field.defaultValue !== undefined) {
          initialData[field.name] = field.defaultValue;
        } else if (field.type === 'select' && field.options) {
          initialData[field.name] = field.options[0];
        } else if (field.type === 'chief_select') {
          initialData[field.name] = [];
        } else if (actionType === ActionType.Trade) {
            initialData['offer_food'] = 0;
            initialData['offer_scrap'] = 0;
            initialData['offer_weapons'] = 0;
            initialData['request_food'] = 0;
            initialData['request_scrap'] = 0;
            initialData['request_weapons'] = 0;
            initialData['troops'] = 1;
            initialData['weapons'] = 0;
            if (otherTribesWithGarrisons.length > 0) {
              initialData['target_location'] = otherTribesWithGarrisons[0].location;
              initialData['target_tribe_id'] = otherTribesWithGarrisons[0].tribeId;
            }
        }
      });
    } else {
      // Custom diplomacy actions
      if (actionType === ActionType.ReleasePrisoner) {
        const prisonerNames = (tribe.prisoners || []).map(p => p.chief?.name).filter(Boolean);
        initialData['chief_name'] = prisonerNames[0] || '';
        const toId = (tribe.prisoners || [])[0]?.fromTribeId;
        if (toId) initialData['toTribeId'] = toId;
      }
      if (actionType === ActionType.ExchangePrisoners) {
        // Defaults: first non-self tribe
        const to = allTribes.find(t => t.id !== tribe.id);
        if (to) initialData['toTribeId'] = to.id;
        initialData['offeredChiefNames'] = [];
        initialData['requestedChiefNames'] = '';
      }
    }

    setDraftAction({
      actionType: actionType,
      actionData: initialData,
    });
  };

  const handleBack = () => {
    setDraftAction(null);
    // Clear selection state when going back
    if (setPendingHexSelection) {
      setPendingHexSelection(null);
    }
    if (setSelectedLocationForAction) {
      setSelectedLocationForAction(null);
    }
    // Clear map selection mode
    setMapSelectionMode({ active: false, onSelect: null });
  };

  const handleFieldChange = (name: string, value: string | number | string[]) => {
    setDraftAction(prev => {
      if (!prev) return null;

      const newActionData = {
          ...prev.actionData,
          [name]: value,
      };

      if (name === 'target_location_and_tribe') {
          const [location, tribeId] = (value as string).split('|');
          newActionData['target_location'] = location;
          newActionData['target_tribe_id'] = tribeId;
          const start = newActionData.start_location;
          if (start) {
              const pathInfo = findPath(parseAnyCoords(start), parseAnyCoords(location), mapData);
              setTravelTime(pathInfo?.cost ?? null);
              setPathPreview(pathInfo ? pathInfo.path : null);
          }
      }

      return {
        ...prev,
        actionData: newActionData,
      };
    });
  };

  // Use external pending selection state instead of local state
  const [currentFieldName, setCurrentFieldName] = useState<string | null>(null);

  // Clean hex selection handlers
  const handleConfirmSelection = () => {
    if (!pendingHexSelection || !currentFieldName) return;

    const location = formatHexCoords(pendingHexSelection.q, pendingHexSelection.r);

    // Update the field with the location
    handleFieldChange(currentFieldName, location);

    // Set the confirmed location for display
    setSelectedHexForDisplay(location);

    // Clear pending selection
    setPendingHexSelection(null);
    setCurrentFieldName(null);

    // Exit map selection mode
    setMapSelectionMode({ active: false, onSelect: null });
  };

  const handleCancelSelection = () => {
    // Clear pending selection
    setPendingHexSelection(null);
    setCurrentFieldName(null);

    // Stay in map selection mode for another try
    // Don't exit map mode, just clear the pending selection
  };

  const handleSelectOnMap = (fieldName: string) => {
    console.log('🔥 ACTION MODAL: handleSelectOnMap called for field:', fieldName);

    // Store which field we're selecting for
    setCurrentFieldName(fieldName);

    // Set the selected hex display immediately for instant feedback
    setSelectedHexForDisplay('Selecting...');

    // Clear any previous pending selection
    if (setPendingHexSelection) {
      setPendingHexSelection(null);
    }

    // Trigger the map selection mode (this will be handled by Dashboard)
    onEnterMapSelectionMode();
  };



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftAction?.actionType || !draftAction?.actionData) return;

    // Use the displayed hex location if available
    const finalActionData = { ...draftAction.actionData };
    if (selectedHexForDisplay) {
      // Set the appropriate location field based on action type
      if (draftAction.actionType === ActionType.Move) {
        finalActionData.finish_location = selectedHexForDisplay;
      } else if ([ActionType.Scout, ActionType.Attack, ActionType.Scavenge, ActionType.BuildOutpost].includes(draftAction.actionType)) {
        finalActionData.target_location = selectedHexForDisplay;
      }
      console.log('✅ Using selected location:', selectedHexForDisplay, 'for action:', draftAction.actionType);
    }

    const { troops, chiefsToMove } = finalActionData;
    const actionsRequiringCarriers = [
      ActionType.Move, ActionType.Attack, ActionType.Scout,
      ActionType.Scavenge, ActionType.BuildOutpost, ActionType.Trade,
    ];

    if (actionsRequiringCarriers.includes(draftAction.actionType)) {
      const hasTroops = troops !== undefined && troops > 0;
      const hasChiefs = chiefsToMove && Array.isArray(chiefsToMove) && chiefsToMove.length > 0;

      if (!hasTroops && !hasChiefs) {
        alert("This action requires at least one troop or chief to be assigned.");
        return;
      }
    }

    if (draftAction.actionType === ActionType.Trade) {
        const { offer_food, offer_scrap, offer_weapons, request_food, request_scrap, request_weapons } = finalActionData;
        const totalOffered = offer_food + offer_scrap + offer_weapons;
        const totalRequested = request_food + request_scrap + request_weapons;
        if (totalOffered === 0 && totalRequested === 0) {
            alert("A trade must include at least one offered or requested resource.");
            return;
        }
    }

    const newAction: Omit<GameAction, 'result'> = {
      id: `action-${Date.now()}`,
      actionType: draftAction.actionType,
      actionData: finalActionData,
    };
    onAddAction(newAction);
    onClose();
  };

  const renderField = (field: ActionField) => {
    const value = draftAction?.actionData?.[field.name] ?? '';
    const startLocation = draftAction?.actionData?.start_location;
    const currentGarrison = startLocation ? availableGarrisons[startLocation] : null;

    switch (field.type) {
        case 'garrison_select': {
             const validGarrisonEntries = Object.entries(availableGarrisons).filter(([, g]) => g.troops > 0 || g.chiefs.length > 0);

             if (validGarrisonEntries.length === 0) {
                 return <p className="text-sm text-red-500 italic bg-slate-800/50 p-2 rounded-md">No garrisons with available units.</p>;
             }

             return (
                <select value={value} onChange={e => handleFieldChange(field.name, e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 font-mono">
                    {validGarrisonEntries.map(([loc, g]) => (
                        <option key={loc} value={loc}>{`Hex ${loc} (Troops: ${g.troops}, Weapons: ${g.weapons}, Chiefs: ${g.chiefs.length})`}</option>
                    ))}
                </select>
            );
        }
        case 'location':
            return <p className="text-lg font-mono bg-slate-800 px-3 py-1 rounded-md">{value}</p>
        case 'targetLocation':
            console.log(`🎯 Rendering targetLocation field '${field.name}' with value:`, value);
            return (
                <div className="flex flex-col space-y-2">
                    <input
                        type="text"
                        value={value || ''}
                        placeholder="Tap 'Select Location' below..."
                        readOnly
                        className="w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-slate-200 font-mono"
                    />
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => handleSelectOnMap(field.name)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                    >
                        📍 Select Location
                    </Button>
                </div>
            )
        case 'number':
            let maxVal: number | undefined = undefined;
            if (field.max && currentGarrison) {
                const maxKey = field.max as keyof Omit<Garrison, 'chiefs'>;
                maxVal = currentGarrison[maxKey];
            } else if (field.max && tribe.globalResources[field.max as keyof typeof tribe.globalResources] !== undefined) {
                 maxVal = tribe.globalResources[field.max as keyof typeof tribe.globalResources];
            }

            return <input type="number" value={value} min="0" max={maxVal} onChange={e => handleFieldChange(field.name, parseInt(e.target.value) || 0)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200" />

        case 'troops_weapons_select':
            // Special up/down control for troops and weapons with garrison limits
            let maxAvailable: number = 0;
            if (field.max && currentGarrison) {
                const maxKey = field.max as keyof Omit<Garrison, 'chiefs'>;
                maxAvailable = currentGarrison[maxKey] || 0;
            }

            const currentValue = (value as number) || 0;
            const resourceType = field.name === 'troops' ? 'Troops' : 'Weapons';

            return (
                <div className="space-y-2">
                    <div className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                        <div className="text-slate-300">
                            <div className="font-medium">{resourceType}</div>
                            <div className="text-xs text-slate-400">Available: {maxAvailable}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => handleFieldChange(field.name, Math.max(0, currentValue - 1))}
                                disabled={currentValue <= 0}
                                className="w-10 h-10 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                                style={{ touchAction: 'manipulation' }}
                            >
                                −
                            </button>
                            <div className="w-16 text-center">
                                <div className="text-2xl font-bold text-white">{currentValue}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleFieldChange(field.name, Math.min(maxAvailable, currentValue + 1))}
                                disabled={currentValue >= maxAvailable}
                                className="w-10 h-10 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                                style={{ touchAction: 'manipulation' }}
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>
            )
        case 'select':
            return (
                <select value={value} onChange={e => handleFieldChange(field.name, e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200">
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            )
        case 'chief_select':
            const rawChiefs = currentGarrison?.chiefs || [];
            // DEDUPLICATION FIX: Remove duplicate chiefs by name
            const availableChiefs = rawChiefs.filter((chief, index, array) =>
                array.findIndex(c => c.name === chief.name) === index
            );

            if (availableChiefs.length === 0) return <p className="text-xs text-slate-500 italic">No chiefs in this garrison.</p>;
            const selectedChiefs = (draftAction?.actionData?.chiefsToMove as string[]) || [];

            return (
                <div className="space-y-2 p-2 bg-slate-800/50 rounded-md max-h-40 overflow-y-auto">
                    {availableChiefs.map((chief: Chief, index: number) => {
                        const isSelected = selectedChiefs.includes(chief.name);
                        return (
                            <label key={`${chief.name}-${index}`} className="flex items-center space-x-3 cursor-pointer p-1 hover:bg-slate-700 rounded-md">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded bg-slate-600 border-slate-500 text-amber-500 focus:ring-amber-500"
                                    checked={isSelected}
                                    value={chief.name}
                                    onChange={e => {
                                        const newSelection = e.target.checked
                                            ? [...new Set([...selectedChiefs, chief.name])] // Prevent duplicates in selection
                                            : selectedChiefs.filter(name => name !== chief.name);
                                        handleFieldChange('chiefsToMove', newSelection);
                                    }}
                                />
                                <span className={`font-semibold ${isSelected ? 'text-amber-300' : 'text-slate-300'}`}>
                                    {chief.name} {isSelected ? '✓' : ''}
                                </span>
                            </label>
                        );
                    })}
                </div>
            )
        case 'info':
            return <p className="text-xs text-slate-400 italic p-2 bg-slate-800/50 rounded-md">{field.info}</p>;
        default: return null;
    }
  }

  const renderTradeForm = () => {
    const data = draftAction?.actionData || {};
    const startGarrison = availableGarrisons[data.start_location];
    return (
      <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[75vh] p-1">
        <p className="text-sm text-slate-400 -mt-2 mb-4">{ACTION_DEFINITIONS.Trade.description}</p>

        <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Dispatch Caravan From</label>
            {renderField(ACTION_DEFINITIONS.Trade.fields[0])}
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Trade With (Target)</label>
            {otherTribesWithGarrisons.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {otherTribesWithGarrisons.map(g => {
                  const isSelected = `${data.target_location}|${data.target_tribe_id}` === `${g.location}|${g.tribeId}`;
                  return (
                    <button
                      key={`${g.location}-${g.tribeId}`}
                      type="button"
                      onClick={() => handleFieldChange('target_location_and_tribe', `${g.location}|${g.tribeId}`)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all mobile-touch-target touch-feedback haptic-light ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                          : 'border-slate-600 bg-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-600'
                      }`}
                    >
                      <div className="font-semibold">{g.tribeName}</div>
                      <div className="text-sm text-slate-400">Hex {g.location}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-400 text-center">
                No other tribes to trade with
              </div>
            )}
        </div>

        <div className="pt-3 border-t border-slate-700">
            <h4 className="text-md font-semibold text-slate-300 mb-2">Assign Guards</h4>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Troops</label>
                    {renderField(ACTION_DEFINITIONS.Trade.fields[2])}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Weapons</label>
                    {renderField(ACTION_DEFINITIONS.Trade.fields[3])}
                </div>
            </div>
            {startGarrison?.chiefs?.length > 0 && (
                 <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Chiefs</label>
                    {renderField(ACTION_DEFINITIONS.Trade.fields[4])}
                </div>
            )}
        </div>

        <div className="grid grid-cols-2 gap-6 pt-3 border-t border-slate-700">
            <div className="space-y-3">
                <h4 className="text-md font-semibold text-slate-300 text-center">You Offer</h4>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Food (Max: {tribe.globalResources.food})</label>
                    {renderField(ACTION_DEFINITIONS.Trade.fields[5])}
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Scrap (Max: {tribe.globalResources.scrap})</label>
                    {renderField(ACTION_DEFINITIONS.Trade.fields[6])}
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Weapons (Max: {startGarrison?.weapons ?? 0})</label>
                    {renderField(ACTION_DEFINITIONS.Trade.fields[7])}
                </div>
            </div>
            <div className="space-y-3">
                <h4 className="text-md font-semibold text-slate-300 text-center">You Request</h4>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Food</label>
                    {renderField(ACTION_DEFINITIONS.Trade.fields[8])}
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Scrap</label>
                    {renderField(ACTION_DEFINITIONS.Trade.fields[9])}
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Weapons</label>
                    {renderField(ACTION_DEFINITIONS.Trade.fields[10])}
                </div>
            </div>
        </div>

        {travelTime !== null && (
            <div className="text-center bg-slate-800/50 p-3 rounded-md border border-amber-500/30 space-y-1">
                <div className="font-bold text-amber-400">
                    🚶‍♂️ Estimated Travel Time: {Math.ceil(travelTime)} turn{Math.ceil(travelTime) > 1 ? 's' : ''}
                </div>
                <div className="text-xs text-slate-300">
                    {travelTime <= 1 ?
                        "⚡ Fast movement - arrives instantly!" :
                        `🗺️ Multi-turn journey - visible on map during travel`
                    }
                </div>
                <div className="text-xs text-slate-400">
                    Movement cost: {travelTime.toFixed(1)} • Based on terrain difficulty
                </div>
                {pathPreview && pathPreview.length > 0 && (
                  <div className="text-xs text-slate-400">
                    Path: {pathPreview.slice(0, 3).join(' → ')}{pathPreview.length > 3 ? ` → … → ${pathPreview[pathPreview.length - 1]}` : ''}
                  </div>
                )}
                {pathPreview && pathPreview.length > 0 && (
                  <div className="text-xs text-slate-400">
                    Hexes: {pathPreview.length - 1} • Round trip: {Math.ceil((travelTime || 0) * 2)} turns
                  </div>
                )}
            </div>
        )}

        <div className="flex justify-between pt-4 border-t border-slate-700">
            <Button type="button" variant="secondary" onClick={handleBack}>Back</Button>
            <Button type="submit">Send Caravan</Button>
        </div>
      </form>
    )
  }

  const renderReleasePrisonerForm = () => {
    const prisonerNames = (tribe.prisoners || []).map(p => p.chief?.name).filter(Boolean);
    const data = draftAction?.actionData || {};
    return (
      <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[75vh] p-1">
        <p className="text-sm text-slate-400 -mt-2 mb-4">Release a captured enemy chief back to their tribe.</p>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Prisoner</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200"
            value={data.chief_name || ''}
            onChange={(e) => handleFieldChange('chief_name', e.target.value)}
          >
            <option value='' disabled>Select prisoner</option>
            {prisonerNames.map(name => (<option key={name} value={name}>{name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Return To Tribe (optional)</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200"
            value={data.toTribeId || ''}
            onChange={(e) => handleFieldChange('toTribeId', e.target.value)}
          >
            <option value=''>Original Owner</option>
            {allTribes.filter(t => t.id !== tribe.id).map(t => (
              <option key={t.id} value={t.id}>{t.tribeName}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-between pt-4 border-t border-slate-700">
          <Button type="button" variant="secondary" onClick={handleBack}>Back</Button>
          <Button type="submit">Add Action</Button>
        </div>
      </form>
    );
  };

  const renderExchangePrisonersForm = () => {
    const data = draftAction?.actionData || {};
    const prisonerNames = (tribe.prisoners || []).map(p => p.chief?.name).filter(Boolean);
    return (
      <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[75vh] p-1">
        <p className="text-sm text-slate-400 -mt-2 mb-4">Propose an exchange of prisoners with another tribe.</p>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Target Tribe</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200"
            value={data.toTribeId || ''}
            onChange={(e) => handleFieldChange('toTribeId', e.target.value)}
          >
            {allTribes.filter(t => t.id !== tribe.id).map(t => (
              <option key={t.id} value={t.id}>{t.tribeName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Offer These Prisoners (you hold)</label>
          <select multiple className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 min-h-[6rem]"
            value={data.offeredChiefNames || []}
            onChange={(e) => handleFieldChange('offeredChiefNames', Array.from(e.target.selectedOptions).map(o => o.value))}
          >
            {prisonerNames.length === 0 ? <option disabled>No prisoners to offer</option> : null}
            {prisonerNames.map(name => (<option key={name} value={name}>{name}</option>))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Hold Ctrl/Cmd to select multiple.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Request These Prisoners (type names, comma-separated)</label>
          <input
            type="text"
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200"
            value={data.requestedChiefNames || ''}
            onChange={(e) => handleFieldChange('requestedChiefNames', e.target.value)}
            placeholder="e.g., Raven, Ironclaw"
          />
        </div>
        <div className="flex justify-between pt-4 border-t border-slate-700">
          <Button type="button" variant="secondary" onClick={handleBack}>Back</Button>
          <Button type="submit">Add Action</Button>
        </div>
      </form>
    );
  };


  console.log('🎬 ActionModal RENDER COMPLETE at:', Date.now() - renderStartTime, 'ms');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      {/* FORCE CONFIRMATION DIALOGS AT TOP LEVEL - OUTSIDE EVERYTHING */}
      {pendingHexSelection && (
        <div className="fixed top-4 left-4 right-4 bg-orange-600 border-8 border-orange-400 p-8 rounded-lg shadow-2xl z-[9999] animate-pulse">
          <div className="text-white font-bold text-4xl mb-4">
            🎯 FORCE TOP LEVEL CONFIRMATION v16:30:
          </div>
          <div className="text-white font-mono text-5xl font-bold mb-6">{pendingHexSelection.q},{pendingHexSelection.r}</div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleConfirmSelection}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-8 rounded-lg text-2xl shadow-lg"
            >
              ✅ CONFIRM SELECTION
            </button>
            <button
              type="button"
              onClick={handleCancelSelection}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-6 px-8 rounded-lg text-2xl shadow-lg"
            >
              ❌ CANCEL
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <Card title={selectedActionType ? ACTION_DEFINITIONS[selectedActionType].name : "Choose Action"} className="max-h-[90vh] flex flex-col">
          {/* HEX SELECTION CONFIRMATION - CLEAN VERSION */}
          {pendingHexSelection ? (
            <div className="bg-green-50 border-2 border-green-200 p-4 rounded mb-4">
              <div className="text-green-800 font-bold text-lg mb-3 text-center">
                📍 Selected Location: {pendingHexSelection.q},{pendingHexSelection.r}
              </div>
              <div className="flex gap-3">
                <button
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfirmSelection();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfirmSelection();
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  ✅ Confirm Location
                </button>
                <button
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelSelection();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelSelection();
                  }}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          ) : (
            currentFieldName ? (
              <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded mb-4">
                <div className="text-blue-800 font-medium text-center">
                  {`Tap a hex on the map to select location for ${currentFieldName}`}
                </div>
              </div>
            ) : null
          )}

          {selectedActionType === ActionType.Trade ? renderTradeForm() :
           selectedActionType === ActionType.ReleasePrisoner ? renderReleasePrisonerForm() :
           selectedActionType === ActionType.ExchangePrisoners ? renderExchangePrisonersForm() :
           selectedActionType ? (
             <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto">
                <p className="text-sm text-slate-400 -mt-2 mb-4">{ACTION_DEFINITIONS[selectedActionType].description}</p>
                {ACTION_DEFINITIONS[selectedActionType].fields.map(field => {
                    // Hide targetLocation fields when we have a selected location
                    const isLocationField = field.type === 'targetLocation' ||
                                          field.name === 'finish_location' ||
                                          field.name === 'target_location';

                    if (isLocationField && selectedHexForDisplay) {
                        return null; // Hide the field since we show it in the green box
                    }

                    return (
                        <div key={field.name}>
                            <label className="block text-sm font-medium text-slate-300 mb-1">{field.label}</label>
                            {renderField(field)}
                        </div>
                    );
                })}

                {/* Confirmed Selected Hex Display */}
                {selectedHexForDisplay && selectedHexForDisplay !== 'Selecting...' && !pendingHexSelection && (
                    <div className="bg-green-600 border-2 border-green-400 p-4 rounded-lg">
                        <div className="text-white font-bold text-lg flex items-center gap-2">
                            ✅ Selected Location:
                        </div>
                        <div className="text-white font-mono text-xl font-bold">{selectedHexForDisplay}</div>
                        <button
                            type="button"
                            onClick={() => setSelectedHexForDisplay(null)}
                            className="mt-2 text-sm text-green-200 hover:text-white underline"
                        >
                            Clear selection
                        </button>
                    </div>
                )}

                {/* Pending Selection - FORCE VISIBLE - v16:30 */}
                {pendingHexSelection && (
                    <div className="bg-orange-600 border-4 border-orange-400 p-6 rounded-lg animate-pulse shadow-2xl relative z-50" style={{position: 'relative', zIndex: 9999}}>
                        <div className="text-white font-bold text-2xl flex items-center gap-2 mb-4">
                            🎯 PREVIEW LOCATION v16:30:
                        </div>
                        <div className="text-white font-mono text-3xl font-bold mb-4">{pendingHexSelection.q},{pendingHexSelection.r}</div>
                        <div className="flex gap-4 mt-4">
                            <button
                                type="button"
                                onClick={handleConfirmSelection}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg"
                            >
                                ✅ CONFIRM SELECTION
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelSelection}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg"
                            >
                                ❌ CANCEL
                            </button>
                        </div>
                        <div className="text-orange-200 text-lg mt-4 font-bold">
                            Tap another hex to change selection, or confirm this one
                        </div>
                    </div>
                )}

                {/* FORCE SHOW CONFIRMATION FOR TESTING - SUPER VISIBLE */}
                {pendingHexSelection && (
                    <div className="bg-purple-600 border-8 border-purple-400 p-8 rounded-lg shadow-2xl" style={{position: 'relative', zIndex: 9999}}>
                        <div className="text-white font-bold text-3xl mb-4">🧪 FORCE CONFIRMATION TEST</div>
                        <div className="text-white text-xl mb-2">This should ALWAYS show when pendingHexSelection exists</div>
                        <div className="text-white text-lg">pendingHexSelection: {JSON.stringify(pendingHexSelection)}</div>
                    </div>
                )}

                {/* Loading state */}
                {selectedHexForDisplay === 'Selecting...' && !pendingHexSelection && (
                    <div className="bg-blue-600 border-2 border-blue-400 p-4 rounded-lg animate-pulse">
                        <div className="text-white font-bold text-lg">
                            🎯 Tap a hex on the map to select it...
                        </div>
                    </div>
                )}

                {travelTime !== null && (
                    <div className="text-center bg-slate-800/50 p-3 rounded-md border border-amber-500/30 space-y-1">
                        <div className="font-bold text-amber-400">
                            🚶‍♂️ Estimated Travel Time: {Math.ceil(travelTime)} turn{Math.ceil(travelTime) > 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-slate-300">
                            {travelTime <= 1 ?
                                "⚡ Fast movement - arrives instantly!" :
                                `🗺️ Multi-turn journey - visible on map during travel`
                            }
                        </div>
                        <div className="text-xs text-slate-400">
                            Movement cost: {travelTime.toFixed(1)} • Based on terrain difficulty
                        </div>
                        {pathPreview && pathPreview.length > 0 && (
                          <div className="text-xs text-slate-400">
                            Path: {pathPreview.slice(0, 3).join(' → ')}{pathPreview.length > 3 ? ` → … → ${pathPreview[pathPreview.length - 1]}` : ''}
                          </div>
                        )}
                        {pathPreview && pathPreview.length > 0 && (
                          <div className="text-xs text-slate-400">
                            Hexes: {pathPreview.length - 1} • Round trip: {Math.ceil((travelTime || 0) * 2)} turns
                          </div>
                        )}
                    </div>
                )}

                <div className="flex justify-between pt-4 border-t border-slate-700">
                    <Button type="button" variant="secondary" onClick={handleBack}>Back</Button>
                    <Button type="submit" disabled={ACTION_DEFINITIONS[selectedActionType].isPlaceholder}>Add Action</Button>
                </div>
            </form>
          ) : (
            <div className="grid grid-cols-3 gap-4 overflow-y-auto">
              {Object.entries(ACTION_DEFINITIONS).map(([key, def]) => (
                <button
                  key={key}
                  onClick={() => handleSelectActionType(key as ActionType)}
                  className="flex flex-col items-center justify-center space-y-2 p-3 bg-slate-700 hover:bg-slate-600 rounded-lg aspect-square transition-colors duration-200 text-slate-300 hover:text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={def.isPlaceholder}
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">{def.icon}</svg>
                  <span className="text-xs text-center font-semibold">{def.name}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>


    </div>
  );
};

export default ActionModal;
