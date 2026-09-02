import { Settings, ChevronDown, LogOut, Info, Smartphone, Share2, MapPinned } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStore } from '@/lib/store';
import { Link } from 'react-router-dom';
import { ShareLocationModal } from '@/components/modals/ShareLocationModal';
import { GeofenceModal } from '@/components/modals/GeofenceModal';

interface HeaderProps {
  onSettingsClick: () => void;
  onAccountInfoClick: () => void;
  onAccountClick: () => void;
}

export const Header = ({ onSettingsClick, onAccountInfoClick, onAccountClick }: HeaderProps) => {
  const { userData, logout } = useStore();
  const { t } = useTranslation('common');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);

  return (
    <header className="bg-background/90 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-50 flex items-center justify-between border-b border-border px-4 py-3 backdrop-blur-md">
      <Link to="/" className="ms-2 flex items-center gap-2.5">
        <span className="bg-fmd-green/10 flex h-9 w-9 items-center justify-center rounded-lg">
          <img src="./icon.svg" alt="FMD" width="20" height="20" className="text-fmd-green" />
        </span>
        <h1 className="text-lg font-bold tracking-tight text-foreground">FMD Server</h1>
      </Link>
      {userData && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowShareModal(true)}
            title={t('share_location')}
            className="rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Share2 className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowGeofenceModal(true)}
            title={t('geofence_title')}
            className="rounded-lg text-muted-foreground hover:text-foreground"
          >
            <MapPinned className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onSettingsClick}
            title={t('settings')}
            className="rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-lg border border-transparent hover:border-border"
              >
                <span className="bg-fmd-green h-2 w-2 rounded-full" aria-hidden="true" />
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">{userData.fmdId}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-1000 w-44 border-border bg-background shadow-lg"
            >
              <DropdownMenuItem onClick={() => void onAccountInfoClick()}>
                <Info className="mr-2 h-4 w-4" />
                {t('account_info')}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => void onAccountClick()}>
                <Smartphone className="mr-2 h-4 w-4" />
                {t('switch_device')}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => void logout()} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <ShareLocationModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
      <GeofenceModal isOpen={showGeofenceModal} onClose={() => setShowGeofenceModal(false)} />
    </header>
  );
};
