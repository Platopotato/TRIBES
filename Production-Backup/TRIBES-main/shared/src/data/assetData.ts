import { TechnologyEffect, TechnologyEffectType, TerrainType, GameAsset } from '../types.js';

export const ALL_ASSETS: GameAsset[] = [
    {
        name: "Dune_Buggy",
        description: "A fast, lightweight vehicle ideal for crossing open terrain quickly, though it offers little protection.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/dune_buggy.gif",
        effects: [
            { type: TechnologyEffectType.MovementSpeedBonus, value: 0.20 },
            { type: TechnologyEffectType.CombatBonusDefense, value: -0.10, terrain: TerrainType.Plains },
            { type: TechnologyEffectType.CombatBonusDefense, value: -0.10, terrain: TerrainType.Desert },
        ]
    },
    {
        name: "Ghillie_Mantle",
        description: "A camouflage cloak made of synthetic fibers and local flora, offering superb concealment in forests.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/ghillie_mantle.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusDefense, value: 0.25, terrain: TerrainType.Forest }
        ]
    },
    {
        name: "Advanced_Sonar",
        description: "A recovered piece of old-world tech that can detect dense scrap deposits deep underground.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/advanced_sonar.gif",
        effects: [
            { type: TechnologyEffectType.ScavengeYieldBonus, value: 0.20, resource: 'Scrap' }
        ]
    },
    {
        name: "Hydro_Purifier",
        description: "A portable device that makes questionable water sources safe, drastically improving the success of finding food.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/hydro_purifier.gif",
        effects: [
            { type: TechnologyEffectType.ScavengeYieldBonus, value: 0.20, resource: 'Food' }
        ]
    },
    {
        name: "Bunker_Buster",
        description: "A heavy-duty explosive charge designed to breach fortified positions in urban environments.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/bunker_buster.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusAttack, value: 0.25, terrain: TerrainType.Ruins }
        ]
    },
    {
        name: "Junk_Forged_Armor",
        description: "Layers of scrap metal and hardened leather, providing a baseline improvement to troop survivability.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/junk_forged_armor.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusDefense, value: 0.05 }
        ]
    },
    {
        name: "Whetstone",
        description: "A simple but effective tool for keeping blades sharp, ensuring every strike counts.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/whetstone.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusAttack, value: 0.05 }
        ]
    },
    {
        name: "Seed_Vault",
        description: "A collection of pre-war seeds, genetically engineered for resilience. Provides a small, steady supply of food.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/seed_vault.gif",
        effects: [
            { type: TechnologyEffectType.PassiveFoodGeneration, value: 5 }
        ]
    },
    {
        name: "Scrap_Compressor",
        description: "An automated hydraulic press that compacts loose junk into usable scrap plates.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/scrap_compressor.gif",
        effects: [
            { type: TechnologyEffectType.PassiveScrapGeneration, value: 5 }
        ]
    },
    {
        name: "Mountaineering_Gear",
        description: "Picks, ropes, and climbing harnesses that allow for aggressive maneuvers in treacherous mountain terrain.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/mountaineering_gear.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusAttack, value: 0.20, terrain: TerrainType.Mountains }
        ]
    },
    {
        name: "Swamp_Skiff",
        description: "A flat-bottomed boat perfect for navigating murky bogs, allowing for better defensive positioning.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/swamp_skiff.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusDefense, value: 0.20, terrain: TerrainType.Swamp }
        ]
    },
    {
        name: "Desert_Cloaks",
        description: "Flowing robes that provide protection from the sun and sand, helping troops blend into the desert landscape.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/desert_cloaks.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusDefense, value: 0.20, terrain: TerrainType.Desert }
        ]
    },
    {
        name: "Barbed_Wire",
        description: "Spools of rusted, sharp wire, perfect for creating defensive perimeters in open plains.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/barbed_wire.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusDefense, value: 0.20, terrain: TerrainType.Plains }
        ]
    },
    {
        name: "Ambush_Netting",
        description: "Lightweight nets that can be quickly deployed from treetops, entangling enemies in forest ambushes.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/ambush_netting.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusAttack, value: 0.20, terrain: TerrainType.Forest }
        ]
    },
    {
        name: "Scrap_Cannon",
        description: "A crude but effective projectile launcher, deadly when used in the open badlands.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/scrap_cannon.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusAttack, value: 0.20, terrain: TerrainType.Wasteland }
        ]
    },
    {
        name: "Radiation_Suit",
        description: "A lead-lined suit that offers some protection against hazardous environments.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/radiation_suit.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusDefense, value: 0.25, terrain: TerrainType.Radiation }
        ]
    },
    {
        name: "Scouts_Medkit",
        description: "A pouch containing bandages, herbal remedies, and stimulants, increasing the amount of foraged food.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/scouts_medkit.gif",
        effects: [
            { type: TechnologyEffectType.ScavengeYieldBonus, value: 0.15, resource: 'Food' }
        ]
    },
    {
        name: "Masterwork_Tools",
        description: "A set of high-quality pre-war tools, invaluable for salvaging and repairing complex weapon systems.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/masterwork_tools.gif",
        effects: [
            { type: TechnologyEffectType.ScavengeYieldBonus, value: 0.15, resource: 'Weapons' }
        ]
    },
    {
        name: "Ballistic_Shields",
        description: "Heavy shields made from repurposed vehicle armor, excellent for defending fortified positions in ruins.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/ballistic_shields.gif",
        effects: [
            { type: TechnologyEffectType.CombatBonusDefense, value: 0.10, terrain: TerrainType.Ruins }
        ]
    },
    {
        name: "Ratchet_Set",
        description: "A complete set of wrenches and ratchets, making the disassembly of junk for scrap far more efficient.",
        key_image_url: "https://www.platopotato.com/NFT/Tribes/assets/ratchet_set.gif",
        effects: [
            { type: TechnologyEffectType.ScavengeYieldBonus, value: 0.15, resource: 'Scrap' }
        ]
    }
];

export function getAsset(assetName: string): GameAsset | undefined {
    return ALL_ASSETS.find(a => a.name === assetName);
}