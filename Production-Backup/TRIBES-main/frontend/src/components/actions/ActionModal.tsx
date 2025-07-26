
/** @jsxImportSource react */
import React, { useMemo, useState, useEffect } from 'react';
import { ActionType, GameAction, Tribe, Garrison, Chief, HexData } from '../../types';
import { ACTION_DEFINITIONS, ActionField } from './actionDefinitions';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { findPath, parseHexCoords } from '../../lib/mapUtils';

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
}

const ActionModal: React.FC<ActionModalProps> = (props) => {
    const { isOpen, onClose, onAddAction, tribe, allTribes, mapData, availableGarrisons, setMapSelectionMode, draftAction, setDraftAction, onEnterMapSelectionMode } = props;
    const [travelTime, setTravelTime] = useState<number | null>(null);
  
  if (!isOpen) return null;
  
  const selectedActionType = draftAction?.actionType ?? null;

  useEffect(() => {
    if (draftAction?.actionData?.start_location && draftAction?.actionData?.finish_location) {
        const start = parseHexCoords(draftAction.actionData.start_location);
        const end = parseHexCoords(draftAction.actionData.finish_location);
        const pathInfo = findPath(start, end, mapData);
        setTravelTime(pathInfo?.cost ?? null);
    } else if (draftAction?.actionData?.start_location && draftAction?.actionData?.target_location) {
        const start = parseHexCoords(draftAction.actionData.start_location);
        const end = parseHexCoords(draftAction.actionData.target_location);
        const pathInfo = findPath(start, end, mapData);
        setTravelTime(pathInfo?.cost ?? null);
    } else {
        setTravelTime(null);
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

  const handleSelectActionType = (actionType: ActionType) => {
    const definition = ACTION_DEFINITIONS[actionType];
    const initialData: { [key: string]: any } = {};

    const validGarrisonLocations = Object.keys(availableGarrisons).filter(loc => {
        const g = availableGarrisons[loc];
        return g.troops > 0 || (g.chiefs?.length || 0) > 0;
    });
    const firstGarrison = validGarrisonLocations[0] || Object.keys(tribe.garrisons)[0] || tribe.location;

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

    setDraftAction({
      actionType: actionType,
      actionData: initialData,
    });
  };

  const handleBack = () => {
    setDraftAction(null);
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
              const pathInfo = findPath(parseHexCoords(start), parseHexCoords(location), mapData);
              setTravelTime(pathInfo?.cost ?? null);
          }
      }
      
      return {
        ...prev,
        actionData: newActionData,
      };
    });
  };

  const handleSelectOnMap = (fieldName: string) => {
    onEnterMapSelectionMode();
    setMapSelectionMode({
      active: true,
      onSelect: (location) => {
        handleFieldChange(fieldName, location);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftAction?.actionType || !draftAction?.actionData) return;

    const { troops, chiefsToMove } = draftAction.actionData;
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
        const { offer_food, offer_scrap, offer_weapons, request_food, request_scrap, request_weapons } = draftAction.actionData;
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
      actionData: draftAction.actionData,
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
            return (
                <div className="flex items-center space-x-2">
                    <input type="text" value={value} placeholder="Select on map..." readOnly className="w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-slate-200 font-mono" />
                    <Button type="button" variant="secondary" onClick={() => handleSelectOnMap(field.name)}>Map</Button>
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
        case 'select':
            return (
                <select value={value} onChange={e => handleFieldChange(field.name, e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200">
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            )
        case 'chief_select':
            const availableChiefs = currentGarrison?.chiefs || [];
            if (availableChiefs.length === 0) return <p className="text-xs text-slate-500 italic">No chiefs in this garrison.</p>;
            const selectedChiefs = (draftAction?.actionData?.chiefsToMove as string[] || []);
            return (
                <div className="space-y-2 p-2 bg-slate-800/50 rounded-md max-h-40 overflow-y-auto">
                    {availableChiefs.map((chief: Chief) => (
                        <label key={chief.name} className="flex items-center space-x-3 cursor-pointer p-1 hover:bg-slate-700 rounded-md">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded bg-slate-600 border-slate-500 text-amber-500 focus:ring-amber-500"
                                checked={selectedChiefs.includes(chief.name)}
                                onChange={e => {
                                    const newSelection = e.target.checked
                                        ? [...selectedChiefs, chief.name]
                                        : selectedChiefs.filter(name => name !== chief.name);
                                    handleFieldChange('chiefsToMove', newSelection);
                                }}
                            />
                            <span className="text-slate-300 font-semibold">{chief.name}</span>
                        </label>
                    ))}
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Trade With (Target)</label>
            <select
                value={`${data.target_location}|${data.target_tribe_id}`}
                onChange={e => handleFieldChange('target_location_and_tribe', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 font-mono"
            >
                {otherTribesWithGarrisons.length > 0 ? otherTribesWithGarrisons.map(g => (
                    <option key={`${g.location}-${g.tribeId}`} value={`${g.location}|${g.tribeId}`}>
                        {g.tribeName} - Hex {g.location}
                    </option>
                )) : <option>No other tribes to trade with</option>}
            </select>
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
            <div className="text-center font-bold text-amber-400 bg-slate-800/50 p-2 rounded-md">
                Estimated Travel Time: {travelTime} turn(s)
            </div>
        )}

        <div className="flex justify-between pt-4 border-t border-slate-700">
            <Button type="button" variant="secondary" onClick={handleBack}>Back</Button>
            <Button type="submit">Send Caravan</Button>
        </div>
      </form>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <Card title={selectedActionType ? ACTION_DEFINITIONS[selectedActionType].name : "Choose Action"} className="max-h-[90vh] flex flex-col">
          {selectedActionType === ActionType.Trade ? renderTradeForm() :
           selectedActionType ? (
             <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto">
                <p className="text-sm text-slate-400 -mt-2 mb-4">{ACTION_DEFINITIONS[selectedActionType].description}</p>
                {ACTION_DEFINITIONS[selectedActionType].fields.map(field => (
                    <div key={field.name}>
                        <label className="block text-sm font-medium text-slate-300 mb-1">{field.label}</label>
                        {renderField(field)}
                    </div>
                ))}
                
                {travelTime !== null && (
                    <div className="text-center font-bold text-amber-400 bg-slate-800/50 p-2 rounded-md">
                        Estimated Travel Time: {travelTime} turn(s)
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
