/** @jsxImportSource react */
import React, { useState, useRef, useEffect } from 'react';
import { Tribe, User, GameState, FullBackupState, ChiefRequest, AssetRequest, AIType, TickerMessage, TickerPriority, LoginAnnouncement, BackupStatus, BackupFile, TurnDeadline } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import ConfirmationModal from './ui/ConfirmationModal';
import * as Auth from '../lib/auth';
import * as client from '../lib/client';

interface AdminPanelProps {
  gameState: GameState;
  users: User[];
  onBack: () => void;
  onNavigateToEditor: () => void;
  onNavigateToGameEditor: () => void;
  onProcessTurn: () => void;
  onRemovePlayer: (userId: string) => void;
  onStartNewGame: () => void;
  onLoadBackup: (backup: FullBackupState) => void;
  onApproveChief: (requestId: string) => void;
  onDenyChief: (requestId: string) => void;
  onApproveAsset: (requestId: string) => void;
  onDenyAsset: (requestId: string) => void;
  onAddAITribe: (aiType?: AIType) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const { gameState, users, onBack, onNavigateToEditor, onNavigateToGameEditor, onProcessTurn, onRemovePlayer, onStartNewGame, onLoadBackup, onApproveChief, onDenyChief, onApproveAsset, onDenyAsset, onAddAITribe } = props;
  const [selectedAIType, setSelectedAIType] = useState<AIType>(AIType.Wanderer);

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
  const [showTurnSummary, setShowTurnSummary] = useState(false);
  const [summaryTurnsBack, setSummaryTurnsBack] = useState(1); // How many turns back to include
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showTickerModal, setShowTickerModal] = useState(false);
  const [newTickerMessage, setNewTickerMessage] = useState('');
  const [newTickerPriority, setNewTickerPriority] = useState<TickerPriority>('normal');
  const [showLoginAnnouncementModal, setShowLoginAnnouncementModal] = useState(false);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState('');
  const [newAnnouncementPriority, setNewAnnouncementPriority] = useState<TickerPriority>('normal');
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupList, setBackupList] = useState<BackupFile[]>([]);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [deadlineMinutes, setDeadlineMinutes] = useState(0);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  const handleConfirmRemove = () => {
    if (userToRemove) {
      console.log('🗑️ Removing user:', userToRemove);
      onRemovePlayer(userToRemove.id);
      setUserToRemove(null);
    }
  };

  const handleConfirmNewGame = () => {
    onStartNewGame();
    setShowNewGameConfirm(false);
  };

  const handleResetPassword = (userId: string) => {
    setResetPasswordUserId(userId);
    setNewPassword('');
  };

  const handleConfirmPasswordReset = () => {
    if (resetPasswordUserId && newPassword.trim()) {
      // Emit password reset event
      client.adminResetPassword({ userId: resetPasswordUserId, newPassword: newPassword.trim() });
      setResetPasswordUserId(null);
      setNewPassword('');
      alert(`Password reset successfully! New password: ${newPassword.trim()}`);
    }
  };

  const handleCancelPasswordReset = () => {
    setResetPasswordUserId(null);
    setNewPassword('');
  };

  const handleAddTickerMessage = () => {
    if (newTickerMessage.trim()) {
      const tickerMessage: TickerMessage = {
        id: `ticker-${Date.now()}`,
        message: newTickerMessage.trim(),
        priority: newTickerPriority,
        createdAt: Date.now(),
        isActive: true
      };

      client.addTickerMessage(tickerMessage);
      setNewTickerMessage('');
      setNewTickerPriority('normal');
      setShowTickerModal(false);
    }
  };

  const handleToggleTickerMessage = (messageId: string) => {
    client.toggleTickerMessage(messageId);
  };

  const handleDeleteTickerMessage = (messageId: string) => {
    client.deleteTickerMessage(messageId);
  };

  const handleToggleTicker = () => {
    client.toggleTicker();
  };

  const handleAddLoginAnnouncement = () => {
    if (newAnnouncementTitle.trim() && newAnnouncementMessage.trim()) {
      const announcement: LoginAnnouncement = {
        id: `announcement-${Date.now()}`,
        title: newAnnouncementTitle.trim(),
        message: newAnnouncementMessage.trim(),
        priority: newAnnouncementPriority,
        isActive: true,
        createdAt: Date.now()
      };

      client.addLoginAnnouncement(announcement);
      setNewAnnouncementTitle('');
      setNewAnnouncementMessage('');
      setNewAnnouncementPriority('normal');
      setShowLoginAnnouncementModal(false);
    }
  };

  const handleToggleLoginAnnouncement = (announcementId: string) => {
    client.toggleLoginAnnouncement(announcementId);
  };

  const handleDeleteLoginAnnouncement = (announcementId: string) => {
    client.deleteLoginAnnouncement(announcementId);
  };

  const handleToggleLoginAnnouncements = () => {
    client.toggleLoginAnnouncements();
  };

  const handleRefreshBackupStatus = () => {
    client.getBackupStatus();
  };

  const handleDownloadBackup = (filename: string) => {
    client.downloadBackup(filename);
  };

  const handleDeleteBackup = (filename: string) => {
    if (confirm(`Are you sure you want to delete backup: ${filename}?`)) {
      client.deleteBackup(filename);
    }
  };

  const handleCreateManualBackup = () => {
    client.createManualBackup();
  };

  const handleSetTurnDeadline = () => {
    const now = Date.now();
    const deadlineTime = now + (deadlineHours * 60 * 60 * 1000) + (deadlineMinutes * 60 * 1000);

    const deadline: TurnDeadline = {
      turn: gameState.turn,
      deadline: deadlineTime,
      isActive: true
    };

    client.setTurnDeadline(deadline);
    setShowDeadlineModal(false);
  };

  const handleClearTurnDeadline = () => {
    if (confirm('Are you sure you want to clear the current turn deadline?')) {
      client.clearTurnDeadline();
    }
  };

  const handleUpdateAdminPassword = () => {
    if (newAdminPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    if (confirm('Are you sure you want to update the admin password? Make sure you remember the new password!')) {
      client.updateAdminPassword(newAdminPassword);
      setNewAdminPassword('');
      setShowAdminPasswordModal(false);
    }
  };

  const handleResetAdminPassword = () => {
    if (confirm('🚨 EMERGENCY RESET: This will reset the admin password back to "snoopy". Are you sure?')) {
      client.resetAdminPassword();
    }
  };

  const handleDebugPassword = () => {
    client.debugAdminPassword();
  };

  const handleDebugSocket = () => {
    client.debugSocket();
  };

  const handleSyncPasswordWithEnv = () => {
    if (confirm('🔄 SYNC: This will update the database password to match the ADMIN_PASSWORD environment variable. Continue?')) {
      client.syncPasswordWithEnv();
    }
  };

  // Set up backup status callback and fetch initial status
  useEffect(() => {
    const handleBackupStatus = (status: BackupStatus, backupList: BackupFile[]) => {
      setBackupStatus(status);
      setBackupList(backupList);
    };

    client.setBackupStatusCallback(handleBackupStatus);
    client.getBackupStatus();

    return () => {
      client.setBackupStatusCallback(null);
    };
  }, []);

  const handleSaveBackup = () => {
    // Request enhanced backup with password hashes
    client.requestEnhancedBackup();
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

  const generateTurnSummary = (turnsBack: number = 1) => {
    const currentTurn = gameState.turn;
    const history = gameState.history || [];

    const summary = allTribes.map(tribe => {
      // Get garrison information
      const garrisons = Object.entries(tribe.garrisons || {}).map(([location, garrison]) => ({
        location,
        troops: garrison.troops,
        weapons: garrison.weapons,
        chiefs: garrison.chiefs.length
      }));

      // Get current turn actions
      const currentActions = tribe.actions.map(action => ({
        type: action.actionType,
        data: action.actionData
      }));

      // Get last turn results
      const lastTurnResults = tribe.lastTurnResults.map(result => ({
        type: result.actionType,
        result: result.result || 'No result'
      }));

      // Detect chiefs that appeared this turn
      const chiefsAppearedThisTurn = tribe.lastTurnResults
        .filter(result => {
          const resultText = result.result || '';
          // Look for patterns that indicate chief acquisition
          return resultText.includes('chief') ||
                 resultText.includes('Chief') ||
                 resultText.includes('leader') ||
                 resultText.includes('Leader') ||
                 resultText.includes('approved') && resultText.includes('request');
        })
        .map(result => ({
          type: result.actionType,
          description: result.result || 'Chief acquired'
        }));

      // Also check if any chiefs were approved via admin this turn
      const approvedChiefsThisTurn = (gameState.chiefRequests || [])
        .filter(req => req.tribeId === tribe.id && req.status === 'approved')
        .map(req => ({
          type: 'Admin Approval' as any,
          description: `Chief "${req.chiefName}" was approved by admin`
        }));

      // Get historical data for this tribe
      const tribeHistory = [];
      for (let i = 1; i <= turnsBack && i < currentTurn; i++) {
        const historicalTurn = currentTurn - i;
        const turnRecord = history.find(h => h.turn === historicalTurn);
        if (turnRecord) {
          const tribeRecord = turnRecord.tribeRecords.find(tr => tr.tribeId === tribe.id);
          if (tribeRecord) {
            tribeHistory.push({
              turn: historicalTurn,
              score: tribeRecord.score,
              troops: tribeRecord.troops,
              garrisons: tribeRecord.garrisons
            });
          }
        }
      }

      // Calculate trends
      const currentStats = {
        troops: garrisons.reduce((sum, g) => sum + g.troops, 0),
        garrisons: garrisons.length,
        score: 0 // We'd need to calculate this if needed
      };

      const trends = tribeHistory.length > 0 ? {
        troopChange: currentStats.troops - tribeHistory[0].troops,
        garrisonChange: currentStats.garrisons - tribeHistory[0].garrisons,
        scoreChange: currentStats.score - tribeHistory[0].score
      } : null;

      return {
        tribeName: tribe.tribeName,
        playerName: tribe.playerName,
        isAI: tribe.isAI,
        aiType: tribe.aiType,
        turnSubmitted: tribe.turnSubmitted,
        homeBase: tribe.location,
        resources: tribe.globalResources,
        totalTroops: garrisons.reduce((sum, g) => sum + g.troops, 0),
        totalWeapons: garrisons.reduce((sum, g) => sum + g.weapons, 0),
        totalChiefs: garrisons.reduce((sum, g) => sum + g.chiefs, 0),
        garrisons,
        currentActions,
        lastTurnResults,
        chiefsAppearedThisTurn: [...chiefsAppearedThisTurn, ...approvedChiefsThisTurn],
        morale: tribe.globalResources.morale,
        rationLevel: tribe.rationLevel,
        completedTechs: tribe.completedTechs.length,
        currentResearch: tribe.currentResearch?.techId || 'None',
        history: tribeHistory,
        trends: trends
      };
    });

    return summary;
  };

  const handleDownloadTurnSummary = () => {
    const summary = generateTurnSummary(summaryTurnsBack);
    const summaryText = `RADIX TRIBES - TURN ${gameState.turn} SUMMARY
Generated: ${new Date().toLocaleString()}
============================================

${summary.map(tribe => `
TRIBE: ${tribe.tribeName}
Leader: ${tribe.playerName} ${tribe.isAI ? `(AI - ${tribe.aiType})` : '(Human)'}
Turn Status: ${tribe.turnSubmitted ? '✅ SUBMITTED' : '❌ NOT SUBMITTED'}
Home Base: ${tribe.homeBase}

RESOURCES:
- Food: ${tribe.resources.food}
- Scrap: ${tribe.resources.scrap}
- Morale: ${tribe.morale}
- Ration Level: ${tribe.rationLevel}

MILITARY STRENGTH:
- Total Troops: ${tribe.totalTroops}
- Total Weapons: ${tribe.totalWeapons}
- Total Chiefs: ${tribe.totalChiefs}

GARRISONS:
${tribe.garrisons.map(g => `  📍 ${g.location}: ${g.troops} troops, ${g.weapons} weapons, ${g.chiefs} chiefs`).join('\n')}

CURRENT TURN ACTIONS:
${tribe.currentActions.length > 0 ?
  tribe.currentActions.map(a => `  🎯 ${a.type}: ${JSON.stringify(a.data)}`).join('\n') :
  '  No actions planned'}

LAST TURN RESULTS:
${tribe.lastTurnResults.length > 0 ?
  tribe.lastTurnResults.map(r => `  📊 ${r.type}: ${r.result}`).join('\n') :
  '  No results from last turn'}

CHIEFS APPEARED THIS TURN:
${tribe.chiefsAppearedThisTurn.length > 0 ?
  tribe.chiefsAppearedThisTurn.map(c => `  👑 ${c.type}: ${c.description}`).join('\n') :
  '  No new chiefs this turn'}

TECHNOLOGY:
- Completed Technologies: ${tribe.completedTechs}
- Current Research: ${tribe.currentResearch}

HISTORICAL TRENDS (Last ${summaryTurnsBack} Turn${summaryTurnsBack > 1 ? 's' : ''}):
${tribe.trends ? `
- Troop Change: ${tribe.trends.troopChange > 0 ? '+' : ''}${tribe.trends.troopChange}
- Garrison Change: ${tribe.trends.garrisonChange > 0 ? '+' : ''}${tribe.trends.garrisonChange}
- Score Change: ${tribe.trends.scoreChange > 0 ? '+' : ''}${tribe.trends.scoreChange}` : '- No historical data available'}

PREVIOUS TURN HISTORY:
${tribe.history.length > 0 ?
  tribe.history.map(h => `  📈 Turn ${h.turn}: ${h.troops} troops, ${h.garrisons} garrisons, Score: ${h.score}`).join('\n') :
  '  No previous turn data available'}

${'='.repeat(50)}
`).join('')}

GAME STATISTICS:
- Total Tribes: ${summary.length}
- Human Players: ${summary.filter(t => !t.isAI).length}
- AI Players: ${summary.filter(t => t.isAI).length}
- Turns Submitted: ${summary.filter(t => t.turnSubmitted).length}/${summary.length}
- Total Military Units: ${summary.reduce((sum, t) => sum + t.totalTroops, 0)} troops, ${summary.reduce((sum, t) => sum + t.totalWeapons, 0)} weapons
- New Chiefs This Turn: ${summary.reduce((sum, t) => sum + t.chiefsAppearedThisTurn.length, 0)}
`;

    const blob = new Blob([summaryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radix-tribes-turn-${gameState.turn}-summary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                            <div className="flex space-x-2">
                              {user.role === 'player' && (
                                <Button
                                    onClick={() => handleResetPassword(user.id)}
                                    className="bg-blue-600 hover:bg-blue-700 text-xs py-1 px-2"
                                >
                                    Reset Password
                                </Button>
                              )}
                              {user.role === 'player' && user.id !== currentUser.id && (
                                  <Button
                                      onClick={() => setUserToRemove(user)}
                                      className="bg-red-800 hover:bg-red-700 text-xs py-1 px-2"
                                  >
                                      Remove
                                  </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </Card>
          </div>

          <div className="space-y-8">
            <Card title="News Ticker Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Ticker Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      gameState.ticker?.isEnabled ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                      {gameState.ticker?.isEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <Button
                    onClick={handleToggleTicker}
                    className={`text-xs ${
                      gameState.ticker?.isEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {gameState.ticker?.isEnabled ? 'Disable' : 'Enable'} Ticker
                  </Button>
                </div>

                <Button
                  onClick={() => setShowTickerModal(true)}
                  className="w-full bg-amber-600 hover:bg-amber-700"
                >
                  Add News Message
                </Button>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {gameState.ticker?.messages?.map(message => (
                    <div key={message.id} className={`p-3 rounded border ${
                      message.priority === 'urgent' ? 'bg-red-900/20 border-red-600' :
                      message.priority === 'important' ? 'bg-amber-900/20 border-amber-600' :
                      'bg-slate-900/20 border-slate-600'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wide">
                              {message.priority}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${
                              message.isActive ? 'bg-green-400' : 'bg-gray-400'
                            }`}></span>
                          </div>
                          <p className="text-sm">{message.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(message.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <Button
                            onClick={() => handleToggleTickerMessage(message.id)}
                            className={`text-xs py-1 px-2 ${
                              message.isActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
                            }`}
                          >
                            {message.isActive ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            onClick={() => handleDeleteTickerMessage(message.id)}
                            className="bg-red-600 hover:bg-red-700 text-xs py-1 px-2"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) || (
                    <p className="text-gray-400 text-sm text-center py-4">No ticker messages</p>
                  )}
                </div>
              </div>
            </Card>

            <Card title="Login Announcements" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Login Announcements:</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      gameState.loginAnnouncements?.isEnabled ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                      {gameState.loginAnnouncements?.isEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <Button
                    onClick={handleToggleLoginAnnouncements}
                    className={`text-xs ${
                      gameState.loginAnnouncements?.isEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {gameState.loginAnnouncements?.isEnabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>

                <Button
                  onClick={() => setShowLoginAnnouncementModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Add Login Announcement
                </Button>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {gameState.loginAnnouncements?.announcements?.map(announcement => (
                    <div key={announcement.id} className={`p-3 rounded border ${
                      announcement.priority === 'urgent' ? 'bg-red-900/20 border-red-600' :
                      announcement.priority === 'important' ? 'bg-amber-900/20 border-amber-600' :
                      'bg-blue-900/20 border-blue-600'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wide">
                              {announcement.priority}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${
                              announcement.isActive ? 'bg-green-400' : 'bg-gray-400'
                            }`}></span>
                          </div>
                          <h4 className="font-bold text-sm mb-1">{announcement.title}</h4>
                          <p className="text-sm">{announcement.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(announcement.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <Button
                            onClick={() => handleToggleLoginAnnouncement(announcement.id)}
                            className={`text-xs py-1 px-2 ${
                              announcement.isActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
                            }`}
                          >
                            {announcement.isActive ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            onClick={() => handleDeleteLoginAnnouncement(announcement.id)}
                            className="bg-red-600 hover:bg-red-700 text-xs py-1 px-2"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) || (
                    <p className="text-gray-400 text-sm text-center py-4">No login announcements</p>
                  )}
                </div>
              </div>
            </Card>

            <Card title="World Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
                <div className="space-y-4">
                    <p className="text-neutral-400 leading-relaxed">Edit the game world directly or start a new game on the current map.</p>
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={onNavigateToEditor}>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Edit World Map
                    </Button>
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={onNavigateToGameEditor}>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                      Game Editor
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
                  <p className="text-neutral-400 leading-relaxed">Add computer-controlled tribes with different personalities. There are currently <span className="text-amber-400 font-semibold">{aiTribesCount}</span> AI tribes in the game.</p>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-neutral-300">AI Personality</label>
                    <select
                      value={selectedAIType}
                      onChange={(e) => setSelectedAIType(e.target.value as AIType)}
                      className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value={AIType.Wanderer}>🚶 Wanderer - Random movement and exploration</option>
                      <option value={AIType.Aggressive}>⚔️ Aggressive - Focuses on combat and attacking enemies</option>
                      <option value={AIType.Defensive}>🛡️ Defensive - Builds fortifications and defends territory</option>
                      <option value={AIType.Expansionist}>🏗️ Expansionist - Builds outposts and claims territory</option>
                      <option value={AIType.Trader}>💰 Trader - Focuses on resource gathering and trading</option>
                      <option value={AIType.Scavenger}>🔍 Scavenger - Prioritizes scavenging and resource collection</option>
                    </select>
                  </div>

                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                    onClick={() => onAddAITribe(selectedAIType)}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Add {selectedAIType} AI Tribe
                  </Button>

                  <div className="mt-4 p-3 bg-neutral-700/50 rounded-lg">
                    <h4 className="text-sm font-medium text-neutral-300 mb-2">AI Personality Guide:</h4>
                    <div className="text-xs text-neutral-400 space-y-1">
                      <div><strong>Aggressive:</strong> Builds weapons, attacks enemies, focuses on combat</div>
                      <div><strong>Defensive:</strong> Fortifies positions, recruits troops, defends territory</div>
                      <div><strong>Expansionist:</strong> Builds outposts, scouts new areas, claims territory</div>
                      <div><strong>Trader:</strong> Gathers resources, trades with other tribes, diplomatic</div>
                      <div><strong>Scavenger:</strong> Focuses on scavenging, explores for resources</div>
                      <div><strong>Wanderer:</strong> Random behavior, unpredictable movement</div>
                    </div>
                  </div>
              </div>
            </Card>

            <Card title="Auto-Backup System" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Auto-Backup Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      backupStatus?.isRunning ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                      {backupStatus?.isRunning ? 'RUNNING' : 'STOPPED'}
                    </span>
                  </div>
                  <Button
                    onClick={handleRefreshBackupStatus}
                    className="text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    Refresh Status
                  </Button>
                </div>

                {backupStatus && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-neutral-400">Interval:</span>
                      <span className="ml-2 font-medium">{backupStatus.intervalMinutes} minutes</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Backup Count:</span>
                      <span className="ml-2 font-medium">{backupStatus.backupCount}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Last Backup:</span>
                      <span className="ml-2 font-medium">
                        {backupStatus.lastBackup ? new Date(backupStatus.lastBackup).toLocaleString() : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Next Backup:</span>
                      <span className="ml-2 font-medium">
                        {backupStatus.nextBackup ? new Date(backupStatus.nextBackup).toLocaleString() : 'Unknown'}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleCreateManualBackup}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Create Manual Backup Now
                </Button>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  <h4 className="font-medium text-neutral-300">Available Backups:</h4>
                  {backupList.length > 0 ? backupList.map(backup => (
                    <div key={backup.filename} className="p-3 rounded border bg-slate-900/20 border-slate-600">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{backup.filename}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(backup.timestamp).toLocaleString()} • {(backup.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <Button
                            onClick={() => handleDownloadBackup(backup.filename)}
                            className="bg-blue-600 hover:bg-blue-700 text-xs py-1 px-2"
                          >
                            Download
                          </Button>
                          <Button
                            onClick={() => handleDeleteBackup(backup.filename)}
                            className="bg-red-600 hover:bg-red-700 text-xs py-1 px-2"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-400 text-sm text-center py-4">No auto-backups available</p>
                  )}
                </div>
              </div>
            </Card>

            <Card title="Turn Deadline Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Current Deadline:</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      gameState.turnDeadline?.isActive && gameState.turnDeadline.turn === gameState.turn
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-600 text-white'
                    }`}>
                      {gameState.turnDeadline?.isActive && gameState.turnDeadline.turn === gameState.turn
                        ? 'ACTIVE'
                        : 'NONE SET'}
                    </span>
                  </div>
                  <Button
                    onClick={() => setShowDeadlineModal(true)}
                    className="text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    Set Deadline
                  </Button>
                </div>

                {gameState.turnDeadline?.isActive && gameState.turnDeadline.turn === gameState.turn && (
                  <div className="p-3 rounded border bg-blue-900/20 border-blue-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Turn {gameState.turnDeadline.turn} Deadline</p>
                        <p className="text-xs text-gray-400">
                          {new Date(gameState.turnDeadline.deadline).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        onClick={handleClearTurnDeadline}
                        className="bg-red-600 hover:bg-red-700 text-xs py-1 px-2"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}

                <div className="text-sm text-neutral-400">
                  <p>Set a deadline for the current turn to create urgency for players.</p>
                  <p>Players will see a countdown timer in the header showing time remaining.</p>
                </div>
              </div>
            </Card>

            <Card title="Security Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                <div className="p-3 rounded border bg-amber-900/20 border-amber-600">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">⚠️</span>
                    <span className="font-bold text-sm">Security Notice</span>
                  </div>
                  <p className="text-sm text-amber-200">
                    The admin password is currently using environment variable or hardcoded fallback.
                    For production security, set ADMIN_PASSWORD environment variable.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Button
                    onClick={() => setShowAdminPasswordModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-xs"
                  >
                    🔒 Update
                  </Button>

                  <Button
                    onClick={handleResetAdminPassword}
                    className="bg-orange-600 hover:bg-orange-700 text-xs"
                  >
                    🚨 Reset
                  </Button>

                  <Button
                    onClick={handleSyncPasswordWithEnv}
                    className="bg-green-600 hover:bg-green-700 text-xs"
                  >
                    🔄 Sync Env
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleDebugPassword}
                    className="bg-purple-600 hover:bg-purple-700 text-xs"
                  >
                    🔍 Debug Password
                  </Button>

                  <Button
                    onClick={handleDebugSocket}
                    className="bg-blue-600 hover:bg-blue-700 text-xs"
                  >
                    🔗 Debug Socket
                  </Button>
                </div>

                <div className="text-sm text-neutral-400">
                  <p><strong>Safe Migration Steps:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li>Update password using button above</li>
                    <li>Test login with new password</li>
                    <li>Set ADMIN_PASSWORD environment variable on server</li>
                    <li>Restart server to use environment variable</li>
                  </ol>
                </div>
              </div>
            </Card>

            <Card title="Game Data Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                  <p className="text-neutral-400 leading-relaxed">Save the entire game state, all users, passwords, ticker messages, and announcements to a file, or load a previous backup.</p>
                  <Button className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={handleSaveBackup}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Enhanced Backup (with Passwords)
                  </Button>
                  <Button className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={handleLoadBackupClick}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Load Game Backup
                  </Button>
                  <Button className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={() => setShowTurnSummary(true)}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Turn Summary
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

      {showTurnSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-neutral-600">
              <div>
                <h2 className="text-2xl font-bold text-amber-400">Turn {gameState.turn} Summary</h2>
                <div className="flex items-center space-x-4 mt-2">
                  <label className="text-sm text-neutral-300">Include previous turns:</label>
                  <select
                    value={summaryTurnsBack}
                    onChange={(e) => setSummaryTurnsBack(Number(e.target.value))}
                    className="bg-neutral-700 text-white rounded px-2 py-1 text-sm border border-neutral-600"
                  >
                    <option value={1}>Current turn only</option>
                    <option value={2}>Last 2 turns</option>
                    <option value={3}>Last 3 turns</option>
                    <option value={5}>Last 5 turns</option>
                    <option value={10}>Last 10 turns</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => setShowTurnSummary(false)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                {generateTurnSummary(summaryTurnsBack).map((tribe, index) => (
                  <div key={index} className="bg-neutral-700 rounded-lg p-4 border border-neutral-600">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-amber-300">{tribe.tribeName}</h3>
                        <p className="text-neutral-300">
                          Leader: {tribe.playerName} {tribe.isAI ? `(AI - ${tribe.aiType})` : '(Human)'}
                        </p>
                        <p className={`text-sm font-semibold ${tribe.turnSubmitted ? 'text-green-400' : 'text-red-400'}`}>
                          {tribe.turnSubmitted ? '✅ Turn Submitted' : '❌ Turn Not Submitted'}
                        </p>
                      </div>
                      <div className="text-right text-sm text-neutral-400">
                        <p>Home: {tribe.homeBase}</p>
                        <p>Morale: {tribe.morale}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-neutral-600 rounded p-3">
                        <h4 className="font-semibold text-amber-200 mb-2">Resources</h4>
                        <p className="text-sm">Food: {tribe.resources.food}</p>
                        <p className="text-sm">Scrap: {tribe.resources.scrap}</p>
                        <p className="text-sm">Rations: {tribe.rationLevel}</p>
                      </div>

                      <div className="bg-neutral-600 rounded p-3">
                        <h4 className="font-semibold text-amber-200 mb-2">Military</h4>
                        <p className="text-sm">Troops: {tribe.totalTroops}</p>
                        <p className="text-sm">Weapons: {tribe.totalWeapons}</p>
                        <p className="text-sm">Chiefs: {tribe.totalChiefs}</p>
                      </div>

                      <div className="bg-neutral-600 rounded p-3">
                        <h4 className="font-semibold text-amber-200 mb-2">Technology</h4>
                        <p className="text-sm">Completed: {tribe.completedTechs}</p>
                        <p className="text-sm">Research: {tribe.currentResearch}</p>
                      </div>

                      {summaryTurnsBack > 1 && tribe.trends && (
                        <div className="bg-neutral-600 rounded p-3">
                          <h4 className="font-semibold text-amber-200 mb-2">Trends</h4>
                          <p className={`text-sm ${tribe.trends.troopChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            Troops: {tribe.trends.troopChange >= 0 ? '+' : ''}{tribe.trends.troopChange}
                          </p>
                          <p className={`text-sm ${tribe.trends.garrisonChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            Garrisons: {tribe.trends.garrisonChange >= 0 ? '+' : ''}{tribe.trends.garrisonChange}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <h4 className="font-semibold text-amber-200 mb-2">Garrisons ({tribe.garrisons.length})</h4>
                        <div className="text-sm space-y-1 max-h-20 overflow-y-auto">
                          {tribe.garrisons.map((g, i) => (
                            <p key={i} className="text-neutral-300">
                              📍 {g.location}: {g.troops}T, {g.weapons}W, {g.chiefs}C
                            </p>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-amber-200 mb-2">Current Actions ({tribe.currentActions.length})</h4>
                        <div className="text-sm space-y-1 max-h-20 overflow-y-auto">
                          {tribe.currentActions.length > 0 ? (
                            tribe.currentActions.map((a, i) => (
                              <p key={i} className="text-neutral-300">🎯 {a.type}</p>
                            ))
                          ) : (
                            <p className="text-neutral-500">No actions planned</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-amber-200 mb-2">New Chiefs This Turn ({tribe.chiefsAppearedThisTurn.length})</h4>
                        <div className="text-sm space-y-1 max-h-20 overflow-y-auto">
                          {tribe.chiefsAppearedThisTurn.length > 0 ? (
                            tribe.chiefsAppearedThisTurn.map((c, i) => (
                              <p key={i} className="text-green-400">👑 {c.description}</p>
                            ))
                          ) : (
                            <p className="text-neutral-500">No new chiefs</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {summaryTurnsBack > 1 && tribe.history.length > 0 && (
                      <div className="mt-4 bg-neutral-700 rounded p-3">
                        <h4 className="font-semibold text-amber-200 mb-2">Previous Turn History</h4>
                        <div className="text-sm space-y-1 max-h-20 overflow-y-auto">
                          {tribe.history.map((h, i) => (
                            <p key={i} className="text-neutral-300">
                              📈 Turn {h.turn}: {h.troops} troops, {h.garrisons} garrisons, Score: {h.score}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center p-6 border-t border-neutral-600">
              <div className="text-sm text-neutral-400">
                <p>Total Tribes: {generateTurnSummary(summaryTurnsBack).length} |
                   Submitted: {generateTurnSummary(summaryTurnsBack).filter(t => t.turnSubmitted).length}/{generateTurnSummary(summaryTurnsBack).length} |
                   New Chiefs: {generateTurnSummary(summaryTurnsBack).reduce((sum, t) => sum + t.chiefsAppearedThisTurn.length, 0)}
                   {summaryTurnsBack > 1 ? ` | Showing ${summaryTurnsBack} turns` : ''}</p>
              </div>
              <div className="space-x-3">
                <Button onClick={handleDownloadTurnSummary} className="bg-amber-600 hover:bg-amber-700">
                  Download Summary
                </Button>
                <Button onClick={() => setShowTurnSummary(false)} variant="secondary">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetPasswordUserId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-96 border border-neutral-600">
            <h3 className="text-xl font-bold text-amber-400 mb-4">Reset User Password</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  New Password
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <Button onClick={handleCancelPasswordReset} variant="secondary">
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmPasswordReset}
                  disabled={!newPassword.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Reset Password
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticker Message Modal */}
      {showTickerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-96 border border-neutral-600">
            <h3 className="text-xl font-bold text-amber-400 mb-4">Add News Ticker Message</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Priority Level
                </label>
                <select
                  value={newTickerPriority}
                  onChange={(e) => setNewTickerPriority(e.target.value as TickerPriority)}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="normal">📢 Normal</option>
                  <option value="important">⚠️ Important</option>
                  <option value="urgent">🚨 Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Message
                </label>
                <textarea
                  value={newTickerMessage}
                  onChange={(e) => setNewTickerMessage(e.target.value)}
                  placeholder="Enter ticker message..."
                  rows={3}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setShowTickerModal(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddTickerMessage}
                  disabled={!newTickerMessage.trim()}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Add Message
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Announcement Modal */}
      {showLoginAnnouncementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-96 border border-neutral-600">
            <h3 className="text-xl font-bold text-blue-400 mb-4">Add Login Announcement</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Priority Level
                </label>
                <select
                  value={newAnnouncementPriority}
                  onChange={(e) => setNewAnnouncementPriority(e.target.value as TickerPriority)}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="normal">📢 Notice</option>
                  <option value="important">⚠️ Important</option>
                  <option value="urgent">🚨 Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newAnnouncementTitle}
                  onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                  placeholder="e.g., Server Maintenance"
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Message
                </label>
                <textarea
                  value={newAnnouncementMessage}
                  onChange={(e) => setNewAnnouncementMessage(e.target.value)}
                  placeholder="e.g., Server will be down for 30 minutes starting at 3 PM EST"
                  rows={3}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setShowLoginAnnouncementModal(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddLoginAnnouncement}
                  disabled={!newAnnouncementTitle.trim() || !newAnnouncementMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Add Announcement
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Turn Deadline Modal */}
      {showDeadlineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-96 border border-neutral-600">
            <h3 className="text-xl font-bold text-blue-400 mb-4">Set Turn Deadline</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Turn: {gameState.turn}
                </label>
                <p className="text-xs text-neutral-400">
                  Setting deadline for the current turn
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Hours from now
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="168"
                    value={deadlineHours}
                    onChange={(e) => setDeadlineHours(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={deadlineMinutes}
                    onChange={(e) => setDeadlineMinutes(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded bg-blue-900/20 border border-blue-600">
                <p className="text-sm font-medium text-blue-300">
                  Deadline will be set for:
                </p>
                <p className="text-sm text-blue-200">
                  {new Date(Date.now() + (deadlineHours * 60 * 60 * 1000) + (deadlineMinutes * 60 * 1000)).toLocaleString()}
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setShowDeadlineModal(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSetTurnDeadline}
                  disabled={deadlineHours === 0 && deadlineMinutes === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Set Deadline
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Password Modal */}
      {showAdminPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-96 border border-neutral-600">
            <h3 className="text-xl font-bold text-red-400 mb-4">🔒 Update Admin Password</h3>

            <div className="space-y-4">
              <div className="p-3 rounded bg-red-900/20 border border-red-600">
                <p className="text-sm font-medium text-red-300 mb-2">
                  ⚠️ Important Security Update
                </p>
                <p className="text-sm text-red-200">
                  This will immediately update the admin password. Make sure you remember the new password!
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  New Admin Password
                </label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Enter new secure password (min 6 characters)"
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="p-3 rounded bg-blue-900/20 border border-blue-600">
                <p className="text-sm font-medium text-blue-300 mb-1">
                  Next Steps After Update:
                </p>
                <ol className="text-sm text-blue-200 list-decimal list-inside space-y-1">
                  <li>Test login with new password</li>
                  <li>Set ADMIN_PASSWORD environment variable</li>
                  <li>Restart server for full security</li>
                </ol>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => {
                    setShowAdminPasswordModal(false);
                    setNewAdminPassword('');
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateAdminPassword}
                  disabled={newAdminPassword.length < 6}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Update Password
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;