import React, { useState, useEffect } from 'react';

interface SmartNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  placeholder?: string;
  className?: string;
  showQuickButtons?: boolean;
  showMaxButton?: boolean;
  disabled?: boolean;
}

const SmartNumberInput: React.FC<SmartNumberInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  label,
  placeholder,
  className = '',
  showQuickButtons = true,
  showMaxButton = true,
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);

  // Update input value when prop value changes
  useEffect(() => {
    if (!isFocused) {
      setInputValue(value.toString());
    }
  }, [value, isFocused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Parse and validate the number
    const parsed = parseInt(newValue) || 0;
    const clamped = Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed);
    onChange(clamped);
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    // Ensure input shows the actual clamped value
    setInputValue(value.toString());
  };

  const handleInputFocus = () => {
    setIsFocused(true);
  };

  const adjustValue = (delta: number) => {
    const newValue = Math.max(min, max !== undefined ? Math.min(max, value + delta) : value + delta);
    onChange(newValue);
  };

  const setToMax = () => {
    if (max !== undefined) {
      onChange(max);
    }
  };

  const setToMin = () => {
    onChange(min);
  };

  // Determine quick button increments based on max value
  const getIncrements = () => {
    if (max === undefined || max <= 10) return [1];
    if (max <= 100) return [1, 10];
    if (max <= 1000) return [1, 10, 100];
    return [1, 10, 100, 1000];
  };

  const increments = getIncrements();
  const maxAvailable = max || 999999;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-300">
          {label} {max !== undefined && `(Max: ${max})`}
        </label>
      )}
      
      <div className="flex items-center space-x-2">
        {/* Main number input */}
        <div className="flex-1">
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            min={min}
            max={max}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-200 text-center font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Quick adjustment buttons */}
        {showQuickButtons && !disabled && (
          <div className="flex flex-col space-y-1">
            {/* Increment buttons */}
            <div className="flex space-x-1">
              {increments.map(inc => (
                <button
                  key={`plus-${inc}`}
                  type="button"
                  onClick={() => adjustValue(inc)}
                  disabled={value >= maxAvailable}
                  className="w-8 h-6 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs font-bold rounded transition-colors"
                  title={`Add ${inc}`}
                >
                  +{inc >= 1000 ? '1k' : inc}
                </button>
              ))}
              {showMaxButton && max !== undefined && max > increments[increments.length - 1] && (
                <button
                  type="button"
                  onClick={setToMax}
                  disabled={value >= max}
                  className="w-8 h-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs font-bold rounded transition-colors"
                  title={`Set to maximum (${max})`}
                >
                  MAX
                </button>
              )}
            </div>
            
            {/* Decrement buttons */}
            <div className="flex space-x-1">
              {increments.map(inc => (
                <button
                  key={`minus-${inc}`}
                  type="button"
                  onClick={() => adjustValue(-inc)}
                  disabled={value <= min}
                  className="w-8 h-6 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs font-bold rounded transition-colors"
                  title={`Subtract ${inc}`}
                >
                  -{inc >= 1000 ? '1k' : inc}
                </button>
              ))}
              {min > 0 && (
                <button
                  type="button"
                  onClick={setToMin}
                  disabled={value <= min}
                  className="w-8 h-6 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs font-bold rounded transition-colors"
                  title={`Set to minimum (${min})`}
                >
                  MIN
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Current value display for large numbers */}
      {value >= 1000 && (
        <div className="text-xs text-slate-400 text-center">
          Current: {value.toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default SmartNumberInput;
