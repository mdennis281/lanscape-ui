import { useState, useEffect, useRef } from 'react';
import { useScanStore } from '../../store';
import type { SubnetInfo, SubnetTestResult } from '../../types';

interface SubnetInputProps {
  disabled?: boolean;
  onSettingsClick?: () => void;
  validation?: SubnetTestResult | null;
  onSubmit?: () => void;
}

export function SubnetInput({ disabled, onSettingsClick, validation, onSubmit }: SubnetInputProps) {
  const { subnetInput, setSubnetInput, subnets } = useScanStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubnetSelect = (subnet: SubnetInfo) => {
    setSubnetInput(subnet.subnet);
    setIsDropdownOpen(false);
  };

  const showError = subnetInput.trim() && validation && !validation.valid;

  return (
    <div className="subnet-input-group" ref={dropdownRef}>
      {/* Label and info row */}
      <div className="subnet-label-row">
        <label htmlFor="subnet-input">Subnet:</label>
        <div className={`subnet-info ${showError ? 'error' : ''}`}>
          {validation ? (
            <span className={validation.valid ? 'valid' : 'invalid'}>
              {validation.msg}
            </span>
          ) : null}
        </div>
      </div>

      {/* Input group */}
      <div className={`subnet-input-wrapper ${showError ? 'has-error' : ''}`}>
        {/* Settings button */}
        <button
          type="button"
          className="btn btn-secondary subnet-settings-btn"
          onClick={onSettingsClick}
          data-tooltip-id="tooltip"
          data-tooltip-content="Advanced scan settings"
          disabled={disabled}
        >
          <i className="fa-solid fa-gear"></i>
        </button>

        {/* Subnet text input */}
        <input
          id="subnet-input"
          type="text"
          className="subnet-text-input"
          placeholder="Enter subnet (e.g., 192.168.1.0/24)"
          value={subnetInput}
          onChange={(e) => setSubnetInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && validation?.valid && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          disabled={disabled}
        />

        {/* Dropdown toggle */}
        <button
          type="button"
          className="btn btn-secondary subnet-dropdown-btn"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={disabled || subnets.length === 0}
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
        >
          <i className={`fa-solid fa-chevron-${isDropdownOpen ? 'up' : 'down'}`}></i>
        </button>

        {/* Dropdown menu */}
        {isDropdownOpen && subnets.length > 0 && (
          <ul className="subnet-dropdown-menu" role="listbox">
            {subnets.map((subnet, index) => (
              <li
                key={index}
                role="option"
                className="subnet-dropdown-item"
                onClick={() => handleSubnetSelect(subnet)}
                aria-selected={subnetInput === subnet.subnet}
              >
                {subnet.subnet}
                {subnet.interface && (
                  <span className="subnet-interface">{subnet.interface}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
