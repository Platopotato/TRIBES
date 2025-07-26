
import { HexData, TerrainType } from '../types.js';

// Cube coordinates for hex grids
interface Cube {
    q: number;
    r: number;
    s: number;
}

// Function to convert axial coordinates to cube coordinates
function axialToCube(q: number, r: number): Cube {
    return { q, r, s: -q - r };
}

// Function to convert cube coordinates back to axial coordinates
function cubeToAxial(cube: Cube): { q: number; r: number } {
    return { q: cube.q, r: cube.r };
}

// Function to calculate the distance between two hexes in cube coordinates
function cubeDistance(a: Cube, b: Cube): number {
    return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}

/**
 * Calculates the grid distance between two hexes using axial coordinates.
 */
export function axialDistance(q1: number, r1: number, q2: number, r2: number): number {
    const a = axialToCube(q1, r1);
    const b = axialToCube(q2, r2);
    return cubeDistance(a, b);
}

/**
 * Formats axial coordinates into a string key (e.g., "050.050").
 */
export const formatHexCoords = (q: number, r: number): string => 
    `${String(50 + q).padStart(3, '0')}.${String(50 + r).padStart(3, '0')}`;

/**
 * Parses a hex coordinate string key back into axial coordinates.
 */
export const parseHexCoords = (coords: string): { q: number, r: number } => {
    const [qStr, rStr] = coords.split('.');
    return { q: parseInt(qStr) - 50, r: parseInt(rStr) - 50 };
}

/**
 * Gets all hex coordinate strings within a given range of a central hex.
 */
export function getHexesInRange(center: { q: number, r: number }, range: number): string[] {
    const results: string[] = [];
    for (let q = -range; q <= range; q++) {
        for (let r = -range; r <= range; r++) {
            if (q + r >= -range && q + r <= range) {
                const hexQ = center.q + q;
                const hexR = center.r + r;
                if (axialDistance(center.q, center.r, hexQ, hexR) <= range) {
                    results.push(formatHexCoords(hexQ, hexR));
                }
            }
        }
    }
    return results;
}

/**
 * Converts hex coordinates to pixel coordinates for SVG rendering.
 */
export function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
    const width = Math.sqrt(3) * size;
    const height = 2 * size;
    const x = width * (q + r / 2);
    const y = (height * 3 / 4) * r;
    return { x, y };
}

// --- A* Pathfinding ---
const BASE_MOVEMENT_PER_TURN = 5; // Hexes traveled on standard terrain in one turn.

const TERRAIN_MOVEMENT_COSTS: Record<TerrainType, number> = {
    [TerrainType.Plains]: 1 / BASE_MOVEMENT_PER_TURN,
    [TerrainType.Wasteland]: 1 / BASE_MOVEMENT_PER_TURN,
    [TerrainType.Forest]: 1.5 / BASE_MOVEMENT_PER_TURN,
    [TerrainType.Desert]: 1.5 / BASE_MOVEMENT_PER_TURN,
    [TerrainType.Ruins]: 1.2 / BASE_MOVEMENT_PER_TURN,
    [TerrainType.Swamp]: 2 / BASE_MOVEMENT_PER_TURN,
    [TerrainType.Mountains]: 2.5 / BASE_MOVEMENT_PER_TURN,
    [TerrainType.Crater]: 1.8 / BASE_MOVEMENT_PER_TURN,
    [TerrainType.Radiation]: 1 / BASE_MOVEMENT_PER_TURN,
    [TerrainType.Water]: Infinity,
};

const HEX_DIRECTIONS = [
    { q: 1, r: 0 }, { q: -1, r: 0 },
    { q: 0, r: 1 }, { q: 0, r: -1 },
    { q: 1, r: -1 }, { q: -1, r: 1 },
];

export function findPath(start: {q: number, r: number}, end: {q: number, r: number}, mapData: HexData[]): { path: string[], cost: number } | null {
    const map = new Map(mapData.map(hex => [formatHexCoords(hex.q, hex.r), hex]));
    const startKey = formatHexCoords(start.q, start.r);
    const endKey = formatHexCoords(end.q, end.r);

    const openSet = new Set([startKey]);
    const cameFrom = new Map<string, string>();

    const gScore = new Map<string, number>();
    gScore.set(startKey, 0);

    const fScore = new Map<string, number>();
    fScore.set(startKey, axialDistance(start.q, start.r, end.q, end.r));

    while (openSet.size > 0) {
        let currentKey = '';
        let minFScore = Infinity;
        for (const key of openSet) {
            if ((fScore.get(key) ?? Infinity) < minFScore) {
                minFScore = fScore.get(key)!;
                currentKey = key;
            }
        }

        if (currentKey === endKey) {
            const path: string[] = [];
            let tempKey = currentKey;
            while (tempKey) {
                path.unshift(tempKey);
                tempKey = cameFrom.get(tempKey)!;
            }
            return { path, cost: Math.ceil(gScore.get(endKey) ?? 0) };
        }

        openSet.delete(currentKey);
        const currentCoords = parseHexCoords(currentKey);
        
        for (const dir of HEX_DIRECTIONS) {
            const neighborCoords = { q: currentCoords.q + dir.q, r: currentCoords.r + dir.r };
            const neighborKey = formatHexCoords(neighborCoords.q, neighborCoords.r);
            const neighborHex = map.get(neighborKey);

            if (!neighborHex) continue;

            const moveCost = TERRAIN_MOVEMENT_COSTS[neighborHex.terrain] ?? Infinity;
            if (moveCost === Infinity) continue;
            
            const tentativeGScore = (gScore.get(currentKey) ?? Infinity) + moveCost;

            if (tentativeGScore < (gScore.get(neighborKey) ?? Infinity)) {
                cameFrom.set(neighborKey, currentKey);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + axialDistance(neighborCoords.q, neighborCoords.r, end.q, end.r));
                if (!openSet.has(neighborKey)) {
                    openSet.add(neighborKey);
                }
            }
        }
    }

    return null; // No path found
}