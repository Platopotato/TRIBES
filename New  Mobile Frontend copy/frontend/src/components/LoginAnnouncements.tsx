import React from 'react';
import { LoginAnnouncement, TickerPriority } from '@radix-tribes/shared';

interface LoginAnnouncementsProps {
  announcements: LoginAnnouncement[];
  isEnabled: boolean;
}

const LoginAnnouncements: React.FC<LoginAnnouncementsProps> = ({ announcements, isEnabled }) => {
  if (!isEnabled || announcements.length === 0) {
    return null;
  }

  // Filter active announcements and sort by priority
  const activeAnnouncements = announcements
    .filter(announcement => announcement.isActive)
    .sort((a, b) => {
      const priorityOrder = { urgent: 3, important: 2, normal: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

  if (activeAnnouncements.length === 0) {
    return null;
  }

  const getPriorityStyles = (priority: TickerPriority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600/20 border-red-500 text-red-100';
      case 'important':
        return 'bg-amber-600/20 border-amber-500 text-amber-100';
      case 'normal':
      default:
        return 'bg-blue-600/20 border-blue-500 text-blue-100';
    }
  };

  const getPriorityIcon = (priority: TickerPriority) => {
    switch (priority) {
      case 'urgent':
        return '🚨';
      case 'important':
        return '⚠️';
      case 'normal':
      default:
        return '📢';
    }
  };

  const getPriorityLabel = (priority: TickerPriority) => {
    switch (priority) {
      case 'urgent':
        return 'URGENT';
      case 'important':
        return 'IMPORTANT';
      case 'normal':
      default:
        return 'NOTICE';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mb-6 space-y-3">
      <h3 className="text-lg font-bold text-amber-400 text-center mb-4">
        📢 Important Announcements
      </h3>
      
      {activeAnnouncements.map(announcement => (
        <div
          key={announcement.id}
          className={`p-4 rounded-lg border-2 ${getPriorityStyles(announcement.priority)} backdrop-blur-sm`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 text-2xl">
              {getPriorityIcon(announcement.priority)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wide opacity-75">
                  {getPriorityLabel(announcement.priority)}
                </span>
                <span className="text-xs opacity-50">
                  {new Date(announcement.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <h4 className="font-bold text-sm mb-1">
                {announcement.title}
              </h4>
              
              <p className="text-sm opacity-90 leading-relaxed">
                {announcement.message}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LoginAnnouncements;
