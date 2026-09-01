import { ChevronDown, CircleHelp, LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStore } from '@/lib/store';

interface HeaderProps {
  onSettingsClick: () => void;
  onAccountInfoClick: () => void;
}

export const Header = ({ onSettingsClick, onAccountInfoClick }: HeaderProps) => {
  const { userData, logout } = useStore();
  const { t } = useTranslation('common');

  return (
    <header className="topbar">
      <Link to="/" className="topbar-mobile-brand" aria-label="FMD OS">
        <span className="brand-mark small">
          <img src="./icon.svg" alt="" width="18" height="18" />
        </span>
        <span>
          FMD <em>OS</em>
        </span>
      </Link>
      <div className="topbar-meta">
        <span className="topbar-status">
          <span className="live-dot" />
          Secure session
        </span>
        <span className="topbar-divider" />
        Encrypted locally
      </div>
      {userData && (
        <div className="topbar-account">
          <button className="topbar-help" title="Help">
            <CircleHelp className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="account-trigger">
                <span className="avatar">
                  <UserRound className="h-4 w-4" />
                </span>
                <span className="account-copy">
                  <strong>{userData.fmdId}</strong>
                  <small>FMD account</small>
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="account-menu z-1000">
              <DropdownMenuItem onClick={onAccountInfoClick}>{t('account_info')}</DropdownMenuItem>
              <DropdownMenuItem onClick={onSettingsClick}>{t('settings')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
};
