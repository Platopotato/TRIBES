

import { HexData, TerrainType, POIType, POI, POIRarity, MapSettings } from '../types.js';
import { Perlin } from './noise.js';
import { POI_RARITY_MAP } from '../constants.js';

// --- CONFIGURATION ---
const NOISE_SCALE = 0.05; // Lower numbers = larger features
const POI_SPAWN_CHANCE = 0.04;
const STARTING_LOCATION_COUNT = 50;

// --- TERRAIN PROFILES ---
// Defines the "ideal" conditions for each terrain type based on noise values (0-1).
// `range` is the ideal value, `falloff` controls how quickly the score drops off.
// Note: Water is handled separately and is not in this profile list.
const TERRAIN_PROFILES: { [key in Exclude<TerrainType, TerrainType.Water>]: {
  elevation: { range: number, falloff: number },
  moisture?: { range: number, falloff: number },
  special?: { range: number, falloff: number },
}} = {
  [TerrainType.Mountains]: { elevation: { range: 0.8, falloff: 5 } },
  [TerrainType.Plains]:    { elevation: { range: 0.4, falloff: 4 }, moisture: { range: 0.5, falloff: 3 } },
  [TerrainType.Forest]:    { elevation: { range: 0.5, falloff: 5 }, moisture: { range: 0.7, falloff: 4 } },
  [TerrainType.Swamp]:     { elevation: { range: 0.3, falloff: 8 }, moisture: { range: 0.85, falloff: 4 } },
  [TerrainType.Desert]:    { elevation: { range: 0.4, falloff: 4 }, moisture: { range: 0.15, falloff: 5 } },
  [TerrainType.Wasteland]: { elevation: { range: 0.6, falloff: 3 }, moisture: { range: 0.3, falloff: 4 } },
  [TerrainType.Ruins]:     { elevation: { range: 0.5, falloff: 2 }, special: { range: 0.85, falloff: 8 } },
  [TerrainType.Crater]:    { elevation: { range: 0.7, falloff: 6 }, special: { range: 0.5, falloff: 10 } },
  [TerrainType.Radiation]: { elevation: { range: 0.5, falloff: 3 }, special: { range: 0.1, falloff: 8 } },
};


const TERRAIN_POI_MAP: { [key in TerrainType]?: POIType[] } = {
  [TerrainType.Ruins]: [POIType.Ruins, POIType.Scrapyard, POIType.WeaponsCache, POIType.Factory],
  [TerrainType.Mountains]: [POIType.Mine, POIType.Outpost, POIType.Vault, POIType.ResearchLab],
  [TerrainType.Plains]: [POIType.Settlement, POIType.FoodSource, POIType.Battlefield],
  [TerrainType.Forest]: [POIType.FoodSource, POIType.BanditCamp, POIType.Outpost],
  [TerrainType.Wasteland]: [POIType.Scrapyard, POIType.BanditCamp, POIType.Factory, POIType.Crater],
  [TerrainType.Desert]: [POIType.ResearchLab, POIType.Scrapyard, POIType.Mine],
  [TerrainType.Swamp]: [POIType.FoodSource, POIType.BanditCamp],
  [TerrainType.Crater]: [POIType.Scrapyard, POIType.WeaponsCache, POIType.Radiation],
  [TerrainType.Radiation]: [POIType.Scrapyard, POIType.ResearchLab, POIType.WeaponsCache, POIType.Radiation]
};

