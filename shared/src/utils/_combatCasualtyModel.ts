// Extracted helper for clearer diffs; currently unused outside turnProcessor
export function computeCasualties(attTroops: number, attWeapons: number, defTroops: number, defWeapons: number, winner: 'attacker'|'defender', context: { terrainDefBonus: number, outpost?: boolean }) {
  const atkStrength = Math.max(1, attTroops + (attWeapons || 0));
  const defStrength = Math.max(1, defTroops + (defWeapons || 0));
  const ratio = atkStrength / defStrength; // >1 favors attacker
  const nearParity = Math.max(0, 1 - Math.abs(1 - ratio)); // 1 when equal, 0 when very lopsided
  // Increase overall lethality slightly, especially near parity
  const intensityBase = 0.35 + (0.25 * nearParity); // 35%–60%
  const terrainMitigation = 1 - Math.min(0.2, Math.max(0, context.terrainDefBonus || 0)); // cap mitigation lower
  // Defenders in outposts get some resilience, but not enough to avoid bloodshed
  const outpostMitigation = context.outpost ? 0.95 : 1.0; // previously 0.85 (more mitigation); now closer to 1 (less mitigation)
  const rndA = 0.9 + Math.random() * 0.3; // 0.9–1.2
  const rndB = 0.9 + Math.random() * 0.3;

  let defCasualtyFrac: number;
  let atkCasualtyFrac: number;
  if (winner === 'attacker') {
    defCasualtyFrac = intensityBase * (1.0 + Math.min(1.0, ratio - 1) * 0.6) * terrainMitigation * outpostMitigation * rndA;
    atkCasualtyFrac = (intensityBase * 0.5) * (1.0 - Math.min(0.7, ratio - 1) * 0.5) * rndB;
  } else {
    atkCasualtyFrac = intensityBase * (1.0 + Math.min(1.0, (1/ratio) - 1) * 0.6) * rndA;
    defCasualtyFrac = (intensityBase * 0.5) * (1.0 - Math.min(0.7, (1/ratio) - 1) * 0.5) * terrainMitigation * outpostMitigation * rndB;
  }
  const atkLosses = Math.max(1, Math.min(attTroops, Math.floor(attTroops * atkCasualtyFrac)));
  const defLosses = Math.max(1, Math.min(defTroops, Math.floor(defTroops * defCasualtyFrac)));
  const atkWeaponsLoss = Math.min(attWeapons || 0, Math.floor(atkLosses * 0.5));
  const defWeaponsLoss = Math.min(defWeapons || 0, Math.floor(defLosses * 0.5));
  return { atkLosses, defLosses, atkWeaponsLoss, defWeaponsLoss };
}

