



import React, { useState, useMemo } from 'react';
import { Tribe, ChiefRequest, Chief, Journey } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { ALL_CHIEFS } from '@radix-tribes/shared';

interface ChiefsPanelProps {
    tribe: Tribe;
    allChiefRequests: ChiefRequest[];
    allTribes: Tribe[];
    journeys: Journey[];
    onRequestChief: (chiefName: string, radixAddressSnippet: string) => void;
}

const ChiefsPanel: React.FC<ChiefsPanelProps> = ({ tribe, allChiefRequests = [], allTribes, journeys, onRequestChief }) => {
    const [selectedChief, setSelectedChief] = useState('');
    const [radixAddress, setRadixAddress] = useState('');

    const playerChiefs = useMemo(() => {
        const allChiefs: Array<Chief & { status: string; location?: string; returnTurn?: number }> = [];

        // Chiefs in garrisons (active)
        Object.entries(tribe.garrisons).forEach(([location, garrison]) => {
            (garrison.chiefs || []).forEach(chief => {
                allChiefs.push({
                    ...chief,
                    status: 'Active',
                    location: location
                });
            });
        });

        // Chiefs on journeys
        const tribeJourneys = journeys.filter(j => j.ownerTribeId === tribe.id);
        tribeJourneys.forEach(journey => {
            (journey.force.chiefs || []).forEach(chief => {
                allChiefs.push({
                    ...chief,
                    status: `On Journey (${journey.type})`,
                    location: `${journey.currentLocation} → ${journey.destination}`
                });
            });
        });

        // Injured chiefs
        (tribe.injuredChiefs || []).forEach(injuredEntry => {
            allChiefs.push({
                ...injuredEntry.chief,
                status: 'Injured',
                location: injuredEntry.fromHex || tribe.location,
                returnTurn: injuredEntry.returnTurn
            });
        });

        // Prisoner chiefs (if they exist)
        (tribe.prisoners || []).forEach((prisoner: any) => {
            allChiefs.push({
                ...prisoner.chief,
                status: 'Prisoner',
                location: prisoner.location || 'Unknown'
            });
        });

        return allChiefs;
    }, [tribe.garrisons, tribe.injuredChiefs, tribe.prisoners, journeys, tribe.id]);

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
                {/* All Chiefs */}
                <div>
                    <h4 className="font-semibold text-slate-300 mb-2">Your Chiefs ({playerChiefs.length})</h4>
                    {playerChiefs.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2">
                            {playerChiefs.map((chief: any) => {
                                const getStatusColor = (status: string) => {
                                    if (status === 'Active') return 'text-green-400';
                                    if (status === 'Injured') return 'text-red-400';
                                    if (status.includes('Journey')) return 'text-blue-400';
                                    if (status === 'Prisoner') return 'text-orange-400';
                                    return 'text-slate-400';
                                };

                                return (
                                    <div key={`${chief.name}-${chief.status}`} className="bg-slate-900/50 rounded-lg p-3 flex items-start space-x-3">
                                        <img src={chief.key_image_url} alt={chief.name} className="w-16 h-16 rounded-md object-cover flex-shrink-0 mt-1" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-amber-400">{chief.name}</p>
                                                <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusColor(chief.status)} bg-slate-800`}>
                                                    {chief.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 italic mb-1">"{chief.description}"</p>
                                            {chief.location && (
                                                <p className="text-xs text-slate-300">
                                                    📍 {chief.location}
                                                </p>
                                            )}
                                            {chief.returnTurn && (
                                                <p className="text-xs text-yellow-400">
                                                    🕒 Returns on turn {chief.returnTurn}
                                                </p>
                                            )}
                                            <div className="flex space-x-3 mt-1 text-xs text-slate-400">
                                                <span>💪 {chief.stats.strength}</span>
                                                <span>🧠 {chief.stats.intelligence}</span>
                                                <span>👑 {chief.stats.leadership}</span>
                                                <span>✨ {chief.stats.charisma}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <p className="text-sm text-slate-400 italic">No chiefs owned.</p>}
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