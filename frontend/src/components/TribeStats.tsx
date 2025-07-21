
/** @jsxImportSource react */
import React from 'react';
import { TribeStats as TribeStatsType } from '@radix-tribes/shared';
import Card from './ui/Card';

interface TribeStatsProps {
  stats: TribeStatsType;
}

const TribeStats: React.FC<TribeStatsProps> = ({ stats }) => {
  return (
    <Card title="Tribe Attributes">
      <ul className="space-y-2">
        {Object.entries(stats).map(([key, value]) => (
          <li key={key} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-md">
            <span className="font-medium capitalize text-slate-300">{key}</span>
            <span className="font-bold text-lg text-white">{value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default TribeStats;
