import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { Influencer, RecommendationCreate } from '@domain/models/Influencer';
import { useTranslation } from 'react-i18next';

interface AddRecommendationDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (influencerId: string, data: RecommendationCreate[]) => void;
  influencers: Influencer[];
  initialInfluencerId: string | null;
}

export function AddRecommendationDialog({
  open,
  onClose,
  onAdd,
  influencers,
  initialInfluencerId,
}: AddRecommendationDialogProps) {
  const [influencerId, setInfluencerId] = useState('');
  const [formData, setFormData] = useState<RecommendationCreate>({
    symbol: '',
    recommendation_date: new Date().toISOString().split('T')[0] ?? '',
    initial_price: undefined,
    note: '',
  });
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      setInfluencerId(initialInfluencerId || '');
      setFormData({
        symbol: '',
        recommendation_date: new Date().toISOString().split('T')[0] ?? '',
        initial_price: undefined,
        note: '',
      });
    }
  }, [open, initialInfluencerId]);

  const handleSubmit = () => {
    if (!influencerId || !formData.symbol || !formData.recommendation_date)
      return;

    const symbols = formData.symbol
      .split(',')
      .map(s => s.trim())
      .filter(s => s);

    const recommendations = symbols.map(s => ({
      ...formData,
      symbol: s,
    }));

    onAdd(influencerId, recommendations);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('influencers.addRecDialogTitle')}</DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}
      >
        <FormControl fullWidth margin="dense">
          <InputLabel>{t('influencers.influencerLabel')}</InputLabel>
          <Select
            value={influencerId || ''}
            label="Influencer"
            onChange={e => setInfluencerId(e.target.value)}
          >
            {influencers.map(inf => (
              <MenuItem key={inf.id} value={inf.id}>
                {inf.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label={t('influencers.symbolsLabel')}
          fullWidth
          value={formData.symbol}
          onChange={e =>
            setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
          }
        />

        <TextField
          label={t('influencers.dateLabel')}
          type="date"
          fullWidth
          value={formData.recommendation_date}
          onChange={e =>
            setFormData({ ...formData, recommendation_date: e.target.value })
          }
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label={t('influencers.initialPriceLabel')}
          type="number"
          fullWidth
          value={formData.initial_price || ''}
          onChange={e =>
            setFormData({
              ...formData,
              initial_price: e.target.value
                ? parseFloat(e.target.value)
                : undefined,
            })
          }
          helperText={t('influencers.initialPriceHelper')}
        />

        <TextField
          label={t('influencers.noteLabel')}
          fullWidth
          multiline
          rows={2}
          value={formData.note || ''}
          onChange={e => setFormData({ ...formData, note: e.target.value })}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!influencerId || !formData.symbol}
        >
          {t('influencers.addRecommendation')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
