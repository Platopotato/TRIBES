import React from 'react';
import Card from './ui/Card';
import Button from './ui/Button';

interface RegistrationSuccessProps {
  username: string;
  onCreateTribe: () => void;
}

const RegistrationSuccess: React.FC<RegistrationSuccessProps> = ({ username, onCreateTribe }) => {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/radix-logo.png" alt="Radix Tribes Logo" className="mx-auto h-16 w-auto mb-4" />
        </div>
        
        <Card>
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to Radix Tribes!</h2>
              <p className="text-gray-300">
                Thank you for registering, <span className="text-amber-400 font-semibold">{username}</span>!
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Your account has been created successfully and you are now logged in.
              </p>
            </div>

            <div className="space-y-4">
              <Button 
                onClick={onCreateTribe}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Create Your Tribe
              </Button>
              
              <p className="text-gray-500 text-xs">
                Ready to start your journey in the wasteland? Create your tribe and begin building your civilization!
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RegistrationSuccess;
