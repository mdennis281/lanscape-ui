import { useScanStore } from '../../store';
import type { DeviceResult } from '../../types';

interface DeviceStageProps {
  device: DeviceResult;
}

/**
 * Visual device scan stage indicator
 * - Found: pulsing radar dot
 * - Scanning: circular progress ring with percentage
 * - Complete: animated checkmark
 */
export function DeviceStage({ device }: DeviceStageProps) {
  const config = useScanStore((state) => state.config);
  const portLists = useScanStore((state) => state.portLists);
  
  const stage = device.stage || 'found';
  const portsScanned = device.ports_scanned || 0;
  
  // Get the actual port count from the portLists loaded from backend
  const portListName = config?.port_list || 'medium';
  const portListInfo = portLists.find(
    (pl) => pl.name.toLowerCase() === portListName.toLowerCase()
  );
  const totalPorts = portListInfo?.count || 100; // Fallback to 100 if not found
  
  const progress = totalPorts > 0 
    ? Math.min((portsScanned / totalPorts) * 100, 100)
    : 0;

  if (stage === 'complete') {
    // Show green circle drawing over where yellow was, then checkmark fades in
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    
    return (
      <div 
        className="device-stage complete"
        data-tooltip-id="tooltip"
        data-tooltip-content="Scan complete"
      >
        <svg className="stage-checkmark" viewBox="0 0 24 24">
          {/* Yellow ring fading out */}
          <circle 
            className="complete-yellow-fade" 
            cx="12" 
            cy="12" 
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={0}
          />
          {/* Green ring drawing over */}
          <circle 
            className="complete-green-draw" 
            cx="12" 
            cy="12" 
            r={radius}
            strokeDasharray={circumference}
          />
          {/* Checkmark fades in after ring completes */}
          <path className="checkmark-check" d="M7 12l3 3 7-7" />
        </svg>
      </div>
    );
  }

  if (stage === 'scanning') {
    // Circular progress indicator
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
      <div 
        className="device-stage scanning"
        data-tooltip-id="tooltip"
        data-tooltip-content={`Scanning ports: ${Math.round(progress)}%`}
      >
        <svg className="stage-progress-ring" viewBox="0 0 24 24">
          <circle 
            className="progress-bg" 
            cx="12" 
            cy="12" 
            r={radius}
          />
          <circle 
            className="progress-fill" 
            cx="12" 
            cy="12" 
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
      </div>
    );
  }

  // Default: 'found' stage - pulsing radar effect
  return (
    <div 
      className="device-stage found"
      data-tooltip-id="tooltip"
      data-tooltip-content="Device found, waiting for port scan"
    >
      <div className="stage-pulse">
        <div className="pulse-ring"></div>
        <div className="pulse-ring delay"></div>
        <div className="pulse-core"></div>
      </div>
    </div>
  );
}
