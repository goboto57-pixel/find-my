import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/lib/store';
import { apiService } from '@/lib/apiService';

interface GeofenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GeofenceItem {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  enabled: boolean;
}

export const GeofenceModal = ({ isOpen, onClose }: GeofenceModalProps) => {
  const { t } = useTranslation('common');
  const { locations, currentLocationIndex } = useStore();

  const [fences, setFences] = useState<GeofenceItem[] | null>(null);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radius, setRadius] = useState('200');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    void apiService
      .listGeofences()
      .then(setFences)
      .catch(() => setFences([]));
  };

  useEffect(() => {
    if (!isOpen) return;
    refresh();
  }, [isOpen]);

  const useCurrentLocation = () => {
    const loc = locations[currentLocationIndex];
    if (!loc) {
      toast.error(t('geofence_no_location'));
      return;
    }
    setLat(loc.lat.toFixed(6));
    setLon(loc.lon.toFixed(6));
  };

  const handleCreate = () => {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const radiusNum = parseFloat(radius);

    if (!name.trim() || Number.isNaN(latNum) || Number.isNaN(lonNum) || Number.isNaN(radiusNum)) {
      toast.error(t('geofence_invalid_input'));
      return;
    }

    setBusy(true);
    void apiService
      .createGeofence(name.trim(), latNum, lonNum, radiusNum)
      .then(() => {
        setName('');
        refresh();
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Failed to create geofence')
      )
      .finally(() => setBusy(false));
  };

  const handleToggle = (fence: GeofenceItem) => {
    void apiService
      .setGeofenceEnabled(fence.id, !fence.enabled)
      .then(refresh)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Failed to update geofence')
      );
  };

  const handleDelete = (id: number) => {
    void apiService
      .deleteGeofence(id)
      .then(refresh)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Failed to delete geofence')
      );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('geofence_title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('geofence_description')}</p>

          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="space-y-1">
              <Label htmlFor="geofence-name">{t('geofence_name')}</Label>
              <Input
                id="geofence-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('geofence_name_placeholder')}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="geofence-lat">{t('geofence_lat')}</Label>
                <Input id="geofence-lat" value={lat} onChange={(e) => setLat(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="geofence-lon">{t('geofence_lon')}</Label>
                <Input id="geofence-lon" value={lon} onChange={(e) => setLon(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="geofence-radius">{t('geofence_radius')}</Label>
              <Input
                id="geofence-radius"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={useCurrentLocation} className="flex-1">
                {t('geofence_use_current')}
              </Button>
              <Button size="sm" disabled={busy} onClick={handleCreate} className="flex-1">
                <Plus className="mr-1 h-4 w-4" />
                {t('geofence_add')}
              </Button>
            </div>
          </div>

          {fences && fences.length > 0 && (
            <ul className="space-y-1">
              {fences.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-sm"
                >
                  <button
                    onClick={() => handleToggle(f)}
                    className={
                      f.enabled ? 'text-fmd-green font-medium' : 'text-muted-foreground line-through'
                    }
                    title={t('geofence_toggle_hint')}
                  >
                    {f.name}
                  </button>
                  <span className="text-xs text-muted-foreground">{f.radiusMeters}m</span>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {fences && fences.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('geofence_empty')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
