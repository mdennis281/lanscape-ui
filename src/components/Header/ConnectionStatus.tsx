import { useScanStore } from '../../store';
import { getCurrentWSServer } from '../../utils';

export function ConnectionStatus() {
  const connectionStatus = useScanStore((state) => state.connectionStatus);
  const wsServer = getCurrentWSServer();

  const statusLabels: Record<string, string> = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Connection Error',
  };

  const tooltipContent = `${statusLabels[connectionStatus]} (${wsServer})`;

  return (
    <div 
      className={`connection-status ${connectionStatus}`}
      data-tooltip-id="tooltip"
      data-tooltip-content={tooltipContent}
    >
      <span className={`status-dot ${connectionStatus === 'connecting' ? 'pulse' : ''}`}></span>
    </div>
  );
}
