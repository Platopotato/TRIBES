



import React from 'react';
import { Tribe, Garrison, ActionType, Chief } from '../../types';

export interface ActionField {
  name: string;
  label: string;
  type: 'location' | 'targetLocation' | 'number' | 'select' | 'info' | 'text' | 'garrison_select' | 'chief_select';
  options?: string[]; // for select type
  defaultValue?: string | number;
  placeholder?: string;
  info?: string;
  max?: keyof Garrison | keyof Tribe['globalResources']; // key to check against garrison resources or global
  chiefs?: Chief[];
}

export interface ActionDefinition {
  name:string;
  description: string;
  icon: React.ReactNode;
  fields: ActionField[];
  isPlaceholder?: boolean;
}

export const ACTION_DEFINITIONS: { [key in Exclude<ActionType, ActionType.Upkeep | ActionType.Technology | ActionType.StartResearch | ActionType.Explore | ActionType.SupplyOutpost | ActionType.RespondToTrade | ActionType.Return>]: ActionDefinition } = {
  [ActionType.Move]: {
    name: 'Move',
    description: 'Relocate troops, chiefs, and equipment between garrisons.',
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3' }),
    fields: [
      { name: 'start_location', label: 'Move From', type: 'garrison_select' },
      { name: 'finish_location', label: 'Destination', type: 'targetLocation' },
      { name: 'troops', label: 'Troops', type: 'number', defaultValue: 1, max: 'troops' },
      { name: 'weapons', label: 'Weapons', type: 'number', defaultValue: 0, max: 'weapons' },
      { name: 'chiefsToMove', label: 'Chiefs', type: 'chief_select' },
      { name: 'info', label: 'Info', type: 'info', info: 'Attrition: 2% per hex + terrain mods.' }
    ],
  },
  [ActionType.Scout]: {
    name: 'Scout',
    description: 'Gather intelligence on distant locations. Risk and reward depend on distance and scout party strength.',
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' }),
    fields: [
      { name: 'start_location', label: 'Start', type: 'garrison_select' },
      { name: 'target_location', label: 'Target', type: 'targetLocation' },
      { name: 'troops', label: 'Scouts', type: 'number', defaultValue: 1, max: 'troops' },
      { name: 'weapons', label: 'Weapons', type: 'number', defaultValue: 0, max: 'weapons' },
      { name: 'chiefsToMove', label: 'Chief Scout(s)', type: 'chief_select' },
      { name: 'info', label: 'Info', type: 'info', info: 'Reveals an area. Risk of casualties increases with distance. Chiefs with high Intelligence improve results and reduce risk.' }
    ],
  },
  [ActionType.Scavenge]: {
    name: 'Scavenge',
    description: 'Gather specific resources. The wasteland is dangerous; send protection.',
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25 1.313M12 12.75V15m0-2.25l2.25 1.313M9 15l2.25-1.313M15 15l-2.25-1.313M15 15V12.75m-3-7.5V3m3 4.5V3m-3 0h3' }),
    fields: [
      { name: 'start_location', label: 'Operate From', type: 'garrison_select' },
      { name: 'target_location', label: 'Target Hex', type: 'targetLocation' },
      { name: 'resource_type', label: 'Resource', type: 'select', options: ['Food', 'Scrap', 'Weapons'] },
      { name: 'troops', label: 'Scavengers', type: 'number', defaultValue: 5, max: 'troops' },
      { name: 'weapons', label: 'Weapons', type: 'number', defaultValue: 0, max: 'weapons' },
      { name: 'chiefsToMove', label: 'Chief(s) to lead', type: 'chief_select' },
      { name: 'info', label: 'Info', type: 'info', info: 'Yields affected by terrain and POIs. Random events can occur. Weapons and Chiefs can improve survival and success.' }
    ],
  },
  [ActionType.Recruit]: {
    name: 'Recruit',
    description: 'Convert food into new troops for your tribe.',
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-3.742 2.72a9.094 9.094 0 01-3.742-.479 3 3 0 01-4.682-2.72m3.742 2.72c.283 0 .567.022.85.065m-2.148-.065a9.094 9.094 0 01-1.592-.479 3 3 0 01-2.54-1.921M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    fields: [
      { name: 'start_location', label: 'Location', type: 'garrison_select' },
      { name: 'food_offered', label: 'Food Offered (Global)', type: 'number', defaultValue: 10, max: 'food' },
      { name: 'info', label: 'Info', type: 'info', info: 'Base rate: 0.3 recruits per food. Charisma improves results.' }
    ],
  },
    [ActionType.SetRations]: {
    name: 'Set Rations',
    description: 'Adjust food rations. Affects morale and consumption rate. Persists until changed.',
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12' }),
    fields: [
      { name: 'ration_level', label: 'Ration Level', type: 'select', options: ['Hard', 'Normal', 'Generous'], defaultValue: 'Normal' },
      { name: 'info', label: 'Info', type: 'info', info: 'Hard: 0.5x food/troop, -2 morale/turn. Normal: 1x food/troop. Generous: 1.5x food/troop, +2 morale/turn (if not starving).' }
    ],
  },
  [ActionType.Rest]: {
    name: 'Rest',
    description: 'Restore troop morale and combat effectiveness.',
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' }),
    fields: [
      { name: 'start_location', label: 'Location', type: 'garrison_select' },
      { name: 'troops', label: 'Resting Troops', type: 'number', defaultValue: 1, max: 'troops' },
      { name: 'info', label: 'Info', type: 'info', info: 'Recovers 15-25 morale, affected by leadership.' }
    ],
  },
  [ActionType.BuildWeapons]: {
    name: 'Build Weapons',
    description: 'Convert scrap into valuable weapons.',
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M13.5 3H12v2.25L13.5 6v12H6V6L7.5 5.25V3H6m13.5 0h-1.5v2.25L21 6v12h-7.5V6L15 5.25V3z' }),
    fields: [
      { name: 'start_location', label: 'Location', type: 'garrison_select' },
      { name: 'scrap', label: 'Scrap Used (Global)', type: 'number', defaultValue: 5, max: 'scrap' },
      { name: 'info', label: 'Info', type: 'info', info: 'Base rate: 0.4 weapons per scrap. Intelligence improves yield.' }
    ],
  },
  [ActionType.Defend]: {
    name: 'Defend',
    description: 'Prepare defensive positions for an impending attack.',
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286z' }),
    fields: [
      { name: 'start_location', label: 'Location', type: 'garrison_select' },
      { name: 'troops', label: 'Defenders', type: 'number', defaultValue: 1, max: 'troops' },
      { name: 'info', label: 'Info', type: 'info', info: 'Provides a +30% defense bonus when attacked.' }
    ],
  },
  [ActionType.Attack]: {
    name: 'Attack',
    description: 'Assault an enemy position to capture it.',
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M11.25 4.5l7.5 7.5-7.5 7.5' }),
    fields: [
      { name: 'start_location', label: 'Staging Area', type: 'garrison_select' },
      { name: 'target_location', label: 'Target', type: 'targetLocation' },
      { name: 'troops', label: 'Assault Force', type: 'number', defaultValue: 1, max: 'troops' },
      { name: 'weapons', label: 'Weapons', type: 'number', defaultValue: 0, max: 'weapons' },
      { name: 'chiefsToMove', label: 'Chiefs', type: 'chief_select' },
      { name: 'info', label: 'Info', type: 'info', info: 'Strength and terrain are key factors. High risk of casualties.' }
    ],
  },
  [ActionType.BuildOutpost]: {
    name: 'Build Outpost',
    description: "Establish a new garrison in an unoccupied hex. Extends your tribe's reach.",
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' }),
    fields: [
      { name: 'start_location', label: 'Build From', type: 'garrison_select' },
      { name: 'target_location', label: 'Target Hex', type: 'targetLocation' },
      { name: 'troops', label: 'Builders', type: 'number', defaultValue: 5, max: 'troops' },
      { name: 'info', label: 'Info', type: 'info', info: 'Costs 25 Scrap. Requires at least 5 builders. The builders will garrison the new outpost.' }
    ],
  },
  [ActionType.Trade]: {
    name: 'Trade',
    description: 'Dispatch a guarded caravan to trade resources with another tribe.',
    icon: React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' }),
    fields: [
        { name: 'start_location', label: 'From', type: 'garrison_select' },
        { name: 'target_location_and_tribe', label: 'To', type: 'select' }, // Custom handling in modal
        { name: 'troops', label: 'Guards', type: 'number', max: 'troops' },
        { name: 'weapons', label: 'Guard Weapons', type: 'number', max: 'weapons' },
        { name: 'chiefsToMove', label: 'Guard Chiefs', type: 'chief_select' },
        { name: 'offer_food', label: 'Food', type: 'number', max: 'food' },
        { name: 'offer_scrap', label: 'Scrap', type: 'number', max: 'scrap' },
        { name: 'offer_weapons', label: 'Weapons', type: 'number', max: 'weapons' },
        { name: 'request_food', label: 'Food', type: 'number' },
        { name: 'request_scrap', label: 'Scrap', type: 'number' },
        { name: 'request_weapons', label: 'Weapons', type: 'number' },
    ],
  },
};