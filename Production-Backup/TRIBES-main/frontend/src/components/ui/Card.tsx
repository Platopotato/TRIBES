import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className }) => {
  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-6 ${className}`}>
      {title && <h2 className="text-xl font-bold text-slate-100 mb-4">{title}</h2>}
      {children}
    </div>
  );
};

export default Card;
