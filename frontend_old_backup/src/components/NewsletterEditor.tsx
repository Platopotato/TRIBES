import React, { useState, useEffect } from 'react';
import { Newsletter } from '@radix-tribes/shared';
import Button from './ui/Button';

interface NewsletterEditorProps {
  currentTurn: number;
  currentNewsletter?: Newsletter;
  onSave: (newsletter: Omit<Newsletter, 'id' | 'publishedAt'>) => void;
  onPublish: (newsletterId: string) => void;
  onUnpublish: (newsletterId: string) => void;
}

const NewsletterEditor: React.FC<NewsletterEditorProps> = ({
  currentTurn,
  currentNewsletter,
  onSave,
  onPublish,
  onUnpublish
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (currentNewsletter) {
      setTitle(currentNewsletter.title);
      setContent(currentNewsletter.content);
    } else {
      setTitle(`Turn ${currentTurn} Newsletter`);
      setContent(`# Turn ${currentTurn} Newsletter

## Major Events This Turn

*Write about the major events, battles, discoveries, and developments that happened this turn.*

## Tribal Updates

### [Tribe Name]
- Brief update about what this tribe accomplished
- Any notable achievements or setbacks

### [Tribe Name]
- Another tribe's updates
- Keep it engaging and narrative

## Economic Report

*Market conditions, resource discoveries, trade developments*

## Diplomatic News

*Alliances formed, wars declared, peace treaties, etc.*

## Looking Ahead

*Tease what might happen next turn to build excitement*

---
*The Radix Tribes Chronicle - Turn ${currentTurn}*`);
    }
  }, [currentNewsletter, currentTurn]);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      alert('Please enter both a title and content for the newsletter');
      return;
    }

    onSave({
      turn: currentTurn,
      title: title.trim(),
      content: content.trim(),
      isPublished: false
    });

    setIsEditing(false);
  };

  const handlePublish = () => {
    if (!currentNewsletter) {
      alert('Please save the newsletter first before publishing');
      return;
    }

    if (confirm('Publish this newsletter? Players will be able to see it immediately.')) {
      onPublish(currentNewsletter.id);
    }
  };

  const handleUnpublish = () => {
    if (!currentNewsletter) return;

    if (confirm('Unpublish this newsletter? Players will no longer be able to see it.')) {
      onUnpublish(currentNewsletter.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-blue-400">
          📰 Turn {currentTurn} Newsletter
        </h3>
        
        <div className="flex items-center space-x-2">
          {currentNewsletter && (
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              currentNewsletter.isPublished 
                ? 'bg-green-600 text-white' 
                : 'bg-yellow-600 text-white'
            }`}>
              {currentNewsletter.isPublished ? 'PUBLISHED' : 'DRAFT'}
            </span>
          )}
        </div>
      </div>

      {!isEditing && currentNewsletter ? (
        // Display mode
        <div className="space-y-4">
          <div className="p-4 rounded bg-slate-800 border border-slate-600">
            <h4 className="font-bold text-white mb-2">{currentNewsletter.title}</h4>
            <div 
              className="prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: currentNewsletter.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/^# (.*$)/gm, '<h1>$1</h1>').replace(/^## (.*$)/gm, '<h2>$1</h2>').replace(/^### (.*$)/gm, '<h3>$1</h3>')
              }}
            />
          </div>

          <div className="flex space-x-3">
            <Button 
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              ✏️ Edit Newsletter
            </Button>

            {currentNewsletter.isPublished ? (
              <Button 
                onClick={handleUnpublish}
                className="bg-orange-600 hover:bg-orange-700"
              >
                📤 Unpublish
              </Button>
            ) : (
              <Button 
                onClick={handlePublish}
                className="bg-green-600 hover:bg-green-700"
              >
                📢 Publish Newsletter
              </Button>
            )}
          </div>
        </div>
      ) : (
        // Edit mode
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Newsletter Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter newsletter title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Newsletter Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="Write your newsletter content here... Use markdown-style formatting:&#10;# Large Heading&#10;## Medium Heading&#10;### Small Heading&#10;**Bold Text**&#10;*Italic Text*"
            />
            <p className="text-xs text-slate-400 mt-1">
              Use markdown-style formatting: # for headings, **bold**, *italic*
            </p>
          </div>

          <div className="flex space-x-3">
            <Button 
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700"
            >
              💾 Save Newsletter
            </Button>

            <Button 
              onClick={() => {
                setIsEditing(false);
                if (currentNewsletter) {
                  setTitle(currentNewsletter.title);
                  setContent(currentNewsletter.content);
                }
              }}
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsletterEditor;
