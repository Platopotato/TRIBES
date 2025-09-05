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
  ScavengeBonus = 'SCAVENGE_BONUS',
  RecruitmentCostReduction = 'RECRUITMENT_COST_REDUCTION',
  WeaponProductionBonus = 'WEAPON_PRODUCTION_BONUS',
  ResearchSpeedBonus = 'RESEARCH_SPEED_BONUS',
  MoraleBonus = 'MORALE_BONUS',
  TradeBonus = 'TRADE_BONUS',
  VisibilityRangeBonus = 'VISIBILITY_RANGE_BONUS',
  SabotageResistance = 'SABOTAGE_RESISTANCE',
  SabotageEffectiveness = 'SABOTAGE_EFFECTIVENESS',
  TerrainMovementBonus = 'TERRAIN_MOVEMENT_BONUS',
  ResourceCapacityBonus = 'RESOURCE_CAPACITY_BONUS',
  ChiefRecruitmentBonus = 'CHIEF_RECRUITMENT_BONUS',
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
  Bandit = 'Bandit',
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

export enum DiplomaticActionType {
    ProposeAlliance = 'ProposeAlliance',
    SueForPeace = 'SueForPeace',
    SendPeaceEnvoy = 'SendPeaceEnvoy',
    SendDemands = 'SendDemands',
    RequestAid = 'RequestAid',
    OfferTribute = 'OfferTribute',
    ProposeNonAggressionPact = 'ProposeNonAggressionPact',
    RequestPassage = 'RequestPassage',
    ProposeTradeAgreement = 'ProposeTradeAgreement',
    ShareIntelligence = 'ShareIntelligence',
    DiplomaticAnnouncement = 'DiplomaticAnnouncement'
}

export enum DiplomaticMessageType {
    Ultimatum = 'ultimatum',
    Alliance = 'alliance',
    Peace = 'peace',
    NonAggression = 'non_aggression',
    AidRequest = 'aid_request',
    TradeProposal = 'trade_proposal',
    PeaceEnvoy = 'peace_envoy',
    Tribute = 'tribute',
    PassageRequest = 'passage_request',
    Intelligence = 'intelligence',
    Announcement = 'announcement'
}

export enum DiplomaticMessageStatus {
    Pending = 'pending',
    Accepted = 'accepted',
    Rejected = 'rejected',
    Expired = 'expired',
    Dismissed = 'dismissed'
}

export interface DiplomaticMessage {
    id: string;
    type: DiplomaticMessageType;
    fromTribeId: string;
    fromTribeName: string;
    toTribeId: string;
    subject: string;
    message: string;
    data?: {
        // For ultimatums/demands
        demands?: {
            food?: number;
            scrap?: number;
            weapons?: number;
            territory?: string;
        };
        // For aid requests/tribute offers
        resources?: {
            food?: number;
            scrap?: number;
            weapons?: number;
        };
        // For trade proposals
        trade?: {
            offering: { food?: number; scrap?: number; weapons?: number };
            requesting: { food?: number; scrap?: number; weapons?: number };
            duration?: number;
        };
        // For non-aggression pacts
        nonAggressionDuration?: number;
        // For passage requests
        passage?: {
            startLocation: string;
            endLocation: string;
            duration: number;
        };
        // For intelligence sharing
        intelligence?: {
            targetTribeId?: string;
            intelType?: 'troop_movements' | 'resource_status' | 'planned_actions' | 'technology';
            details?: string;
        };
        // For peace treaties (reparations)
        reparations?: {
            food?: number;
            scrap?: number;
            weapons?: number;
        };
    };
    requiresResponse: boolean;
    expiresOnTurn?: number;
    status: DiplomaticMessageStatus;
    createdTurn: number;
    createdAt: Date;
}