// This function now only determines LAND terrain. Water is handled separately.
function getLandTerrain(e: number, m: number, s: number, biases: { [key in TerrainType]: number }): TerrainType {
  let bestScore = -1;
  let bestTerrain: TerrainType = TerrainType.Wasteland; // Default to wasteland if no match

  for (const t in TERRAIN_PROFILES) {
      const terrainType = t as keyof typeof TERRAIN_PROFILES;
      const profile = TERRAIN_PROFILES[terrainType];
      if (!profile) continue;

      let score = 1.0;
      
      // Calculate score based on elevation
      score *= Math.max(0, 1.0 - Math.pow(Math.abs(e - profile.elevation.range), profile.elevation.falloff));
      
      // Calculate score based on moisture, if applicable
      if (profile.moisture) {
          score *= Math.max(0, 1.0 - Math.pow(Math.abs(m - profile.moisture.range), profile.moisture.falloff));
      }

      // Calculate score based on special noise, if applicable
      if (profile.special) {
          score *= Math.max(0, 1.0 - Math.pow(Math.abs(s - profile.special.range), profile.special.falloff));
      }
      
      // Apply the admin-defined bias
      score *= biases[terrainType] ?? 1.0;

      if (score > bestScore) {
          bestScore = score;
          bestTerrain = terrainType;
      }
  }
  return bestTerrain;
}

function placePOI(terrain: TerrainType, q: number, r: number): POI | undefined {
    if (terrain === TerrainType.Water || Math.random() > POI_SPAWN_CHANCE) {
        return undefined;
    }
    const possiblePois = TERRAIN_POI_MAP[terrain];
    if (!possiblePois || possiblePois.length === 0) {
        return undefined;
    }
    const poiType = possiblePois[Math.floor(Math.random() * possiblePois.length)];
    const rarity = POI_RARITY_MAP[poiType] || 'Common';

    return {
        id: `poi-${q}-${r}`,
        type: poiType,
        difficulty: Math.ceil(Math.random() * 10),
        rarity: rarity,
    };
}

const formatHexCoords = (q: number, r: number) => `${String(50 + q).padStart(3, '0')}.${String(50 + r).padStart(3, '0')}`;

export function generateMapData(radius: number, seed: number, settings: MapSettings): { map: HexData[], startingLocations: string[] } {
  const map: HexData[] = [];
  const elevationNoise = new Perlin(seed);
  const moistureNoise = new Perlin(seed * 2);
  const specialNoise = new Perlin(seed * 3);

  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (q + r > -radius - 1 && q + r < radius + 1) {
        
        // --- Noise Calculation ---
        const nx = q * NOISE_SCALE;
        const ny = r * NOISE_SCALE;
        
        // RAW noise values (0-1) are used to determine the biome type.
        const raw_elevation = (elevationNoise.noise(nx, ny) + 1) / 2;
        const moisture = (moistureNoise.noise(nx, ny) + 1) / 2;
        const special = (specialNoise.noise(nx * 2, ny * 2) + 1) / 2;
        
        // --- Island Generation ---
        // FINAL elevation is used only to create the island shape and separate land from water.
        const dist_q = q / radius;
        const dist_r = r / radius;
        const dist = Math.sqrt(dist_q*dist_q + dist_r*dist_r);
        const final_elevation = raw_elevation - dist * 0.8;
        
        // --- Biome Determination ---
        let terrain: TerrainType;
        if (final_elevation < 0.20) {
            terrain = TerrainType.Water;
        } else {
            // Use the RAW (unmodified) elevation value for land biome selection.
            terrain = getLandTerrain(raw_elevation, moisture, special, settings.biases);
        }
        
        const poi = placePOI(terrain, q, r);

        map.push({ q, r, terrain, poi });
      }
    }
  }

  // --- Auto-generate Starting Locations ---
  const validStartTerrains = [TerrainType.Plains, TerrainType.Forest, TerrainType.Wasteland];
  const possibleStartHexes = map.filter(hex => validStartTerrains.includes(hex.terrain) && !hex.poi);
  
  // Shuffle possible locations to ensure they are spread out
  for (let i = possibleStartHexes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [possibleStartHexes[i], possibleStartHexes[j]] = [possibleStartHexes[j], possibleStartHexes[i]];
  }

  const startingLocations = possibleStartHexes
    .slice(0, STARTING_LOCATION_COUNT)
    .map(hex => formatHexCoords(hex.q, hex.r));

  return { map, startingLocations };
}