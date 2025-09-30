/** @jsxImportSource react */
import React, { useState, useRef, useEffect } from 'react';
import { Tribe, User, GameState, FullBackupState, ChiefRequest, AssetRequest, AIType, LoginAnnouncement, BackupStatus, BackupFile, TurnDeadline, Newsletter, getTechnology } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import ConfirmationModal from './ui/ConfirmationModal';
import NewsletterEditor from './NewsletterEditor';
import * as Auth from '../lib/auth';
import * as client from '../lib/client';

// Import help content components for export
import {
  GameRulesContent,
  UIGuideContent,
  ActionsGuideContent,
  ResearchGuideContent,
  CombatGuideContent,
  DiplomacyGuideContent,
  ResourcesGuideContent,
  POIGuideContent,
  OutpostsGuideContent,
  SabotageGuideContent,
  TipsGuideContent
} from './HelpModal';

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
  const [showAutoDeadlineModal, setShowAutoDeadlineModal] = useState(false);
  const [autoDeadlineTime, setAutoDeadlineTime] = useState("20:00");
  const [autoDeadlineEnabled, setAutoDeadlineEnabled] = useState(true);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'game' | 'players' | 'content' | 'system' | 'debug'>('game');

  // Initialize auto deadline settings from game state
  useEffect(() => {
    if (gameState.autoDeadlineSettings) {
      setAutoDeadlineEnabled(gameState.autoDeadlineSettings.enabled);
      setAutoDeadlineTime(gameState.autoDeadlineSettings.timeOfDay);
    }
  }, [gameState.autoDeadlineSettings]);

  // Help Export Functions
  const exportHelpToHTML = () => {
    const allContent = {
      rules: React.createElement(GameRulesContent),
      ui: React.createElement(UIGuideContent),
      actions: React.createElement(ActionsGuideContent),
      research: React.createElement(ResearchGuideContent),
      combat: React.createElement(CombatGuideContent),
      diplomacy: React.createElement(DiplomacyGuideContent),
      resources: React.createElement(ResourcesGuideContent),
      poi: React.createElement(POIGuideContent),
      outposts: React.createElement(OutpostsGuideContent),
      sabotage: React.createElement(SabotageGuideContent),
      tips: React.createElement(TipsGuideContent)
    };

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Radix Tribes - Game Help Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #d97706; border-bottom: 3px solid #d97706; padding-bottom: 10px; }
        h2 { color: #d97706; border-bottom: 2px solid #d97706; padding-bottom: 5px; margin-top: 30px; }
        h3 { color: #92400e; margin-top: 25px; }
        ul { margin: 10px 0; padding-left: 20px; }
        li { margin: 5px 0; }
        strong { color: #1f2937; }
        .section { margin-bottom: 30px; }
        .tab-content { margin-bottom: 40px; }
    </style>
</head>
<body>
    <h1>🏛️ Radix Tribes - Complete Game Documentation</h1>
    <p><em>Exported on ${new Date().toLocaleDateString()}</em></p>
`;

    Object.entries(allContent).forEach(([tabName, tabContent]) => {
      html += `    <div class="tab-content">
        <h2>${tabName.charAt(0).toUpperCase() + tabName.slice(1)} Guide</h2>
        <div class="section">
          <p>This section contains the ${tabName} documentation from the game help system.</p>
        </div>
    </div>`;
    });

    html += `</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `radix-tribes-help-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportHelpToMarkdown = () => {
    let markdown = `# 🏛️ Radix Tribes - Complete Game Documentation\n\n*Exported on ${new Date().toLocaleDateString()}*\n\n`;

    const sections = [
      { name: 'Rules', content: 'Basic game rules and mechanics' },
      { name: 'UI Guide', content: 'User interface overview and navigation' },
      { name: 'Actions', content: 'Available actions and their effects' },
      { name: 'Research', content: 'Technology tree and research system' },
      { name: 'Combat', content: 'Combat mechanics and strategies' },
      { name: 'Diplomacy', content: 'Diplomatic actions and relationships' },
      { name: 'Resources', content: 'Resource management and economy' },
      { name: 'POIs', content: 'Points of Interest and their benefits' },
      { name: 'Outposts', content: 'Outpost system and management' },
      { name: 'Sabotage', content: 'Sabotage actions and espionage' },
      { name: 'Tips', content: 'Strategic tips and advanced tactics' }
    ];

    sections.forEach(section => {
      markdown += `## ${section.name} Guide\n\n${section.content}\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `radix-tribes-help-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Diagnostic state
  const [diagnosingTribeLocations, setDiagnosingTribeLocations] = useState(false);
  const [diagnosingSingleTribe, setDiagnosingSingleTribe] = useState(false);
  const [diagnosingStartingLocations, setDiagnosingStartingLocations] = useState(false);
  const [investigatingTribeOrigin, setInvestigatingTribeOrigin] = useState(false);
  const [investigatingAllLocationFields, setInvestigatingAllLocationFields] = useState(false);
  const [backfillingOriginalHomes, setBackfillingOriginalHomes] = useState(false);
  const [singleTribeName, setSingleTribeName] = useState('');

  // Safety features
  const [safetyLockEnabled, setSafetyLockEnabled] = useState(true);
  const [dangerousActionConfirmStep, setDangerousActionConfirmStep] = useState<string | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [processTurnConfirmStep, setProcessTurnConfirmStep] = useState(0);
  const [selectedTestTribeId, setSelectedTestTribeId] = useState('');
  const [debugTribeName, setDebugTribeName] = useState('The Rising Sun');
  const [debugResult, setDebugResult] = useState<any>(null);
  const [debugHexCoord, setDebugHexCoord] = useState('027.054');
  const [hexDebugResult, setHexDebugResult] = useState<any>(null); // 0=not started, 1=first confirm, 2=final confirm

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

    // Listen for debug results
    const handleDebugResult = (result: any) => {
      setDebugResult(result);
    };

    const handleHexDebugResult = (result: any) => {
      setHexDebugResult(result);
    };

    const handleTestTurnResult = (result: any) => {
      console.log('🧪 Test turn result:', result);
      if (result.success) {
        alert(`✅ Test turn completed!\n\nTribe: ${result.tribe}\nActions processed: ${result.actionsProcessed}\n\n${result.message}`);
      } else {
        alert(`❌ Test turn failed: ${result.error}`);
      }
    };

    const socket = client.getSocket();
    if (socket) {
      socket.on('debug_result', handleDebugResult);
      socket.on('hex_debug_result', handleHexDebugResult);
      socket.on('test_turn_result', handleTestTurnResult);
    }

    return () => {
      if (socket) {
        socket.off('debug_result', handleDebugResult);
        socket.off('hex_debug_result', handleHexDebugResult);
        socket.off('test_turn_result', handleTestTurnResult);
      }
    };
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

  const handleUpdateAutoDeadlineSettings = () => {
    const settings = {
      enabled: autoDeadlineEnabled,
      timeOfDay: autoDeadlineTime,
      timezone: "Europe/London" // Default timezone for now
    };

    client.updateAutoDeadlineSettings(settings);
    setShowAutoDeadlineModal(false);
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

  // Newsletter backup and restore handlers
  const handleExportAllNewsletters = () => {
    console.log('📰 Exporting all newsletters...');
    client.exportAllNewsletters();
  };

  const handleImportAllNewsletters = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);

        if (!importData.newsletters || !Array.isArray(importData.newsletters)) {
          alert('Invalid newsletter backup file: newsletters array not found');
          return;
        }

        const count = importData.newsletters.length;
        if (confirm(`Import ${count} newsletters from backup? This will update existing newsletters for the same turns.`)) {
          console.log(`📰 Importing ${count} newsletters...`);
          client.importAllNewsletters(importData);
        }
      } catch (error) {
        console.error('Error parsing newsletter backup file:', error);
        alert('Error reading newsletter backup file. Please ensure it\'s a valid JSON file.');
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    event.target.value = '';
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

  const handleDiagnoseAI = () => {
    const aiTribes = gameState.tribes.filter(t => t.isAI);
    if (aiTribes.length === 0) {
      alert('No AI tribes found to diagnose');
      return;
    }

    let diagnostics = `🤖 AI TRIBES DIAGNOSTIC REPORT\n\n`;
    diagnostics += `Total AI Tribes: ${aiTribes.length}\n\n`;

    aiTribes.forEach((tribe, index) => {
      diagnostics += `${index + 1}. ${tribe.tribeName}\n`;
      diagnostics += `   Type: ${tribe.aiType || 'Unknown'}\n`;
      diagnostics += `   Location: ${tribe.location}\n`;
      diagnostics += `   Turn Submitted: ${tribe.turnSubmitted ? 'Yes' : 'No'}\n`;
      diagnostics += `   Actions: ${tribe.actions?.length || 0}\n`;
      diagnostics += `   Troops: ${Object.values(tribe.garrisons || {}).reduce((sum: number, g: any) => sum + (g.troops || 0), 0)}\n`;
      diagnostics += `   Food: ${tribe.globalResources?.food || 0}\n`;
      diagnostics += `   Scrap: ${tribe.globalResources?.scrap || 0}\n\n`;
    });

    alert(diagnostics);
  };

  // Set up backup status callback and fetch initial status
  useEffect(() => {
    const handleBackupStatus = (status: BackupStatus, backupList: BackupFile[]) => {
      setBackupStatus(status);
      setBackupList(backupList);
    };

    // Newsletter backup/restore event handlers
    const handleNewsletterExportReady = (exportData: any) => {
      console.log('📰 Newsletter export ready:', exportData);

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `newsletters-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`✅ Newsletter backup downloaded!\n\n${exportData.totalNewsletters} newsletters exported.`);
    };

    const handleNewsletterExportError = (error: any) => {
      console.error('❌ Newsletter export error:', error);
      alert(`❌ Error exporting newsletters: ${error.error || 'Unknown error'}`);
    };

    const handleNewsletterImportComplete = (result: any) => {
      console.log('📰 Newsletter import complete:', result);
      alert(`✅ Newsletter import complete!\n\n• ${result.imported} new newsletters imported\n• ${result.updated} existing newsletters updated\n• ${result.skipped} newsletters skipped\n• ${result.total} total newsletters processed`);
    };

    const handleNewsletterImportError = (error: any) => {
      console.error('❌ Newsletter import error:', error);
      alert(`❌ Error importing newsletters: ${error.error || 'Unknown error'}`);
    };

    // Set up event listeners
    client.setBackupStatusCallback(handleBackupStatus);

    // Add newsletter event listeners to socket
    const socket = client.getSocket();
    if (socket) {
      socket.on('admin:newsletterExportReady', handleNewsletterExportReady);
      socket.on('admin:newsletterExportError', handleNewsletterExportError);
      socket.on('admin:newsletterImportComplete', handleNewsletterImportComplete);
      socket.on('admin:newsletterImportError', handleNewsletterImportError);

      // Diagnostic event handlers
      const handleTribeLocationsDiagnosed = (result: any) => {
        setDiagnosingTribeLocations(false);
        if (result.success) {
          alert('✅ Tribe locations diagnosed successfully!\n\nCheck the server logs for detailed analysis.');
        } else {
          alert(`❌ Error diagnosing tribe locations: ${result.error || 'Unknown error'}`);
        }
      };

      const handleSingleTribeLocationDiagnosed = (result: any) => {
        setDiagnosingSingleTribe(false);
        if (result.success) {
          alert(`✅ Single tribe location diagnosed successfully for "${result.tribeName}"!\n\nCheck the server logs for detailed analysis.`);
        } else {
          alert(`❌ Error diagnosing tribe location for "${result.tribeName}": ${result.error || 'Unknown error'}`);
        }
      };

      const handleStartingLocationsDiagnosed = (result: any) => {
        setDiagnosingStartingLocations(false);
        if (result.success) {
          alert('✅ Starting locations diagnosed successfully!\n\nCheck the server logs for detailed analysis.');
        } else {
          alert(`❌ Error diagnosing starting locations: ${result.error || 'Unknown error'}`);
        }
      };

      const handleTribeOriginInvestigated = (result: any) => {
        setInvestigatingTribeOrigin(false);
        if (result.success) {
          alert(`✅ Tribe origin investigated successfully for "${result.tribeName}"!\n\nCheck the server logs for detailed database analysis.`);
        } else {
          alert(`❌ Error investigating tribe origin for "${result.tribeName}": ${result.error || 'Unknown error'}`);
        }
      };

      const handleAllLocationFieldsInvestigated = (result: any) => {
        setInvestigatingAllLocationFields(false);
        if (result.success) {
          alert(`✅ All location fields investigated successfully for "${result.tribeName}"!\n\nCheck the server logs for complete field analysis.`);
        } else {
          alert(`❌ Error investigating all location fields for "${result.tribeName}": ${result.error || 'Unknown error'}`);
        }
      };

      const handleOriginalStartingLocationsBackfilled = (result: any) => {
        setBackfillingOriginalHomes(false);
        if (result.success) {
          alert(`✅ Original starting locations backfilled successfully!\n\nCheck the server logs for detailed backfill results.`);
        } else {
          alert(`❌ Error backfilling original starting locations: ${result.error || 'Unknown error'}`);
        }
      };

      socket.on('admin:tribeLocationsDiagnosed', handleTribeLocationsDiagnosed);
      socket.on('admin:singleTribeLocationDiagnosed', handleSingleTribeLocationDiagnosed);
      socket.on('admin:startingLocationsDiagnosed', handleStartingLocationsDiagnosed);
      socket.on('admin:tribeOriginInvestigated', handleTribeOriginInvestigated);
      socket.on('admin:allLocationFieldsInvestigated', handleAllLocationFieldsInvestigated);
      socket.on('admin:originalStartingLocationsBackfilled', handleOriginalStartingLocationsBackfilled);
    }

    client.getBackupStatus();

    return () => {
      client.setBackupStatusCallback(null);
      if (socket) {
        socket.off('admin:newsletterExportReady', handleNewsletterExportReady);
        socket.off('admin:newsletterExportError', handleNewsletterExportError);
        socket.off('admin:newsletterImportComplete', handleNewsletterImportComplete);
        socket.off('admin:newsletterImportError', handleNewsletterImportError);
        socket.off('admin:tribeLocationsDiagnosed');
        socket.off('admin:singleTribeLocationDiagnosed');
        socket.off('admin:startingLocationsDiagnosed');
        socket.off('admin:tribeOriginInvestigated');
        socket.off('admin:allLocationFieldsInvestigated');
        socket.off('admin:originalStartingLocationsBackfilled');
      }
    };
  }, []);

  const handleSaveBackup = () => {
    // Request enhanced backup with password hashes
    client.requestEnhancedBackup();
  };

  const handleDiagnoseTribeLocations = () => {
    setDiagnosingTribeLocations(true);
    client.diagnoseTribeLocations();
  };

  const handleDiagnoseSingleTribeLocation = () => {
    if (!singleTribeName.trim()) {
      alert('Please enter a tribe name to diagnose');
      return;
    }
    setDiagnosingSingleTribe(true);
    client.diagnoseSingleTribeLocation(singleTribeName.trim());
  };

  const handleDiagnoseStartingLocations = () => {
    setDiagnosingStartingLocations(true);
    client.diagnoseStartingLocations();
  };

  const handleInvestigateTribeOrigin = () => {
    if (!singleTribeName.trim()) {
      alert('Please enter a tribe name to investigate');
      return;
    }
    setInvestigatingTribeOrigin(true);
    client.investigateTribeOrigin(singleTribeName.trim());
  };

  const handleInvestigateAllLocationFields = () => {
    if (!singleTribeName.trim()) {
      alert('Please enter a tribe name to investigate');
      return;
    }
    setInvestigatingAllLocationFields(true);
    client.investigateAllLocationFields(singleTribeName.trim());
  };

  const handleBackfillOriginalStartingLocations = () => {
    if (!confirm('This will analyze all existing tribes and populate their originalStartingLocation field based on exploration patterns. Continue?')) {
      return;
    }
    setBackfillingOriginalHomes(true);
    client.backfillOriginalStartingLocations();
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

    // SIMPLIFIED: Generate clean newsletter content matching desired format
    const newsletterData = {
      turn: targetTurn,
      tribes: turnRecord.tribeRecords.map(tribe => ({
        player: tribe.playerName,
        name: tribe.tribeName,
        results: tribe.actions.map(action => action.result).filter(result => result) // Extract result strings from actions
      }))
    };

    return newsletterData;
  };

  const generateCurrentStateNewsletter = () => {
    // SIMPLIFIED: Generate clean newsletter from current game state
    const currentTurn = gameState.turn;

    return {
      turn: currentTurn,
      tribes: allTribes.map(tribe => ({
        player: tribe.playerName,
        name: tribe.tribeName,
        results: tribe.lastTurnResults?.map(result => result.result) || []
      }))
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

        {/* Safety Status Banner */}
        <div className="mb-6">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-4 bg-neutral-800/50 rounded-lg px-6 py-3 border border-neutral-600">
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-4 rounded-full ${safetyLockEnabled ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="text-lg font-bold text-neutral-200">
                  Safety Lock: {safetyLockEnabled ? 'PROTECTED' : 'UNLOCKED'}
                </span>
              </div>
              {!safetyLockEnabled && (
                <div className="text-orange-400 text-sm font-medium">
                  ⚠️ Dangerous actions enabled
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 bg-neutral-800/50 rounded-lg p-2 border border-neutral-600">
            <button
              onClick={() => setActiveTab('game')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'game'
                  ? 'bg-amber-600 text-white shadow-lg'
                  : 'bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              🎮 Game Control
            </button>
            <button
              onClick={() => setActiveTab('players')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'players'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              👥 Players & Tribes
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'content'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              📰 Content & Announcements
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'system'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              ⚙️ System & Data
            </button>
            <button
              onClick={() => setActiveTab('debug')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'debug'
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              🔧 Debug & Tools
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* 🎮 GAME CONTROL TAB */}
          {activeTab === 'game' && (
            <div className="space-y-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-amber-400 mb-2">🎮 Game Control</h2>
                <p className="text-neutral-400">Manage turn processing, game status, and world settings</p>
              </div>

            {/* Game Suspension Control */}
            <Card title="🚨 Game Access Control" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
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

                    {/* Test Single Tribe Turn (for debugging) */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-300">🧪 Debug Tools</h4>
                      <div className="flex space-x-2">
                        <select
                          className="flex-1 bg-slate-700 border border-slate-600 rounded p-2 text-white text-sm"
                          value={selectedTestTribeId}
                          onChange={(e) => setSelectedTestTribeId(e.target.value)}
                        >
                          <option value="">Select tribe to test...</option>
                          {gameState.tribes.map(tribe => (
                            <option key={tribe.id} value={tribe.id}>
                              {tribe.tribeName} ({tribe.actions.length} actions)
                            </option>
                          ))}
                        </select>
                        <Button
                          onClick={() => {
                            if (selectedTestTribeId) {
                              client.testTribeTurn({ tribeId: selectedTestTribeId });
                              console.log(`🧪 Testing turn for tribe: ${selectedTestTribeId}`);
                            }
                          }}
                          disabled={!selectedTestTribeId}
                          className="bg-purple-600 hover:bg-purple-700 text-sm px-3"
                        >
                          🧪 Test Turn
                        </Button>
                      </div>
                      <p className="text-xs text-slate-400">Process one tribe's actions without advancing the global turn</p>
                    </div>

                    {/* Debug Tribe Garrison Status */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-300">🔍 Database Debug</h4>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          className="flex-1 bg-slate-700 border border-slate-600 rounded p-2 text-white text-sm"
                          value={debugTribeName}
                          onChange={(e) => setDebugTribeName(e.target.value)}
                          placeholder="Tribe name to debug..."
                        />
                        <Button
                          onClick={() => {
                            if (debugTribeName.trim()) {
                              client.debugTribeGarrison({ tribeName: debugTribeName.trim() });
                              setDebugResult(null);
                            }
                          }}
                          disabled={!debugTribeName.trim()}
                          className="bg-blue-600 hover:bg-blue-700 text-sm px-3"
                        >
                          🔍 Debug
                        </Button>
                      </div>
                      <p className="text-xs text-slate-400">Check tribe's garrison database status and foreign key issues</p>

                      {debugResult && (
                        <div className="mt-3 p-3 bg-slate-800 border border-slate-600 rounded text-xs">
                          {debugResult.error ? (
                            <div className="text-red-400">❌ Error: {debugResult.error}</div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-green-400">✅ Tribe: {debugResult.tribe?.name}</div>
                              <div>📍 Location: {debugResult.tribe?.location}</div>
                              <div>🏰 Garrisons: {debugResult.summary?.totalGarrisons}</div>
                              <div>✅ Valid hex refs: {debugResult.summary?.validHexReferences}</div>
                              <div>❌ Invalid hex refs: {debugResult.summary?.invalidHexReferences}</div>

                              {debugResult.garrisons?.map((g: any, i: number) => (
                                <div key={i} className="ml-2 p-2 bg-slate-700 rounded">
                                  <div>Garrison {i + 1}: {g.troops} troops, {g.weapons} weapons</div>
                                  <div>Coords: ({g.hexQ}, {g.hexR})</div>
                                  <div className={g.hexIdFormat.includes('BAD') ? 'text-red-400' : 'text-green-400'}>
                                    HexId: {g.hexIdFormat}
                                  </div>
                                  <div className={g.hexRecordExists ? 'text-green-400' : 'text-red-400'}>
                                    Hex Record: {g.hexRecordExists ? '✅ Exists' : '❌ Missing'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Debug Hex Existence */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-300">🗺️ Hex Database Debug</h4>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          className="flex-1 bg-slate-700 border border-slate-600 rounded p-2 text-white text-sm"
                          value={debugHexCoord}
                          onChange={(e) => setDebugHexCoord(e.target.value)}
                          placeholder="Hex coordinate (e.g., 027.054)..."
                        />
                        <Button
                          onClick={() => {
                            if (debugHexCoord.trim()) {
                              client.debugHexExistence({ coordinate: debugHexCoord.trim() });
                              setHexDebugResult(null);
                            }
                          }}
                          disabled={!debugHexCoord.trim()}
                          className="bg-green-600 hover:bg-green-700 text-sm px-3"
                        >
                          🗺️ Check Hex
                        </Button>
                      </div>
                      <p className="text-xs text-slate-400">Check if hex exists in both game state and database</p>

                      {hexDebugResult && (
                        <div className="mt-3 p-3 bg-slate-800 border border-slate-600 rounded text-xs">
                          {hexDebugResult.error ? (
                            <div className="text-red-400">❌ Error: {hexDebugResult.error}</div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-blue-400">🗺️ Hex: {hexDebugResult.coordinate}</div>
                              <div>📍 Parsed coords: q={hexDebugResult.parsedCoords?.q}, r={hexDebugResult.parsedCoords?.r}</div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 bg-slate-700 rounded">
                                  <div className="font-medium">Game State</div>
                                  <div className={hexDebugResult.gameState?.exists ? 'text-green-400' : 'text-red-400'}>
                                    {hexDebugResult.gameState?.exists ? '✅ Exists' : '❌ Missing'}
                                  </div>
                                  {hexDebugResult.gameState?.terrain && (
                                    <div>Terrain: {hexDebugResult.gameState.terrain}</div>
                                  )}
                                </div>

                                <div className="p-2 bg-slate-700 rounded">
                                  <div className="font-medium">Database</div>
                                  <div className={hexDebugResult.database?.exists ? 'text-green-400' : 'text-red-400'}>
                                    {hexDebugResult.database?.exists ? '✅ Exists' : '❌ Missing'}
                                  </div>
                                  {hexDebugResult.database?.error && (
                                    <div className="text-red-400">Error: {hexDebugResult.database.error}</div>
                                  )}
                                </div>
                              </div>

                              <div className="p-2 bg-slate-700 rounded">
                                <div className="font-medium text-yellow-400">Analysis</div>
                                <div>{hexDebugResult.analysis?.issue}</div>
                                <div className="text-slate-400">{hexDebugResult.analysis?.recommendation}</div>
                              </div>

                              {hexDebugResult.nearbyHexes && hexDebugResult.nearbyHexes.length > 0 && (
                                <div className="p-2 bg-slate-700 rounded">
                                  <div className="font-medium">Nearby Hexes (5x5 area)</div>
                                  <div className="grid grid-cols-5 gap-1 text-xs mt-1">
                                    {hexDebugResult.nearbyHexes.map((hex: any, i: number) => (
                                      <div
                                        key={i}
                                        className={`p-1 rounded text-center ${
                                          hex.inGameState && hex.inDatabase ? 'bg-green-800' :
                                          hex.inGameState ? 'bg-yellow-800' :
                                          'bg-red-800'
                                        }`}
                                        title={`${hex.coordinate} (${hex.q},${hex.r}) - ${hex.terrain}`}
                                      >
                                        {hex.inGameState && hex.inDatabase ? '✅' :
                                         hex.inGameState ? '⚠️' : '❌'}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-xs text-slate-400 mt-1">
                                    ✅ = Both, ⚠️ = Game only, ❌ = Neither
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
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

            {/* Turn Deadline Management - moved here from below */}
            <Card title="⏰ Turn Deadline Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
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

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Auto Deadlines:</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        gameState.autoDeadlineSettings?.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-600 text-white'
                      }`}>
                        {gameState.autoDeadlineSettings?.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                      {gameState.autoDeadlineSettings?.enabled && (
                        <span className="text-xs text-gray-400">
                          @ {gameState.autoDeadlineSettings.timeOfDay}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setShowDeadlineModal(true)}
                      className="text-xs bg-blue-600 hover:bg-blue-700"
                    >
                      Set Deadline
                    </Button>
                    <Button
                      onClick={() => setShowAutoDeadlineModal(true)}
                      className="text-xs bg-purple-600 hover:bg-purple-700"
                    >
                      Auto Settings
                    </Button>
                  </div>
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

            {/* World Management - moved here from below */}
            <Card title="🗺️ World Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
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
                </div>
            </Card>
            </div>
          )}

          {/* 👥 PLAYERS & TRIBES TAB */}
          {activeTab === 'players' && (
            <div className="space-y-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-blue-400 mb-2">👥 Players & Tribes</h2>
                <p className="text-neutral-400">Manage users, tribes, and approval requests</p>
              </div>

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

            {/* AI Tribe Management - moved here from below */}
            <Card title="🤖 AI Tribe Management" className="bg-gradient-to-br from-purple-800/90 to-purple-900/90 backdrop-blur-sm border-purple-600/50">
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

            {/* All Tribes - moved here from below */}
             <Card title="📋 All Tribes" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
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
          )}

          {/* 📰 CONTENT & ANNOUNCEMENTS TAB */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-purple-400 mb-2">📰 Content & Announcements</h2>
                <p className="text-neutral-400">Manage newsletters, announcements, and player communications</p>
              </div>

            <Card title="📢 Login Announcements" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
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

                {/* Newsletter Backup & Restore Section */}
                <div className="border-t border-neutral-600 pt-4 mt-4">
                  <h3 className="text-lg font-semibold text-amber-300 mb-3">📦 Newsletter Backup & Restore</h3>
                  <p className="text-neutral-400 text-sm mb-4">
                    Export all newsletters to a backup file or restore from a previous backup.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleExportAllNewsletters}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export All Newsletters
                    </Button>

                    <label className="inline-block">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportAllNewsletters}
                        className="hidden"
                      />
                      <span className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg cursor-pointer transition-colors duration-200">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        Import Newsletter Backup
                      </span>
                    </label>

                    <div className="text-xs text-neutral-500 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Total: {gameState.newsletter?.newsletters?.length || 0} newsletters
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Turn Summary Generator */}
            <Card title="📊 Turn Summary Generator" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-4">
                <p className="text-neutral-400 leading-relaxed">
                  Generate a summary of recent turns for newsletter content or player updates.
                </p>
                <Button
                  onClick={() => setShowTurnSummary(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  📊 Generate Turn Summary
                </Button>
                <Button
                  onClick={() => setShowNewsletterSummary(true)}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                >
                  📰 Generate Newsletter Data
                </Button>
              </div>
            </Card>
            </div>
          )}

          {/* ⚙️ SYSTEM & DATA TAB */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-green-400 mb-2">⚙️ System & Data</h2>
                <p className="text-neutral-400">Manage backups, security, and game data</p>
              </div>

            {/* Auto-Backup System - moved here from below */}
            <Card title="💾 Auto-Backup System" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
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

            {/* Security Management - moved here from below */}
            <Card title="🔒 Security Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
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

            {/* Game Data Management - moved here from below */}
            <Card title="💾 Game Data Management" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
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

                  {/* Help Documentation Export */}
                  <div className="border-t border-neutral-600 pt-4 mt-4">
                    <p className="text-neutral-400 text-sm mb-3">📚 Export help documentation for your website:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2 px-3 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                        onClick={exportHelpToHTML}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        📄 Export HTML
                      </Button>
                      <Button
                        className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-2 px-3 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                        onClick={exportHelpToMarkdown}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        📝 Export MD
                      </Button>
                    </div>
                  </div>

                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
              </div>
            </Card>
            </div>
          )}

          {/* 🔧 DEBUG & TOOLS TAB */}
          {activeTab === 'debug' && (
            <div className="space-y-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-red-400 mb-2">🔧 Debug & Tools</h2>
                <p className="text-neutral-400">Technical tools and diagnostics</p>
              </div>

            {/* Debug & Diagnostics - moved here from below */}
            <Card title="🔧 Debug & Diagnostics" className="bg-gradient-to-br from-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-neutral-600/50">
              <div className="space-y-6">
                <p className="text-neutral-400 leading-relaxed">Debug tools for diagnosing database issues, analyzing tribe locations, and troubleshooting collision problems.</p>

                {/* Global Diagnostics */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Global Analysis
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button
                      className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      onClick={handleDiagnoseTribeLocations}
                      disabled={diagnosingTribeLocations}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      {diagnosingTribeLocations ? 'Diagnosing...' : 'All Tribes'}
                    </Button>
                    <Button
                      className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      onClick={handleDiagnoseStartingLocations}
                      disabled={diagnosingStartingLocations}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      {diagnosingStartingLocations ? 'Diagnosing...' : 'Starting Locations'}
                    </Button>
                  </div>
                </div>

                {/* Single Tribe Analysis */}
                <div className="bg-gradient-to-br from-indigo-800 to-indigo-900 rounded-xl p-4 border border-indigo-700">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Single Tribe Analysis
                  </h3>
                  <p className="text-indigo-200 text-sm mb-3">Focused analysis of a specific tribe:</p>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Enter tribe name (e.g., The Scorched Earth)"
                      value={singleTribeName}
                      onChange={(e) => setSingleTribeName(e.target.value)}
                      className="w-full px-3 py-2 bg-indigo-700/50 border border-indigo-600 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Button
                        className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold py-2 px-3 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
                        onClick={handleDiagnoseSingleTribeLocation}
                        disabled={diagnosingSingleTribe || !singleTribeName.trim()}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {diagnosingSingleTribe ? 'Analyzing...' : 'Location'}
                      </Button>
                      <Button
                        className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-semibold py-2 px-3 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
                        onClick={handleInvestigateTribeOrigin}
                        disabled={investigatingTribeOrigin || !singleTribeName.trim()}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        {investigatingTribeOrigin ? 'Analyzing...' : 'Origin'}
                      </Button>
                      <Button
                        className="bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 text-white font-semibold py-2 px-3 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
                        onClick={handleInvestigateAllLocationFields}
                        disabled={investigatingAllLocationFields || !singleTribeName.trim()}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        {investigatingAllLocationFields ? 'Analyzing...' : 'All Fields'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Home Permanence Tool */}
                <div className="bg-gradient-to-br from-amber-800 to-amber-900 rounded-xl p-4 border border-amber-700">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Home Permanence
                  </h3>
                  <p className="text-amber-200 text-sm mb-3">Populate originalStartingLocation for all tribes based on exploration patterns:</p>
                  <Button
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    onClick={handleBackfillOriginalStartingLocations}
                    disabled={backfillingOriginalHomes}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {backfillingOriginalHomes ? 'Populating...' : 'Populate All Starting Locations'}
                  </Button>
                </div>

                {/* Legend */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700">
                  <h3 className="text-lg font-bold text-white mb-3">📖 Tool Reference</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-purple-400 mb-1">Global Analysis:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li><strong>All Tribes:</strong> Comprehensive location analysis</li>
                        <li><strong>Starting Locations:</strong> Origin point verification</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-indigo-400 mb-1">Single Tribe:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li><strong>Location:</strong> Focused tribe analysis</li>
                        <li><strong>Origin:</strong> Database records & history</li>
                        <li><strong>All Fields:</strong> Complete database dump</li>
                      </ul>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-600">
                    <p className="font-semibold text-purple-400 mb-1">Home Permanence:</p>
                    <p className="text-xs">Populates originalStartingLocation field using exploration pattern analysis</p>
                  </div>
                  <div className="pt-2 border-t border-gray-600">
                    <p className="text-xs text-gray-400"><strong>Note:</strong> All results appear in server logs. Tools identify coordinate transformation issues and collision problems.</p>
                  </div>
                </div>
              </div>
            </Card>
            </div>
          )}
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
              <div className="space-y-4">
                <p className="text-neutral-300">Turn summary generation is currently being updated. Please check server logs for detailed turn information.</p>
                <div className="bg-neutral-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-amber-300 mb-2">Current Game State</h3>
                  <p className="text-neutral-300">Turn: {gameState.turn}</p>
                  <p className="text-neutral-300">Active Tribes: {Object.keys(gameState.tribes).length}</p>
                </div>
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
      {/* Add AI Tribe Modal */}
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

      {/* Turn Deadline Modal */}
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

      {/* Auto Deadline Settings Modal */}
      {/* Auto Deadline Settings Modal */}
      {showAutoDeadlineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-96 border border-neutral-600">
            <h3 className="text-xl font-bold text-purple-400 mb-4">Auto Deadline Settings</h3>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="autoDeadlineEnabled"
                  checked={autoDeadlineEnabled}
                  onChange={(e) => setAutoDeadlineEnabled(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-neutral-700 border-neutral-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="autoDeadlineEnabled" className="text-sm font-medium text-white">
                  Enable automatic turn deadlines
                </label>
              </div>

              {autoDeadlineEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Daily deadline time (24-hour format):
                  </label>
                  <input
                    type="time"
                    value={autoDeadlineTime}
                    onChange={(e) => setAutoDeadlineTime(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Deadlines will be set automatically for this time each day when turns advance
                  </p>
                </div>
              )}

              <div className="p-3 rounded bg-purple-900/20 border border-purple-600">
                <p className="text-sm font-medium text-purple-300">
                  Current Settings:
                </p>
                <p className="text-sm text-purple-200">
                  Auto deadlines: {gameState.autoDeadlineSettings?.enabled ? 'Enabled' : 'Disabled'}
                </p>
                {gameState.autoDeadlineSettings?.enabled && (
                  <p className="text-sm text-purple-200">
                    Time: {gameState.autoDeadlineSettings.timeOfDay}
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setShowAutoDeadlineModal(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateAutoDeadlineSettings}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Update Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Auto Deadline Settings Modal */}
      {showAutoDeadlineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 rounded-lg p-6 w-96 border border-neutral-600">
            <h3 className="text-xl font-bold text-purple-400 mb-4">Auto Deadline Settings</h3>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="autoDeadlineEnabled"
                  checked={autoDeadlineEnabled}
                  onChange={(e) => setAutoDeadlineEnabled(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-neutral-700 border-neutral-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="autoDeadlineEnabled" className="text-sm font-medium text-white">
                  Enable automatic turn deadlines
                </label>
              </div>

              {autoDeadlineEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Daily deadline time (24-hour format):
                  </label>
                  <input
                    type="time"
                    value={autoDeadlineTime}
                    onChange={(e) => setAutoDeadlineTime(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Deadlines will be set automatically for this time each day when turns advance
                  </p>
                </div>
              )}

              <div className="p-3 rounded bg-purple-900/20 border border-purple-600">
                <p className="text-sm font-medium text-purple-300">
                  Current Settings:
                </p>
                <p className="text-sm text-purple-200">
                  Auto deadlines: {gameState.autoDeadlineSettings?.enabled ? 'Enabled' : 'Disabled'}
                </p>
                {gameState.autoDeadlineSettings?.enabled && (
                  <p className="text-sm text-purple-200">
                    Time: {gameState.autoDeadlineSettings.timeOfDay}
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setShowAutoDeadlineModal(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateAutoDeadlineSettings}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Update Settings
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
                  onClick={handleDiagnoseAI}
                  className="bg-blue-600 hover:bg-blue-700 text-sm"
                  disabled={gameState.tribes.filter(t => t.isAI).length === 0}
                >
                  🔍 Diagnose AI
                </Button>
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
                    {/* SIMPLIFIED: Clean newsletter format */}
                    <div className="bg-neutral-700 rounded-lg p-4">
                      <h3 className="text-xl font-bold text-amber-300 mb-3">Turn {newsletterData.turn} Newsletter</h3>
                      <p className="text-neutral-300 mb-4">Simplified format for easy copying to newsletter</p>

                      {/* JSON Preview for Copy/Paste */}
                      <div className="bg-neutral-800 rounded-lg p-4">
                        <h4 className="text-lg font-bold text-blue-300 mb-2">JSON Format (for newsletter)</h4>
                        <pre className="text-xs text-neutral-300 bg-neutral-900 rounded p-3 overflow-auto max-h-96">
                          {JSON.stringify(newsletterData, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* Tribe Results Preview */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-amber-300">📋 Tribe Results Preview</h3>
                      {newsletterData.tribes.map((tribe, index) => (
                          <div key={index} className="bg-neutral-700 rounded-lg p-4">
                            <h4 className="text-lg font-bold text-amber-300 mb-2">
                              {tribe.name} (Player: {tribe.player})
                            </h4>

                            {/* Action Results */}
                            {tribe.results.length > 0 ? (
                              <div className="space-y-1">
                                <h5 className="font-semibold text-green-300 mb-2">Results:</h5>
                                {tribe.results.map((result, resultIndex) => (
                                  <div key={resultIndex} className="text-sm text-neutral-300 bg-neutral-800 rounded p-2">
                                    {result}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-neutral-400 italic">No actions taken this turn</div>
                            )}

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