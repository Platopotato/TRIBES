/** @jsxImportSource react */
import React, { useState, useRef, useEffect } from 'react';
import { Tribe, User, GameState, FullBackupState, ChiefRequest, AssetRequest, AIType, LoginAnnouncement, BackupStatus, BackupFile, TurnDeadline, Newsletter, getTechnology } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import ConfirmationModal from './ui/ConfirmationModal';
import NewsletterEditor from './NewsletterEditor';
import * as Auth from '../lib/auth';
import * as client from '../lib/client';

interface AdminPanelProps {
  gameState: GameState;
  users: User[];
  currentUser: User;
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
  console.log('🛠️ AdminPanel rendering with props:', { gameState: !!props.gameState, users: props.users?.length, currentUser: !!props.currentUser });
  const { gameState, users, currentUser, onBack, onNavigateToEditor, onNavigateToGameEditor, onProcessTurn, onRemovePlayer, onStartNewGame, onLoadBackup, onApproveChief, onDenyChief, onApproveAsset, onDenyAsset, onAddAITribe } = props;


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

  const [userToRemove, setUserToRemove] = useState<User | null>(null);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showTurnSummary, setShowTurnSummary] = useState(false);
  const [showNewsletterSummary, setShowNewsletterSummary] = useState(false);
  const [summaryTurnsBack, setSummaryTurnsBack] = useState(1); // How many turns back to include
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [showLoginAnnouncementModal, setShowLoginAnnouncementModal] = useState(false);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState('');
  const [newAnnouncementType, setNewAnnouncementType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<any>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);

  // AI Management state
  const [showAIManagementModal, setShowAIManagementModal] = useState(false);
  const [showAddAIModal, setShowAddAIModal] = useState(false);
  const [selectedAIType, setSelectedAIType] = useState<string>('Aggressive');
  const [selectedSpawnLocation, setSelectedSpawnLocation] = useState('');
  const [aiTribeName, setAITribeName] = useState('');
  const [aiBackstory, setAIBackstory] = useState('');
  const [backupList, setBackupList] = useState<BackupFile[]>([]);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [deadlineMinutes, setDeadlineMinutes] = useState(0);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Safety features
  const [safetyLockEnabled, setSafetyLockEnabled] = useState(true);
  const [dangerousActionConfirmStep, setDangerousActionConfirmStep] = useState<string | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [processTurnConfirmStep, setProcessTurnConfirmStep] = useState(0); // 0=not started, 1=first confirm, 2=final confirm

  // Game suspension
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  const [suspensionMessage, setSuspensionMessage] = useState('We are currently performing essential maintenance. Please check back shortly.');



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

  // Safety handlers
  const handleSafetyLockToggle = () => {
    if (!safetyLockEnabled) {
      // Enabling safety lock - no confirmation needed
      setSafetyLockEnabled(true);
      setDangerousActionConfirmStep(null);
      setConfirmationText('');
      setProcessTurnConfirmStep(0);
    } else {
      // Disabling safety lock - require confirmation
      const confirmed = confirm('⚠️ DISABLE SAFETY LOCK?\n\nThis will enable dangerous admin actions that could break the game.\n\nOnly disable if you are absolutely sure you need to perform dangerous operations.');
      if (confirmed) {
        setSafetyLockEnabled(false);
      }
    }
  };

  const handleDangerousAction = (actionType: string, actionHandler: () => void) => {
    if (safetyLockEnabled) {
      alert('🔒 Safety Lock Enabled\n\nDangerous actions are locked. Disable the safety lock first to access this feature.');
      return;
    }

    if (dangerousActionConfirmStep !== actionType) {
      setDangerousActionConfirmStep(actionType);
      setConfirmationText('');
      return;
    }

    // Second step - require typing confirmation
    const requiredText = 'I UNDERSTAND THE RISKS';
    if (confirmationText !== requiredText) {
      alert(`Please type exactly: ${requiredText}`);
      return;
    }

    // Final confirmation
    const finalConfirm = confirm(`🚨 FINAL CONFIRMATION\n\nYou are about to perform: ${actionType}\n\nThis action cannot be undone. Are you absolutely sure?`);
    if (finalConfirm) {
      actionHandler();
      setDangerousActionConfirmStep(null);
      setConfirmationText('');
    }
  };

  const handleProcessTurnSafely = () => {
    if (safetyLockEnabled) {
      alert('🔒 Safety Lock Enabled\n\nProcess Turn is locked. Disable the safety lock first.');
      return;
    }

    if (processTurnConfirmStep === 0) {
      setProcessTurnConfirmStep(1);
      return;
    }

    if (processTurnConfirmStep === 1) {
      const confirmed = confirm('⚠️ PROCESS ALL TURNS?\n\nThis will:\n- Execute all pending tribe actions\n- Advance the game to the next turn\n- Generate AI actions for inactive tribes\n- Update all game statistics\n\nThis cannot be undone. Continue?');
      if (confirmed) {
        setProcessTurnConfirmStep(2);
        return;
      } else {
        setProcessTurnConfirmStep(0);
        return;
      }
    }

    if (processTurnConfirmStep === 2) {
      const finalConfirm = confirm('🚨 FINAL CONFIRMATION\n\nYou are about to PROCESS ALL TURNS.\n\nThis is the point of no return. Are you absolutely certain?');
      if (finalConfirm) {
        console.log('🚨 FINAL STEP: Calling onProcessTurn()');
        onProcessTurn();
        setProcessTurnConfirmStep(0);
        console.log('✅ FINAL STEP: onProcessTurn() called, step reset to 0');
      } else {
        console.log('❌ FINAL STEP: User cancelled final confirmation');
        setProcessTurnConfirmStep(0);
      }
    }
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



  // Fetch current announcement on component mount
  useEffect(() => {
    fetchCurrentAnnouncement();
  }, []);

  const fetchCurrentAnnouncement = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/login-announcement`);
      const data = await response.json();
      if (data.announcement) {
        setCurrentAnnouncement(data.announcement);
        setNewAnnouncementTitle(data.announcement.title);
        setNewAnnouncementMessage(data.announcement.message);
        setNewAnnouncementType(data.announcement.type);
        setAnnouncementEnabled(data.announcement.enabled);
      }
    } catch (error) {
      console.error('Failed to fetch announcement:', error);
    }
  };

  const handleUpdateLoginAnnouncement = async () => {
    if (newAnnouncementTitle.trim() && newAnnouncementMessage.trim()) {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/login-announcement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enabled: announcementEnabled,
            title: newAnnouncementTitle.trim(),
            message: newAnnouncementMessage.trim(),
            type: newAnnouncementType
          }),
        });

        if (response.ok) {
          await fetchCurrentAnnouncement(); // Refresh the current announcement
          setShowLoginAnnouncementModal(false);
          console.log('✅ Announcement updated successfully');
        } else {
          console.error('❌ Failed to update announcement');
        }
      } catch (error) {
        console.error('❌ Error updating announcement:', error);
      }
    }
  };

  const handleToggleLoginAnnouncements = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const newEnabledState = !announcementEnabled;

      const response = await fetch(`${apiUrl}/api/login-announcement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: newEnabledState,
          title: newAnnouncementTitle || 'Welcome!',
          message: newAnnouncementMessage || 'Welcome to Radix Tribes!',
          type: newAnnouncementType
        }),
      });

      if (response.ok) {
        setAnnouncementEnabled(newEnabledState);
        await fetchCurrentAnnouncement();
        console.log(`✅ Announcements ${newEnabledState ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('❌ Error toggling announcements:', error);
    }
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

  // Game suspension handlers
  const handleToggleGameSuspension = () => {
    console.log('🚨 Suspension toggle clicked. Current state:', {
      suspended: gameState.suspended,
      suspensionMessage: gameState.suspensionMessage
    });

    if (gameState.suspended) {
      // Resume game
      if (confirm('Resume the game? Players will be able to access the game again.')) {
        console.log('🚨 Resuming game...');
        client.toggleGameSuspension(false, '');
      }
    } else {
      // Suspend game - show modal for custom message
      console.log('🚨 Opening suspension modal...');
      setShowSuspensionModal(true);
    }
  };

  const handleConfirmSuspension = () => {
    console.log('🚨 Confirming suspension with message:', suspensionMessage.trim());
    if (suspensionMessage.trim()) {
      client.toggleGameSuspension(true, suspensionMessage.trim());
      setShowSuspensionModal(false);
    } else {
      alert('Please enter a maintenance message for players.');
    }
  };

  const handleSyncPasswordWithEnv = () => {
    if (confirm('🔄 SYNC: This will update the database password to match the ADMIN_PASSWORD environment variable. Continue?')) {
      client.syncPasswordWithEnv();
    }
  };

  const handleSaveNewsletter = (newsletter: Omit<Newsletter, 'id' | 'publishedAt'>) => {
    client.saveNewsletter(newsletter);
  };

  const handlePublishNewsletter = (newsletterId: string) => {
    client.publishNewsletter(newsletterId);
  };

  const handleUnpublishNewsletter = (newsletterId: string) => {
    client.unpublishNewsletter(newsletterId);
  };

  const handleUploadNewsletter = (newsletter: Omit<Newsletter, 'id' | 'publishedAt'>) => {
    console.log(`📤 Uploading newsletter for turn ${newsletter.turn}:`, newsletter.title);
    client.saveNewsletter(newsletter);
  };

  // AI Management handlers
  const handleAddAITribe = () => {
    if (!selectedSpawnLocation) {
      alert('Please select a spawn location for the AI tribe');
      return;
    }

    const aiData = {
      aiType: selectedAIType,
      spawnLocation: selectedSpawnLocation,
      customName: aiTribeName.trim() || undefined,
      backstory: aiBackstory.trim() || undefined
    };

    console.log('🤖 ADMIN: Adding AI tribe with data:', aiData);
    client.addAITribeAdvanced(aiData);
    setShowAddAIModal(false);
    setAITribeName('');
    setAIBackstory('');
    setSelectedSpawnLocation('');
  };

  const handleRemoveAITribe = (tribeId: string) => {
    if (confirm('Are you sure you want to remove this AI tribe? This action cannot be undone.')) {
      client.removeAITribe(tribeId);
    }
  };

  const handleBulkRemoveAI = () => {
    const aiTribes = gameState.tribes.filter(t => t.isAI);
    if (aiTribes.length === 0) {
      alert('No AI tribes to remove');
      return;
    }

    if (confirm(`Are you sure you want to remove all ${aiTribes.length} AI tribes? This action cannot be undone.`)) {
      aiTribes.forEach(tribe => client.removeAITribe(tribe.id));
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
    if (safetyLockEnabled) {
      alert('🔒 Safety Lock Enabled\n\nLoad Backup is locked. Disable the safety lock first.');
      return;
    }

    if (dangerousActionConfirmStep !== 'LOAD_BACKUP') {
      setDangerousActionConfirmStep('LOAD_BACKUP');
      setConfirmationText('');
      return;
    }

    const requiredText = 'I UNDERSTAND THE RISKS';
    if (confirmationText !== requiredText) {
      alert(`Please type exactly: ${requiredText}`);
      return;
    }

    const finalConfirm = confirm('🚨 FINAL CONFIRMATION\n\nYou are about to LOAD A BACKUP.\n\nThis will REPLACE ALL current game data including:\n- All tribes and their progress\n- All user accounts\n- All game settings\n- Current turn progress\n\nThis action cannot be undone. Are you absolutely sure?');
    if (finalConfirm) {
      fileInputRef.current?.click();
      setDangerousActionConfirmStep(null);
      setConfirmationText('');
    }
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

  const generateNewsletterSummary = (turnsBack: number = 1) => {
    const targetTurn = gameState.turn - turnsBack;
    const detailedHistory = gameState.detailedHistory || [];

    // Find the detailed history record for the target turn
    const turnRecord = detailedHistory.find(record => record.turn === targetTurn);

    if (!turnRecord) {
      // If no detailed history exists, generate summary from current game state
      if (detailedHistory.length === 0 && turnsBack === 1) {
        return generateCurrentStateNewsletter();
      }

      return {
        error: `No detailed history found for turn ${targetTurn}`,
        availableTurns: detailedHistory.map(r => r.turn)
      };
    }

    // Generate comprehensive newsletter content
    const newsletterData = {
      turn: targetTurn,
      summary: turnRecord.turnSummary,
      globalEvents: turnRecord.globalEvents,
      tribes: turnRecord.tribeRecords.map(tribe => ({
        name: tribe.tribeName,
        player: tribe.playerName,
        isAI: tribe.isAI,
        rank: tribe.rank,
        score: tribe.score,
        troops: tribe.troops,
        garrisons: tribe.garrisons,
        chiefs: tribe.chiefs,
        chiefNames: tribe.chiefNames || [],
        actions: tribe.actions.map(action => ({
          type: action.actionType,
          location: action.location,
          result: action.result,
          success: action.success,
          resourcesSpent: action.resourcesSpent,
          resourcesGained: action.resourcesGained,
          troopsInvolved: action.troopsInvolved
        })),
        majorEvents: tribe.majorEvents,
        resourceChanges: tribe.resourceChanges,
        territoryChanges: tribe.territoryChanges,
        militaryChanges: tribe.militaryChanges,
        researchProgress: tribe.researchProgress,
        diplomaticEvents: tribe.diplomaticEvents
      })),
      statistics: {
        totalActions: turnRecord.tribeRecords.reduce((sum, tribe) => sum + tribe.actions.length, 0),
        researchCompletions: turnRecord.tribeRecords.reduce((sum, tribe) => sum + tribe.researchProgress.completed.length, 0),
        majorEvents: turnRecord.tribeRecords.reduce((sum, tribe) => sum + tribe.majorEvents.length, 0),
        activePlayers: turnRecord.tribeRecords.filter(t => !t.isAI).length,
        aiTribes: turnRecord.tribeRecords.filter(t => t.isAI).length
      }
    };

    return newsletterData;
  };

  const generateCurrentStateNewsletter = () => {
    // Generate newsletter summary from current game state when no detailed history exists
    const currentTurn = gameState.turn;

    // Calculate scores and rank tribes
    const tribesWithScores = allTribes.map(tribe => {
      const troops = Object.values(tribe.garrisons || {}).reduce((sum, g) => sum + g.troops, 0);
      const garrisons = Object.keys(tribe.garrisons || {}).length;
      const chiefs = Object.values(tribe.garrisons || {}).reduce((sum, g) => sum + (g.chiefs?.length || 0), 0);
      const chiefNames = Object.values(tribe.garrisons || {})
        .flatMap(garrison => garrison.chiefs || [])
        .map(chief => chief.name);

      // Simple score calculation (can be improved)
      const score = troops * 10 + garrisons * 50 + chiefs * 100 + (tribe.globalResources?.food || 0) + (tribe.globalResources?.scrap || 0);

      return {
        name: tribe.tribeName,
        player: tribe.playerName,
        isAI: tribe.isAI || false,
        rank: 0, // Will be set after sorting
        score,
        troops,
        garrisons,
        chiefs,
        chiefNames,
        actions: tribe.lastTurnResults.map(result => ({
          type: result.actionType,
          location: result.actionData?.location || 'Unknown',
          result: result.result || 'No result',
          success: !result.result?.includes('failed') && !result.result?.includes('error'),
          resourcesSpent: {},
          resourcesGained: {},
          troopsInvolved: 0
        })),
        majorEvents: [],
        resourceChanges: {
          food: { before: 0, after: tribe.globalResources?.food || 0, change: 0 },
          scrap: { before: 0, after: tribe.globalResources?.scrap || 0, change: 0 },
          morale: { before: 50, after: tribe.globalResources?.morale || 50, change: 0 }
        },
        territoryChanges: { gained: [], lost: [], netChange: 0 },
        militaryChanges: { troopsGained: 0, troopsLost: 0, weaponsGained: 0, weaponsLost: 0, netTroopChange: 0, netWeaponChange: 0 },
        researchProgress: { started: [], completed: [], ongoing: tribe.currentResearch?.map(r => r.techId) || [] },
        diplomaticEvents: []
      };
    }).sort((a, b) => b.score - a.score).map((tribe, index) => ({ ...tribe, rank: index + 1 }));

    return {
      turn: currentTurn,
      summary: `Current game state summary for Turn ${currentTurn}. ${tribesWithScores.filter(t => !t.isAI).length} player tribes and ${tribesWithScores.filter(t => t.isAI).length} AI tribes are active.`,
      globalEvents: ['Game in progress - detailed history will be available after turn processing'],
      tribes: tribesWithScores,
      statistics: {
        totalActions: tribesWithScores.reduce((sum, tribe) => sum + tribe.actions.length, 0),
        researchCompletions: 0,
        majorEvents: 0,
        activePlayers: tribesWithScores.filter(t => !t.isAI).length,
        aiTribes: tribesWithScores.filter(t => t.isAI).length
      }
    };
  };

  const generateTurnSummary = (turnsBack: number = 1) => {
    const currentTurn = gameState.turn;
    const summarizedTurn = currentTurn - turnsBack;
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
        .map(result => {
          const resultText = result.result || '';
          // Extract chief name from common patterns
          let chiefName = 'Unknown Chief';

          // Pattern: "Chief [Name] has joined"
          const joinedMatch = resultText.match(/Chief\s+([A-Za-z\s]+)\s+has\s+joined/i);
          if (joinedMatch) {
            chiefName = joinedMatch[1].trim();
          }

          // Pattern: "approved for Chief [Name]"
          const approvedMatch = resultText.match(/approved.*?Chief\s+([A-Za-z\s]+)/i);
          if (approvedMatch) {
            chiefName = approvedMatch[1].trim();
          }

          // Pattern: "[Name] approved"
          const nameApprovedMatch = resultText.match(/([A-Za-z\s]+)\s+approved/i);
          if (nameApprovedMatch && !resultText.includes('request')) {
            chiefName = nameApprovedMatch[1].trim();
          }

          return {
            type: result.actionType,
            name: chiefName,
            description: result.result || 'Chief acquired'
          };
        });

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

      // Detect if this is a new tribe (joined this turn or recently)
      const isNewTribe = currentTurn <= 2 || tribeHistory.length === 0 ||
        tribe.lastTurnResults.some(result =>
          result.result?.includes('joined the game') ||
          result.result?.includes('tribe created') ||
          result.result?.includes('new tribe')
        );

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
        isNewTribe: isNewTribe,
        morale: tribe.globalResources.morale,
        rationLevel: tribe.rationLevel,
        completedTechs: tribe.completedTechs.length,
        currentResearch: tribe.currentResearch && tribe.currentResearch.length > 0 ?
          tribe.currentResearch.map(project => getTechnology(project.techId)?.name || 'Unknown').join(', ') : 'None',
        history: tribeHistory,
        trends: trends
      };
    });

    return summary;
  };

  const handleDownloadTurnSummary = () => {
    const summary = generateTurnSummary(summaryTurnsBack);
    const summarizedTurn = gameState.turn - summaryTurnsBack;
    const summaryText = `RADIX TRIBES - TURN ${summarizedTurn} SUMMARY
Current Turn: ${gameState.turn} | Summarizing: Turn ${summarizedTurn} Results
Generated: ${new Date().toLocaleString()}
============================================

${summary.map(tribe => `
TRIBE: ${tribe.tribeName} ${tribe.isNewTribe ? '🆕 NEW TRIBE - JUST STARTED!' : ''}
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
  tribe.chiefsAppearedThisTurn.map(c => `  👑 ${c.description} (via ${c.type})`).join('\n') :
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

  console.log('🛠️ AdminPanel about to render main content');

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

        {/* Safety Zone Headers */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-4 bg-neutral-800/50 rounded-lg px-6 py-3 border border-neutral-600">
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-4 rounded-full ${safetyLockEnabled ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="text-lg font-bold text-neutral-200">
                  Admin Safety Status: {safetyLockEnabled ? 'PROTECTED' : 'UNLOCKED'}
                </span>
              </div>
              {!safetyLockEnabled && (
                <div className="text-orange-400 text-sm font-medium">
                  ⚠️ Dangerous actions enabled
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-green-900/20 border border-green-600/50 rounded-lg p-4">
              <div className="text-green-400 font-bold text-lg mb-2">🟢 SAFE ZONE</div>
              <p className="text-green-300 text-sm">View data, approve requests, manage settings</p>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4">
              <div className="text-yellow-400 font-bold text-lg mb-2">🟡 MODERATE ZONE</div>
              <p className="text-yellow-300 text-sm">User management, backups, AI tribes</p>
            </div>
            <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4">
              <div className="text-red-400 font-bold text-lg mb-2">🔴 DANGER ZONE</div>
              <p className="text-red-300 text-sm">Turn processing, new games, data loading</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="space-y-8 xl:col-span-2">
            {/* SAFE ZONE - Always accessible */}
            <div className="border-l-4 border-green-500 pl-4">
              <h2 className="text-xl font-bold text-green-400 mb-4">🟢 SAFE ZONE - View & Approve</h2>

            {/* Game Suspension Control */}
            <Card title="🚨 Game Access Control" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50 mb-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-600">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full ${gameState.suspended ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                    <div>
                      <span className="text-lg font-bold text-neutral-200">
                        Game Status: {gameState.suspended ? 'SUSPENDED' : 'ACTIVE'}
                      </span>
                      {gameState.suspended && gameState.suspensionMessage && (
                        <p className="text-sm text-orange-300 mt-1">"{gameState.suspensionMessage}"</p>
                      )}
                      <p className="text-xs text-neutral-500 mt-1">
                        Debug: suspended={String(gameState.suspended)}, message="{gameState.suspensionMessage || 'none'}"
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleToggleGameSuspension}
                    className={`px-6 py-2 font-bold ${
                      gameState.suspended
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {gameState.suspended ? '✅ Resume Game' : '🚨 Suspend Game'}
                  </Button>
                </div>
                <p className="text-sm text-neutral-400">
                  {gameState.suspended
                    ? 'Game is currently suspended. Players cannot access the game and will see a maintenance message.'
                    : 'Game is active. Players can access all features normally.'
                  }
                </p>
              </div>
            </Card>

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
                    {/* Safety Lock Status */}
                    <div className="mb-4 p-3 rounded-lg bg-neutral-700/50 border border-neutral-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${safetyLockEnabled ? 'bg-red-500' : 'bg-green-500'}`}></div>
                          <span className="text-sm font-medium text-neutral-300">
                            Safety Lock: {safetyLockEnabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                        <Button
                          onClick={handleSafetyLockToggle}
                          className={`text-xs px-3 py-1 ${safetyLockEnabled ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                          {safetyLockEnabled ? '🔓 Disable' : '🔒 Enable'}
                        </Button>
                      </div>
                      {!safetyLockEnabled && (
                        <p className="text-xs text-orange-400 mt-2">⚠️ Dangerous actions are now available. Use with extreme caution!</p>
                      )}
                    </div>

                    {/* Process Turn Button with Multi-Step Safety */}
                    <div className="space-y-2">
                      {processTurnConfirmStep === 0 && (
                        <Button
                          onClick={handleProcessTurnSafely}
                          disabled={safetyLockEnabled}
                          className={`w-full font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-200 ${
                            safetyLockEnabled
                              ? 'bg-gray-500 cursor-not-allowed opacity-50'
                              : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white hover:shadow-xl transform hover:scale-[1.02]'
                          }`}
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {safetyLockEnabled ? '🔒 Process All Turns (LOCKED)' : 'Process All Turns'}
                        </Button>
                      )}

                      {processTurnConfirmStep === 1 && (
                        <div className="space-y-2">
                          <div className="p-3 bg-orange-900/50 border border-orange-600 rounded-lg">
                            <p className="text-orange-300 text-sm font-medium">⚠️ Step 1 of 2: Confirm Turn Processing</p>
                            <p className="text-orange-200 text-xs mt-1">This will execute all pending actions and advance the game turn.</p>
                          </div>
                          <div className="flex space-x-2">
                            <Button onClick={handleProcessTurnSafely} className="flex-1 bg-orange-600 hover:bg-orange-700">
                              Continue →
                            </Button>
                            <Button onClick={() => setProcessTurnConfirmStep(0)} className="bg-gray-600 hover:bg-gray-700">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {processTurnConfirmStep === 2 && (
                        <div className="space-y-2">
                          <div className="p-3 bg-red-900/50 border border-red-600 rounded-lg">
                            <p className="text-red-300 text-sm font-medium">🚨 Step 2 of 2: Final Confirmation</p>
                            <p className="text-red-200 text-xs mt-1">This action cannot be undone. Click to proceed with turn processing.</p>
                          </div>
                          <div className="flex space-x-2">
                            <Button onClick={handleProcessTurnSafely} className="flex-1 bg-red-600 hover:bg-red-700 font-bold">
                              🚨 PROCESS TURNS NOW
                            </Button>
                            <Button onClick={() => setProcessTurnConfirmStep(0)} className="bg-gray-600 hover:bg-gray-700">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
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
              <div className="space-y-4">
                <p className="text-neutral-400 leading-relaxed">
                  Manage all registered users. Removing a player will permanently delete their account and associated tribe.
                  <span className="text-amber-400 font-semibold"> Perfect for cleaning up test accounts!</span>
                </p>
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
              </div>
            </Card>
          </div>

          <div className="space-y-8">


            <Card title="Login Announcements (File-Based)" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Login Announcements:</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      announcementEnabled ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                      {announcementEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <Button
                    onClick={handleToggleLoginAnnouncements}
                    className={`text-xs ${
                      announcementEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {announcementEnabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>

                <Button
                  onClick={() => setShowLoginAnnouncementModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Edit Login Announcement
                </Button>

                {currentAnnouncement && (
                  <div className={`p-3 rounded border ${
                    currentAnnouncement.type === 'error' ? 'bg-red-900/20 border-red-600' :
                    currentAnnouncement.type === 'warning' ? 'bg-amber-900/20 border-amber-600' :
                    currentAnnouncement.type === 'success' ? 'bg-green-900/20 border-green-600' :
                    'bg-blue-900/20 border-blue-600'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-bold uppercase tracking-wide">
                            {currentAnnouncement.type}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${
                            currentAnnouncement.enabled ? 'bg-green-400' : 'bg-gray-400'
                          }`}></span>
                        </div>
                        <h4 className="font-bold text-sm mb-1">{currentAnnouncement.title}</h4>
                        <p className="text-sm whitespace-pre-line">{currentAnnouncement.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Last updated: {new Date(currentAnnouncement.lastUpdated).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!currentAnnouncement && (
                  <p className="text-gray-400 text-sm text-center py-4">No announcement configured</p>
                )}
              </div>
            </Card>

            <Card title="AI Tribe Management" className="bg-gradient-to-br from-purple-800/90 to-purple-900/90 backdrop-blur-sm border-purple-600/50">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => setShowAIManagementModal(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    🤖 Manage AI Tribes
                  </Button>
                  <Button
                    onClick={() => setShowAddAIModal(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    ➕ Add AI Tribe
                  </Button>
                </div>

                <div className="bg-purple-900/20 border border-purple-600 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-300">Current AI Tribes:</span>
                    <span className="text-xs text-purple-400">
                      {gameState.tribes.filter(t => t.isAI).length} active
                    </span>
                  </div>

                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {gameState.tribes.filter(t => t.isAI).map(tribe => (
                      <div key={tribe.id} className="flex items-center justify-between p-2 bg-purple-800/30 rounded">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{tribe.icon}</span>
                          <div>
                            <div className="text-sm font-medium text-purple-200">{tribe.tribeName}</div>
                            <div className="text-xs text-purple-400">{tribe.aiType} • {tribe.location}</div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRemoveAITribe(tribe.id)}
                          className="bg-red-600 hover:bg-red-700 text-xs py-1 px-2"
                        >
                          Remove
                        </Button>
                      </div>
                    )) || (
                      <p className="text-purple-400 text-sm text-center py-2">No AI tribes active</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Newsletter Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                <p className="text-neutral-400 leading-relaxed">
                  Create and publish newsletters for each turn. Players will see these instead of PDF downloads.
                </p>

                {(() => {
                  console.log('📰 AdminPanel Newsletter State:', {
                    turn: gameState.turn,
                    hasNewsletterField: !!gameState.newsletter,
                    newslettersCount: gameState.newsletter?.newsletters?.length || 0,
                    hasCurrentNewsletter: !!gameState.newsletter?.currentNewsletter
                  });
                  return null;
                })()}
                <NewsletterEditor
                  currentTurn={gameState.turn}
                  currentNewsletter={gameState.newsletter?.currentNewsletter}
                  allNewsletters={gameState.newsletter?.newsletters || []}
                  onSave={handleSaveNewsletter}
                  onPublish={handlePublishNewsletter}
                  onUnpublish={handleUnpublishNewsletter}
                  onUploadNewsletter={handleUploadNewsletter}
                />
              </div>
            </Card>

            </div>

            {/* DANGER ZONE - Requires safety lock to be disabled */}
            <div className="border-l-4 border-red-500 pl-4">
              <h2 className="text-xl font-bold text-red-400 mb-4">🔴 DANGER ZONE - Game Breaking Actions</h2>
              {safetyLockEnabled && (
                <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4 mb-6">
                  <p className="text-red-300 text-sm">
                    🔒 <strong>Safety Lock Enabled:</strong> Dangerous actions are locked to prevent accidental game damage.
                    Disable the safety lock above to access these features.
                  </p>
                </div>
              )}

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
                    {dangerousActionConfirmStep === 'START_NEW_GAME' ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-red-900/50 border border-red-600 rounded-lg">
                          <p className="text-red-300 text-sm font-medium">🚨 DANGEROUS ACTION: Start New Game</p>
                          <p className="text-red-200 text-xs mt-1">This will DELETE ALL tribes, requests, and game progress!</p>
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Type "I UNDERSTAND THE RISKS" to continue:</label>
                          <input
                            type="text"
                            value={confirmationText}
                            onChange={(e) => setConfirmationText(e.target.value)}
                            className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded text-white text-sm"
                            placeholder="I UNDERSTAND THE RISKS"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => handleDangerousAction('START_NEW_GAME', () => setShowNewGameConfirm(true))}
                            disabled={confirmationText !== 'I UNDERSTAND THE RISKS'}
                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            🚨 CONFIRM START NEW GAME
                          </Button>
                          <Button
                            onClick={() => {
                              setDangerousActionConfirmStep(null);
                              setConfirmationText('');
                            }}
                            className="bg-gray-600 hover:bg-gray-700"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        className={`w-full font-semibold py-3 px-4 rounded-lg shadow-lg transition-all duration-200 ${
                          safetyLockEnabled
                            ? 'bg-gray-500 cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white hover:shadow-xl transform hover:scale-[1.02]'
                        }`}
                        onClick={() => handleDangerousAction('START_NEW_GAME', () => setShowNewGameConfirm(true))}
                        disabled={safetyLockEnabled}
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {safetyLockEnabled ? '🔒 Start New Game (LOCKED)' : 'Start New Game'}
                      </Button>
                    )}
                </div>
            </Card>
            
            </div>

            {/* MODERATE ZONE - Requires some caution */}
            <div className="border-l-4 border-yellow-500 pl-4">
              <h2 className="text-xl font-bold text-yellow-400 mb-4">🟡 MODERATE ZONE - Use With Caution</h2>

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
                    onClick={() => setShowAddAIModal(true)}
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
                  <p className="text-neutral-400 leading-relaxed">Save the entire game state, all users, passwords, and announcements to a file, or load a previous backup.</p>
                  <Button className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={handleSaveBackup}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Enhanced Backup (with Passwords)
                  </Button>
                  {dangerousActionConfirmStep === 'LOAD_BACKUP' ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-red-900/50 border border-red-600 rounded-lg">
                        <p className="text-red-300 text-sm font-medium">🚨 DANGEROUS ACTION: Load Backup</p>
                        <p className="text-red-200 text-xs mt-1">This will REPLACE ALL current game data and cannot be undone!</p>
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Type "I UNDERSTAND THE RISKS" to continue:</label>
                        <input
                          type="text"
                          value={confirmationText}
                          onChange={(e) => setConfirmationText(e.target.value)}
                          className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded text-white text-sm"
                          placeholder="I UNDERSTAND THE RISKS"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={handleLoadBackupClick}
                          disabled={confirmationText !== 'I UNDERSTAND THE RISKS'}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          🚨 CONFIRM LOAD BACKUP
                        </Button>
                        <Button
                          onClick={() => {
                            setDangerousActionConfirmStep(null);
                            setConfirmationText('');
                          }}
                          className="bg-gray-600 hover:bg-gray-700"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className={`w-full font-semibold py-3 px-4 rounded-lg shadow-lg transition-all duration-200 ${
                        safetyLockEnabled
                          ? 'bg-gray-500 cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white hover:shadow-xl transform hover:scale-[1.02]'
                      }`}
                      onClick={handleLoadBackupClick}
                      disabled={safetyLockEnabled}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      {safetyLockEnabled ? '🔒 Load Game Backup (LOCKED)' : 'Load Game Backup'}
                    </Button>
                  )}
                  <Button className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={() => setShowTurnSummary(true)}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Turn Summary
                  </Button>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" onClick={() => setShowNewsletterSummary(true)}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    Newsletter Summary
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

            </div> {/* End Danger Zone */}
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
                <h2 className="text-2xl font-bold text-amber-400">
                  Turn {gameState.turn - summaryTurnsBack} Results Summary
                </h2>
                <p className="text-sm text-neutral-300 mt-1">
                  Current Turn: {gameState.turn} | Showing results from Turn {gameState.turn - summaryTurnsBack}
                </p>
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
                        <h3 className="text-xl font-bold text-amber-300">
                          {tribe.tribeName}
                          {tribe.isNewTribe && (
                            <span className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                              🆕 NEW TRIBE
                            </span>
                          )}
                        </h3>
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
                              <p key={i} className="text-green-400">👑 {c.description} <span className="text-neutral-400">(via {c.type})</span></p>
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



      {/* Login Announcement Modal */}
      {showLoginAnnouncementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-96 border border-neutral-600">
            <h3 className="text-xl font-bold text-blue-400 mb-4">Edit Login Announcement</h3>

            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-2 mb-4">
                  <input
                    type="checkbox"
                    checked={announcementEnabled}
                    onChange={(e) => setAnnouncementEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-neutral-300">Enable announcement</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Type
                </label>
                <select
                  value={newAnnouncementType}
                  onChange={(e) => setNewAnnouncementType(e.target.value as 'info' | 'warning' | 'success' | 'error')}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="info">📢 Info</option>
                  <option value="success">✅ Success</option>
                  <option value="warning">⚠️ Warning</option>
                  <option value="error">🚨 Error</option>
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
                  placeholder="e.g., Welcome to Radix Tribes!"
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Message (supports line breaks)
                </label>
                <textarea
                  value={newAnnouncementMessage}
                  onChange={(e) => setNewAnnouncementMessage(e.target.value)}
                  placeholder="e.g., New features and improvements are being added regularly.&#10;&#10;Check back often for updates!"
                  rows={4}
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
                  onClick={handleUpdateLoginAnnouncement}
                  disabled={!newAnnouncementTitle.trim() || !newAnnouncementMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Update Announcement
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



      {/* Game Suspension Modal */}
      {showSuspensionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-96 border border-neutral-600">
            <h3 className="text-xl font-bold text-red-400 mb-4">🚨 Suspend Game Access</h3>

            <div className="space-y-4">
              <div className="p-3 rounded bg-red-900/20 border border-red-600">
                <p className="text-red-300 text-sm font-medium">⚠️ This will immediately block all player access</p>
                <p className="text-red-200 text-xs mt-1">
                  Players will see a maintenance message and cannot access any game features.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Maintenance Message for Players
                </label>
                <textarea
                  value={suspensionMessage}
                  onChange={(e) => setSuspensionMessage(e.target.value)}
                  placeholder="Enter a message to display to players..."
                  rows={3}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setShowSuspensionModal(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmSuspension}
                  disabled={!suspensionMessage.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🚨 Suspend Game
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Add AI Tribe Modal */}
      {showAddAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-[500px] border border-neutral-600">
            <h3 className="text-xl font-bold text-purple-400 mb-4">🤖 Add AI Tribe</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  AI Personality Type
                </label>
                <select
                  value={selectedAIType}
                  onChange={(e) => setSelectedAIType(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Aggressive">⚔️ Aggressive - Warlike and expansionist</option>
                  <option value="Defensive">🛡️ Defensive - Cautious and protective</option>
                  <option value="Expansionist">🗺️ Expansionist - Territory focused</option>
                  <option value="Trader">💰 Trader - Commerce and diplomacy</option>
                  <option value="Scavenger">🔍 Scavenger - Resource gathering</option>
                  <option value="Wanderer">🚶 Wanderer - Nomadic and unpredictable</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Spawn Location
                </label>
                <select
                  value={selectedSpawnLocation}
                  onChange={(e) => setSelectedSpawnLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select spawn location...</option>
                  {gameState.mapData
                    .filter(hex =>
                      ['Plains', 'Forest', 'Wasteland', 'Desert'].includes(hex.terrain) &&
                      !hex.poi &&
                      !gameState.tribes.some(t => t.location === `${String(50 + hex.q).padStart(3, '0')}.${String(50 + hex.r).padStart(3, '0')}`)
                    )
                    .slice(0, 50) // Limit options for performance
                    .map(hex => {
                      const coords = `${String(50 + hex.q).padStart(3, '0')}.${String(50 + hex.r).padStart(3, '0')}`;
                      return (
                        <option key={coords} value={coords}>
                          {coords} ({hex.terrain})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Custom Tribe Name (Optional)
                </label>
                <input
                  type="text"
                  value={aiTribeName}
                  onChange={(e) => setAITribeName(e.target.value)}
                  placeholder="Leave empty for auto-generated name"
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Backstory (Optional)
                </label>
                <textarea
                  value={aiBackstory}
                  onChange={(e) => setAIBackstory(e.target.value)}
                  placeholder="A brief backstory for this AI tribe..."
                  rows={3}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setShowAddAIModal(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddAITribe}
                  disabled={!selectedSpawnLocation}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Add AI Tribe
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Management Modal */}
      {showAIManagementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-[600px] border border-neutral-600">
            <h3 className="text-xl font-bold text-purple-400 mb-4">🤖 AI Tribe Management</h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-neutral-300">
                  Managing {gameState.tribes.filter(t => t.isAI).length} AI tribes
                </span>
                <Button
                  onClick={handleBulkRemoveAI}
                  className="bg-red-600 hover:bg-red-700 text-sm"
                  disabled={gameState.tribes.filter(t => t.isAI).length === 0}
                >
                  Remove All AI
                </Button>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-3">
                {gameState.tribes.filter(t => t.isAI).map(tribe => (
                  <div key={tribe.id} className="p-4 bg-purple-900/20 border border-purple-600 rounded">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{tribe.icon}</span>
                        <div>
                          <div className="font-medium text-purple-200">{tribe.tribeName}</div>
                          <div className="text-sm text-purple-400">
                            {tribe.aiType} • Location: {tribe.location}
                          </div>
                          <div className="text-xs text-neutral-400 mt-1">
                            Troops: {Object.values(tribe.garrisons || {}).reduce((sum, g) => sum + g.troops, 0)} •
                            Weapons: {Object.values(tribe.garrisons || {}).reduce((sum, g) => sum + g.weapons, 0)} •
                            Morale: {tribe.globalResources.morale}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleRemoveAITribe(tribe.id)}
                        className="bg-red-600 hover:bg-red-700 text-sm"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )) || (
                  <p className="text-neutral-400 text-center py-8">No AI tribes currently active</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setShowAIManagementModal(false)}
                  variant="secondary"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Newsletter Summary Modal */}
      {showNewsletterSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-neutral-600">
              <h2 className="text-2xl font-bold text-amber-300">
                📰 Newsletter Summary - Turn {gameState.turn - summaryTurnsBack}
              </h2>
              <button
                onClick={() => setShowNewsletterSummary(false)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {(() => {
                const newsletterData = generateNewsletterSummary(summaryTurnsBack);

                if ('error' in newsletterData) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-red-400 mb-4">{newsletterData.error}</p>
                      <p className="text-neutral-400">Available turns: {newsletterData.availableTurns?.join(', ') || 'None'}</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* Turn Overview */}
                    <div className="bg-neutral-700 rounded-lg p-4">
                      <h3 className="text-xl font-bold text-amber-300 mb-3">Turn Overview</h3>
                      <p className="text-neutral-300 mb-2">{newsletterData.summary}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">{newsletterData.statistics.totalActions}</div>
                          <div className="text-sm text-neutral-400">Total Actions</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">{newsletterData.statistics.researchCompletions}</div>
                          <div className="text-sm text-neutral-400">Research Completed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-400">{newsletterData.statistics.majorEvents}</div>
                          <div className="text-sm text-neutral-400">Major Events</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-amber-400">{newsletterData.statistics.activePlayers}</div>
                          <div className="text-sm text-neutral-400">Active Players</div>
                        </div>
                      </div>
                    </div>

                    {/* Global Events */}
                    {newsletterData.globalEvents.length > 0 && (
                      <div className="bg-neutral-700 rounded-lg p-4">
                        <h3 className="text-xl font-bold text-red-400 mb-3">🌍 Global Events</h3>
                        <ul className="space-y-2">
                          {newsletterData.globalEvents.map((event, index) => (
                            <li key={index} className="text-neutral-300">• {event}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Tribe Actions */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-amber-300">📋 Detailed Tribe Actions</h3>
                      {newsletterData.tribes
                        .sort((a, b) => a.rank - b.rank)
                        .map((tribe, index) => (
                          <div key={index} className="bg-neutral-700 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="text-lg font-bold text-amber-300">
                                  #{tribe.rank} {tribe.name}
                                  {tribe.isAI && <span className="text-xs bg-blue-600 px-2 py-1 rounded ml-2">AI</span>}
                                </h4>
                                <p className="text-sm text-neutral-400">Player: {tribe.player}</p>
                                <div className="flex items-center space-x-4 mt-2 text-sm">
                                  <span className="text-blue-300">👥 {tribe.troops || 0} troops</span>
                                  <span className="text-purple-300">🏛️ {tribe.garrisons || 0} garrisons</span>
                                  <span className="text-yellow-300">👑 {tribe.chiefs || 0} chiefs</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-400">{tribe.score}</div>
                                <div className="text-xs text-neutral-400">Score</div>
                              </div>
                            </div>

                            {/* Actions */}
                            {tribe.actions.length > 0 && (
                              <div className="mb-3">
                                <h5 className="font-semibold text-blue-300 mb-2">Actions Taken ({tribe.actions.length})</h5>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {tribe.actions.map((action, actionIndex) => (
                                    <div key={actionIndex} className="text-sm bg-neutral-800 p-2 rounded">
                                      <div className="flex justify-between items-start">
                                        <span className="font-medium text-amber-400">{action.type}</span>
                                        <span className={`text-xs px-2 py-1 rounded ${action.success ? 'bg-green-600' : 'bg-red-600'}`}>
                                          {action.success ? 'Success' : 'Failed'}
                                        </span>
                                      </div>
                                      {action.location && (
                                        <div className="text-xs text-neutral-400">Location: {action.location}</div>
                                      )}
                                      <div className="text-neutral-300 mt-1">{action.result}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Major Events */}
                            {tribe.majorEvents.length > 0 && (
                              <div className="mb-3">
                                <h5 className="font-semibold text-purple-300 mb-2">Major Events</h5>
                                <ul className="space-y-1">
                                  {tribe.majorEvents.map((event, eventIndex) => (
                                    <li key={eventIndex} className="text-sm text-neutral-300">• {event}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Chiefs */}
                            {tribe.chiefNames && tribe.chiefNames.length > 0 && (
                              <div className="mb-3">
                                <h5 className="font-semibold text-yellow-300 mb-2">👑 Chiefs & Leaders</h5>
                                <div className="text-sm text-neutral-300">
                                  {tribe.chiefNames.join(', ')}
                                </div>
                              </div>
                            )}

                            {/* Research Progress */}
                            {(tribe.researchProgress.completed.length > 0 || tribe.researchProgress.started.length > 0) && (
                              <div className="mb-3">
                                <h5 className="font-semibold text-green-300 mb-2">🔬 Research Progress</h5>
                                {tribe.researchProgress.completed.length > 0 && (
                                  <div className="text-sm">
                                    <span className="text-green-400">Completed:</span> {tribe.researchProgress.completed.join(', ')}
                                  </div>
                                )}
                                {tribe.researchProgress.started.length > 0 && (
                                  <div className="text-sm">
                                    <span className="text-blue-400">Started:</span> {tribe.researchProgress.started.join(', ')}
                                  </div>
                                )}
                                {tribe.researchProgress.ongoing.length > 0 && (
                                  <div className="text-sm">
                                    <span className="text-yellow-400">Ongoing:</span> {tribe.researchProgress.ongoing.join(', ')}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Resource & Territory Changes */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div>
                                <h6 className="font-semibold text-amber-300">Resources</h6>
                                <div>🍖 Food: <span className="text-green-400">{tribe.resourceChanges.food.after}</span> ({tribe.resourceChanges.food.change > 0 ? '+' : ''}{tribe.resourceChanges.food.change})</div>
                                <div>🔧 Scrap: <span className="text-blue-400">{tribe.resourceChanges.scrap.after}</span> ({tribe.resourceChanges.scrap.change > 0 ? '+' : ''}{tribe.resourceChanges.scrap.change})</div>
                                <div>😊 Morale: <span className="text-purple-400">{tribe.resourceChanges.morale.after}</span> ({tribe.resourceChanges.morale.change > 0 ? '+' : ''}{tribe.resourceChanges.morale.change})</div>
                              </div>
                              <div>
                                <h6 className="font-semibold text-amber-300">Territory</h6>
                                <div>Net Change: {tribe.territoryChanges.netChange > 0 ? '+' : ''}{tribe.territoryChanges.netChange}</div>
                                {tribe.territoryChanges.gained.length > 0 && (
                                  <div className="text-green-400">Gained: {tribe.territoryChanges.gained.length}</div>
                                )}
                                {tribe.territoryChanges.lost.length > 0 && (
                                  <div className="text-red-400">Lost: {tribe.territoryChanges.lost.length}</div>
                                )}
                              </div>
                              <div>
                                <h6 className="font-semibold text-amber-300">Military</h6>
                                <div>Troops: {tribe.militaryChanges.netTroopChange > 0 ? '+' : ''}{tribe.militaryChanges.netTroopChange}</div>
                                <div>Weapons: {tribe.militaryChanges.netWeaponChange > 0 ? '+' : ''}{tribe.militaryChanges.netWeaponChange}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="flex justify-between items-center p-6 border-t border-neutral-600">
              <div className="flex items-center space-x-4">
                <label className="text-sm text-neutral-400">
                  Turns Back:
                  <select
                    value={summaryTurnsBack}
                    onChange={(e) => setSummaryTurnsBack(parseInt(e.target.value))}
                    className="ml-2 bg-neutral-700 text-white rounded px-2 py-1"
                  >
                    {[1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="space-x-3">
                <Button
                  onClick={() => {
                    const data = generateNewsletterSummary(summaryTurnsBack);
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const filename = 'error' in data ? 'newsletter-error.json' : `newsletter-turn-${data.turn}-data.json`;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Download JSON
                </Button>
                <Button onClick={() => setShowNewsletterSummary(false)} variant="secondary">
                  Close
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