export interface DiplomaticProposal {
    id: string;
    fromTribeId: string;
    toTribeId: string;
    actionType: DiplomaticActionType;
    statusChangeTo?: DiplomaticStatus.Alliance | DiplomaticStatus.Neutral; // For alliance/peace proposals (optional for trade)
    expiresOnTurn: number;
    fromTribeName: string;
    reparations?: {
        food: number;
        scrap: number;
        weapons: number;
    };
    tradeAgreement?: {
        offering: { food: number; scrap: number };
        duration: number; // Number of turns
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
  currentResearch: ResearchProject[];
  journeyResponses: { journeyId: string; response: 'accept' | 'reject' }[];
  diplomacy: Record<string, DiplomaticRelation>; // Key is other tribe's ID
  injuredChiefs?: InjuredChief[]; // Chiefs out of action; return handled via upkeep
  shareMapWithAllies?: boolean; // Whether to share explored map with allies (default: true)
  mapSharingSettings?: Record<string, boolean>; // Per-ally map sharing settings (tribeId -> enabled)
  prisoners?: PrisonerChief[]; // Captured enemy chiefs
  lastStateUpdate?: number; // Timestamp for frontend state synchronization
  forceUIReset?: boolean; // Flag to force frontend UI reset after turn processing
  forceRefreshApplied?: boolean; // Flag indicating Force Refresh logic was applied
  abandonmentTracking?: {
    lastActiveActions: number;
    turnsInactive: number;
    lastActionTurn: number;
    isPotentiallyAbandoned?: boolean;
    homeBaseResources?: {
      weapons: number;
      scrap: number;
      food: number;
      recordedOnTurn: number;
    } | null;
  };
  bonusTurns?: number;
  maxActionsOverride?: number; // Admin override for max actions per turn (optional)
}

export interface InjuredChief {
  chief: Chief;
  returnTurn: number;
  fromHex: string;
}

export interface PrisonerChief {
  chief: Chief;
  fromTribeId: string;
  capturedOnTurn: number;
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
  Sabotage = 'Sabotage',
  Upkeep = 'Upkeep', // Not user-selectable, for results only
  Technology = 'Technology', // Not user-selectable, for results only
  RandomEvent = 'Random Event', // Not user-selectable, for random events only
  RespondToTrade = 'Respond to Trade',
  ReleasePrisoner = 'Release Prisoner',
  ExchangePrisoners = 'Exchange Prisoners',
  RespondToPrisonerExchange = 'Respond to Prisoner Exchange',
}

export interface PrisonerExchangeProposal {
  id: string;
  fromTribeId: string;
  toTribeId: string;
  offeredChiefNames: string[];
  requestedChiefNames: string[];
  expiresOnTurn: number;
}

export enum SabotageType {
  DestroyResources = 'Destroy Resources',
  StealResources = 'Steal Resources',
  IntelligenceGathering = 'Intelligence Gathering',
  StealResearch = 'Steal Research',
  DestroyResearch = 'Destroy Research',
  SabotageOutpost = 'Sabotage Outpost',
  PoisonSupplies = 'Poison Supplies',
}

export interface SabotageOperation {
  type: SabotageType;
  targetTribeId: string;
  targetLocation: string;
  operatives: {
    troops: number;
    chiefs: string[];
  };
  specificTarget?: {
    resourceType?: 'food' | 'scrap' | 'weapons';
    researchProject?: string;
    amount?: number;
  };
}

export interface SabotageResult {
  success: boolean;
  detected: boolean;
  operativesCaptured: {
    troops: number;
    chiefs: string[];
  };
  intelligence?: {
    troopCounts?: Record<string, number>;
    resources?: Record<string, number>;
    plannedActions?: GameAction[];
    researchProgress?: ResearchProject[];
    completedTechs?: string[];
  };
  damageDealt?: {
    resourcesDestroyed?: Record<string, number>;
    resourcesStolen?: Record<string, number>;
    researchDestroyed?: string[];
    researchStolen?: ResearchProject[];
    outpostDisabled?: boolean;
    troopsWeakened?: number;
  };
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
  meta?: {
    assetBadges?: { name?: string; label: string; emoji?: string }[];
  };
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
    fortified?: boolean; // Whether POI is fortified with outpost defenses
    outpostOwner?: string; // Tribe ID that owns the fortified POI
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
    chiefs: number;
    rank: number;
}

export interface DetailedActionRecord {
    actionType: ActionType;
    actionData: any;
    result: string;
    timestamp?: number;
    success?: boolean;
    resourcesSpent?: Record<string, number>;
    resourcesGained?: Record<string, number>;
    troopsInvolved?: number;
    location?: string;
}

export interface DetailedTribeHistoryRecord extends TribeHistoryRecord {
    tribeName: string;
    playerName: string;
    isAI: boolean;
    aiType?: AIType;
    chiefNames: string[];
    actions: DetailedActionRecord[];
    majorEvents: string[];
    resourceChanges: {
        food: { before: number; after: number; change: number };
        scrap: { before: number; after: number; change: number };
        morale: { before: number; after: number; change: number };
    };
    territoryChanges: {
        gained: string[];
        lost: string[];
        netChange: number;
    };
    militaryChanges: {
        troopsGained: number;
        troopsLost: number;
        weaponsGained: number;
        weaponsLost: number;
        netTroopChange: number;
        netWeaponChange: number;
    };
    researchProgress: {
        started: string[];
        completed: string[];
        ongoing: string[];
    };
    diplomaticEvents: string[];
}

export interface TurnHistoryRecord {
    turn: number;
    tribeRecords: TribeHistoryRecord[];
}

export interface DetailedTurnHistoryRecord {
    turn: number;
    tribeRecords: DetailedTribeHistoryRecord[];
    globalEvents: string[];
    turnSummary: string;
}

export interface TradeAgreement {
    id: string;
    fromTribeId: string;
    toTribeId: string;
    fromTribeName: string;
    toTribeName: string;
    terms: {
        fromTribeGives: { food: number; scrap: number };
        toTribeGives: { food: number; scrap: number };
    };
    duration: number; // turns remaining
    createdTurn: number;
    status: 'active' | 'expired' | 'cancelled';
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
    diplomaticMessages?: DiplomaticMessage[]; // New unified message system
    prisonerExchangeProposals?: PrisonerExchangeProposal[];
    tradeAgreements?: TradeAgreement[]; // Active trade agreements
    history?: TurnHistoryRecord[];
    detailedHistory?: DetailedTurnHistoryRecord[];
    ticker?: TickerState;
    loginAnnouncements?: LoginAnnouncementState;
    turnDeadline?: TurnDeadline;
    newsletter?: NewsletterState;
    suspended?: boolean;
    suspensionMessage?: string;
    poiExtractionThisTurn?: Record<string, { food: number; scrap: number; weapons: number }>; // Track POI extraction per turn
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
    scrollSpeed?: number; // Animation duration in seconds (default: 30)
}

export interface Newsletter {
    id: string;
    turn: number;
    title: string;
    content: string; // Rich text content (HTML)
    publishedAt: Date;
    isPublished: boolean;
}

export interface NewsletterState {
    newsletters: Newsletter[];
    currentNewsletter?: Newsletter; // Current turn's newsletter
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