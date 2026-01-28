import { LayoutDashboard, Download, Mic, Clapperboard, Settings, ArrowLeftRight } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'downloader', label: 'Downloader', icon: Download },
    { id: 'transcriber', label: 'Transcriber', icon: Mic },
    { id: 'translator', label: 'Translator', icon: ArrowLeftRight },
    { id: 'editor', label: 'Editor', icon: Clapperboard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div style={{
      width: '160px',
      background: '#1a1a1a',
      color: '#e5e5e5',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #333',
      fontFamily: "'Inter', sans-serif" 
    }}>
      {/* Draggable Header Region for Electron */}
      <div style={{ 
          padding: '24px 12px', 
          fontSize: '1.2em', 
          fontWeight: '700', 
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#4F46E5',
          WebkitAppRegion: 'drag' // Allow window dragging (Electron-specific)
      } as React.CSSProperties}>
        <Clapperboard size={24} />
        <span>MediaFlow</span>
      </div>
      <div style={{ flex: 1, paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <div
                key={item.id}
                onClick={() => onTabChange(item.id)}
                style={{
                  padding: '12px 12px',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                  color: isActive ? '#818cf8' : '#a3a3a3',
                  borderRight: isActive ? '3px solid #818cf8' : '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                  fontSize: '0.90em',
                  fontWeight: isActive ? 500 : 400
                  // No drag on buttons
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </div>
            );
        })}
      </div>
      <div style={{ padding: '20px', borderTop: '1px solid #333', fontSize: '0.75em', color: '#555' }}>
        v0.1.0 Alpha
      </div>
    </div>
  );
}
