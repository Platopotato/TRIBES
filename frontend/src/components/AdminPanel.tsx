/** @jsxImportSource react */
import React, { useState, useRef } from 'react';
import { Tribe, User, GameState, FullBackupState, ChiefRequest, AssetRequest } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import ConfirmationModal from './ui/ConfirmationModal';
import * as Auth from '../lib/auth';

interface AdminPanelProps {
  gameState: GameState;
  users: User[];
  onBack: () => void;
  onNavigateToEditor: () => void;
  onProcessTurn: () => void;
  onRemovePlayer: (userId: string) => void;
  onStartNewGame: () => void;
  onLoadBackup: (backup: FullBackupState) => void;
  onApproveChief: (requestId: string) => void;
  onDenyChief: (requestId: string) => void;
  onApproveAsset: (requestId: string) => void;
  onDenyAsset: (requestId: string) => void;
  onAddAITribe: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const { gameState, users, onBack, onNavigateToEditor, onProcessTurn, onRemovePlayer, onStartNewGame, onLoadBackup, onApproveChief, onDenyChief, onApproveAsset, onDenyAsset, onAddAITribe } = props;

  // Safety checks
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-4 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-amber-400 mb-4">Admin Panel</h1>
          <p className="text-neutral-400">Loading game state...</p>
        </div>
      </div>
    );
  }

  const { tribes: allTribes, chiefRequests, assetRequests } = gameState;
  const allUsers = users;
  const currentUser = Auth.getCurrentUser();

  const [userToRemove, setUserToRemove] = useState<User | null>(null);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  const handleConfirmRemove = () => {
    if (userToRemove) {
      onRemovePlayer(userToRemove.id);
      setUserToRemove(null);
    }
  };

  const handleConfirmNewGame = () => {
    onStartNewGame();
    setShowNewGameConfirm(false);
  };

  const handleSaveBackup = () => {
    const backupState: FullBackupState = {
        gameState: gameState,
        users: allUsers
    };
    const stateString = JSON.stringify(backupState, null, 2);
    const blob = new Blob([stateString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `radix-tribes-backup-${date}.json`;
    document.body.appendChild(a);
a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadBackupClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('Invalid file format');
        const loadedData = JSON.parse(text);

        if (loadedData.gameState && loadedData.users && Array.isArray(loadedData.users)) {
          onLoadBackup(loadedData as FullBackupState);
        } else {
          throw new Error('File does not appear to be a valid full game state backup.');
        }
      } catch (error) {
        console.error('Failed to load game state:', error);
        alert(`Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const pendingChiefRequests = (chiefRequests || []).filter(r => r.status === 'pending');
  const pendingAssetRequests = (assetRequests || []).filter(r => r.status === 'pending');
  const aiTribesCount = allTribes.filter(t => t.isAI).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-amber-400 tracking-wide mb-2">Admin Panel</h1>
            <p className="text-neutral-400 text-lg">Manage the world of Radix Tribes</p>
          </div>
          <Button onClick={onBack} className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Game</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="space-y-8 xl:col-span-2">
            <Card title="Turn Status" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                  <div className="overflow-x-auto max-h-96 rounded-lg border border-neutral-700/50">
                    <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-neutral-600 sticky top-0 bg-gradient-to-r from-neutral-800 to-neutral-900">
                            <th className="p-3 text-amber-300 font-semibold">Tribe Name</th>
                            <th className="p-3 text-amber-300 font-semibold">Player</th>
                            <th className="p-3 text-amber-300 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allTribes.map(tribe => (
                            <tr key={tribe.id} className="border-b border-neutral-700/50 hover:bg-neutral-700/30 transition-colors">
                              <td className="p-3 font-semibold text-white">
                                {tribe.tribeName}
                                {tribe.isAI && <span className="ml-2 px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full border border-blue-500/30">AI</span>}
                              </td>
                              <td className="p-3 text-neutral-300">{tribe.playerName}</td>
                              <td className="p-3">
                                {tribe.turnSubmitted ? (
                                  <span className="inline-flex items-center px-3 py-1 bg-green-600/20 text-green-400 text-sm rounded-full border border-green-500/30">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Submitted
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 bg-yellow-600/20 text-yellow-400 text-sm rounded-full border border-yellow-500/30">
                                    <svg className="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Planning
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                    </table>
                  </div>
                  <div className="pt-6 border-t border-neutral-600/50">
                    <Button onClick={onProcessTurn} className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Process All Turns
                    </Button>
                  </div>
              </div>
            </Card>

            <Card title="Pending Asset Approvals" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
                <div className="overflow-x-auto max-h-96 rounded-lg border border-neutral-700/50">
                    {pendingAssetRequests.length > 0 ? (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-neutral-600 sticky top-0 bg-gradient-to-r from-neutral-800 to-neutral-900">
                                    <th className="p-3 text-amber-300 font-semibold">Tribe</th>
                                    <th className="p-3 text-amber-300 font-semibold">Asset Name</th>
                                    <th className="p-3 text-amber-300 font-semibold">Radix Addr.</th>
                                    <th className="p-3 text-amber-300 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingAssetRequests.map(req => {
                                    const tribe = allTribes.find(t => t.id === req.tribeId);
                                    return (
                                        <tr key={req.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                            <td className="p-2 font-semibold">{tribe?.tribeName || 'Unknown Tribe'}</td>
                                            <td className="p-2">{req.assetName}</td>
                                            <td className="p-2 font-mono text-xs">{req.radixAddressSnippet}</td>
                                            <td className="p-2 space-x-2">
                                                <Button onClick={() => onApproveAsset(req.id)} className="text-xs bg-green-700 hover:bg-green-600 px-2 py-1">Approve</Button>
                                                <Button onClick={() => onDenyAsset(req.id)} className="text-xs bg-red-800 hover:bg-red-700 px-2 py-1">Deny</Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-slate-400 text-center p-4">No pending asset requests.</p>
                    )}
                </div>
            </Card>

             <Card title="Pending Chief Approvals" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
                <div className="overflow-x-auto max-h-96 rounded-lg border border-neutral-700/50">
                    {pendingChiefRequests.length > 0 ? (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-neutral-600 sticky top-0 bg-gradient-to-r from-neutral-800 to-neutral-900">
                                    <th className="p-3 text-amber-300 font-semibold">Tribe</th>
                                    <th className="p-3 text-amber-300 font-semibold">Chief Name</th>
                                    <th className="p-3 text-amber-300 font-semibold">Radix Addr.</th>
                                    <th className="p-3 text-amber-300 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingChiefRequests.map(req => {
                                    const tribe = allTribes.find(t => t.id === req.tribeId);
                                    return (
                                        <tr key={req.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                            <td className="p-2 font-semibold">{tribe?.tribeName || 'Unknown Tribe'}</td>
                                            <td className="p-2">{req.chiefName}</td>
                                            <td className="p-2 font-mono text-xs">{req.radixAddressSnippet}</td>
                                            <td className="p-2 space-x-2">
                                                <Button onClick={() => onApproveChief(req.id)} className="text-xs bg-green-700 hover:bg-green-600 px-2 py-1">Approve</Button>
                                                <Button onClick={() => onDenyChief(req.id)} className="text-xs bg-red-800 hover:bg-red-700 px-2 py-1">Deny</Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-slate-400 text-center p-4">No pending chief requests.</p>
                    )}
                </div>
            </Card>

            <Card title="Registered Users" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
                <div className="overflow-x-auto max-h-96 rounded-lg border border-neutral-700/50">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-neutral-600 sticky top-0 bg-gradient-to-r from-neutral-800 to-neutral-900">
                        <th className="p-3 text-amber-300 font-semibold">Username</th>
                        <th className="p-3 text-amber-300 font-semibold">Role</th>
                        <th className="p-3 text-amber-300 font-semibold">User ID</th>
                        <th className="p-3 text-amber-300 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.map(user => (
                        <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="p-2 font-semibold">{user.username}</td>
                          <td className="p-2 text-slate-400 capitalize">{user.role}</td>
                          <td className="p-2 font-mono text-xs">{user.id}</td>
                          <td className="p-2">
                            {user.role === 'player' && user.id !== currentUser.id && (
                                <Button 
                                    onClick={() => setUserToRemove(user)}
                                    className="bg-red-800 hover:bg-red-700 text-xs py-1 px-2"
                                >
                                    Remove
                                </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </Card>
          </div>

          <div className="space-y-8">
            <Card title="World Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
                <div className="space-y-4">
                    <p className="text-neutral-400 leading-relaxed">Edit the game world directly or start a new game on the current map.</p>
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={onNavigateToEditor}>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Edit World Map
                    </Button>
                     <Button
                        className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                        onClick={() => setShowNewGameConfirm(true)}
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Start New Game
                    </Button>
                </div>
            </Card>
            
            <Card title="AI Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                  <p className="text-neutral-400 leading-relaxed">Add or manage computer-controlled tribes. There are currently <span className="text-amber-400 font-semibold">{aiTribesCount}</span> AI tribes in the game.</p>
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={onAddAITribe}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Add Wanderer AI Tribe
                  </Button>
              </div>
            </Card>

            <Card title="Game Data Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                  <p className="text-neutral-400 leading-relaxed">Save the entire game state and all users to a file, or load a previous backup.</p>
                  <Button className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={handleSaveBackup}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Game Backup
                  </Button>
                  <Button className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={handleLoadBackupClick}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Load Game Backup
                  </Button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
              </div>
            </Card>

             <Card title="All Tribes" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              {allTribes.length > 0 ? (
                <div className="overflow-x-auto max-h-96 rounded-lg border border-neutral-700/50">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-neutral-600 sticky top-0 bg-gradient-to-r from-neutral-800 to-neutral-900">
                        <th className="p-3 text-amber-300 font-semibold">Tribe Name</th>
                        <th className="p-3 text-amber-300 font-semibold">Location</th>
                        <th className="p-3 text-amber-300 font-semibold">Troops</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTribes.map(tribe => (
                        <tr key={tribe.id} className="border-b border-neutral-700/50 hover:bg-neutral-700/30 transition-colors">
                          <td className="p-3 font-semibold text-white">
                            {tribe.tribeName}
                            {tribe.isAI && <span className="ml-2 px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full border border-blue-500/30">AI</span>}
                          </td>
                          <td className="p-3 font-mono text-neutral-300">{tribe.location}</td>
                          <td className="p-3 text-amber-400 font-semibold">{Object.values(tribe.garrisons).reduce((total, garrison) => total + garrison.troops, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-center p-4">No tribes have been founded yet.</p>
              )}
            </Card>
          </div>
        </div>
      </div>
      {userToRemove && (
        <ConfirmationModal
          title={`Remove ${userToRemove.username}?`}
          message="This will permanently delete the user and their associated tribe. This action cannot be undone."
          onConfirm={handleConfirmRemove}
          onCancel={() => setUserToRemove(null)}
        />
      )}
      {showNewGameConfirm && (
        <ConfirmationModal
            title="Start a New Game?"
            message="This will remove ALL current tribes and requests, and reset the turn to 1. The map will be preserved. Are you sure?"
            onConfirm={handleConfirmNewGame}
            onCancel={() => setShowNewGameConfirm(false)}
        />
      )}
    </div>
  );
};

export default AdminPanel;