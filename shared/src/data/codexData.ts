import { TerrainType, POIType } from '../types';

export const TERRAIN_DESCRIPTIONS: Record<TerrainType, { description: string, modifiers: string }> = {
    [TerrainType.Plains]: {
        description: "Expansive, open grasslands. Easy to traverse but offer little cover.",
        modifiers: "Standard movement cost. Minor defensive penalties."
    },
    [TerrainType.Forest]: {
        description: "Dense woodlands that provide excellent cover and concealment.",
        modifiers: "Good source of Food. Provides a significant defensive bonus. Slightly increased movement attrition."
    },
    [TerrainType.Desert]: {
        description: "Scorching hot deserts with shifting sands. Survival is difficult.",
        modifiers: "Poor source of Food. High movement attrition. Can hide rare artifacts."
    },
    [TerrainType.Mountains]: {
        description: "Towering peaks and treacherous passes. Difficult to cross but highly defensible.",
        modifiers: "Very high movement attrition. Excellent defensive bonus. Good source of Scrap/minerals."
    },
    [TerrainType.Ruins]: {
        description: "The skeletal remains of an old-world city. A scavenger's paradise, but dangerous.",
        modifiers: "Good source of Scrap and occasional Technology. Offers a minor defensive bonus."
    },
    [TerrainType.Wasteland]: {
        description: "Barren, cracked earth offering little of value. The default state of the world.",
        modifiers: "Poor source of all resources. Standard movement cost."
    },
    [TerrainType.Water]: {
        description: "Large bodies of water, impassable by land units.",
        modifiers: "Cannot be entered or built upon."
    },
    [TerrainType.Radiation]: {
        description: "Areas glowing with a sickly green light. Highly dangerous to all organic life.",
        modifiers: "Causes constant attrition to any troops in the hex. Can contain rare technology or mutated resources."
    },
    [TerrainType.Crater]: {
        description: "The result of a massive, ancient impact. The crater has unearthed rare materials.",
        modifiers: "Good source of Scrap. Difficult terrain with a minor defensive bonus."
    },
    [TerrainType.Swamp]: {
        description: "Murky, bog-filled wetlands. Slow to move through and teeming with unseen dangers.",
        modifiers: "High movement attrition. Moderate defensive bonus. Can be a source of strange food."
    },
};

export const POI_DESCRIPTIONS: Record<POIType, string> = {
    [POIType.Scrapyard]: "A dumping ground for old-world technology. A reliable source of Scrap.",
    [POIType.FoodSource]: "An oasis of life, like a patch of hardy fruit trees or a stream with edible fish. Excellent for finding Food.",
    [POIType.WeaponsCache]: "A forgotten military bunker or police armory. A rare and valuable source for finding ready-made Weapons.",
    [POIType.ResearchLab]: "An old scientific outpost. Accelerates technology research conducted here and may contain technical documents.",
    [POIType.Settlement]: "A small, neutral community of survivors. Increases recruitment effectiveness in the nearby area.",
    [POIType.Outpost]: "A fortified structure built by a tribe. Provides visibility and a defensive bonus, but not as strong as a Home Base.",
    [POIType.Ruins]: "The crumbling remains of a pre-war structure. Excellent for Scavenging, particularly for Scrap.",
    [POIType.BanditCamp]: "A den of hostile raiders. They must be cleared out with an Attack action before the hex is safe. May hold loot.",
    [POIType.Mine]: "A pre-war mining operation. Provides a steady passive income of Scrap for the tribe that controls it.",
    [POIType.Vault]: "A heavily-fortified underground shelter. Extremely difficult to breach, but may contain immense treasures.",
    [POIType.Battlefield]: "The site of a major past conflict. A good place to salvage Weapons from the fallen.",
    [POIType.Factory]: "An automated pre-war manufacturing plant. Provides a large passive income of Scrap for the controlling tribe.",
    [POIType.Crater]: "A massive impact crater. Good for scavenging rare minerals and Scrap.",
    [POIType.Radiation]: "A zone of intense, persistent radiation. Lethal to occupy for long, but may hold unique artifacts."
};

export const ASSET_DESCRIPTIONS: Record<string, string> = {
    "Dune Buggy": "A fast, lightweight vehicle ideal for crossing open terrain quickly, though it offers little protection.",
    "Ghillie Mantle": "A camouflage cloak made of synthetic fibers and local flora, offering superb concealment in forests.",
    "Advanced Sonar": "A recovered piece of old-world tech that can detect dense scrap deposits deep underground.",
    "Hydro-Purifier": "A portable device that makes questionable water sources safe, drastically improving the success of finding food.",
    "Bunker Buster": "A heavy-duty explosive charge designed to breach fortified positions in urban environments.",
    "Junk-Forged Armor": "Layers of scrap metal and hardened leather, providing a baseline improvement to troop survivability.",
    "Whetstone": "A simple but effective tool for keeping blades sharp, ensuring every strike counts.",
    "Seed Vault": "A collection of pre-war seeds, genetically engineered for resilience. Provides a small, steady supply of food.",
    "Scrap Compressor": "An automated hydraulic press that compacts loose junk into usable scrap plates.",
    "Mountaineering Gear": "Picks, ropes, and climbing harnesses that allow for aggressive maneuvers in treacherous mountain terrain.",
    "Swamp Skiff": "A flat-bottomed boat perfect for navigating murky bogs, allowing for better defensive positioning.",
    "Desert Cloaks": "Flowing robes that provide protection from the sun and sand, helping troops blend into the desert landscape.",
    "Barbed Wire": "Spools of rusted, sharp wire, perfect for creating defensive perimeters in open plains.",
    "Ambush Netting": "Lightweight nets that can be quickly deployed from treetops, entangling enemies in forest ambushes.",
    "Scrap Cannon": "A crude but effective projectile launcher, deadly when used in the open badlands.",
    "Radiation Suit": "A lead-lined suit that offers some protection against hazardous environments.",
    "Scout's Medkit": "A pouch containing bandages, herbal remedies, and stimulants, increasing the amount of foraged food.",
    "Masterwork Tools": "A set of high-quality pre-war tools, invaluable for salvaging and repairing complex weapon systems.",
    "Ballistic Shields": "Heavy shields made from repurposed vehicle armor, excellent for defending fortified positions in ruins.",
    "Ratchet Set": "A complete set of wrenches and ratchets, making the disassembly of junk for scrap far more efficient."
};