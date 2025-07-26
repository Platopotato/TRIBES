import React, { useState, useEffect } from 'react';
import { TurnDeadline as TurnDeadlineType } from '@radix-tribes/shared';

interface TurnDeadlineProps {
  turnDeadline?: TurnDeadlineType;
  currentTurn: number;
}

const TurnDeadline: React.FC<TurnDeadlineProps> = ({ turnDeadline, currentTurn }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [urgencyLevel, setUrgencyLevel] = useState<'safe' | 'warning' | 'urgent'>('safe');

  useEffect(() => {
    if (!turnDeadline || !turnDeadline.isActive || turnDeadline.turn !== currentTurn) {
      setTimeLeft('');
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const deadline = turnDeadline.deadline;
      const timeDiff = deadline - now;

      if (timeDiff <= 0) {
        setTimeLeft('DEADLINE PASSED');
        setUrgencyLevel('urgent');
        return;
      }

      // Calculate time components
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      // Format time string
      let timeString = '';
      if (days > 0) {
        timeString = `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        timeString = `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        timeString = `${minutes}m ${seconds}s`;
      } else {
        timeString = `${seconds}s`;
      }

      setTimeLeft(timeString);

      // Set urgency level based on time remaining
      const totalHours = timeDiff / (1000 * 60 * 60);
      if (totalHours <= 2) {
        setUrgencyLevel('urgent');
      } else if (totalHours <= 12) {
        setUrgencyLevel('warning');
      } else {
        setUrgencyLevel('safe');
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [turnDeadline, currentTurn]);

  if (!turnDeadline || !turnDeadline.isActive || turnDeadline.turn !== currentTurn || !timeLeft) {
    return null;
  }

  const getUrgencyStyles = () => {
    switch (urgencyLevel) {
      case 'urgent':
        return 'bg-red-600/20 border-red-500 text-red-100 animate-pulse';
      case 'warning':
        return 'bg-amber-600/20 border-amber-500 text-amber-100';
      case 'safe':
      default:
        return 'bg-green-600/20 border-green-500 text-green-100';
    }
  };

  const getUrgencyIcon = () => {
    switch (urgencyLevel) {
      case 'urgent':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'safe':
      default:
        return '⏰';
    }
  };

  const getUrgencyLabel = () => {
    switch (urgencyLevel) {
      case 'urgent':
        return timeLeft === 'DEADLINE PASSED' ? 'DEADLINE PASSED' : 'URGENT';
      case 'warning':
        return 'DEADLINE APPROACHING';
      case 'safe':
      default:
        return 'TURN DEADLINE';
    }
  };

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg border-2 ${getUrgencyStyles()} backdrop-blur-sm`}>
      <div className="flex-shrink-0 text-lg">
        {getUrgencyIcon()}
      </div>
      
      <div className="flex flex-col min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide opacity-75">
          {getUrgencyLabel()}
        </div>
        <div className="font-bold text-sm">
          {timeLeft === 'DEADLINE PASSED' ? timeLeft : `${timeLeft} remaining`}
        </div>
      </div>
    </div>
  );
};

export default TurnDeadline;
