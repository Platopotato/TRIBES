import React, { useState, useEffect } from 'react';

interface LoginAnnouncement {
  enabled: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  lastUpdated: string;
}

interface LoginAnnouncementsProps {
  // No props needed - component fetches its own data
}

const LoginAnnouncements: React.FC<LoginAnnouncementsProps> = () => {
  const [announcement, setAnnouncement] = useState<LoginAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/login-announcement`);
        const data = await response.json();
        setAnnouncement(data.announcement);
      } catch (error) {
        console.error('Failed to fetch login announcement:', error);
        setAnnouncement(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncement();
  }, []);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!announcement || !announcement.enabled) {
    return null;
  }

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-600/20 border-red-500 text-red-100';
      case 'warning':
        return 'bg-amber-600/20 border-amber-500 text-amber-100';
      case 'success':
        return 'bg-green-600/20 border-green-500 text-green-100';
      case 'info':
      default:
        return 'bg-blue-600/20 border-blue-500 text-blue-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      case 'info':
      default:
        return '📢';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mb-6">
      <div className={`p-4 rounded-lg border-2 ${getTypeStyles(announcement.type)} backdrop-blur-sm`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 text-2xl">
            {getTypeIcon(announcement.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide opacity-75">
                {announcement.type.toUpperCase()}
              </span>
              <span className="text-xs opacity-50">
                {new Date(announcement.lastUpdated).toLocaleDateString()}
              </span>
            </div>

            <h4 className="font-bold text-sm mb-2">
              {announcement.title}
            </h4>

            <div className="text-sm opacity-90 leading-relaxed whitespace-pre-line">
              {announcement.message}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginAnnouncements;
