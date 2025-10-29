// Rebalanced combat casualty model for epic battles
export function computeCasualties(
  attTroops: number,
  attWeapons: number,
  defTroops: number,
  defWeapons: number,
  winner: 'attacker'|'defender',
  context: {
    terrainDefBonus: number,
    outpost?: boolean,
    homeBase?: boolean,
    // CRITICAL FIX: Accept final combat strengths (after all bonuses) for accurate casualty calculation
    finalAttackerStrength?: number,
    finalDefenderStrength?: number
  }
) {
  // CRITICAL FIX: Use final combat strengths if provided, otherwise calculate base strength
  // This ensures casualties are based on the ACTUAL battle outcome, not just raw troop counts
  let atkStrength: number;
  let defStrength: number;

  if (context.finalAttackerStrength !== undefined && context.finalDefenderStrength !== undefined) {
    // Use the final strengths that were actually used in combat resolution
    atkStrength = Math.max(1, context.finalAttackerStrength);
    defStrength = Math.max(1, context.finalDefenderStrength);
  } else {
    // Fallback to calculating base strength (for backwards compatibility)
    const effectiveAtkWeapons = Math.min(attWeapons || 0, attTroops * 2);
    const effectiveDefWeapons = Math.min(defWeapons || 0, defTroops * 2);
    atkStrength = Math.max(1, attTroops + effectiveAtkWeapons * 0.5);
    defStrength = Math.max(1, defTroops + effectiveDefWeapons * 0.5);
  }

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

    // CRITICAL FIX: For extremely lopsided battles, winner should lose almost nothing
    const strengthAdvantage = ratio - 1; // How much stronger the attacker is
    let casualtyReduction: number;

    if (strengthAdvantage > 50) {
      // For extreme advantages (>50:1), use exponential decay
      casualtyReduction = Math.min(0.999, 1.0 - (1.0 / Math.sqrt(strengthAdvantage)));
    } else {
      // For moderate advantages, use the original formula
      casualtyReduction = Math.min(0.8, strengthAdvantage * 0.6);
    }

    atkCasualtyFrac = (intensityBase * 0.4) * (1.0 - casualtyReduction) * rndB;
  } else {
    atkCasualtyFrac = intensityBase * (1.0 + Math.min(1.5, (1/ratio) - 1) * 0.8) * lopsidedBonus * rndA;

    // CRITICAL FIX: For extremely lopsided battles, winner should lose almost nothing
    // Use exponential decay for very large strength ratios instead of capping at 0.8
    const strengthAdvantage = (1/ratio) - 1; // How much stronger the defender is
    let casualtyReduction: number;

    if (strengthAdvantage > 50) {
      // For extreme advantages (>50:1), use exponential decay
      // This ensures casualties approach zero as strength advantage increases
      // Formula: reduction = 1 - (1 / (advantage^0.5))
      // Examples: 100:1 → 0.9, 1000:1 → 0.968, 10000:1 → 0.99
      casualtyReduction = Math.min(0.999, 1.0 - (1.0 / Math.sqrt(strengthAdvantage)));
    } else {
      // For moderate advantages, use the original formula
      casualtyReduction = Math.min(0.8, strengthAdvantage * 0.6);
    }

    defCasualtyFrac = (intensityBase * 0.4) * (1.0 - casualtyReduction) * terrainMitigation * outpostMitigation * homeBaseMitigation * rndB;
  }
  const atkLosses = Math.max(1, Math.min(attTroops, Math.floor(attTroops * atkCasualtyFrac)));
  const defLosses = Math.max(1, Math.min(defTroops, Math.floor(defTroops * defCasualtyFrac)));
  const atkWeaponsLoss = Math.min(attWeapons || 0, Math.floor(atkLosses * 0.5));
  const defWeaponsLoss = Math.min(defWeapons || 0, Math.floor(defLosses * 0.5));
  return { atkLosses, defLosses, atkWeaponsLoss, defWeaponsLoss };
}

