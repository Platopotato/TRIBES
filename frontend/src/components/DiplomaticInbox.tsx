import React, { useMemo, useState } from 'react';
import { DiplomaticMessage, DiplomaticMessageType, DiplomaticMessageStatus } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { respondToMessage, dismissMessage } from '../lib/client';

interface DiplomaticInboxProps {
    messages: DiplomaticMessage[];
    currentTribeId: string;
    currentTurn: number;
    onMessageResponse: (messageId: string, response: 'accepted' | 'rejected' | 'dismissed') => void;
}

const DiplomaticInbox: React.FC<DiplomaticInboxProps> = ({ 
    messages, 
    currentTribeId, 
    currentTurn,
    onMessageResponse 
}) => {
    const [selectedMessage, setSelectedMessage] = useState<DiplomaticMessage | null>(null);
    const [filter, setFilter] = useState<'all' | 'urgent' | 'info' | 'archived'>('all');

    // Filter messages for current tribe
    const myMessages = useMemo(() => {
        return messages.filter(msg => msg.toTribeId === currentTribeId);
    }, [messages, currentTribeId]);

    // Categorize messages
    const categorizedMessages = useMemo(() => {
        const urgent = myMessages.filter(msg => 
            msg.requiresResponse && 
            msg.status === 'pending' && 
            (!msg.expiresOnTurn || msg.expiresOnTurn > currentTurn)
        );
        
        const info = myMessages.filter(msg => 
            !msg.requiresResponse && 
            msg.status === 'pending'
        );
        
        const archived = myMessages.filter(msg => 
            msg.status !== 'pending' || 
            (msg.expiresOnTurn && msg.expiresOnTurn <= currentTurn)
        );

        return { urgent, info, archived };
    }, [myMessages, currentTurn]);

    // Get filtered messages based on current filter
    const filteredMessages = useMemo(() => {
        switch (filter) {
            case 'urgent': return categorizedMessages.urgent;
            case 'info': return categorizedMessages.info;
            case 'archived': return categorizedMessages.archived;
            default: return myMessages;
        }
    }, [filter, categorizedMessages, myMessages]);

    // Get message type display info
    const getMessageTypeInfo = (type: DiplomaticMessageType) => {
        switch (type) {
            case 'ultimatum': return { icon: '📜', color: 'text-red-400', label: 'Ultimatum' };
            case 'alliance': return { icon: '🤝', color: 'text-blue-400', label: 'Alliance Proposal' };
            case 'peace': return { icon: '🕊️', color: 'text-green-400', label: 'Peace Treaty' };
            case 'non_aggression': return { icon: '🛡️', color: 'text-yellow-400', label: 'Non-Aggression Pact' };
            case 'aid_request': return { icon: '🆘', color: 'text-orange-400', label: 'Aid Request' };
            case 'trade_proposal': return { icon: '🚛', color: 'text-purple-400', label: 'Trade Proposal' };
            case 'peace_envoy': return { icon: '🕊️', color: 'text-cyan-400', label: 'Peace Envoy' };
            case 'tribute': return { icon: '🎁', color: 'text-pink-400', label: 'Tribute Offer' };
            case 'passage_request': return { icon: '🗺️', color: 'text-indigo-400', label: 'Passage Request' };
            case 'intelligence': return { icon: '🔍', color: 'text-gray-400', label: 'Intelligence Report' };
            case 'announcement': return { icon: '📰', color: 'text-slate-400', label: 'Announcement' };
            default: return { icon: '📨', color: 'text-slate-400', label: 'Message' };
        }
    };

    // Handle message response
    const handleResponse = (messageId: string, response: 'accepted' | 'rejected' | 'dismissed') => {
        respondToMessage({ messageId, response });
        onMessageResponse(messageId, response);
        setSelectedMessage(null);
    };

    // Get status badge
    const getStatusBadge = (message: DiplomaticMessage) => {
        if (message.expiresOnTurn && message.expiresOnTurn <= currentTurn) {
            return <span className="px-2 py-1 text-xs bg-red-600 text-white rounded">Expired</span>;
        }
        
        switch (message.status) {
            case 'pending':
                if (message.requiresResponse) {
                    const turnsLeft = message.expiresOnTurn ? message.expiresOnTurn - currentTurn : null;
                    return (
                        <span className="px-2 py-1 text-xs bg-red-600 text-white rounded">
                            {turnsLeft ? `${turnsLeft} turns left` : 'Response Required'}
                        </span>
                    );
                }
                return <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded">New</span>;
            case 'accepted':
                return <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">Accepted</span>;
            case 'rejected':
                return <span className="px-2 py-1 text-xs bg-red-600 text-white rounded">Rejected</span>;
            case 'dismissed':
                return <span className="px-2 py-1 text-xs bg-gray-600 text-white rounded">Dismissed</span>;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            {/* Filter Tabs */}
            <div className="flex space-x-2 border-b border-slate-600">
                {[
                    { key: 'all', label: 'All', count: myMessages.length },
                    { key: 'urgent', label: 'Urgent', count: categorizedMessages.urgent.length },
                    { key: 'info', label: 'Info', count: categorizedMessages.info.length },
                    { key: 'archived', label: 'Archived', count: categorizedMessages.archived.length }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key as any)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            filter === tab.key
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                                tab.key === 'urgent' && tab.count > 0
                                    ? 'bg-red-600 text-white'
                                    : 'bg-slate-600 text-slate-300'
                            }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Message List */}
            <div className="space-y-2">
                {filteredMessages.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <div className="text-4xl mb-2">📭</div>
                        <div>No messages in this category</div>
                    </div>
                ) : (
                    filteredMessages.map(message => {
                        const typeInfo = getMessageTypeInfo(message.type);
                        const isSelected = selectedMessage?.id === message.id;
                        
                        return (
                            <div
                                key={message.id}
                                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                                    isSelected
                                        ? 'border-blue-500 bg-slate-700'
                                        : 'border-slate-600 bg-slate-800 hover:bg-slate-700'
                                }`}
                                onClick={() => setSelectedMessage(isSelected ? null : message)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-3 flex-1">
                                        <div className="text-2xl">{typeInfo.icon}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className={`font-medium ${typeInfo.color}`}>
                                                    {typeInfo.label}
                                                </span>
                                                <span className="text-slate-400 text-sm">
                                                    from {message.fromTribeName}
                                                </span>
                                                <span className="text-slate-500 text-xs">
                                                    Turn {message.createdTurn}
                                                </span>
                                            </div>
                                            <div className="text-slate-200 font-medium mb-1">
                                                {message.subject}
                                            </div>
                                            <div className="text-slate-400 text-sm line-clamp-2">
                                                {message.message}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end space-y-2">
                                        {getStatusBadge(message)}
                                        {isSelected && (
                                            <div className="text-slate-400 text-xs">
                                                Click to collapse
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Message Details */}
                                {isSelected && (
                                    <div className="mt-4 pt-4 border-t border-slate-600">
                                        <div className="space-y-3">
                                            {/* Message Content */}
                                            <div>
                                                <div className="text-sm font-medium text-slate-300 mb-2">Message:</div>
                                                <div className="text-slate-200 bg-slate-900 p-3 rounded">
                                                    {message.message}
                                                </div>
                                            </div>

                                            {/* Message Data */}
                                            {message.data && (
                                                <div>
                                                    <div className="text-sm font-medium text-slate-300 mb-2">Details:</div>
                                                    <div className="text-slate-200 bg-slate-900 p-3 rounded">
                                                        {/* Render specific data based on message type */}
                                                        {message.type === 'ultimatum' && message.data.demands && (
                                                            <div>
                                                                <div className="font-medium text-red-400 mb-2">Demands:</div>
                                                                <ul className="space-y-1">
                                                                    {message.data.demands.food && <li>🌾 {message.data.demands.food} Food</li>}
                                                                    {message.data.demands.scrap && <li>🔩 {message.data.demands.scrap} Scrap</li>}
                                                                    {message.data.demands.weapons && <li>⚔️ {message.data.demands.weapons} Weapons</li>}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {message.type === 'aid_request' && message.data.resources && (
                                                            <div>
                                                                <div className="font-medium text-orange-400 mb-2">Requested Aid:</div>
                                                                <ul className="space-y-1">
                                                                    {message.data.resources.food && <li>🌾 {message.data.resources.food} Food</li>}
                                                                    {message.data.resources.scrap && <li>🔩 {message.data.resources.scrap} Scrap</li>}
                                                                    {message.data.resources.weapons && <li>⚔️ {message.data.resources.weapons} Weapons</li>}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {message.type === 'trade_proposal' && message.data.trade && (
                                                            <div>
                                                                <div className="font-medium text-purple-400 mb-2">Trade Terms:</div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <div className="text-sm text-slate-400">They Offer:</div>
                                                                        <ul className="space-y-1">
                                                                            {message.data.trade.offering.food && <li>🌾 {message.data.trade.offering.food} Food per turn</li>}
                                                                            {message.data.trade.offering.scrap && <li>🔩 {message.data.trade.offering.scrap} Scrap per turn</li>}
                                                                        </ul>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm text-slate-400">They Want:</div>
                                                                        <ul className="space-y-1">
                                                                            {message.data.trade.requesting.food && <li>🌾 {message.data.trade.requesting.food} Food</li>}
                                                                            {message.data.trade.requesting.scrap && <li>🔩 {message.data.trade.requesting.scrap} Scrap</li>}
                                                                            {message.data.trade.requesting.weapons && <li>⚔️ {message.data.trade.requesting.weapons} Weapons</li>}
                                                                        </ul>
                                                                    </div>
                                                                </div>
                                                                {message.data.trade.duration && (
                                                                    <div className="mt-2 text-sm text-slate-400">
                                                                        Duration: {message.data.trade.duration} turns
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            {message.status === 'pending' && (
                                                <div className="flex space-x-2">
                                                    {message.requiresResponse ? (
                                                        <>
                                                            <Button
                                                                onClick={() => handleResponse(message.id, 'accepted')}
                                                                className="bg-green-600 hover:bg-green-700"
                                                            >
                                                                ✅ Accept
                                                            </Button>
                                                            <Button
                                                                onClick={() => handleResponse(message.id, 'rejected')}
                                                                className="bg-red-600 hover:bg-red-700"
                                                            >
                                                                ❌ Reject
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Button
                                                            onClick={() => handleResponse(message.id, 'dismissed')}
                                                            className="bg-slate-600 hover:bg-slate-700"
                                                        >
                                                            📋 Dismiss
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default DiplomaticInbox;
