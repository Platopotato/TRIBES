
import React from 'react';

interface TransitionScreenProps {
  message: string;
}

const TransitionScreen: React.FC<TransitionScreenProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900 text-white">
      <div className="text-center">
        <svg className="mx-auto h-16 w-16 text-amber-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <h2 className="mt-6 text-2xl font-bold tracking-tight text-amber-400">{message}</h2>
        <p className="mt-2 text-slate-400">Please wait while the wasteland evolves...</p>
      </div>
    </div>
  );
};

export default TransitionScreen;
