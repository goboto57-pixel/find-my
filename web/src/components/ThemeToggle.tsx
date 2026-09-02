import { Sun, Moon, Monitor, Clock, Check } from 'lucide-react';
import { useStore, type Theme, type AccentColor, ACCENT_COLORS } from '@/lib/store';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from 'react-i18next';

export const ThemeToggle = () => {
  const { theme, setTheme, darkStart, darkEnd, setThemeSchedule, accentColor, setAccentColor } =
    useStore();
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={(value) => value && setTheme(value as Theme)}
      >
        <ToggleGroupItem value="light" aria-label="Light mode" className="min-w-24">
          <Sun className="mr-2 h-4 w-4" />
          {t('theme_light')}
        </ToggleGroupItem>

        <ToggleGroupItem value="system" aria-label="System theme" className="min-w-24">
          <Monitor className="mr-2 h-4 w-4" />
          {t('theme_system')}
        </ToggleGroupItem>

        <ToggleGroupItem value="dark" aria-label="Dark mode" className="min-w-24">
          <Moon className="mr-2 h-4 w-4" />
          {t('theme_dark')}
        </ToggleGroupItem>

        <ToggleGroupItem value="scheduled" aria-label="Scheduled theme" className="min-w-24">
          <Clock className="mr-2 h-4 w-4" />
          {t('theme_scheduled')}
        </ToggleGroupItem>
      </ToggleGroup>

      {theme === 'scheduled' && (
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm">
            {t('theme_schedule_dark_start')}
            <input
              type="time"
              value={darkStart}
              onChange={(e) => setThemeSchedule(e.target.value, darkEnd)}
              className="rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            {t('theme_schedule_dark_end')}
            <input
              type="time"
              value={darkEnd}
              onChange={(e) => setThemeSchedule(darkStart, e.target.value)}
              className="rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">{t('accent_color')}</p>
        <div className="flex gap-2">
          {(Object.keys(ACCENT_COLORS) as AccentColor[]).map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => setAccentColor(color)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border"
              style={{ backgroundColor: ACCENT_COLORS[color] }}
            >
              {accentColor === color && <Check className="h-4 w-4 text-white drop-shadow" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
