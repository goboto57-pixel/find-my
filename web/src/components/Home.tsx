import { useState, useEffect } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { DevicePanel } from '@/components/DevicePanel';
import { LocationMap } from '@/components/LocationMap';
import { PhotosModal } from '@/components/modals/PhotosModal';
import { AccountInfoModal } from '@/components/modals/AccountInfoModal';
import { AccountModal } from '@/components/modals/AccountModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { Header } from '@/components/Header';
import { Spinner } from '@/components/ui/spinner';
import { apiService } from '@/lib/apiService';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';

const second = 1000;
const minute = 60 * 1000;

const Home = () => {
  const { isLoggedIn, userData, wasAuthRestoreTried, locations } = useStore();

  const [photosOpen, setPhotosOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountInfoOpen, setAccountInfoOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [lastLocateTime, setLastLocateTime] = useState<number | null>(null);
  const [lastLocationsFetchedTime, setLastLocationsFetchedTime] = useState<number | null>(null);

  const fetchLocations = async (showLoading = true) => {
    if (!userData) return;

    if (showLoading) useStore.setState({ isLocationsLoading: true });
    try {
      const decryptedLocations = await apiService.getLocations();

      const isFirstLoad = locations.length === 0;
      const hasNewLocations = decryptedLocations.length > locations.length;

      if (isFirstLoad || hasNewLocations) {
        useStore.setState({
          currentLocationIndex: decryptedLocations.length - 1,
        });
      }

      setLastLocationsFetchedTime(Date.now());
      useStore.setState({ locations: decryptedLocations });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch locations';
      toast.error(message || 'An unknown error occurred');
    } finally {
      if (showLoading) useStore.setState({ isLocationsLoading: false });
    }
  };

  useEffect(() => {
    if (isLoggedIn && userData) {
      void fetchLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // Regular background polling while browser tab is visibile
  useEffect(() => {
    if (!isLoggedIn || !userData) return;

    let timeoutId: NodeJS.Timeout;

    const getPollingInterval = () => {
      if (!lastLocateTime) return 15 * minute;

      // If just after a locate command, poll more often
      const timeSinceLocate = Date.now() - lastLocateTime;
      if (timeSinceLocate < 1 * minute) {
        return 10 * second;
      }
      if (timeSinceLocate < 2 * minute) {
        return 20 * second;
      }

      return 15 * minute;
    };

    const poll = () => {
      if (!document.hidden) {
        void fetchLocations(false);
      }
      timeoutId = setTimeout(poll, getPollingInterval()); // reschedule
    };

    timeoutId = setTimeout(poll, getPollingInterval()); // initial schedule

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userData, lastLocateTime]);

  // Poll when browser tab is resumed
  useEffect(() => {
    if (!isLoggedIn || !userData) return;

    const poll = () => {
      if (document.hidden) return;

      if (!lastLocationsFetchedTime) return;

      const timeSinceLocate = Date.now() - lastLocationsFetchedTime;
      if (timeSinceLocate < 5 * minute) return;

      void fetchLocations(false);
    };

    window.addEventListener('visibilitychange', poll);
    return () => window.removeEventListener('visibilitychange', poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userData, lastLocationsFetchedTime]);

  if (!wasAuthRestoreTried) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <LoginForm onSwitchDeviceClick={() => setAccountOpen(true)} />
        <AccountModal
          isOpen={accountOpen}
          onClose={() => setAccountOpen(false)}
          onSelectDevice={(deviceUsername) => {
            useStore.setState({ prefillDeviceUsername: deviceUsername });
            setAccountOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onAccountInfoClick={() => setAccountInfoOpen(true)}
        onAccountClick={() => setAccountOpen(true)}
      />

      <div className="flex h-[calc(100vh-3.6rem)] flex-col bg-muted/40 text-foreground">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
          {userData && (
            <div className="order-2 w-full lg:order-1 lg:w-100 lg:shrink-0">
              <DevicePanel
                onViewPhotos={() => setPhotosOpen(true)}
                onLocateCommand={() => setLastLocateTime(Date.now())}
              />
            </div>
          )}

          <div className="order-1 min-h-96 flex-1 overflow-hidden rounded-xl border border-border shadow-sm lg:order-2 lg:min-h-0">
            <LocationMap />
          </div>
        </div>
      </div>

      <PhotosModal isOpen={photosOpen} onClose={() => setPhotosOpen(false)} />

      <AccountInfoModal isOpen={accountInfoOpen} onClose={() => setAccountInfoOpen(false)} />

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AccountModal
        isOpen={accountOpen}
        onClose={() => setAccountOpen(false)}
        onSelectDevice={(deviceUsername) => {
          // Switching devices means logging out of the current device
          // session first; the device password still has to be entered
          // manually since the account never holds it.
          void useStore.getState().logout();
          useStore.setState({ prefillDeviceUsername: deviceUsername });
          setAccountOpen(false);
        }}
      />
    </>
  );
};

export default Home;
