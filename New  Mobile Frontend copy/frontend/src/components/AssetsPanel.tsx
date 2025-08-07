import React, { useState, useMemo } from 'react';
import { Tribe, AssetRequest, GameAsset } from '@radix-tribes/shared';
import Card from './ui/Card';
import Button from './ui/Button';
import { ALL_ASSETS } from '@radix-tribes/shared';

interface AssetsPanelProps {
    tribe: Tribe;
    allAssetRequests: AssetRequest[];
    allTribes: Tribe[];
    onRequestAsset: (assetName: string, radixAddressSnippet: string) => void;
}

const AssetsPanel: React.FC<AssetsPanelProps> = ({ tribe, allAssetRequests = [], allTribes, onRequestAsset }) => {
    const [selectedAsset, setSelectedAsset] = useState('');
    const [radixAddress, setRadixAddress] = useState('');

    const playerAssets = useMemo(() => {
        return (tribe.assets || []).map(assetName => ALL_ASSETS.find(a => a.name === assetName)).filter(Boolean) as GameAsset[];
    }, [tribe.assets]);

    const playerAssetRequests = useMemo(() => {
        return allAssetRequests.filter(req => req.tribeId === tribe.id);
    }, [allAssetRequests, tribe.id]);

    const availableAssets = useMemo(() => {
        const claimedAssetNames = new Set<string>();

        allTribes.forEach(t => {
            (t.assets || []).forEach(assetName => claimedAssetNames.add(assetName));
        });

        allAssetRequests.forEach(req => {
            if (req.status === 'pending' || req.status === 'approved') {
                claimedAssetNames.add(req.assetName);
            }
        });

        const available = ALL_ASSETS.filter(asset => !claimedAssetNames.has(asset.name));
        
        if (available.length > 0 && !selectedAsset) {
            setSelectedAsset(available[0].name);
        } else if (available.length > 0 && selectedAsset && !available.find(a => a.name === selectedAsset)) {
            setSelectedAsset(available[0].name);
        } else if (available.length === 0 && selectedAsset) {
            setSelectedAsset('');
        }
        
        return available;
    }, [allTribes, allAssetRequests, selectedAsset]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAsset || !radixAddress || radixAddress.length !== 5) {
            alert('Please select an Asset and enter the last 5 digits of your Radix account address.');
            return;
        }
        onRequestAsset(selectedAsset, radixAddress);
        setRadixAddress('');
    };

    return (
        <Card title="Assets">
            <div className="space-y-4">
                {/* Active Assets */}
                <div>
                    <h4 className="font-semibold text-slate-300 mb-2">Owned Assets ({playerAssets.length})</h4>
                    {playerAssets.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                            {playerAssets.map((asset: GameAsset) => (
                                <div key={asset.name} className="bg-slate-900/50 rounded-lg p-2 flex items-start space-x-3">
                                    <img src={asset.key_image_url} alt={asset.name} className="w-16 h-16 rounded-md object-cover flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="font-bold text-amber-400">{asset.name}</p>
                                        <p className="text-xs text-slate-400 italic">"{asset.description}"</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-sm text-slate-400 italic">No owned assets.</p>}
                </div>

                {/* Pending Requests */}
                <div className="pt-3 border-t border-slate-700">
                    <h4 className="font-semibold text-slate-300 mb-2">Pending Approvals</h4>
                    {playerAssetRequests.filter(r => r.status === 'pending').length > 0 ? (
                        <ul className="space-y-1">
                            {playerAssetRequests.filter(r => r.status === 'pending').map(req => (
                                <li key={req.id} className="text-sm text-slate-300 bg-slate-800 p-2 rounded-md">
                                    Request for <span className="font-bold text-amber-400">{req.assetName}</span> is pending admin approval.
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-slate-400 italic">No pending requests.</p>}
                </div>

                {/* Request Form */}
                <div className="pt-3 border-t border-slate-700">
                    <h4 className="font-semibold text-slate-300 mb-2">Request an Asset</h4>
                     <p className="text-xs text-slate-400 -mt-2 mb-3">
                        You must own the corresponding Asset NFT to request it.
                    </p>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label htmlFor="asset-select" className="block text-sm font-medium text-slate-300 mb-1">Select Asset</label>
                            <select
                                id="asset-select"
                                value={selectedAsset}
                                onChange={e => setSelectedAsset(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200"
                                disabled={availableAssets.length === 0}
                            >
                                {availableAssets.length > 0 ? (
                                  availableAssets.map(asset => (
                                      <option key={asset.name} value={asset.name}>{asset.name}</option>
                                  ))
                                ) : (
                                  <option>No more assets available</option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="radix-address-asset" className="block text-sm font-medium text-slate-300 mb-1">Radix Account (last 5 digits)</label>
                            <input
                                type="text"
                                id="radix-address-asset"
                                value={radixAddress}
                                onChange={e => setRadixAddress(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200"
                                placeholder="e.g., a8c2f"
                                maxLength={5}
                                minLength={5}
                                required
                                disabled={availableAssets.length === 0}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={availableAssets.length === 0}>Submit for Approval</Button>
                    </form>
                </div>
            </div>
        </Card>
    );
};

export default AssetsPanel;
