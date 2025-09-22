
import React, { useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';

interface HelpModalProps {
  onClose: () => void;
  isOpen?: boolean;
  isDesktopWindow?: boolean;
}

type HelpTab = 'rules' | 'ui' | 'actions' | 'research' | 'combat' | 'diplomacy' | 'resources' | 'poi' | 'outposts' | 'sabotage' | 'tips';

const TabButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-lg font-bold rounded-t-md transition-colors duration-200 focus:outline-none ${
        isActive
          ? 'bg-neutral-800 text-amber-400'
          : 'bg-neutral-900 text-slate-400 hover:bg-neutral-800 hover:text-amber-500'
      }`}
    >
      {label}
    </button>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-6">
    <h4 className="text-xl font-bold text-amber-400 border-b-2 border-amber-500/50 pb-1 mb-3">{title}</h4>
    <div className="space-y-2 text-slate-300">{children}</div>
  </div>
);

const GameRulesContent: React.FC = () => (
    <>
        <Section title="The Turn Cycle">
            <p>This game runs on a turn-based system, managed automatically by the game server.</p>
             <ul className="list-disc list-inside space-y-2 pl-4">
                <li><strong className="text-white">1. Planning Phase:</strong> This is where you play! Assign actions to your tribe. When you're done, click "Finalize Actions". Your status will change to "Waiting".</li>
                <li><strong className="text-white">2. Admin Processing:</strong> Once all players have submitted their turns, the Admin will click "Process Turn" in the Admin Panel. This tells the server to calculate the results for all tribes.</li>
                <li><strong className="text-white">3. Automatic Update:</strong> After the Admin processes the turn, the game will automatically update for you. You don't need to do anything. The "Waiting" screen will be replaced by the results of the previous turn.</li>
                <li><strong className="text-white">4. Results Phase:</strong> Review the outcome of your actions and start planning your next turn!</li>
            </ul>
        </Section>
        <Section title="Diplomacy">
            <p>Diplomacy is managed through the turn-based action system. Use "Add New Action" → "Diplomacy" to plan diplomatic actions.</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
                 <li><strong className="text-white">Turn-Based System:</strong> All diplomatic actions are planned during your turn and executed when you finalize.</li>
                 <li><strong className="text-blue-400">Propose Alliance:</strong> Send alliance proposals to neutral tribes. They have 3 turns to accept or reject.</li>
                 <li><strong className="text-green-400">Alliance Benefits:</strong> Allies share vision and cannot attack each other.</li>
                 <li><strong className="text-red-400">Declare War:</strong> Enables attacks and changes diplomatic status to War.</li>
                 <li><strong className="text-yellow-400">Sue for Peace:</strong> Offer reparations to end wars and return to neutral status.</li>
                 <li><strong className="text-purple-400">End Alliance:</strong> Cancel existing alliances and return to neutral status.</li>
            </ul>
        </Section>
        <Section title="Journeys & Travel Time">
            <p>Actions involving travel now use the <strong className="text-white">Journey</strong> system, which has two speeds:</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
                <li><strong className="text-white">Fast-Track Travel:</strong> Very short, non-aggressive journeys (e.g., Move, Scavenge, Scout to a nearby hex) are now resolved <strong className="text-amber-400">instantly</strong> during turn processing. A quick scavenge run will see your troops return with loot, ready for your next turn, all in one go.</li>
                <li><strong className="text-white">Standard Journeys:</strong> Longer journeys and all <strong className="text-red-400">Attack</strong> actions will always take at least one turn. These are dispatched as traveling groups that you can see on the map and track in the "Active Journeys" panel. This preserves the strategic warning for attacks.</li>
                <li>When planning, the game will still show you an <strong className="text-white">Estimated Travel Time</strong>. If the action can be fast-tracked, it will resolve immediately.</li>
            </ul>
        </Section>
         <Section title="Trade">
            <p>Trading is handled through the journey system. It's a multi-turn process involving risk and player interaction.</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
                <li><strong className="text-white">Dispatch:</strong> You send a `Trade` caravan. It will travel to the target, which may take several turns.</li>
                <li><strong className="text-white">Arrival & Decision:</strong> When your caravan arrives, it enters a "waiting" state. The receiving player will see your offer in their "Pending Trade Offers" panel and has two turns to respond.</li>
                <li><strong className="text-white">The Return Journey:</strong> Once a decision is made (or the offer expires), a return journey is automatically created. This also takes time.</li>
                <li><strong className="text-white">Arrival Home:</strong> When the caravan returns, the goods and surviving guards are added back to your tribe.</li>
            </ul>
        </Section>
        <Section title="Resources & Stats">
            <ul className="list-disc list-inside space-y-1 pl-4">
                <li><strong className="text-white">Troops:</strong> Your population. Needed for all actions and for defense. Consume food each turn.</li>
                <li><strong className="text-white">Weapons:</strong> Boost your combat power in attacks and defense.</li>
                <li><strong className="text-white">Food:</strong> A global resource used to feed troops and recruit new ones. If you run out, troops will starve and morale will plummet.</li>
                <li><strong className="text-white">Scrap:</strong> A global resource used for building weapons, outposts, and researching technology.</li>
                <li><strong className="text-white">Morale:</strong> Your tribe's happiness. Low morale can lead to desertions. Affected by food rations and combat outcomes.</li>
                <li><strong className="text-white">Rations:</strong> Set the food consumption rate. Generous rations boost morale but use more food, while Hard rations save food at the cost of morale.</li>
            </ul>
        </Section>
         <Section title="Combat">
            <p>When an attacking journey arrives at a destination with an enemy, combat is resolved. Both sides' power is calculated based on several factors:</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
                <li>Number of <strong className="text-white">Troops</strong>.</li>
                <li>Number of <strong className="text-white">Weapons</strong> (relative to troop count).</li>
                <li>Tribe and Chief <strong className="text-white">Strength</strong> stats.</li>
                <li>Completed <strong className="text-white">Technologies</strong>.</li>
                <li>For the defender: <strong className="text-white">Terrain</strong> bonuses, <strong className="text-white">Fortifications</strong> (Home Base or Outpost), and a <code className="bg-slate-900 p-1 rounded">Defend</code> action bonus.</li>
            </ul>
             <p className="mt-2">If you attack a hex an enemy is moving <strong className="text-white">from</strong> in the same turn, you will <strong className="text-white">intercept</strong> them. Intercepted forces do not get any terrain or fortification bonuses.</p>
        </Section>
        <Section title="Technology & Chiefs">
             <p><strong className="text-white">Technology:</strong> Unlocks permanent bonuses for your tribe. To research, you must assign troops from a garrison. Progress is made each turn. Some POIs (like Research Labs) can speed this up.</p>
             <p><strong className="text-white">Chiefs:</strong> Powerful unique units with their own stats. They add to your max action limit, participate in actions to provide bonuses, and are acquired by owning the corresponding NFT and submitting a request for admin approval.</p>
        </Section>
    </>
);

const UIGuideContent: React.FC = () => (
    <>
        <Section title="Header">
            <p>Located at the top. Shows your Tribe Name, Leader, and Icon. On the right, you'll find the current Turn number, Game Phase, and buttons for Help, Admin Panel (if you're an admin), and Logout.</p>
        </Section>
        <Section title="Wasteland Map">
            <p>Your view into the world. You can pan by clicking and dragging, and zoom with the mouse wheel or the +/- buttons.</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
                <li><strong className="text-white">Fog of War:</strong> Darkened hexes are unexplored. Grayed-out hexes have been explored but are not currently in your line of sight.</li>
                <li><strong className="text-white">Influence:</strong> The green overlay shows the area currently visible to your garrisons and those of your allies. Enemy units inside this zone are visible to you.</li>
                <li><strong className="text-white">Garrison & Journey Icons:</strong> You'll see icons for POIs, your garrisons (green), enemy garrisons (red), allied garrisons (blue), and smaller icons for your forces that are currently on a journey.</li>
                <li><strong className="text-white">Selection Mode:</strong> When an action requires you to select a hex on the map, the map border will glow amber.</li>
            </ul>
        </Section>
        <Section title="Right-Side Panels">
            <ul className="list-disc list-inside space-y-1 pl-4">
                <li><strong className="text-white">Resource Panel:</strong> An at-a-glance summary of your tribe's total troops, weapons, and global resources like food, scrap, and morale.</li>
                <li><strong className="text-white">Tribe Attributes:</strong> Displays your tribe's four core stats.</li>
                <li><strong className="text-white">Turn Actions Panel:</strong> This is where you manage your turn. Add new actions, review planned actions, and finalize your turn when ready.</li>
                <li><strong className="text-white">Pending Trade Offers:</strong> Appears when you have incoming trade offers to respond to.</li>
                <li><strong className="text-white">Active Journeys Panel:</strong> A new panel that shows all of your groups currently traveling across the map, including their destination and ETA.</li>
                 <li><strong className="text-white">Diplomacy Panel:</strong> A new panel to manage your relations with other tribes. View current statuses, propose alliances, declare war, and respond to incoming proposals.</li>
                 <li><strong className="text-white">Technology & Chiefs Panels:</strong> Manage your research and chiefs from these panels.</li>
            </ul>
        </Section>
        <Section title="Modals">
            <p>Modals are pop-up windows for specific tasks.</p>
             <ul className="list-disc list-inside space-y-1 pl-4">
                <li><strong className="text-white">Action Modal:</strong> Opens when you click "Add Action". For actions that require travel, it will now show you an "Estimated Travel Time".</li>
                <li><strong className="text-white">Tech Tree Modal:</strong> Shows all available technologies and allows you to start a new research project.</li>
                 <li><strong className="text-white">Confirmation Modal:</strong> Appears to ask you to confirm important decisions, like finalizing your turn.</li>
            </ul>
        </Section>
    </>
);


const ActionsGuideContent: React.FC = () => (
  <>
    <Section title="Movement & Exploration">
      <p><strong className="text-white">Journey:</strong> Move troops and chiefs to explore new territories. Success depends on distance, terrain, and troop count.</p>

      <p><strong className="text-white">Scavenge:</strong> Search locations for resources. Different terrains and POIs yield different materials:</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>Cities:</strong> High scrap and weapons, some food</li>
        <li><strong>Forests:</strong> Abundant food, limited scrap</li>
        <li><strong>Mountains:</strong> Rich in scrap and weapons</li>
        <li><strong>Wasteland:</strong> Minimal resources, high risk</li>
        <li><strong>POIs:</strong> Bonus resources related to POI type (farms give extra food, factories give extra scrap)</li>
      </ul>

      <p><strong className="text-white">🚫 Scavenging Restrictions:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>Garrison Conflict:</strong> Cannot scavenge at locations where you already have a garrison stationed</li>
        <li><strong>Resource Overlap:</strong> Stationed troops already gather resources automatically from POIs</li>
        <li><strong>Strategic Choice:</strong> Either station troops for passive income OR scavenge for immediate resources</li>
      </ul>

      <p><strong className="text-white">Note:</strong> Scavenging at POIs provides immediate resources plus the ongoing income from controlling them.</p>
    </Section>

    <Section title="Military Actions">
      <p><strong className="text-white">Attack:</strong> Assault enemy garrisons. Success depends on troop numbers, weapons, terrain, and technology bonuses.</p>
      <p><strong className="text-white">Sabotage:</strong> Covert operations with multiple mission types:</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>🔍 Intelligence Gathering:</strong> Learn about enemy forces and resources</li>
        <li><strong>💥 Sabotage Outpost:</strong> Disable enemy defenses for 2 turns</li>
        <li><strong>☠️ Poison Supplies:</strong> Weaken enemy troops for 3 turns</li>
        <li><strong>💰 Steal Resources:</strong> Take enemy resources</li>
        <li><strong>🔥 Destroy Resources:</strong> Permanently destroy enemy stockpiles</li>
        <li><strong>📚 Steal/Destroy Research:</strong> Target enemy technology progress</li>
      </ul>
    </Section>

    <Section title="Economic Actions">
      <p><strong className="text-white">Recruit:</strong> Train new troops using food. Cost varies by technology and garrison size.</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>Base Cost:</strong> 5 food per troop recruited</li>
        <li><strong>Scaling Cost:</strong> Increases with existing garrison size</li>
        <li><strong>Technology Bonuses:</strong> Various techs reduce recruitment costs</li>
        <li><strong>Settlement Bonus:</strong> POI provides recruitment efficiency boost</li>
      </ul>

      <p><strong className="text-white">Produce Weapons:</strong> Convert scrap into weapons for combat effectiveness.</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>Base Cost:</strong> 10 scrap per weapon produced</li>
        <li><strong>Technology Bonuses:</strong> Various techs reduce production costs</li>
        <li><strong>Strategic Value:</strong> Weapons multiply combat effectiveness significantly</li>
      </ul>

      <p><strong className="text-white">Trade:</strong> Exchange resources with other tribes through journey system.</p>
    </Section>

    <Section title="Sabotage Success Rates">
      <p><strong className="text-white">Base Success:</strong> 60%</p>
      <p><strong className="text-white">Bonuses:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Operatives: +5% each (max +30% at 6+ operatives)</li>
        <li>Chiefs: +15% each (no limit)</li>
        <li>Spy Networks tech: +25%</li>
        <li>Siege Warfare tech: +20%</li>
      </ul>
      <p><strong className="text-white">Penalties:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Distance: -5% per hex (max -40%)</li>
        <li>Enemy Counter-Intelligence: -30%</li>
      </ul>
    </Section>
  </>
);

const ResearchGuideContent: React.FC = () => (
  <>
    <Section title="Technology System">
      <p>Research unlocks powerful bonuses and new capabilities. Each technology requires specific resources and research points.</p>
      <p><strong className="text-white">Research Process:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Assign troops to research at a garrison</li>
        <li>Pay the required scrap cost upfront</li>
        <li>Research progresses each turn based on assigned troops</li>
        <li>Bonus: +25% speed with Scientific Method, +35% with Advanced Labs, +50% with Quantum Computing</li>
      </ul>
    </Section>

    <Section title="Technology Categories">
      <p><strong className="text-white">🌱 Farming:</strong> Passive food generation (+10/+15/+25 per turn)</p>
      <p><strong className="text-white">⚡ Energy:</strong> Passive scrap generation (+8/+12/+25 per turn)</p>
      <p><strong className="text-white">⚔️ Combat:</strong> Attack and defense bonuses (+5% to +40%)</p>
      <p><strong className="text-white">🔍 Scavenging:</strong> Improved resource yields (+10% to +40%)</p>
      <p><strong className="text-white">🏥 Medicine:</strong> Reduced recruitment costs, morale bonuses</p>
      <p><strong className="text-white">⚙️ Engineering:</strong> Weapon production bonuses (+20% to +30%)</p>
      <p><strong className="text-white">🕵️ Intelligence:</strong> Sabotage effectiveness and resistance</p>
      <p><strong className="text-white">🚗 Transportation:</strong> Movement speed bonuses (+15% to +50%)</p>
      <p><strong className="text-white">🔬 Research:</strong> Faster technology development</p>
      <p><strong className="text-white">💰 Economics:</strong> Trade bonuses and resource capacity</p>
      <p><strong className="text-white">🏺 Archaeology:</strong> Advanced scavenging and ancient knowledge</p>
    </Section>

    <Section title="Technology Effects">
      <p><strong className="text-white">Passive Generation:</strong> Food and scrap technologies provide resources every turn automatically.</p>
      <p><strong className="text-white">Combat Bonuses:</strong> Apply to all attacks and defenses, stack with multiple technologies.</p>
      <p><strong className="text-white">Efficiency Bonuses:</strong> Reduce costs or increase yields for various actions.</p>
      <p><strong className="text-white">Special Abilities:</strong> Unlock new action types or improve existing ones.</p>
    </Section>
  </>
);

const CombatGuideContent: React.FC = () => (
  <>
    <Section title="Combat Mechanics">
      <p>Combat success depends on multiple factors that determine the outcome of battles.</p>
      <p><strong className="text-white">Attack Strength Calculation:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Base: Troops × (1 + Weapons/Troops ratio)</li>
        <li>Technology bonuses (e.g., +15% from Composite Bows)</li>
        <li>Terrain bonuses (e.g., +15% Forest attack from Guerrilla Tactics)</li>
        <li>Chief bonuses and special abilities</li>
      </ul>
    </Section>

    <Section title="Defense Mechanics">
      <p><strong className="text-white">Defense Strength:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Base: Defending troops × weapons ratio</li>
        <li>Outpost bonus: +50% defense if outpost present</li>
        <li>Technology bonuses (e.g., +15% from Reinforced Concrete)</li>
        <li>Terrain bonuses (e.g., +10% Mountain defense from Guerrilla Tactics)</li>
        <li>Sabotage effects: Disabled outposts provide no bonus</li>
      </ul>
    </Section>

    <Section title="Combat Resolution">
      <p><strong className="text-white">Victory Conditions:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Attacker wins if Attack Strength &gt; Defense Strength</li>
        <li>Casualties are calculated based on strength difference</li>
        <li>Winner takes control of the location</li>
        <li>Loser's surviving forces retreat to nearest friendly garrison</li>
      </ul>
    </Section>

    <Section title="Special Combat Effects">
      <p><strong className="text-white">Poisoned Troops:</strong> Reduced combat effectiveness for 3 turns</p>
      <p><strong className="text-white">Sabotaged Outposts:</strong> No defensive bonus for 2 turns</p>
      <p><strong className="text-white">Chief Abilities:</strong> Some chiefs provide combat bonuses or special effects</p>
    </Section>
  </>
);

const DiplomacyGuideContent: React.FC = () => (
  <>
    <Section title="Turn-Based Diplomacy System">
      <p>Diplomacy in Radix Tribes uses a turn-based action system where all diplomatic actions are planned during your turn and executed when you finalize.</p>
      <p><strong className="text-white">How to Use Diplomacy:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>1. Add Action:</strong> Click "Add New Action" in your Dashboard</li>
        <li><strong>2. Select Diplomacy:</strong> Choose "Diplomacy" from the action types</li>
        <li><strong>3. Choose Sub-Action:</strong> Select specific diplomatic action (Alliance, War, Peace, etc.)</li>
        <li><strong>4. Select Target:</strong> Choose which tribe to interact with</li>
        <li><strong>5. Finalize Turn:</strong> Action executes when you submit your turn</li>
      </ul>
      <p><strong className="text-white">View Status:</strong> Use the 🤝 Diplomacy panel to view current relationships and incoming proposals.</p>
    </Section>

    <Section title="Diplomatic Statuses">
      <p><strong className="text-white">Three main diplomatic relationships:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>⚖️ Neutral:</strong> Default state - can propose alliances or declare war</li>
        <li><strong>🤝 Alliance:</strong> Mutual cooperation with shared vision and protection</li>
        <li><strong>⚔️ War:</strong> Open hostilities - can attack each other's territories</li>
      </ul>
    </Section>

    <Section title="Available Diplomatic Actions">
      <p><strong className="text-white">🤝 Propose Alliance (Neutral → Alliance):</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Send alliance proposal to neutral tribes</li>
        <li>Target tribe has 3 turns to accept or reject</li>
        <li>Creates formal alliance with shared benefits</li>
        <li>Proposal expires automatically if not responded to</li>
      </ul>

      <p><strong className="text-white">⚔️ Declare War (Neutral → War):</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Immediately changes status to War</li>
        <li>Enables attack actions against target tribe</li>
        <li>No proposal system - takes effect immediately</li>
        <li>Opens path for future peace negotiations</li>
      </ul>
    </Section>

    <Section title="Alliance Benefits">
      <p><strong className="text-white">When you have an alliance with another tribe:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>🛡️ Mutual Protection:</strong> Cannot attack each other's territories</li>
        <li><strong>👁️ Shared Vision:</strong> See allied garrisons and their influence zones on the map</li>
        <li><strong>🤝 Coordination:</strong> Plan joint strategies and coordinate movements</li>
        <li><strong>📍 Safe Passage:</strong> Move through allied territory without conflict</li>
      </ul>

      <p><strong className="text-white">💔 End Alliance (Alliance → Neutral):</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Cancel existing alliance and return to neutral status</li>
        <li>Takes effect immediately when turn is processed</li>
        <li>Removes shared vision and mutual protection</li>
        <li>Allows future war declarations or new alliance proposals</li>
      </ul>
    </Section>

    <Section title="War Status & Peace Negotiations">
      <p><strong className="text-white">War Status Effects:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>⚔️ Combat Enabled:</strong> Can attack enemy garrisons and territories</li>
        <li><strong>🎯 Sabotage Available:</strong> All sabotage operations become possible</li>
        <li><strong>🚫 No Cooperation:</strong> Cannot form alliances while at war</li>
        <li><strong>💰 Resource Drain:</strong> Wars consume resources through conflict</li>
      </ul>

      <p><strong className="text-white">🕊️ Sue for Peace (War → Neutral):</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Offer reparations to end war and return to neutral status</li>
        <li>Specify food, scrap, and weapons to offer as compensation</li>
        <li>Target tribe can accept or reject the peace proposal</li>
        <li>Proposal expires in 3 turns if not responded to</li>
        <li>Successful peace negotiations end hostilities immediately</li>
      </ul>
    </Section>

    <Section title="Alliance Vision Sharing">
      <p><strong className="text-white">🗺️ Shared Vision:</strong> Alliances automatically provide shared vision benefits.</p>

      <p><strong className="text-white">What You Share with Allies:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>👁️ Garrison Vision:</strong> Allies can see your garrisons on the map</li>
        <li><strong>🌍 Influence Zones:</strong> Allies see your territory control areas</li>
        <li><strong>🎯 Enemy Detection:</strong> Enemies spotted by your forces are visible to allies</li>
        <li><strong>📍 Strategic Coordination:</strong> Plan joint operations with shared intelligence</li>
      </ul>

      <p><strong className="text-white">Alliance Vision Benefits:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Improved situational awareness across allied territories</li>
        <li>Early warning system for enemy movements</li>
        <li>Better coordination for joint military operations</li>
        <li>Shared intelligence for strategic planning</li>
      </ul>
    </Section>

    <Section title="Proposal System">
      <p><strong className="text-white">How Proposals Work:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>📤 Outgoing:</strong> Alliance and peace proposals you send to other tribes</li>
        <li><strong>📥 Incoming:</strong> Proposals other tribes send to you</li>
        <li><strong>⏰ Expiration:</strong> All proposals expire in 3 turns if not responded to</li>
        <li><strong>👁️ Visibility:</strong> View all proposals in the Diplomacy panel</li>
      </ul>

      <p><strong className="text-white">Responding to Proposals:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>✅ Accept:</strong> Approve the proposal - status changes immediately</li>
        <li><strong>❌ Reject:</strong> Decline the proposal - returns to previous status</li>
        <li><strong>⏳ Ignore:</strong> Let proposal expire automatically after 3 turns</li>
        <li><strong>📊 Tracking:</strong> See proposal details including reparations offered</li>
      </ul>
    </Section>

    <Section title="Diplomatic Strategy Tips">
      <p><strong className="text-white">Early Game Strategy:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>🤝 Secure Alliances:</strong> Form alliances early for mutual protection and shared vision</li>
        <li><strong>🛡️ Avoid Early Wars:</strong> Focus on expansion and resource gathering before conflicts</li>
        <li><strong>👁️ Use Shared Vision:</strong> Leverage allied intelligence for safer exploration</li>
      </ul>

      <p><strong className="text-white">Mid-Late Game Strategy:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>⚔️ Strategic Wars:</strong> Declare war only when you have clear military advantage</li>
        <li><strong>🕊️ Peace Negotiations:</strong> Offer generous reparations to end costly wars quickly</li>
        <li><strong>💔 Alliance Management:</strong> End alliances when they no longer serve your interests</li>
        <li><strong>🎯 Timing:</strong> Plan diplomatic actions to coincide with military campaigns</li>
      </ul>

      <p><strong className="text-white">Advanced Tips:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Use diplomacy actions as part of your overall turn strategy</li>
        <li>Monitor proposal expiration times to avoid missed opportunities</li>
        <li>Coordinate with allies before major military operations</li>
        <li>Consider offering peace before enemies become too powerful</li>
      </ul>
    </Section>
  </>
);

const ResourcesGuideContent: React.FC = () => (
  <>
    <Section title="Resource Types">
      <p><strong className="text-white">🍖 Food:</strong> Essential for troop upkeep and recruitment</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Consumed each turn: 1 food per troop + 3 per chief</li>
        <li>Ration levels affect morale and consumption</li>
        <li>Generated by farming technologies and scavenging</li>
      </ul>

      <p><strong className="text-white">🔧 Scrap:</strong> Used for technology research and weapon production</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Required for all technology research</li>
        <li>Converted to weapons at 1:1 ratio</li>
        <li>Generated by energy technologies and scavenging</li>
      </ul>

      <p><strong className="text-white">⚔️ Weapons:</strong> Improve combat effectiveness</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Increase attack and defense strength</li>
        <li>Produced from scrap using Produce Weapons action</li>
        <li>Found through scavenging in cities and mountains</li>
      </ul>

      <p><strong className="text-white">😊 Morale:</strong> Affects tribe efficiency and stability</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Affected by food availability and ration levels</li>
        <li>Low morale reduces action effectiveness</li>
        <li>Improved by medical technologies and good management</li>
      </ul>
    </Section>

    <Section title="Resource Management">
      <p><strong className="text-white">Ration Levels:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>Feast:</strong> +2 morale, 150% food consumption</li>
        <li><strong>Normal:</strong> No morale change, 100% food consumption</li>
        <li><strong>Reduced:</strong> -1 morale, 75% food consumption</li>
        <li><strong>Starvation:</strong> -3 morale, 50% food consumption</li>
      </ul>
    </Section>

    <Section title="Resource Generation">
      <p><strong className="text-white">Passive Generation:</strong> Technologies provide automatic resources each turn</p>
      <p><strong className="text-white">Active Generation:</strong> Scavenging and trading provide immediate resources</p>
      <p><strong className="text-white">POI Income:</strong> Controlled Points of Interest provide regular resource income</p>
    </Section>
  </>
);

const TipsGuideContent: React.FC = () => (
  <>
    <Section title="Early Game Strategy">
      <ul className="list-disc list-inside space-y-2 pl-4">
        <li><strong className="text-white">Explore First:</strong> Send small expeditions to map nearby territories and find resources</li>
        <li><strong className="text-white">Secure Food:</strong> Research Basic Farming early for passive food generation</li>
        <li><strong className="text-white">Build Outposts:</strong> Establish defensive positions at strategic locations</li>
        <li><strong className="text-white">Recruit Steadily:</strong> Maintain a growing army but don't overextend your food supply</li>
      </ul>
    </Section>

    <Section title="Technology Priorities">
      <ul className="list-disc list-inside space-y-2 pl-4">
        <li><strong className="text-white">Farming Technologies:</strong> Essential for sustainable growth</li>
        <li><strong className="text-white">Basic Engineering:</strong> Weapon production bonuses pay for themselves quickly</li>
        <li><strong className="text-white">Scientific Method:</strong> 25% research speed bonus accelerates all future research</li>
        <li><strong className="text-white">Combat Technologies:</strong> Small bonuses compound over many battles</li>
      </ul>
    </Section>

    <Section title="Combat Tips">
      <ul className="list-disc list-inside space-y-2 pl-4">
        <li><strong className="text-white">Weapons Matter:</strong> Always produce weapons before major battles</li>
        <li><strong className="text-white">Terrain Advantage:</strong> Attack from favorable terrain when possible</li>
        <li><strong className="text-white">Sabotage First:</strong> Disable enemy outposts before direct assault</li>
        <li><strong className="text-white">Overwhelming Force:</strong> Bring more troops than you think you need</li>
      </ul>
    </Section>

    <Section title="Resource Management">
      <ul className="list-disc list-inside space-y-2 pl-4">
        <li><strong className="text-white">Plan Ahead:</strong> Always maintain 2-3 turns of food reserves</li>
        <li><strong className="text-white">Invest in Passive Income:</strong> Technologies that generate resources pay for themselves</li>
        <li><strong className="text-white">Diversify Sources:</strong> Don't rely on a single resource generation method</li>
        <li><strong className="text-white">Monitor Morale:</strong> Low morale reduces effectiveness of all actions</li>
      </ul>
    </Section>

    <Section title="Diplomatic Strategy">
      <ul className="list-disc list-inside space-y-2 pl-4">
        <li><strong className="text-white">Early Alliances:</strong> Secure at least one ally for mutual protection</li>
        <li><strong className="text-white">Information Trading:</strong> Share intelligence to build trust</li>
        <li><strong className="text-white">Resource Sharing:</strong> Help allies in crisis to maintain relationships</li>
        <li><strong className="text-white">Strategic Wars:</strong> Only declare war when you have clear advantages</li>
      </ul>
    </Section>

    <Section title="Advanced Tactics">
      <ul className="list-disc list-inside space-y-2 pl-4">
        <li><strong className="text-white">Sabotage Chains:</strong> Coordinate multiple sabotage missions for maximum impact</li>
        <li><strong className="text-white">Technology Synergy:</strong> Combine related technologies for multiplicative benefits</li>
        <li><strong className="text-white">Chief Specialization:</strong> Use chiefs with complementary abilities</li>
        <li><strong className="text-white">Economic Warfare:</strong> Target enemy resource generation to cripple their economy</li>
      </ul>
    </Section>
  </>
);

const POIGuideContent: React.FC = () => (
  <>
    <Section title="Points of Interest (POIs)">
      <p>POIs are special locations that provide ongoing resource income when controlled by your tribe.</p>
      <p><strong className="text-white">How to Control POIs:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Move troops to a POI location</li>
        <li>If uncontrolled, you automatically claim it</li>
        <li>If enemy-controlled, you must defeat their garrison</li>
        <li>Maintain at least 1 troop to keep control</li>
      </ul>
    </Section>

    <Section title="POI Types and Income">
      <p><strong className="text-white">🏭 Factory (C):</strong> Produces food at 5× troop count per turn</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>High-value industrial sites (Rare)</li>
        <li>Massive food production potential</li>
        <li>Found in Ruins and Wasteland</li>
        <li>Often heavily contested</li>
      </ul>

      <p><strong className="text-white">⛏️ Mine (M):</strong> Produces scrap at 5× troop count per turn</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Steady scrap income (Rare)</li>
        <li>Essential for technology research</li>
        <li>Found in Mountains and Desert</li>
        <li>Scales with garrison size</li>
      </ul>

      <p><strong className="text-white">🍎 Food Source (F):</strong> Produces food at 3× troop count per turn (max 500)</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Passive food income when garrisoned (Common)</li>
        <li>Found in Plains, Forest, and Swamp</li>
        <li>Also excellent for scavenging immediate food</li>
        <li>Critical for early game survival and growth</li>
        <li>Resource generation capped at 500 per turn</li>
      </ul>

      <p><strong className="text-white">🔧 Scrapyard (S):</strong> Produces scrap at 3× troop count per turn (max 500)</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Passive scrap income when garrisoned (Common)</li>
        <li>Found in Ruins and Wasteland</li>
        <li>Essential for technology research and weapon production</li>
        <li>Resource generation capped at 500 per turn</li>
      </ul>

      <p><strong className="text-white">🏛️ Vault (V):</strong> Special discovery bonuses</p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>One-time massive rewards when first attacked (Very Rare)</li>
        <li>+2 action turns for the attacker</li>
        <li>Random valuable assets or resources</li>
        <li>Found in Mountains - high-risk, high-reward</li>
      </ul>

      <p><strong className="text-white">Other POI Types:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>⚔️ Weapons Cache (W):</strong> Rare weapons source, scavenging only (Uncommon)</li>
        <li><strong>🔬 Research Lab (R):</strong> Accelerates research by +25% (Rare)</li>
        <li><strong>🏘️ Settlement (H):</strong> Improves recruitment efficiency (Rare)</li>
        <li><strong>🏴‍☠️ Bandit Camp (B):</strong> Must be attacked first, rewards on victory (Uncommon)</li>
        <li><strong>🏛️ Ruins POI (X):</strong> General scavenging location (Common)</li>
        <li><strong>⚡ Battlefield (!):</strong> Weapons scavenging location (Rare)</li>
      </ul>
    </Section>

    <Section title="POI Strategy">
      <p><strong className="text-white">Early Game:</strong> Scavenge Food Sources and Scrapyards for basic resources</p>
      <p><strong className="text-white">Mid Game:</strong> Contest Factories and Mines for passive income</p>
      <p><strong className="text-white">Late Game:</strong> Control multiple income POIs and assault Vaults</p>

      <p><strong className="text-white">Income vs Scavenging:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>Passive Income:</strong> Factories and Mines provide ongoing resources</li>
        <li><strong>Scavenging:</strong> Food Sources, Scrapyards, Weapons Caches for immediate gains</li>
        <li><strong>Special:</strong> Research Labs accelerate tech, Settlements boost recruitment</li>
      </ul>

      <p><strong className="text-white">Defense Tips:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Build outposts at valuable POIs for +50% defense</li>
        <li>Station enough troops to deter small raids</li>
        <li>Use chiefs with defensive abilities</li>
        <li>Coordinate with allies to protect key locations</li>
      </ul>
    </Section>

    <Section title="POI Income Rules & Limits">
      <p><strong className="text-white">Income Processing:</strong> POI income is added during turn processing, after upkeep costs.</p>
      <p><strong className="text-white">Control Requirements:</strong> You must control the POI at the start of the turn to receive income.</p>
      <p><strong className="text-white">Stacking:</strong> POI income stacks with technology passive generation (e.g., farms + Crop Rotation).</p>

      <p><strong className="text-white">🚫 Resource Generation Limits:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>500 Resource Cap:</strong> Automatic resource generation from POIs is capped at 500 per turn</li>
        <li><strong>Applies to:</strong> Food Sources (3× troop count) and Scrapyards (3× troop count)</li>
        <li><strong>Large Garrisons:</strong> Deploying 167+ troops won't increase income beyond 500</li>
        <li><strong>Strategic Impact:</strong> Prevents massive resource exploitation from oversized garrisons</li>
        <li><strong>Balance:</strong> Encourages spreading troops across multiple POIs rather than concentrating</li>
      </ul>
    </Section>
  </>
);

const OutpostsGuideContent: React.FC = () => (
  <>
    <Section title="Outpost System">
      <p>Outposts are defensive structures that provide significant combat bonuses and strategic advantages.</p>
      <p><strong className="text-white">Building Outposts:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Use the "Build Outpost" action at any location with your troops</li>
        <li>Costs: 20 scrap + 10 troops (troops are consumed in construction)</li>
        <li>Takes 1 turn to complete</li>
        <li>Provides permanent defensive bonus until destroyed</li>
      </ul>
    </Section>

    <Section title="Outpost Benefits">
      <p><strong className="text-white">🛡️ Combat Defense:</strong> +50% defense strength for all troops at the location</p>
      <p><strong className="text-white">👁️ Vision:</strong> Reveals adjacent hexes permanently</p>
      <p><strong className="text-white">🏠 Garrison Point:</strong> Serves as a rally point for troop movements</p>
      <p><strong className="text-white">📡 Communication:</strong> Extends command range for complex operations</p>

      <p><strong className="text-white">Defense Calculation:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Normal Defense: Troops × Weapons × Tech Bonuses</li>
        <li>With Outpost: (Troops × Weapons × Tech Bonuses) × 1.5</li>
        <li>Stacks with technology bonuses (e.g., Reinforced Concrete)</li>
      </ul>
    </Section>

    <Section title="Outpost Vulnerabilities">
      <p><strong className="text-white">💥 Sabotage:</strong> "Sabotage Outpost" missions disable the defensive bonus for 2 turns</p>
      <p><strong className="text-white">⚔️ Destruction:</strong> Outposts are destroyed if the location is successfully attacked</p>
      <p><strong className="text-white">🔧 Repair:</strong> Destroyed outposts must be rebuilt from scratch</p>

      <p><strong className="text-white">Counter-Sabotage:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Research Counter-Intelligence for +30% sabotage resistance</li>
        <li>Station more troops to deter sabotage attempts</li>
        <li>Use chiefs with defensive or intelligence abilities</li>
      </ul>
    </Section>

    <Section title="Strategic Outpost Placement">
      <p><strong className="text-white">🎯 Priority Locations:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>POIs:</strong> Protect valuable resource-generating locations</li>
        <li><strong>Chokepoints:</strong> Control narrow passages and strategic routes</li>
        <li><strong>Border Regions:</strong> Early warning against enemy advances</li>
        <li><strong>Supply Lines:</strong> Protect routes between major garrisons</li>
      </ul>

      <p><strong className="text-white">🏗️ Construction Tips:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Build outposts during peaceful periods</li>
        <li>Coordinate with allies to create defensive networks</li>
        <li>Consider terrain advantages (mountains, forests)</li>
        <li>Plan for multiple outposts to create overlapping coverage</li>
      </ul>
    </Section>

    <Section title="Outpost Economics">
      <p><strong className="text-white">Cost-Benefit Analysis:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Cost: 20 scrap + 10 troops = significant investment</li>
        <li>Benefit: 50% defense bonus can save many more troops</li>
        <li>ROI: Pays for itself if it prevents one successful attack</li>
        <li>Long-term: Essential for holding valuable territory</li>
      </ul>

      <p><strong className="text-white">When to Build:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>After securing a valuable POI</li>
        <li>When expecting enemy attacks</li>
        <li>To establish forward operating bases</li>
        <li>When you have surplus scrap and troops</li>
      </ul>
    </Section>
  </>
);

const SabotageGuideContent: React.FC = () => (
  <>
    <Section title="Sabotage System Overview">
      <p>Sabotage operations allow you to conduct covert missions against enemy territories using operatives (troops and/or chiefs).</p>
      <p><strong className="text-white">Requirements:</strong> At least 1 operative (troop or chief), target must be at war with you</p>
      <p><strong className="text-white">Chief-Only Missions:</strong> Chiefs can operate alone without troops for elite operations</p>
      <p><strong className="text-white">Detection:</strong> Failed missions have 70% detection rate, successful missions 20%</p>
      <p><strong className="text-white">Consequences:</strong> Detected operatives may be captured, chiefs can be imprisoned</p>
    </Section>

    <Section title="Success Rate Formula">
      <p><strong className="text-white">Base Success Rate:</strong> 60%</p>
      <p><strong className="text-white">Bonuses:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>+15% per chief operative (no limit)</li>
        <li>+5% per troop operative (max +30% at 6+ troops)</li>
        <li>+25% with Spy Networks technology</li>
        <li>+20% with Siege Warfare technology</li>
      </ul>
      <p><strong className="text-white">Penalties:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>-5% per hex distance (max -40%)</li>
        <li>-30% if target has Counter-Intelligence technology</li>
      </ul>
      <p><strong className="text-white">Final Range:</strong> 10% minimum, 95% maximum</p>
    </Section>

    <Section title="Sabotage Mission Types">
      <p><strong className="text-white">🔍 Intelligence Gathering:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Reveals garrison details (troops, weapons, chiefs)</li>
        <li>Shows global resources and research progress</li>
        <li>Displays recent technologies and planned actions</li>
        <li>No permanent damage - pure reconnaissance</li>
      </ul>

      <p><strong className="text-white">💥 Sabotage Outpost:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Disables outpost defenses for 2 turns</li>
        <li>Removes +50% defensive bonus during attacks</li>
        <li>Target must have an outpost to be effective</li>
        <li>Critical for assault preparation</li>
      </ul>

      <p><strong className="text-white">☠️ Poison Supplies:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Affects 30% of enemy troops for 3 turns</li>
        <li>Reduces combat effectiveness by 40% for affected troops</li>
        <li>Weakens enemy defenses significantly</li>
        <li>Stacks with other combat penalties</li>
      </ul>
    </Section>

    <Section title="Resource Operations">
      <p><strong className="text-white">💰 Steal Resources:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Transfers enemy resources to your tribe</li>
        <li>Choose specific resource type or random</li>
        <li>Specify amount or steal maximum available</li>
        <li>Stolen resources added to your global stockpile</li>
      </ul>

      <p><strong className="text-white">💥 Destroy Resources:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Permanently destroys enemy resources</li>
        <li>Choose specific resource type or random</li>
        <li>Specify amount or destroy maximum available</li>
        <li>Pure economic warfare - no benefit to you</li>
      </ul>
    </Section>

    <Section title="Research Operations">
      <p><strong className="text-white">🔬 Steal Research:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Steals 20-50% progress from random enemy research</li>
        <li>Adds stolen progress to your matching project</li>
        <li>Creates new research project if you don't have it</li>
        <li>Accelerates your technological advancement</li>
      </ul>

      <p><strong className="text-white">💥 Destroy Research:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Destroys 30-70% progress from random enemy research</li>
        <li>Permanently sets back enemy technological progress</li>
        <li>No benefit to your research</li>
        <li>Effective for maintaining technological superiority</li>
      </ul>
    </Section>

    <Section title="Strategic Considerations">
      <p><strong className="text-white">Mission Planning:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Use Intelligence Gathering first to assess targets</li>
        <li>Sabotage Outpost before major attacks</li>
        <li>Poison Supplies to weaken large garrisons</li>
        <li>Steal Resources when enemy is resource-rich</li>
      </ul>

      <p><strong className="text-white">Risk Management:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li>Chiefs provide better success rates (+15% each) but risk imprisonment</li>
        <li>Chief-only missions are highly effective for elite operations</li>
        <li>Closer targets have higher success rates</li>
        <li>Failed missions often result in operative capture</li>
        <li>Counter-Intelligence technology significantly reduces success</li>
      </ul>

      <p><strong className="text-white">Technology Synergies:</strong></p>
      <ul className="list-disc list-inside space-y-1 pl-4">
        <li><strong>Spy Networks:</strong> +25% success rate for all missions</li>
        <li><strong>Siege Warfare:</strong> +20% success rate, improves assault coordination</li>
        <li><strong>Counter-Intelligence:</strong> +30% resistance against enemy sabotage</li>
      </ul>
    </Section>
  </>
);

const renderTabContent = (tab: HelpTab) => {
  switch (tab) {
    case 'rules': return <GameRulesContent />;
    case 'ui': return <UIGuideContent />;
    case 'actions': return <ActionsGuideContent />;
    case 'research': return <ResearchGuideContent />;
    case 'combat': return <CombatGuideContent />;
    case 'diplomacy': return <DiplomacyGuideContent />;
    case 'resources': return <ResourcesGuideContent />;
    case 'poi': return <POIGuideContent />;
    case 'outposts': return <OutpostsGuideContent />;
    case 'sabotage': return <SabotageGuideContent />;
    case 'tips': return <TipsGuideContent />;
    default: return <GameRulesContent />;
  }
};

const HelpModal: React.FC<HelpModalProps> = ({ onClose, isOpen = true, isDesktopWindow = false }) => {
  const [activeTab, setActiveTab] = useState<HelpTab>('rules');

  if (!isOpen) return null;

  // Check if mobile device
  const isMobileDevice = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);

  // Desktop window mode - render content only
  if (isDesktopWindow) {
    return (
      <div className="h-full flex flex-col">
        {/* Tab buttons */}
        <div className="flex flex-wrap gap-1 p-3 border-b border-slate-600">
          <TabButton label="Rules" isActive={activeTab === 'rules'} onClick={() => setActiveTab('rules')} />
          <TabButton label="UI Guide" isActive={activeTab === 'ui'} onClick={() => setActiveTab('ui')} />
          <TabButton label="Actions" isActive={activeTab === 'actions'} onClick={() => setActiveTab('actions')} />
          <TabButton label="Research" isActive={activeTab === 'research'} onClick={() => setActiveTab('research')} />
          <TabButton label="Combat" isActive={activeTab === 'combat'} onClick={() => setActiveTab('combat')} />
          <TabButton label="Diplomacy" isActive={activeTab === 'diplomacy'} onClick={() => setActiveTab('diplomacy')} />
          <TabButton label="Resources" isActive={activeTab === 'resources'} onClick={() => setActiveTab('resources')} />
          <TabButton label="POIs" isActive={activeTab === 'poi'} onClick={() => setActiveTab('poi')} />
          <TabButton label="Outposts" isActive={activeTab === 'outposts'} onClick={() => setActiveTab('outposts')} />
          <TabButton label="Sabotage" isActive={activeTab === 'sabotage'} onClick={() => setActiveTab('sabotage')} />
          <TabButton label="Tips" isActive={activeTab === 'tips'} onClick={() => setActiveTab('tips')} />
        </div>

        {/* Content */}
        <div className="flex-1 p-3 overflow-y-auto text-sm">
          {renderTabContent(activeTab)}
        </div>
      </div>
    );
  }

  // Mobile/fullscreen modal mode
  return (
    <div className="fixed z-20"
         style={{
           top: isMobileDevice ? '8rem' : '0',
           left: '0',
           right: '0',
           bottom: '0',
           backgroundColor: isMobileDevice ? 'transparent' : 'rgba(0,0,0,0.6)',
           backdropFilter: isMobileDevice ? 'none' : 'blur(4px)',
           pointerEvents: isMobileDevice ? 'none' : 'auto'
         }}>
      <div className="w-full h-full flex items-center justify-center p-4"
           onClick={isMobileDevice ? undefined : onClose}
           style={{ pointerEvents: 'auto' }}>
        <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg w-full max-w-4xl h-full md:h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Mobile Header */}
            <header className="flex-shrink-0 flex justify-between items-center border-b border-neutral-700 p-3 md:hidden">
              <div className="flex space-x-1 overflow-x-auto">
                <TabButton label="Rules" isActive={activeTab === 'rules'} onClick={() => setActiveTab('rules')} />
                <TabButton label="UI" isActive={activeTab === 'ui'} onClick={() => setActiveTab('ui')} />
                <TabButton label="Actions" isActive={activeTab === 'actions'} onClick={() => setActiveTab('actions')} />
                <TabButton label="Research" isActive={activeTab === 'research'} onClick={() => setActiveTab('research')} />
                <TabButton label="Combat" isActive={activeTab === 'combat'} onClick={() => setActiveTab('combat')} />
                <TabButton label="Diplomacy" isActive={activeTab === 'diplomacy'} onClick={() => setActiveTab('diplomacy')} />
                <TabButton label="Resources" isActive={activeTab === 'resources'} onClick={() => setActiveTab('resources')} />
                <TabButton label="POIs" isActive={activeTab === 'poi'} onClick={() => setActiveTab('poi')} />
                <TabButton label="Outposts" isActive={activeTab === 'outposts'} onClick={() => setActiveTab('outposts')} />
                <TabButton label="Sabotage" isActive={activeTab === 'sabotage'} onClick={() => setActiveTab('sabotage')} />
                <TabButton label="Tips" isActive={activeTab === 'tips'} onClick={() => setActiveTab('tips')} />
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            {/* Desktop Header */}
            <header className="flex-shrink-0 justify-between items-center border-b border-neutral-700 px-6 pt-4 hidden md:flex">
                 <div className="flex flex-wrap gap-1">
                    <TabButton label="Rules" isActive={activeTab === 'rules'} onClick={() => setActiveTab('rules')} />
                    <TabButton label="UI Guide" isActive={activeTab === 'ui'} onClick={() => setActiveTab('ui')} />
                    <TabButton label="Actions" isActive={activeTab === 'actions'} onClick={() => setActiveTab('actions')} />
                    <TabButton label="Research" isActive={activeTab === 'research'} onClick={() => setActiveTab('research')} />
                    <TabButton label="Combat" isActive={activeTab === 'combat'} onClick={() => setActiveTab('combat')} />
                    <TabButton label="Diplomacy" isActive={activeTab === 'diplomacy'} onClick={() => setActiveTab('diplomacy')} />
                    <TabButton label="Resources" isActive={activeTab === 'resources'} onClick={() => setActiveTab('resources')} />
                    <TabButton label="POIs" isActive={activeTab === 'poi'} onClick={() => setActiveTab('poi')} />
                    <TabButton label="Outposts" isActive={activeTab === 'outposts'} onClick={() => setActiveTab('outposts')} />
                    <TabButton label="Sabotage" isActive={activeTab === 'sabotage'} onClick={() => setActiveTab('sabotage')} />
                    <TabButton label="Tips" isActive={activeTab === 'tips'} onClick={() => setActiveTab('tips')} />
                </div>
                 <Button onClick={onClose} variant="secondary" className="bg-transparent hover:bg-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                 </Button>
            </header>
            <main className="flex-grow p-6 overflow-y-auto bg-neutral-800">
                {renderTabContent(activeTab)}
            </main>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;