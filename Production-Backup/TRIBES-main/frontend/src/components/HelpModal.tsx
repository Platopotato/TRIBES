
import React, { useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';

interface HelpModalProps {
  onClose: () => void;
}

type HelpTab = 'rules' | 'ui';

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
            <p>You can manage your relationships with other tribes via the new Diplomacy panel.</p>
            <ul className="list-disc list-inside space-y-1 pl-4">
                 <li><strong className="text-white">Propose Alliance:</strong> You can send an alliance proposal to a tribe you are Neutral with. They will have a few turns to accept or reject it.</li>
                 <li><strong className="text-blue-400">Alliances:</strong> Allies share vision, allowing you to see their territory and any enemies they spot. You can also move your forces into an ally's garrisoned hex without starting a fight.</li>
                 <li><strong className="text-red-400">Declare War:</strong> You can declare war on any tribe. This is a formal action that takes effect at the end of the turn, changing your status to 'War'.</li>
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


const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<HelpTab>('rules');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <header className="flex-shrink-0 flex justify-between items-center border-b border-neutral-700 px-6 pt-4">
                 <div className="flex space-x-1">
                    <TabButton label="Game Rules" isActive={activeTab === 'rules'} onClick={() => setActiveTab('rules')} />
                    <TabButton label="UI Guide" isActive={activeTab === 'ui'} onClick={() => setActiveTab('ui')} />
                </div>
                 <Button onClick={onClose} variant="secondary" className="bg-transparent hover:bg-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                 </Button>
            </header>
            <main className="flex-grow p-6 overflow-y-auto bg-neutral-800">
                {activeTab === 'rules' ? <GameRulesContent /> : <UIGuideContent />}
            </main>
        </div>
    </div>
  );
};

export default HelpModal;