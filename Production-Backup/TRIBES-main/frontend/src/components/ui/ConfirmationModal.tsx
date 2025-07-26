/** @jsxImportSource react */
import React from 'react';
import Card from './Card';
import Button from './Button';

interface ConfirmationModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ title, message, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <Card title={title}>
          <div className="space-y-4">
            <p className="text-slate-300">{message}</p>
            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={onCancel}>Cancel</Button>
              <Button variant="primary" onClick={onConfirm}>Confirm</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ConfirmationModal;
