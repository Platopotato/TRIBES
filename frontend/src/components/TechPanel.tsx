import React, { useState } from 'react';
import { Tribe, GameAction, ActionType, Technology } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { getTechnology } from '@radix-tribes/shared';
import TechnologyDetailsModal from './TechnologyDetailsModal';

interface TechPanelProps {
  tribe: Tribe;
  plannedActions: GameAction[];
  onOpenTechTree: () => void;
  onCancelResearch: () => void;
}

const TechPanel: React.FC<TechPanelProps> = ({ tribe, plannedActions, onOpenTechTree, onCancelResearch }) => {
  const { currentResearch, completedTechs } = tribe;
  const [selectedTechnology, setSelectedTechnology] = useState<Technology | null>(null);

  const isResearchQueued = plannedActions.some(a => a.actionType === ActionType.StartResearch);

  const handleTechClick = (techId: string) => {
    const tech = getTechnology(techId);
    if (tech) {
      setSelectedTechnology(tech);
    }
  };

  const renderContent = () => {
    if (currentResearch && currentResearch.length > 0) {
      return (
        <div className="space-y-3">
          {currentResearch.map((project, index) => {
            const tech = getTechnology(project.techId);
            if (!tech) return <p key={index} className="text-center text-red-400">Error: Technology not found.</p>;

            const progressPercent = (project.progress / tech.researchPoints) * 100;

            // Calculate remaining turns
            const remainingPoints = tech.researchPoints - project.progress;
            const progressPerTurn = project.assignedTroops * 1; // 1 point per troop per turn
            const remainingTurns = Math.ceil(remainingPoints / progressPerTurn);

            return (
              <div key={project.techId} className="space-y-2 p-3 bg-slate-800/50 rounded-lg">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-slate-300">
                    {tech.icon} {tech.name}
                  </span>
                  <span className="text-sm text-slate-400">
                    {project.progress} / {tech.researchPoints} pts
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                  <div
                    className="bg-amber-500 h-2.5 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>{project.assignedTroops} troops assigned at Hex {project.location}</span>
                  <span className="text-amber-400 font-semibold">
                    {remainingTurns} turn{remainingTurns !== 1 ? 's' : ''} remaining
                  </span>
                </div>
              </div>
            );
          })}
          <Button variant="secondary" onClick={onCancelResearch} className="w-full text-xs mt-2 bg-red-900/70 hover:bg-red-800 focus:ring-red-500">
            Cancel All Research
          </Button>
        </div>
      );
    }
    
    if (isResearchQueued) {
      return <p className="text-center text-slate-400 italic">Research project queued for next turn.</p>;
    }

    return (
       <div className="text-center">
         <p className="text-sm text-slate-400 mb-3">No active research project.</p>
       </div>
    );
  };
  
  const cardActions = (
    <Button
        variant="secondary"
        onClick={onOpenTechTree}
        disabled={isResearchQueued}
        className="text-xs px-3 py-1"
    >
        Tech Tree
    </Button>
  );

  return (
    <>
      <Card title="Technology">
        <div className="space-y-3">
          <div className="flex justify-end mb-3">
            {cardActions}
          </div>
          {renderContent()}
          {completedTechs.length > 0 && (
            <div className="pt-3 border-t border-slate-700">
              <h5 className="font-semibold text-slate-300 mb-2 text-sm">Completed Techs</h5>
              <div className="flex flex-wrap gap-2">
                {completedTechs.map(techId => {
                  const tech = getTechnology(techId);
                  if (!tech) return null;
                  return (
                    <button
                      key={techId}
                      onClick={() => handleTechClick(techId)}
                      title={`Click to view ${tech.name} benefits`}
                      className="text-xl cursor-pointer hover:scale-110 transition-transform duration-200 p-1 rounded hover:bg-slate-700/50"
                    >
                      {tech.icon}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">💡 Click on any technology to view its benefits</p>
            </div>
          )}
        </div>
      </Card>

      {/* Technology Details Modal */}
      {selectedTechnology && (
        <TechnologyDetailsModal
          isOpen={true}
          onClose={() => setSelectedTechnology(null)}
          technology={selectedTechnology}
        />
      )}
    </>
  );
};

export default TechPanel;