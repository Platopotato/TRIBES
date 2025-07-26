import React, { useState, useEffect } from 'react';
import { TickerMessage, TickerPriority } from '@radix-tribes/shared';

interface TickerProps {
  messages: TickerMessage[];
  isEnabled: boolean;
}

const Ticker: React.FC<TickerProps> = ({ messages, isEnabled }) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  // Filter active messages and sort by priority
  const activeMessages = messages
    .filter(msg => msg.isActive)
    .sort((a, b) => {
      const priorityOrder = { urgent: 3, important: 2, normal: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

  // Cycle through messages
  useEffect(() => {
    if (activeMessages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % activeMessages.length);
    }, 5000); // Change message every 5 seconds

    return () => clearInterval(interval);
  }, [activeMessages.length]);

  if (!isEnabled || activeMessages.length === 0) {
    return null;
  }

  const currentMessage = activeMessages[currentMessageIndex];

  const getPriorityStyles = (priority: TickerPriority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600 text-white border-red-400';
      case 'important':
        return 'bg-amber-600 text-white border-amber-400';
      case 'normal':
      default:
        return 'bg-slate-700 text-slate-200 border-slate-500';
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

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 border-t-2 ${getPriorityStyles(currentMessage.priority)}`}>
      <div className="flex items-center px-4 py-2">
        <div className="flex items-center space-x-2 mr-4">
          <span className="text-lg">{getPriorityIcon(currentMessage.priority)}</span>
          <span className="font-bold text-sm uppercase tracking-wide">
            {currentMessage.priority === 'urgent' ? 'URGENT' : 
             currentMessage.priority === 'important' ? 'IMPORTANT' : 'NEWS'}
          </span>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap">
            <span className="text-sm font-medium">
              {currentMessage.message}
            </span>
          </div>
        </div>

        {activeMessages.length > 1 && (
          <div className="ml-4 text-xs opacity-75">
            {currentMessageIndex + 1} / {activeMessages.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default Ticker;
