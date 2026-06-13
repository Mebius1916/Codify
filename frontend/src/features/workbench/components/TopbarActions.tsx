import settingIconUrl from '@assets/Setting.svg';
import { useState } from 'react';
import { WorkspaceSettingsModal } from '@/features/settings';
import { AuthAction } from '@/features/auth';

export function TopbarActions() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <AuthAction />
      <button
        className="px-3 py-1.5 hover:bg-[#2a2f4c] group rounded-md transition-colors focus:outline-none inline-flex items-center justify-center"
        onClick={() => setSettingsOpen(true)}
      >
        <img 
          src={settingIconUrl} 
          alt="Settings" 
          className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" 
          style={{ filter: 'brightness(0) invert(1)' }}
        />
      </button>

      <WorkspaceSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
