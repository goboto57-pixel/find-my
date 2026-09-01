import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Filter,
  Flame,
  Gauge,
  History,
  Link2,
  Pause,
  Play,
  KeyRound,
  LocateFixed,
  Map,
  MapPin,
  Menu,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  RefreshCw,
  Search,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Sun,
  TimerReset,
  Trash2,
  Volume2,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/lib/apiService';
import type { Location } from '@/lib/api';
import { useStore } from '@/lib/store';
import { convertDistance } from '@/utils/units';
import { LoginForm } from '@/components/LoginForm';
import { DevicePanel } from '@/components/DevicePanel';
import { LocationMap } from '@/components/LocationMap';
import { PhotosModal } from '@/components/modals/PhotosModal';
import { AccountInfoModal } from '@/components/modals/AccountInfoModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { Header } from '@/components/Header';
import { Spinner } from '@/components/ui/spinner';

const minute = 60 * 1000;

type Tab = 'overview' | 'activity' | 'controls';
type DateFilter = 'all' | 'day' | 'week';

type CommandHistoryEntry = {
  id: string;
  command: string;
  createdAt: number;
  success: boolean;
};

const distanceBetween = (a: Location, b: Location) => {
  const earthRadius = 6371;
  const latDelta = ((b.lat - a.lat) * Math.PI) / 180;
  const lonDelta = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const haversine =
    Math.sin(latDelta / 2) ** 2 + Math.sin(lonDelta / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const formatRelativeTime = (date: number, isRussian: boolean) => {
  const minutes = Math.max(0, Math.round((Date.now() - date) / minute));
  if (minutes < 1) return isRussian ? 'только что' : 'just now';
  if (minutes < 60) return isRussian ? `${minutes} мин назад` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return isRussian ? `${hours} ч назад` : `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return isRussian ? `${days} дн назад` : `${days} days ago`;
};

const formatDate = (date: number, isRussian: boolean) =>
  new Date(date).toLocaleString(isRussian ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const getLocationId = (location: Location, index: number) => `${location.date}-${index}`;

const copyText = async (value: string, successMessage: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error('Clipboard is not available in this browser');
  }
};

const downloadText = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const Home = () => {
  const {
    isLoggedIn,
    userData,
    wasAuthRestoreTried,
    locations,
    currentLocationIndex,
    isLocationsLoading,
    language,
    theme,
    setTheme,
    units,
  } = useStore();
  const isRussian = language === 'ru';

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountInfoOpen, setAccountInfoOpen] = useState(false);
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [replayActive, setReplayActive] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [pointNote, setPointNote] = useState('');

  const labels = isRussian
    ? {
        overview: 'Обзор',
        activity: 'История',
        controls: 'Команды',
        dashboard: 'Панель управления',
        commandCenter: 'Центр команд',
        live: 'Система активна',
        device: 'Моё устройство',
        connected: 'На связи',
        idle: 'Нет свежих данных',
        noData: 'Нет данных о местоположении',
        latest: 'Последняя точка',
        locations: 'Точек на карте',
        battery: 'Батарея',
        accuracy: 'Точность',
        distance: 'Расстояние за период',
        refresh: 'Обновить',
        refreshing: 'Обновление…',
        autoRefresh: 'Автообновление',
        locate: 'Найти устройство',
        ring: 'Позвонить',
        flash: 'Включить вспышку',
        photos: 'Снимки с камеры',
        openMaps: 'Открыть в картах',
        copy: 'Скопировать координаты',
        export: 'Экспорт данных',
        share: 'Поделиться точкой',
        filter: 'Фильтр',
        allTime: 'Всё время',
        today: '24 часа',
        week: '7 дней',
        search: 'Поиск по истории…',
        noMatches: 'Ничего не найдено',
        recent: 'Последние события',
        commandLog: 'Журнал команд',
        noCommands: 'Команды ещё не отправлялись',
        commandSent: 'Команда отправлена',
        failed: 'Не удалось выполнить команду',
        privacy: 'Приватный мониторинг',
        safe: 'Данные остаются зашифрованными',
        settings: 'Настройки',
        collapse: 'Свернуть меню',
        expand: 'Развернуть меню',
        theme: 'Тема',
        saved: 'Сохранено',
        favorite: 'Избранная точка',
        removeFavorite: 'Убрать из избранного',
        showAll: 'Показать всё',
        records: 'записей',
        provider: 'Источник',
        speed: 'Скорость',
        altitude: 'Высота',
        signal: 'Сигнал',
        timeline: 'Лента перемещений',
        commandPalette: 'Быстрые действия',
        controlHint: 'Расширенные команды доступны в разделе команд',
        insights: 'Сигналы и анализ',
        replay: 'Повтор маршрута',
        stopReplay: 'Остановить повтор',
        note: 'Заметка к точке',
        saveNote: 'Сохранить заметку',
        favoriteOnly: 'Только избранное',
        compact: 'Компактный вид',
        integrity: 'Проверка целостности',
        integrityOk: 'История выглядит корректно',
        anomaly: 'Резкий скачок маршрута',
        noAnomaly: 'Аномалий не обнаружено',
        lastSignal: 'Последний сигнал',
        copyLink: 'Скопировать ссылку',
        clearLog: 'Очистить журнал',
        compare: 'Сравнить с первой точкой',
        routeLength: 'Длина маршрута',
      }
    : {
        overview: 'Overview',
        activity: 'Activity',
        controls: 'Commands',
        dashboard: 'Command dashboard',
        commandCenter: 'Command center',
        live: 'System active',
        device: 'My device',
        connected: 'Connected',
        idle: 'No fresh data',
        noData: 'No location data yet',
        latest: 'Latest point',
        locations: 'Map points',
        battery: 'Battery',
        accuracy: 'Accuracy',
        distance: 'Distance this period',
        refresh: 'Refresh',
        refreshing: 'Refreshing…',
        autoRefresh: 'Auto-refresh',
        locate: 'Locate device',
        ring: 'Ring device',
        flash: 'Flash light',
        photos: 'Camera captures',
        openMaps: 'Open in Maps',
        copy: 'Copy coordinates',
        export: 'Export data',
        share: 'Share point',
        filter: 'Filter',
        allTime: 'All time',
        today: '24 hours',
        week: '7 days',
        search: 'Search activity…',
        noMatches: 'No matching points',
        recent: 'Recent events',
        commandLog: 'Command log',
        noCommands: 'No commands sent yet',
        commandSent: 'Command sent',
        failed: 'Command failed',
        privacy: 'Private monitoring',
        safe: 'Your data stays encrypted',
        settings: 'Settings',
        collapse: 'Collapse menu',
        expand: 'Expand menu',
        theme: 'Theme',
        saved: 'Saved',
        favorite: 'Saved point',
        removeFavorite: 'Remove saved point',
        showAll: 'Show all',
        records: 'records',
        provider: 'Provider',
        speed: 'Speed',
        altitude: 'Altitude',
        signal: 'Signal',
        timeline: 'Movement timeline',
        commandPalette: 'Quick actions',
        controlHint: 'More commands are available in the Commands section',
        insights: 'Signals & insights',
        replay: 'Replay route',
        stopReplay: 'Stop replay',
        note: 'Point note',
        saveNote: 'Save note',
        favoriteOnly: 'Favorites only',
        compact: 'Compact view',
        integrity: 'Integrity check',
        integrityOk: 'History looks consistent',
        anomaly: 'Route jump detected',
        noAnomaly: 'No anomalies detected',
        lastSignal: 'Last signal',
        copyLink: 'Copy link',
        clearLog: 'Clear log',
        compare: 'Compare with first point',
        routeLength: 'Route length',
      };

  const fetchLocations = async (showLoading = true) => {
    if (!userData) return;
    if (showLoading) useStore.setState({ isLocationsLoading: true });
    try {
      const nextLocations = await apiService.getLocations();
      if (
        nextLocations.length > 0 &&
        (locations.length === 0 || nextLocations.length > locations.length)
      ) {
        useStore.setState({ currentLocationIndex: nextLocations.length - 1 });
      }
      useStore.setState({ locations: nextLocations });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch locations');
    } finally {
      if (showLoading) useStore.setState({ isLocationsLoading: false });
    }
  };

  useEffect(() => {
    if (isLoggedIn && userData) void fetchLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userData]);

  useEffect(() => {
    if (!isLoggedIn || !userData || !autoRefresh) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) void fetchLocations(false);
    }, 5 * minute);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userData, autoRefresh]);

  useEffect(() => {
    if (!isLoggedIn || !userData) return;
    try {
      const savedHistory = localStorage.getItem('fmd-command-history');
      const savedFavorites = localStorage.getItem('fmd-location-favorites');
      if (savedHistory) setCommandHistory(JSON.parse(savedHistory) as CommandHistoryEntry[]);
      if (savedFavorites) setFavorites(JSON.parse(savedFavorites) as string[]);
    } catch {
      // Ignore stale local preferences.
    }
  }, [isLoggedIn, userData]);

  useEffect(() => {
    localStorage.setItem('fmd-command-history', JSON.stringify(commandHistory.slice(0, 12)));
  }, [commandHistory]);

  useEffect(() => {
    localStorage.setItem('fmd-location-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (!replayActive || locations.length < 2) return;
    const timer = window.setInterval(() => {
      const next = currentLocationIndex + 1;
      if (next >= locations.length) {
        setReplayActive(false);
        return;
      }
      useStore.setState({ currentLocationIndex: next });
    }, 900);
    return () => window.clearInterval(timer);
  }, [currentLocationIndex, locations.length, replayActive]);

  const currentLocation = locations[currentLocationIndex];
  const isDeviceConnected = currentLocation
    ? Date.now() - currentLocation.date < 30 * minute
    : false;

  useEffect(() => {
    if (!currentLocation) return;
    setPointNote(
      localStorage.getItem(
        `fmd-point-note-${getLocationId(currentLocation, currentLocationIndex)}`
      ) ?? ''
    );
  }, [currentLocation, currentLocationIndex]);

  const filteredLocations = useMemo(() => {
    const now = Date.now();
    const cutoff =
      dateFilter === 'day'
        ? now - 24 * 60 * minute
        : dateFilter === 'week'
          ? now - 7 * 24 * 60 * minute
          : 0;
    const query = search.trim().toLowerCase();
    return locations
      .map((location, index) => ({ location, index }))
      .filter(({ location }) => location.date >= cutoff)
      .filter(({ location, index }) => {
        if (onlyFavorites && !favorites.includes(getLocationId(location, index))) return false;
        if (!query) return true;
        return `${location.provider} ${location.lat} ${location.lon} ${new Date(location.date).toLocaleString()}`
          .toLowerCase()
          .includes(query);
      })
      .reverse();
  }, [dateFilter, favorites, locations, onlyFavorites, search]);

  const distanceKm = useMemo(() => {
    const points = locations.slice(-50);
    return points
      .slice(1)
      .reduce((total, point, index) => total + distanceBetween(points[index], point), 0);
  }, [locations]);

  const averageAccuracy = useMemo(() => {
    const accuracyValues = locations
      .filter((location) => location.accuracy !== undefined)
      .map((location) => location.accuracy ?? 0);
    return accuracyValues.length
      ? accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length
      : null;
  }, [locations]);

  const routeAnomaly = useMemo(
    () =>
      locations
        .slice(1)
        .some((location, index) => distanceBetween(locations[index], location) > 100),
    [locations]
  );
  const integrityOk = useMemo(
    () =>
      locations.every((location) => Number.isFinite(location.lat) && Number.isFinite(location.lon)),
    [locations]
  );
  const firstLocation = locations[0];
  const firstToCurrentKm =
    firstLocation && currentLocation ? distanceBetween(firstLocation, currentLocation) : 0;

  const executeQuickCommand = async (command: string, label: string) => {
    setCommandLoading(true);
    try {
      await apiService.sendCommand(command);
      const entry: CommandHistoryEntry = {
        id: `${Date.now()}-${command}`,
        command: label,
        createdAt: Date.now(),
        success: true,
      };
      setCommandHistory((history) => [entry, ...history].slice(0, 12));
      toast.success(`${label} — ${labels.commandSent}`);
    } catch (error) {
      const entry: CommandHistoryEntry = {
        id: `${Date.now()}-${command}`,
        command: label,
        createdAt: Date.now(),
        success: false,
      };
      setCommandHistory((history) => [entry, ...history].slice(0, 12));
      toast.error(error instanceof Error ? error.message : labels.failed);
    } finally {
      setCommandLoading(false);
    }
  };

  const toggleFavorite = (location: Location, index: number) => {
    const id = getLocationId(location, index);
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
    toast.success(favorites.includes(id) ? labels.removeFavorite : labels.saved);
  };

  const savePointNote = () => {
    if (!currentLocation) return;
    localStorage.setItem(
      `fmd-point-note-${getLocationId(currentLocation, currentLocationIndex)}`,
      pointNote
    );
    setShowNote(false);
    toast.success(labels.saveNote);
  };

  const copyPointLink = () => {
    if (!currentLocation) return;
    const link = `https://www.openstreetmap.org/?mlat=${currentLocation.lat}&mlon=${currentLocation.lon}`;
    void copyText(link, labels.copyLink);
  };

  const clearCommandLog = () => {
    setCommandHistory([]);
    toast.success(labels.clearLog);
  };

  const exportLocations = (format: 'json' | 'csv') => {
    const exportRows = locations.map((location) => ({
      ...location,
      recordedAt: new Date(location.date).toISOString(),
    }));
    if (format === 'json') {
      downloadText('fmd-locations.json', JSON.stringify(exportRows, null, 2), 'application/json');
    } else {
      const header =
        'recordedAt,latitude,longitude,battery,provider,accuracy,altitude,speed,bearing';
      const rows = exportRows.map((location) =>
        [
          location.recordedAt,
          location.lat,
          location.lon,
          location.bat,
          location.provider,
          location.accuracy ?? '',
          location.altitude ?? '',
          location.speed ?? '',
          location.bearing ?? '',
        ].join(',')
      );
      downloadText('fmd-locations.csv', [header, ...rows].join('\n'), 'text/csv');
    }
    toast.success(labels.export);
  };

  const shareCurrentLocation = async () => {
    if (!currentLocation) return;
    const url = `https://www.openstreetmap.org/?mlat=${currentLocation.lat}&mlon=${currentLocation.lon}#map=17/${currentLocation.lat}/${currentLocation.lon}`;
    if (navigator.share) {
      await navigator.share({
        title: 'FMD location',
        text: `${currentLocation.lat}, ${currentLocation.lon}`,
        url,
      });
    } else {
      await copyText(url, labels.share);
    }
  };

  const cycleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
  };

  if (!wasAuthRestoreTried) {
    return (
      <div className="auth-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="auth-loading">
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onAccountInfoClick={() => setAccountInfoOpen(true)}
      />
      <div className="dashboard-frame">
        <aside
          className={`sidebar ${sidebarOpen ? '' : 'sidebar-collapsed'} ${mobileMenuOpen ? 'sidebar-mobile-open' : ''}`}
        >
          <div className="sidebar-brand">
            <div className="brand-mark">
              <Radio className="h-5 w-5" />
            </div>
            {sidebarOpen && (
              <div>
                <p className="brand-name">
                  FMD <span>OS</span>
                </p>
                <p className="brand-caption">{labels.privacy}</p>
              </div>
            )}
          </div>
          <div className="sidebar-section-label">{sidebarOpen ? labels.dashboard : '•••'}</div>
          <nav className="sidebar-nav" aria-label={labels.dashboard}>
            <NavButton
              icon={Map}
              label={labels.overview}
              active={activeTab === 'overview'}
              expanded={sidebarOpen}
              onClick={() => {
                setActiveTab('overview');
                setMobileMenuOpen(false);
              }}
            />
            <NavButton
              icon={History}
              label={labels.activity}
              active={activeTab === 'activity'}
              expanded={sidebarOpen}
              onClick={() => {
                setActiveTab('activity');
                setMobileMenuOpen(false);
              }}
              badge={locations.length || undefined}
            />
            <NavButton
              icon={Zap}
              label={labels.controls}
              active={activeTab === 'controls'}
              expanded={sidebarOpen}
              onClick={() => {
                setActiveTab('controls');
                setMobileMenuOpen(false);
              }}
            />
          </nav>
          <div className="sidebar-spacer" />
          {sidebarOpen && (
            <div className="privacy-card">
              <div className="privacy-icon">
                <KeyRound className="h-4 w-4" />
              </div>
              <p className="privacy-title">{labels.safe}</p>
              <p className="privacy-copy">FMD uses your local key to protect location history.</p>
            </div>
          )}
          <div className="sidebar-footer">
            <button
              className="sidebar-link"
              onClick={() => setSettingsOpen(true)}
              title={labels.settings}
            >
              <Settings2 className="h-4 w-4" />
              {sidebarOpen && <span>{labels.settings}</span>}
            </button>
            <button className="sidebar-link" onClick={cycleTheme} title={labels.theme}>
              <Sun className="h-4 w-4" />
              {sidebarOpen && <span>{labels.theme}</span>}
            </button>
            <button
              className="collapse-button"
              onClick={() => setSidebarOpen((open) => !open)}
              title={sidebarOpen ? labels.collapse : labels.expand}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
              {sidebarOpen && <span>{labels.collapse}</span>}
            </button>
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="mobile-toolbar">
            <button
              className="icon-button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="mobile-title">{labels.dashboard}</span>
            <button
              className="icon-button"
              onClick={() => void fetchLocations()}
              aria-label={labels.refresh}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="dashboard-heading">
            <div>
              <div className="eyebrow">
                <span className="live-dot" />
                {labels.live}
              </div>
              <h1>{labels.commandCenter}</h1>
              <p>
                {labels.device} <span className="muted-dot">•</span>{' '}
                <span className="mono-text">{userData?.fmdId ?? 'FMD device'}</span>
              </p>
            </div>
            <div className="heading-actions">
              <button
                className={`outline-button ${autoRefresh ? 'is-active' : ''}`}
                onClick={() => setAutoRefresh((value) => !value)}
              >
                <TimerReset className="h-4 w-4" />
                {labels.autoRefresh}
                <span className={`toggle-dot ${autoRefresh ? 'on' : ''}`} />
              </button>
              <button
                className="primary-button"
                onClick={() => void fetchLocations()}
                disabled={isLocationsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLocationsLoading ? 'animate-spin' : ''}`} />
                {isLocationsLoading ? labels.refreshing : labels.refresh}
              </button>
            </div>
          </div>

          <div className="stats-grid">
            <StatCard
              label={labels.connected}
              value={isDeviceConnected ? 'Online' : 'Idle'}
              detail={
                currentLocation
                  ? formatRelativeTime(currentLocation.date, isRussian)
                  : labels.noData
              }
              icon={Wifi}
              tone={isDeviceConnected ? 'green' : 'amber'}
            />
            <StatCard
              label={labels.battery}
              value={currentLocation ? `${currentLocation.bat}%` : '—'}
              detail={
                currentLocation
                  ? currentLocation.bat > 20
                    ? 'Healthy level'
                    : 'Low battery'
                  : labels.noData
              }
              icon={BatteryCharging}
              tone={currentLocation && currentLocation.bat > 20 ? 'green' : 'red'}
              progress={currentLocation?.bat}
            />
            <StatCard
              label={labels.accuracy}
              value={averageAccuracy !== null ? convertDistance(averageAccuracy, units) : '—'}
              detail={
                currentLocation?.provider
                  ? `${labels.provider}: ${currentLocation.provider}`
                  : labels.noData
              }
              icon={Gauge}
              tone="blue"
            />
            <StatCard
              label={labels.distance}
              value={`${distanceKm.toFixed(1)} km`}
              detail={`${locations.length} ${labels.records}`}
              icon={Navigation}
              tone="violet"
            />
          </div>

          <section className={`insights-strip ${compactMode ? 'compact-mode' : ''}`}>
            <div className="insights-panel">
              <div className="insights-header">
                <div>
                  <div className="panel-kicker">
                    <ScanLine className="h-3.5 w-3.5" />
                    {labels.insights}
                  </div>
                  <h2>{currentLocation ? labels.lastSignal : labels.noData}</h2>
                </div>
                <div className="insight-actions">
                  <button
                    className={`mini-toggle ${onlyFavorites ? 'active' : ''}`}
                    onClick={() => setOnlyFavorites((value) => !value)}
                  >
                    {labels.favoriteOnly}
                  </button>
                  <button
                    className={`mini-toggle ${compactMode ? 'active' : ''}`}
                    onClick={() => setCompactMode((value) => !value)}
                  >
                    {labels.compact}
                  </button>
                </div>
              </div>
              <div className="insight-grid">
                <InsightTile
                  icon={routeAnomaly ? AlertTriangle : ShieldCheck}
                  label={labels.integrity}
                  value={
                    routeAnomaly
                      ? labels.anomaly
                      : integrityOk
                        ? labels.integrityOk
                        : labels.anomaly
                  }
                  tone={routeAnomaly ? 'warning' : 'success'}
                />
                <InsightTile
                  icon={Clock3}
                  label={labels.lastSignal}
                  value={
                    currentLocation ? formatRelativeTime(currentLocation.date, isRussian) : '—'
                  }
                  tone="neutral"
                />
                <InsightTile
                  icon={Navigation}
                  label={labels.routeLength}
                  value={`${distanceKm.toFixed(1)} km`}
                  tone="neutral"
                />
                <InsightTile
                  icon={Gauge}
                  label={labels.compare}
                  value={`${firstToCurrentKm.toFixed(1)} km`}
                  tone="neutral"
                />
              </div>
              <div className="insight-toolbar">
                <button
                  className="small-action"
                  disabled={locations.length < 2}
                  onClick={() => {
                    setReplayActive((value) => !value);
                    if (!replayActive) useStore.setState({ currentLocationIndex: 0 });
                  }}
                >
                  {replayActive ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {replayActive ? labels.stopReplay : labels.replay}
                </button>
                <button
                  className="small-action"
                  disabled={!currentLocation}
                  onClick={() => setShowNote((value) => !value)}
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  {labels.note}
                </button>
                <button
                  className="small-action"
                  disabled={!currentLocation}
                  onClick={copyPointLink}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {labels.copyLink}
                </button>
                {commandHistory.length > 0 && (
                  <button className="small-action danger-action" onClick={clearCommandLog}>
                    <Trash2 className="h-3.5 w-3.5" />
                    {labels.clearLog}
                  </button>
                )}
              </div>
              {showNote && currentLocation && (
                <div className="note-editor">
                  <textarea
                    value={pointNote}
                    onChange={(event) => setPointNote(event.target.value)}
                    placeholder={labels.note}
                    rows={2}
                  />
                  <button className="primary-button" onClick={savePointNote}>
                    {labels.saveNote}
                  </button>
                </div>
              )}
            </div>
          </section>

          {activeTab === 'overview' && (
            <div className="overview-grid">
              <section className="map-card panel-card">
                <div className="panel-header">
                  <div>
                    <div className="panel-kicker">
                      <MapPin className="h-3.5 w-3.5" />
                      {labels.latest}
                    </div>
                    <h2>
                      {currentLocation
                        ? formatDate(currentLocation.date, isRussian)
                        : labels.noData}
                    </h2>
                  </div>
                  {currentLocation && (
                    <div className="location-badge">
                      <span className="status-pulse" />
                      {isDeviceConnected ? labels.connected : labels.idle}
                    </div>
                  )}
                </div>
                <div className="map-wrap">
                  <LocationMap />
                  <div className="map-overlay">
                    <span>
                      <Cloud className="h-3.5 w-3.5" />
                      Live map
                    </span>
                    <span>
                      {locations.length} {labels.locations.toLowerCase()}
                    </span>
                  </div>
                </div>
                <div className="map-footer">
                  <div className="coordinate-block">
                    <span className="coordinate-label">LAT / LON</span>
                    <strong>
                      {currentLocation
                        ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lon.toFixed(5)}`
                        : '—'}
                    </strong>
                  </div>
                  <div className="map-actions">
                    <button
                      className="small-action"
                      disabled={!currentLocation}
                      onClick={() =>
                        currentLocation &&
                        void copyText(`${currentLocation.lat}, ${currentLocation.lon}`, labels.copy)
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {labels.copy}
                    </button>
                    <button
                      className="small-action"
                      disabled={!currentLocation}
                      onClick={() =>
                        currentLocation &&
                        window.open(
                          `https://www.openstreetmap.org/?mlat=${currentLocation.lat}&mlon=${currentLocation.lon}`,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {labels.openMaps}
                    </button>
                    <button
                      className="small-action"
                      disabled={!currentLocation}
                      onClick={() => void shareCurrentLocation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {labels.share}
                    </button>
                  </div>
                </div>
              </section>

              <section className="side-stack">
                <div className="panel-card quick-actions-card">
                  <div className="panel-header compact">
                    <div>
                      <div className="panel-kicker">
                        <Sparkles className="h-3.5 w-3.5" />
                        {labels.commandPalette}
                      </div>
                      <h2>{labels.commandCenter}</h2>
                    </div>
                    <button
                      className="ghost-icon"
                      onClick={() => setActiveTab('controls')}
                      title={labels.controls}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="quick-actions-grid">
                    <QuickAction
                      icon={LocateFixed}
                      label={labels.locate}
                      color="green"
                      disabled={commandLoading}
                      onClick={() => void executeQuickCommand('locate all', labels.locate)}
                    />
                    <QuickAction
                      icon={Volume2}
                      label={labels.ring}
                      color="blue"
                      disabled={commandLoading}
                      onClick={() => void executeQuickCommand('ring', labels.ring)}
                    />
                    <QuickAction
                      icon={Flame}
                      label={labels.flash}
                      color="orange"
                      disabled={commandLoading}
                      onClick={() => void executeQuickCommand('flash', labels.flash)}
                    />
                    <QuickAction
                      icon={Download}
                      label={labels.export}
                      color="violet"
                      disabled={!locations.length}
                      onClick={() => exportLocations('json')}
                    />
                  </div>
                  <p className="control-hint">{labels.controlHint}</p>
                </div>
                <div className="panel-card telemetry-card">
                  <div className="panel-header compact">
                    <div>
                      <div className="panel-kicker">
                        <Activity className="h-3.5 w-3.5" />
                        {labels.recent}
                      </div>
                      <h2>{labels.timeline}</h2>
                    </div>
                    <button className="text-button" onClick={() => setActiveTab('activity')}>
                      {labels.showAll}
                    </button>
                  </div>
                  {locations.length > 0 ? (
                    <div className="mini-timeline">
                      {locations
                        .slice(-3)
                        .reverse()
                        .map((location, index) => (
                          <MiniTimelineItem
                            key={getLocationId(location, locations.length - index - 1)}
                            location={location}
                            isCurrent={location === currentLocation}
                            isRussian={isRussian}
                          />
                        ))}
                    </div>
                  ) : (
                    <EmptyState label={labels.noData} />
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'activity' && (
            <section className="panel-card activity-card">
              <div className="activity-toolbar">
                <div>
                  <div className="panel-kicker">
                    <History className="h-3.5 w-3.5" />
                    {labels.recent}
                  </div>
                  <h2>{labels.timeline}</h2>
                </div>
                <div className="activity-tools">
                  <div className="search-box">
                    <Search className="h-4 w-4" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={labels.search}
                    />
                    <button onClick={() => setSearch('')} className={search ? '' : 'hidden'}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Filter className="filter-icon h-4 w-4" />
                </div>
              </div>
              <div className="filter-row">
                <span className="filter-label">{labels.filter}</span>
                {(['all', 'day', 'week'] as DateFilter[]).map((filter) => (
                  <button
                    key={filter}
                    className={`filter-chip ${dateFilter === filter ? 'selected' : ''}`}
                    onClick={() => setDateFilter(filter)}
                  >
                    {filter === 'all'
                      ? labels.allTime
                      : filter === 'day'
                        ? labels.today
                        : labels.week}
                  </button>
                ))}
              </div>
              <div className="activity-list">
                {filteredLocations.length ? (
                  filteredLocations.map(({ location, index }) => (
                    <ActivityRow
                      key={getLocationId(location, index)}
                      location={location}
                      isCurrent={index === currentLocationIndex}
                      isFavorite={favorites.includes(getLocationId(location, index))}
                      isRussian={isRussian}
                      labels={labels}
                      onSelect={() => useStore.setState({ currentLocationIndex: index })}
                      onFavorite={() => toggleFavorite(location, index)}
                    />
                  ))
                ) : (
                  <EmptyState label={labels.noMatches} />
                )}
              </div>
            </section>
          )}

          {activeTab === 'controls' && (
            <section className="controls-layout">
              <div className="controls-main">
                <DevicePanel onViewPhotos={() => setPhotosOpen(true)} />
              </div>
              <div className="controls-side">
                <div className="panel-card export-card">
                  <div className="panel-kicker">
                    <Download className="h-3.5 w-3.5" />
                    {labels.export}
                  </div>
                  <h2>Take your data with you</h2>
                  <p>Export the encrypted location history for offline analysis or backup.</p>
                  <div className="export-buttons">
                    <button className="outline-button" onClick={() => exportLocations('csv')}>
                      <Download className="h-4 w-4" />
                      CSV
                    </button>
                    <button className="outline-button" onClick={() => exportLocations('json')}>
                      <FileJson className="h-4 w-4" />
                      JSON
                    </button>
                  </div>
                </div>
                <div className="panel-card command-history-card">
                  <div className="panel-header compact">
                    <div>
                      <div className="panel-kicker">
                        <History className="h-3.5 w-3.5" />
                        {labels.commandLog}
                      </div>
                      <h2>
                        {commandHistory.length} {labels.records}
                      </h2>
                    </div>
                    <button
                      className="ghost-icon"
                      onClick={() => setShowHistory((value) => !value)}
                    >
                      {showHistory ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {showHistory &&
                    (commandHistory.length ? (
                      commandHistory.map((entry) => (
                        <div key={entry.id} className="command-log-row">
                          <span className={`command-status ${entry.success ? 'success' : 'error'}`}>
                            {entry.success ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </span>
                          <span>{entry.command}</span>
                          <time>{formatRelativeTime(entry.createdAt, isRussian)}</time>
                        </div>
                      ))
                    ) : (
                      <EmptyState label={labels.noCommands} />
                    ))}
                </div>
              </div>
            </section>
          )}

          <div className="dashboard-footnote">
            <span>
              <ShieldIcon />
              {labels.safe}
            </span>
            <span>
              FMD OS <span className="muted-dot">•</span> v0.16
            </span>
          </div>
        </main>
      </div>
      <div className="mobile-bottom-nav">
        <NavButton
          icon={Map}
          label={labels.overview}
          active={activeTab === 'overview'}
          expanded
          onClick={() => setActiveTab('overview')}
        />
        <NavButton
          icon={History}
          label={labels.activity}
          active={activeTab === 'activity'}
          expanded
          onClick={() => setActiveTab('activity')}
        />
        <NavButton
          icon={Zap}
          label={labels.controls}
          active={activeTab === 'controls'}
          expanded
          onClick={() => setActiveTab('controls')}
        />
      </div>
      <PhotosModal isOpen={photosOpen} onClose={() => setPhotosOpen(false)} />
      <AccountInfoModal isOpen={accountInfoOpen} onClose={() => setAccountInfoOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

const NavButton = ({
  icon: Icon,
  label,
  active,
  expanded,
  onClick,
  badge,
}: {
  icon: typeof Map;
  label: string;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
  badge?: number;
}) => (
  <button
    className={`nav-button ${active ? 'active' : ''} ${expanded ? '' : 'centered'}`}
    onClick={onClick}
    title={label}
  >
    <Icon className="h-[18px] w-[18px]" />
    {expanded && <span>{label}</span>}
    {expanded && badge !== undefined && <span className="nav-badge">{badge}</span>}
  </button>
);

const StatCard = ({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BatteryCharging;
  tone: 'green' | 'amber' | 'red' | 'blue' | 'violet';
  progress?: number;
}) => (
  <div className="stat-card">
    <div className={`stat-icon ${tone}`}>
      <Icon className="h-[18px] w-[18px]" />
    </div>
    <div className="stat-content">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {progress !== undefined && (
        <div className="progress-track">
          <div
            className={`progress-fill ${tone}`}
            style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
          />
        </div>
      )}
    </div>
  </div>
);

const QuickAction = ({
  icon: Icon,
  label,
  color,
  disabled,
  onClick,
}: {
  icon: typeof LocateFixed;
  label: string;
  color: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button className={`quick-action ${color}`} onClick={onClick} disabled={disabled}>
    <span className="quick-action-icon">
      <Icon className="h-[17px] w-[17px]" />
    </span>
    <span>{label}</span>
    <ChevronRight className="quick-chevron h-3.5 w-3.5" />
  </button>
);

const InsightTile = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'neutral';
}) => (
  <div className={`insight-tile ${tone}`}>
    <span className="insight-tile-icon">
      <Icon className="h-3.5 w-3.5" />
    </span>
    <span className="insight-tile-copy">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  </div>
);

const MiniTimelineItem = ({
  location,
  isCurrent,
  isRussian,
}: {
  location: Location;
  isCurrent: boolean;
  isRussian: boolean;
}) => (
  <div className={`mini-timeline-item ${isCurrent ? 'current' : ''}`}>
    <span className="timeline-dot" />
    <div>
      <strong>{location.provider || 'Location update'}</strong>
      <small>
        {formatDate(location.date, isRussian)} <span>•</span> {location.bat}%
      </small>
    </div>
    <span className="mini-arrow">
      {isCurrent ? (
        <LocateFixed className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
    </span>
  </div>
);

const ActivityRow = ({
  location,
  isCurrent,
  isFavorite,
  isRussian,
  labels,
  onSelect,
  onFavorite,
}: {
  location: Location;
  isCurrent: boolean;
  isFavorite: boolean;
  isRussian: boolean;
  labels: Record<string, string>;
  onSelect: () => void;
  onFavorite: () => void;
}) => (
  <div className={`activity-row ${isCurrent ? 'current' : ''}`}>
    <button className="activity-main" onClick={onSelect}>
      <span className="activity-dot" />
      <span className="activity-time">
        <strong>{formatDate(location.date, isRussian)}</strong>
        <small>{formatRelativeTime(location.date, isRussian)}</small>
      </span>
      <span className="activity-coordinates">
        <strong>
          {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
        </strong>
        <small>
          {location.provider || labels.provider}{' '}
          {location.accuracy !== undefined
            ? `• ${labels.accuracy}: ${convertDistance(location.accuracy, 'metric')}`
            : ''}
        </small>
      </span>
      <span className="activity-battery">
        <BatteryCharging className="h-3.5 w-3.5" />
        {location.bat}%
      </span>
    </button>
    <button
      className={`favorite-button ${isFavorite ? 'selected' : ''}`}
      onClick={onFavorite}
      aria-label={isFavorite ? labels.removeFavorite : labels.favorite}
    >
      ★
    </button>
    <button className="activity-open" onClick={onSelect}>
      <ChevronRight className="h-4 w-4" />
    </button>
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="empty-state">
    <MapPin className="h-5 w-5" />
    <span>{label}</span>
  </div>
);
const ShieldIcon = () => (
  <span className="shield-icon">
    <KeyRound className="h-3 w-3" />
  </span>
);

export default Home;
