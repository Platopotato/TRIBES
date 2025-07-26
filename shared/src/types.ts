// Shared types for Radix Tribes game

export enum JourneyType {
    Move = 'Move',
    Attack = 'Attack',
    Scavenge = 'Scavenge',
    Trade = 'Trade',
    Return = 'Return',
    Scout = 'Scout',
    BuildOutpost = 'Build Outpost',
}

export interface Journey {
    id: string;
    ownerTribeId: string;
    type: JourneyType;
    
    origin: string;
    destination: string;
    path: string[];
    currentLocation: string;
    
    force: {
        troops: number;
        weapons: number;
        chiefs: Chief[];
    };
    
    payload: {
        food: number;
        scrap: number;
        weapons: number;
    };

    arrivalTurn: number; // Represents a countdown of turns remaining
    responseDeadline?: number; // The turn number on which a trade offer expires
    // For scavenge journeys
    scavengeType?: 'Food' | 'Scrap' | 'Weapons';
    // For trade journeys, this stores the original action to be re-evaluated
    tradeOffer?: {
        request: { food: number, scrap: number, weapons: number };
        fromTribeName: string;
    };
    status: 'en_route' | 'awaiting_response' | 'returning';
}


export interface TribeStats {
  charisma: number;
  intelligence: number;
  leadership: number;
  strength: number;
}

export interface GlobalResources {
  food: number;
  scrap: number;
  morale: number;
}

export interface Garrison {
    troops: number;
    weapons: number;
    chiefs: Chief[];
}

export interface Chief {
    name: string;
    description: string;
    key_image_url: string;
    stats: TribeStats;
}

export type ChiefRequestStatus = 'pending' | 'approved' | 'denied';
export type AssetRequestStatus = 'pending' | 'approved' | 'denied';


export interface ChiefRequest {
    id: string;
    tribeId: string;
    chiefName: string;
    radixAddressSnippet: string;
    status: ChiefRequestStatus;
}

export interface AssetRequest {
    id: string;
    tribeId: string;
    assetName: string;
    radixAddressSnippet: string;
    status: AssetRequestStatus;
}

export type RationLevel = 'Hard' | 'Normal' | 'Generous';

export enum TechnologyEffectType {
  PassiveFoodGeneration = 'PASSIVE_FOOD_GENERATION',
  PassiveScrapGeneration = 'PASSIVE_SCRAP_GENERATION',
  ScavengeYieldBonus = 'SCAVENGE_YIELD_BONUS',
  CombatBonusAttack = 'COMBAT_BONUS_ATTACK',
  CombatBonusDefense = 'COMBAT_BONUS_DEFENSE',
  MovementSpeedBonus = 'MOVEMENT_SPEED_BONUS',
}

export interface TechnologyEffect {
  type: TechnologyEffectType;
  value: number; // e.g., 10 for food, 0.1 for 10%
  resource?: 'Food' | 'Scrap' | 'Weapons'; // For Scavenge bonus
  terrain?: TerrainType; // For combat bonus in specific terrain
}

export interface GameAsset {
    name: string;
    description: string;
    key_image_url: string;
    effects: TechnologyEffect[];
}

export interface Technology {
  id: string;
  name: string;
  description: string;
  cost: { scrap: number };
  researchPoints: number; // Total points needed to complete
  requiredTroops: number; // Minimum troops to start
  prerequisites: string[];
  effects: TechnologyEffect[];
  icon: string; // emoji or character symbol
}

export interface ResearchProject {
  techId: string;
  progress: number; // points accumulated
  assignedTroops: number;
  location: string;
}

export enum AIType {
  Wanderer = 'Wanderer',
  Aggressive = 'Aggressive',
  Defensive = 'Defensive',
  Expansionist = 'Expansionist',
  Trader = 'Trader',
  Scavenger = 'Scavenger',
}

export enum DiplomaticStatus {
    War = 'War',
    Neutral = 'Neutral',
    Alliance = 'Alliance',
}

export interface DiplomaticRelation {
    status: DiplomaticStatus;
    truceUntilTurn?: number; // Turn number until which war cannot be declared
}

export interface DiplomaticProposal {
    id:string;
    fromTribeId: string;
    toTribeId: string;
    statusChangeTo: DiplomaticStatus.Alliance | DiplomaticStatus.Neutral; // Alliance or Peace
    expiresOnTurn: number;
    fromTribeName: string;
    reparations?: {
        food: number;
        scrap: number;
        weapons: number;
    };
}

export interface Tribe {
  id: string;
  playerId: string; // The ID of the user who owns this tribe
  isAI?: boolean;
  aiType?: AIType | null;
  playerName: string;
  tribeName: string;
  icon: string;
  color: string;
  stats: TribeStats;
  globalResources: GlobalResources;
  garrisons: Record<string, Garrison>; // Key is hex coordinate string
  location: string; // Home base location, e.g., "050.050"
  turnSubmitted: boolean;
  actions: GameAction[];
  lastTurnResults: GameAction[];
  exploredHexes: string[];
  rationLevel: RationLevel;
  completedTechs: string[];
  assets: string[]; // List of owned asset names
  currentResearch: ResearchProject | null;
  journeyResponses: { journeyId: string; response: 'accept' | 'reject' }[];
  diplomacy: Record<string, DiplomaticRelation>; // Key is other tribe's ID
}

