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
import { LiveTrackingToggle } from '@/components/LiveTrackingToggle';
import { apiService } from '@/lib/apiService';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const second = 1000;
const minute = 60 * 1000;

// How often a fresh "locate" command is sent to the device while
// real-time tracking is active.
const LIVE_TRACKING_LOCATE_INTERVAL = 15 * second;
// How often the browser re-checks for a newly uploaded location.
const LIVE_TRACKING_POLL_INTERVAL = 5 * second;
// Safety cap so an accidentally-forgotten toggle doesn't drain the
// phone's battery indefinitely.
const LIVE_TRACKING_MAX_DURATION = 30 * minute;

const Home = () => {
  const { isLoggedIn, userData, wasAuthRestoreTried, locations } = useStore();
  const { t: tDashboard } = useTranslation('dashboard');

  const [photosOpen, setPhotosOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountInfoOpen, setAccountInfoOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [lastLocateTime, setLastLocateTime] = useState<number | null>(null);
  const [lastLocationsFetchedTime, setLastLocationsFetchedTime] = useState<number | null>(null);

  const [liveTracking, setLiveTracking] = useState(false);
  const [secondsToNextUpdate, setSecondsToNextUpdate] = useState<number | null>(null);

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

  // Real-time tracking: while enabled, repeatedly ask the device to
  // locate itself and refresh the map, on top of the normal polling above.
  useEffect(() => {
    if (!liveTracking || !isLoggedIn || !userData) return;

    let cancelled = false;
    let countdownId: NodeJS.Timeout;

    const sendLocate = async () => {
      try {
        await apiService.sendCommand('locate gps');
        setLastLocateTime(Date.now());
      } catch {
        // Non-fatal: the next scheduled attempt will retry.
      }
    };

    void sendLocate();
    const locateId = setInterval(() => void sendLocate(), LIVE_TRACKING_LOCATE_INTERVAL);

    const pollId = setInterval(() => {
      if (!document.hidden) void fetchLocations(false);
    }, LIVE_TRACKING_POLL_INTERVAL);

    // Countdown shown to the user until the next locate request.
    let remaining = LIVE_TRACKING_LOCATE_INTERVAL / second;
    setSecondsToNextUpdate(remaining);
    countdownId = setInterval(() => {
      remaining = remaining <= 1 ? LIVE_TRACKING_LOCATE_INTERVAL / second : remaining - 1;
      if (!cancelled) setSecondsToNextUpdate(remaining);
    }, second);

    const autoOffId = setTimeout(() => {
      setLiveTracking(false);
      toast.info(tDashboard('live_tracking.auto_off'));
    }, LIVE_TRACKING_MAX_DURATION);

    return () => {
      cancelled = true;
      clearInterval(locateId);
      clearInterval(pollId);
      clearInterval(countdownId);
      clearTimeout(autoOffId);
      setSecondsToNextUpdate(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTracking, isLoggedIn, userData]);

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
            <div className="order-2 flex w-full flex-col gap-4 lg:order-1 lg:w-100 lg:shrink-0">
              <LiveTrackingToggle
                active={liveTracking}
                onToggle={setLiveTracking}
                secondsToNextUpdate={secondsToNextUpdate}
              />
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
