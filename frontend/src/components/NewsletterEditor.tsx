import React, { useState, useEffect } from 'react';
import { Newsletter } from '@radix-tribes/shared';
import Button from './ui/Button';

interface NewsletterEditorProps {
  currentTurn: number;
  currentNewsletter?: Newsletter;
  allNewsletters?: Newsletter[];
  onSave: (newsletter: Omit<Newsletter, 'id' | 'publishedAt'>) => void;
  onPublish: (newsletterId: string) => void;
  onUnpublish: (newsletterId: string) => void;
  onUploadNewsletter?: (newsletter: Omit<Newsletter, 'id' | 'publishedAt'>) => void;
}

const NewsletterEditor: React.FC<NewsletterEditorProps> = ({
  currentTurn,
  currentNewsletter,
  allNewsletters = [],
  onSave,
  onPublish,
  onUnpublish,
  onUploadNewsletter
}) => {
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view');
  const [selectedTurn, setSelectedTurn] = useState<number>(currentTurn);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTurn, setUploadTurn] = useState<number>(currentTurn - 1);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');

  // Find newsletter for selected turn
  const selectedNewsletter = allNewsletters.find(n => n.turn === selectedTurn) ||
    (selectedTurn === currentTurn ? currentNewsletter : null);

  // Debug logging
  console.log('📰 NewsletterEditor State:', {
    currentTurn,
    selectedTurn,
    mode,
    hasSelectedNewsletter: !!selectedNewsletter,
    allNewslettersCount: allNewsletters.length,
    allNewsletterTurns: allNewsletters.map(n => n.turn)
  });

  if (selectedNewsletter) {
    console.log('📰 Selected Newsletter Details:', {
      id: selectedNewsletter.id,
      turn: selectedNewsletter.turn,
      title: selectedNewsletter.title,
      contentLength: selectedNewsletter.content?.length,
      isPublished: selectedNewsletter.isPublished,
      publishedAt: selectedNewsletter.publishedAt
    });
  }

  if (currentNewsletter) {
    console.log('📰 Current Newsletter Details:', {
      id: currentNewsletter.id,
      turn: currentNewsletter.turn,
      title: currentNewsletter.title,
      contentLength: currentNewsletter.content?.length,
      isPublished: currentNewsletter.isPublished
    });
  }

  const getNewsletterTemplate = (turn: number) => `# Turn ${turn} Newsletter

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
*The Radix Tribes Chronicle - Turn ${turn}*`;

  const handleCreateNew = () => {
    setMode('create');
    setTitle(`Turn ${selectedTurn} Newsletter`);
    setContent(getNewsletterTemplate(selectedTurn));
  };

  const handleEdit = () => {
    if (selectedNewsletter) {
      setMode('edit');
      setTitle(selectedNewsletter.title);
      setContent(selectedNewsletter.content);
    }
  };

  const handleCancel = () => {
    setMode('view');
    setTitle('');
    setContent('');
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      alert('Please enter both a title and content for the newsletter');
      return;
    }

    onSave({
      turn: selectedTurn,
      title: title.trim(),
      content: content.trim(),
      isPublished: false
    });

    // Return to view mode after save
    setMode('view');
    setTitle('');
    setContent('');
  };

  const handlePublish = () => {
    if (!selectedNewsletter) {
      alert('Please save the newsletter first before publishing');
      return;
    }

    if (confirm('Publish this newsletter? Players will be able to see it immediately.')) {
      onPublish(selectedNewsletter.id);
    }
  };

  const handleUnpublish = () => {
    if (!selectedNewsletter) return;

    if (confirm('Unpublish this newsletter? Players will no longer be able to see it.')) {
      onUnpublish(selectedNewsletter.id);
    }
  };

  const handleUploadNewsletter = () => {
    if (!uploadTitle.trim() || !uploadContent.trim()) {
      alert('Please enter both a title and content for the newsletter');
      return;
    }

    if (uploadTurn < 1 || uploadTurn >= currentTurn) {
      alert(`Turn must be between 1 and ${currentTurn - 1} (previous turns only)`);
      return;
    }

    // Check if newsletter already exists for this turn
    const existingNewsletter = allNewsletters.find(n => n.turn === uploadTurn);
    if (existingNewsletter) {
      if (!confirm(`A newsletter already exists for Turn ${uploadTurn}. Replace it?`)) {
        return;
      }
    }

    if (onUploadNewsletter) {
      onUploadNewsletter({
        turn: uploadTurn,
        title: uploadTitle.trim(),
        content: uploadContent.trim(),
        isPublished: true // Auto-publish uploaded newsletters
      });
    }

    // Reset upload form
    setUploadTurn(currentTurn - 1);
    setUploadTitle('');
    setUploadContent('');
    setShowUploadModal(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;

        // Try to parse as JSON first (newsletter export format)
        try {
          const newsletterData = JSON.parse(content);
          if (newsletterData.title && newsletterData.content && newsletterData.turn) {
            setUploadTurn(newsletterData.turn);
            setUploadTitle(newsletterData.title);
            setUploadContent(newsletterData.content);
          } else {
            throw new Error('Invalid newsletter format');
          }
        } catch {
          // If not JSON, treat as plain text content
          setUploadContent(content);
          setUploadTitle(`Turn ${uploadTurn} Newsletter`);
        }
      } catch (error) {
        alert('Error reading file. Please ensure it\'s a valid text or JSON file.');
      }
    };
    reader.readAsText(file);

    // Clear the input so the same file can be selected again
    event.target.value = '';
  };

  const handleExportNewsletter = () => {
    if (!selectedNewsletter) return;

    const exportData = {
      turn: selectedNewsletter.turn,
      title: selectedNewsletter.title,
      content: selectedNewsletter.content,
      isPublished: selectedNewsletter.isPublished,
      publishedAt: selectedNewsletter.publishedAt,
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `newsletter-turn-${selectedNewsletter.turn}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-blue-400">
          📰 Newsletter Management
        </h3>

        <div className="flex items-center space-x-2">
          {onUploadNewsletter && (
            <Button
              onClick={() => setShowUploadModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-xs px-2 py-1"
            >
              📤 Upload Previous
            </Button>
          )}
        </div>
      </div>

      {/* Turn Selection and Actions */}
      <div className="flex items-center space-x-4 p-4 bg-slate-800 rounded border border-slate-600">
        <div className="flex items-center space-x-2">
          <label className="text-white font-medium">Turn:</label>
          <select
            value={selectedTurn}
            onChange={(e) => setSelectedTurn(Number(e.target.value))}
            className="bg-slate-700 text-white px-3 py-1 rounded border border-slate-600"
            disabled={mode !== 'view'}
          >
            {Array.from({ length: currentTurn }, (_, i) => i + 1).map(turn => (
              <option key={turn} value={turn}>Turn {turn}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          {selectedNewsletter && (
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              selectedNewsletter.isPublished
                ? 'bg-green-600 text-white'
                : 'bg-yellow-600 text-white'
            }`}>
              {selectedNewsletter.isPublished ? 'PUBLISHED' : 'DRAFT'}
            </span>
          )}

          {mode === 'view' && (
            <>
              {selectedNewsletter ? (
                <Button
                  onClick={handleEdit}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  ✏️ Edit
                </Button>
              ) : (
                <Button
                  onClick={handleCreateNew}
                  className="bg-green-600 hover:bg-green-700"
                >
                  ➕ Create Newsletter
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* View Mode - Display Newsletter */}
      {mode === 'view' && selectedNewsletter && (
        <div className="space-y-4">
          <div className="p-4 rounded bg-slate-800 border border-slate-600">
            <h4 className="font-bold text-white mb-2">{selectedNewsletter.title}</h4>
            <div
              className="prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: selectedNewsletter.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/^# (.*$)/gm, '<h1>$1</h1>').replace(/^## (.*$)/gm, '<h2>$1</h2>').replace(/^### (.*$)/gm, '<h3>$1</h3>')
              }}
            />
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={() => {
                const exportData = {
                  turn: selectedNewsletter.turn,
                  title: selectedNewsletter.title,
                  content: selectedNewsletter.content,
                  isPublished: selectedNewsletter.isPublished,
                  publishedAt: selectedNewsletter.publishedAt,
                  exportedAt: new Date().toISOString()
                };
                const dataStr = JSON.stringify(exportData, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `newsletter-turn-${selectedNewsletter.turn}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
              className="bg-slate-600 hover:bg-slate-700"
            >
              💾 Export
            </Button>

            {selectedNewsletter.isPublished ? (
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
      )}

      {/* Edit/Create Mode */}
      {(mode === 'edit' || mode === 'create') && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-800 rounded border border-slate-600">
            <h4 className="text-white font-bold mb-4">
              {mode === 'create' ? `Creating Newsletter for Turn ${selectedTurn}` : `Editing Turn ${selectedTurn} Newsletter`}
            </h4>

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
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700"
              disabled={!title.trim() || !content.trim()}
            >
              💾 Save Newsletter
            </Button>

            <Button
              onClick={handleCancel}
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Upload Previous Newsletter Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-purple-400">📤 Upload Previous Newsletter</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Turn Number (1 to {currentTurn - 1})
                </label>
                <input
                  type="number"
                  min="1"
                  max={currentTurn - 1}
                  value={uploadTurn}
                  onChange={(e) => setUploadTurn(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Newsletter Title
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder={`Turn ${uploadTurn} Newsletter`}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Upload from File
                </label>
                <input
                  type="file"
                  accept=".txt,.md,.json"
                  onChange={handleFileUpload}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:bg-purple-600 file:text-white file:cursor-pointer"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Supports .txt, .md, or .json files. JSON files should have title, content, and turn fields.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Newsletter Content
                </label>
                <textarea
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  placeholder="Enter newsletter content here..."
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200 h-64 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Supports markdown: **bold**, *italic*, # headers, ## subheaders
                </p>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-600">
                <Button
                  onClick={handleUploadNewsletter}
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={!uploadTitle.trim() || !uploadContent.trim()}
                >
                  📤 Upload Newsletter
                </Button>
                <Button
                  onClick={() => setShowUploadModal(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsletterEditor;