export enum ActionType {
  Move = 'Move',
  Scout = 'Scout',
  Scavenge = 'Scavenge',
  Recruit = 'Recruit',
  Attack = 'Attack',
  Rest = 'Rest',
  Explore = 'Explore',
  StartResearch = 'Start Research',
  BuildWeapons = 'Build Weapons',
  BuildOutpost = 'Build Outpost',
  SupplyOutpost = 'Supply Outpost',
  Trade = 'Trade',
  Defend = 'Defend',
  SetRations = 'Set Rations',
  Return = 'Return',
  Upkeep = 'Upkeep', // Not user-selectable, for results only
  Technology = 'Technology', // Not user-selectable, for results only
  RespondToTrade = 'Respond to Trade',
}

export type GamePhase = 'planning' | 'processing' | 'results' | 'waiting';

export interface GameAction {
  id: string;
  actionType: ActionType;
  actionData: { 
    chiefsToMove?: string[];
    [key: string]: any 
  };
  result?: string; // Optional: To store the outcome of the action
}

export enum TerrainType {
  Plains = 'Plains',
  Desert = 'Desert',
  Mountains = 'Mountains',
  Forest = 'Forest',
  Ruins = 'Ruins',
  Wasteland = 'Wasteland',
  Water = 'Water',
  Radiation = 'Radiation',
  Crater = 'Crater',
  Swamp = 'Swamp',
}

export enum POIType {
    Scrapyard = 'Scrapyard',
    FoodSource = 'Food Source',
    WeaponsCache = 'WeaponsCache',
    ResearchLab = 'Research Lab',
    Settlement = 'Settlement',
    Outpost = 'Outpost',
    Ruins = 'Ruins POI',
    BanditCamp = 'Bandit Camp',
    Mine = 'Mine',
    Vault = 'Vault',
    Battlefield = 'Battlefield',
    Factory = 'Factory',
    Crater = 'Crater POI',
    Radiation = 'Radiation Zone',
}

export type POIRarity = 'Common' | 'Uncommon' | 'Rare' | 'Very Rare';

export interface POI {
    id: string;
    type: POIType;
    difficulty: number; // 1-10
    rarity: POIRarity;
}

export interface HexData {
  q: number;
  r: number;
  terrain: TerrainType;
  poi?: POI;
}

export interface User {
    id: string;
    username: string;
    passwordHash: string;
    role: 'player' | 'admin';
    securityQuestion: string;
    securityAnswerHash: string;
}

export type TerrainBiases = {
    [key in TerrainType]: number;
};

export interface MapSettings {
    biases: TerrainBiases;
}

export interface TribeHistoryRecord {
    tribeId: string;
    score: number;
    troops: number;
    garrisons: number;
}

export interface TurnHistoryRecord {
    turn: number;
    tribeRecords: TribeHistoryRecord[];
}

export interface GameState {
    mapData: HexData[];
    tribes: Tribe[];
    turn: number;
    startingLocations: string[]; // Ordered list of hex coordinates for players to join
    chiefRequests: ChiefRequest[];
    assetRequests: AssetRequest[];
    journeys: Journey[];
    diplomaticProposals: DiplomaticProposal[];
    history?: TurnHistoryRecord[];
    ticker?: TickerState;
    loginAnnouncements?: LoginAnnouncementState;
    turnDeadline?: TurnDeadline;
    // These are now primarily for use within the map editor for generating new base maps
    mapSeed?: number; 
    mapSettings?: MapSettings;
}

export interface FullBackupState {
    gameState: GameState;
    users: User[];
    userPasswords?: { [userId: string]: string }; // Password hashes for complete restoration
}

export interface BackupFile {
    filename: string;
    timestamp: Date;
    size: number;
}

export interface BackupStatus {
    isRunning: boolean;
    intervalMinutes: number;
    maxBackups: number;
    backupCount: number;
    lastBackup: Date | null;
    nextBackup: Date | null;
}

export interface TurnDeadline {
    turn: number;
    deadline: number; // timestamp
    isActive: boolean;
}

export type TickerPriority = 'normal' | 'important' | 'urgent';

export interface TickerMessage {
    id: string;
    message: string;
    priority: TickerPriority;
    createdAt: number; // timestamp
    isActive: boolean;
}

export interface TickerState {
    messages: TickerMessage[];
    isEnabled: boolean;
}

export interface LoginAnnouncement {
    id: string;
    title: string;
    message: string;
    priority: TickerPriority;
    isActive: boolean;
    createdAt: number;
}

export interface LoginAnnouncementState {
    announcements: LoginAnnouncement[];
    isEnabled: boolean;
}