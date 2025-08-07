import React, { useState } from 'react';
import { Newsletter } from '@radix-tribes/shared';
import Button from './ui/Button';

interface NewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsletters: Newsletter[];
  currentTurn: number;
}

const NewsletterModal: React.FC<NewsletterModalProps> = ({
  isOpen,
  onClose,
  newsletters,
  currentTurn
}) => {
  const [selectedNewsletter, setSelectedNewsletter] = useState<Newsletter | null>(null);

  if (!isOpen) return null;

  // Get published newsletters, sorted by turn (newest first)
  const publishedNewsletters = newsletters
    .filter(n => n.isPublished)
    .sort((a, b) => b.turn - a.turn);

  // Get current turn newsletter or latest if none for current turn
  const currentNewsletter = publishedNewsletters.find(n => n.turn === currentTurn) || publishedNewsletters[0];

  const displayNewsletter = selectedNewsletter || currentNewsletter;

  const formatContent = (content: string) => {
    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-blue-400 mb-4 mt-6 first:mt-0">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-blue-300 mb-3 mt-5">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-blue-200 mb-2 mt-4">$1</h3>')
      .replace(/^---$/gm, '<hr class="border-slate-600 my-4">');
  };

  // Check if mobile device
  const isMobileDevice = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);

  return (
    <div className="fixed z-50"
         style={{
           top: isMobileDevice ? '0' : '0',
           left: '0',
           right: '0',
           bottom: '0',
           backgroundColor: 'rgba(0,0,0,0.5)',
           pointerEvents: 'auto'
         }}>
      <div className="w-full h-full flex items-center justify-center p-2 md:p-4" onClick={onClose}>
        <div className="bg-slate-800 rounded-lg w-full max-w-4xl h-full md:max-h-[90vh] flex flex-col border border-slate-600" onClick={e => e.stopPropagation()}>
        {/* Header - Desktop only */}
        <div className="items-center justify-between p-6 border-b border-slate-600 hidden md:flex">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-blue-400">📰 The Radix Tribes Chronicle</h2>
            {publishedNewsletters.length > 1 && (
              <select
                value={displayNewsletter?.id || ''}
                onChange={(e) => {
                  const newsletter = publishedNewsletters.find(n => n.id === e.target.value);
                  setSelectedNewsletter(newsletter || null);
                }}
                className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
              >
                {publishedNewsletters.map(newsletter => (
                  <option key={newsletter.id} value={newsletter.id}>
                    Turn {newsletter.turn} - {newsletter.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <Button onClick={onClose} variant="secondary" className="text-lg">
            ✕
          </Button>
        </div>

        {/* Mobile Header */}
        <div className="flex flex-col p-3 border-b border-slate-600 md:hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-blue-400">📰 Chronicle</h2>
            <Button onClick={onClose} variant="secondary" className="text-sm p-2">
              ✕
            </Button>
          </div>
          {publishedNewsletters.length > 1 && (
            <select
              value={displayNewsletter?.id || ''}
              onChange={(e) => {
                const newsletter = publishedNewsletters.find(n => n.id === e.target.value);
                setSelectedNewsletter(newsletter || null);
              }}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
            >
              {publishedNewsletters.map(newsletter => (
                <option key={newsletter.id} value={newsletter.id}>
                  Turn {newsletter.turn} - {newsletter.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {displayNewsletter ? (
            <div className="space-y-4">
              {/* Newsletter Header */}
              <div className="text-center border-b border-slate-600 pb-4 mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {displayNewsletter.title}
                </h1>
                <p className="text-slate-400">
                  Turn {displayNewsletter.turn} • Published {new Date(displayNewsletter.publishedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Newsletter Content */}
              <div 
                className="prose prose-invert prose-lg max-w-none text-slate-200 leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: formatContent(displayNewsletter.content)
                }}
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📰</div>
              <h3 className="text-xl font-bold text-slate-400 mb-2">No Newsletter Available</h3>
              <p className="text-slate-500">
                The newsletter for this turn hasn't been published yet. Check back later!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {displayNewsletter && (
          <div className="border-t border-slate-600 p-4 bg-slate-900/50">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <div>
                📊 Turn {displayNewsletter.turn} Chronicle
              </div>
              <div>
                {publishedNewsletters.length > 1 && (
                  <span>
                    {publishedNewsletters.findIndex(n => n.id === displayNewsletter.id) + 1} of {publishedNewsletters.length} newsletters
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default NewsletterModal;
