



import React, { useState, useMemo } from 'react';
import { Tribe, ChiefRequest, Chief } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { ALL_CHIEFS } from '@radix-tribes/shared';

interface ChiefsPanelProps {
    tribe: Tribe;
    allChiefRequests: ChiefRequest[];
    allTribes: Tribe[];
    onRequestChief: (chiefName: string, radixAddressSnippet: string) => void;
}

const ChiefsPanel: React.FC<ChiefsPanelProps> = ({ tribe, allChiefRequests = [], allTribes, onRequestChief }) => {
    const [selectedChief, setSelectedChief] = useState('');
    const [radixAddress, setRadixAddress] = useState('');

    const playerChiefs = useMemo(() => {
        return Object.values(tribe.garrisons).flatMap(g => g.chiefs || []);
    }, [tribe.garrisons]);

    const playerChiefRequests = useMemo(() => {
        return allChiefRequests.filter(req => req.tribeId === tribe.id);
    }, [allChiefRequests, tribe.id]);

    const availableChiefs = useMemo(() => {
        const claimedChiefNames = new Set<string>();

        // Add chiefs already owned by any tribe
        allTribes.forEach(t => {
            if (!t.garrisons) return;
            Object.values(t.garrisons).forEach(g => {
                (g.chiefs || []).forEach(c => claimedChiefNames.add(c.name));
            });
        });

        // Add chiefs that have a pending or approved request from any tribe
        allChiefRequests.forEach(req => {
            if (req.status === 'pending' || req.status === 'approved') {
                claimedChiefNames.add(req.chiefName);
            }
        });

        const available = ALL_CHIEFS.filter(chief => !claimedChiefNames.has(chief.name));
        
        if (available.length > 0 && !selectedChief) {
            setSelectedChief(available[0].name);
        } else if (available.length > 0 && selectedChief && !available.find(c => c.name === selectedChief)) {
            setSelectedChief(available[0].name);
        } else if (available.length === 0 && selectedChief) {
            setSelectedChief('');
        }
        
        return available;
    }, [allTribes, allChiefRequests, selectedChief]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedChief || !radixAddress || radixAddress.length !== 5) {
            alert('Please select a Chief and enter the last 5 digits of your Radix account address.');
            return;
        }
        onRequestChief(selectedChief, radixAddress);
        setRadixAddress('');
    };

    return (
        <Card title="Chiefs">
            <div className="space-y-4">
                {/* Active Chiefs */}
                <div>
                    <h4 className="font-semibold text-slate-300 mb-2">Active Chiefs ({playerChiefs.length})</h4>
                    {playerChiefs.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                            {playerChiefs.map((chief: Chief) => (
                                <div key={chief.name} className="bg-slate-900/50 rounded-lg p-2 flex items-start space-x-3">
                                    <img src={chief.key_image_url} alt={chief.name} className="w-16 h-16 rounded-md object-cover flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="font-bold text-amber-400">{chief.name}</p>
                                        <p className="text-xs text-slate-400 italic">"{chief.description}"</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-sm text-slate-400 italic">No active chiefs.</p>}
                </div>

                {/* Pending Requests */}
                <div className="pt-3 border-t border-slate-700">
                    <h4 className="font-semibold text-slate-300 mb-2">Pending Approvals</h4>
                    {playerChiefRequests.filter(r => r.status === 'pending').length > 0 ? (
                        <ul className="space-y-1">
                            {playerChiefRequests.filter(r => r.status === 'pending').map(req => (
                                <li key={req.id} className="text-sm text-slate-300 bg-slate-800 p-2 rounded-md">
                                    Request for <span className="font-bold text-amber-400">{req.chiefName}</span> is pending admin approval.
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-slate-400 italic">No pending requests.</p>}
                </div>

                {/* Request Form */}
                <div className="pt-3 border-t border-slate-700">
                    <h4 className="font-semibold text-slate-300 mb-2">Request a Chief</h4>
                     <p className="text-xs text-slate-400 -mt-2 mb-3">
                        You must own the corresponding NFT.
                        <a href="https://www.xrdegen.com/collections/Radix_Tribes_V1" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 ml-1 underline">
                            View Collection
                        </a>
                    </p>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label htmlFor="chief-select" className="block text-sm font-medium text-slate-300 mb-1">Select Chief</label>
                            <select
                                id="chief-select"
                                value={selectedChief}
                                onChange={e => setSelectedChief(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200"
                                disabled={availableChiefs.length === 0}
                            >
                                {availableChiefs.length > 0 ? (
                                  availableChiefs.map(chief => (
                                      <option key={chief.name} value={chief.name}>{chief.name}</option>
                                  ))
                                ) : (
                                  <option>No more chiefs available</option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="radix-address" className="block text-sm font-medium text-slate-300 mb-1">Radix Account (last 5 digits)</label>
                            <input
                                type="text"
                                id="radix-address"
                                value={radixAddress}
                                onChange={e => setRadixAddress(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200"
                                placeholder="e.g., a8c2f"
                                maxLength={5}
                                minLength={5}
                                required
                                disabled={availableChiefs.length === 0}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={availableChiefs.length === 0}>Submit for Approval</Button>
                    </form>
                </div>
            </div>
        </Card>
    );
};

export default ChiefsPanel;