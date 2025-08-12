// Rebalanced combat casualty model for epic battles
export function computeCasualties(attTroops: number, attWeapons: number, defTroops: number, defWeapons: number, winner: 'attacker'|'defender', context: { terrainDefBonus: number, outpost?: boolean, homeBase?: boolean }) {
  // Weapons provide multiplicative advantage (each weapon = 1.5 troops in combat effectiveness)
  const atkStrength = Math.max(1, attTroops + (attWeapons || 0) * 1.5);
  const defStrength = Math.max(1, defTroops + (defWeapons || 0) * 1.5);
  const ratio = atkStrength / defStrength; // >1 favors attacker
  const nearParity = Math.max(0, 1 - Math.abs(1 - ratio)); // 1 when equal, 0 when very lopsided
  // Higher base lethality for more epic battles
  const intensityBase = 0.45 + (0.25 * nearParity); // 45%–70% (increased from 35-60%)
  const terrainMitigation = 1 - Math.min(0.15, Math.max(0, context.terrainDefBonus || 0)); // slightly less mitigation
  // Outposts increase casualties (more brutal fighting), not reduce them
  const outpostMitigation = context.outpost ? 0.85 : 1.0; // outposts = more casualties (was 0.95)
  // Home bases increase casualties even more (desperate fighting)
  const homeBaseMitigation = context.homeBase ? 0.8 : 1.0; // home bases = even more casualties
  const rndA = 0.95 + Math.random() * 0.1; // 0.95–1.05 (reduced variance for more predictable outcomes)
  const rndB = 0.95 + Math.random() * 0.1;

  let defCasualtyFrac: number;
  let atkCasualtyFrac: number;

  // For very lopsided battles (>4:1), make casualties more decisive
  const isLopsided = ratio > 4.0 || ratio < 0.25;
  const lopsidedBonus = isLopsided ? 1.3 : 1.0; // +30% casualties for overwhelming victories

  if (winner === 'attacker') {
    defCasualtyFrac = intensityBase * (1.0 + Math.min(1.5, ratio - 1) * 0.8) * terrainMitigation * outpostMitigation * homeBaseMitigation * lopsidedBonus * rndA;
    atkCasualtyFrac = (intensityBase * 0.4) * (1.0 - Math.min(0.8, ratio - 1) * 0.6) * rndB;
  } else {
    atkCasualtyFrac = intensityBase * (1.0 + Math.min(1.5, (1/ratio) - 1) * 0.8) * lopsidedBonus * rndA;
    defCasualtyFrac = (intensityBase * 0.4) * (1.0 - Math.min(0.8, (1/ratio) - 1) * 0.6) * terrainMitigation * outpostMitigation * homeBaseMitigation * rndB;
  }
  const atkLosses = Math.max(1, Math.min(attTroops, Math.floor(attTroops * atkCasualtyFrac)));
  const defLosses = Math.max(1, Math.min(defTroops, Math.floor(defTroops * defCasualtyFrac)));
  const atkWeaponsLoss = Math.min(attWeapons || 0, Math.floor(atkLosses * 0.5));
  const defWeaponsLoss = Math.min(defWeapons || 0, Math.floor(defLosses * 0.5));
  return { atkLosses, defLosses, atkWeaponsLoss, defWeaponsLoss };
}

