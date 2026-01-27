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
import {
  Recommendation,
  RecommendationUpdate,
  Influencer,
} from '@domain/models/Influencer';
import { useTranslation } from 'react-i18next';

interface EditRecommendationDialogProps {
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: RecommendationUpdate) => void;
  recommendation: Recommendation | null;
  influencers: Influencer[];
}

export function EditRecommendationDialog({
  open,
  onClose,
  onUpdate,
  recommendation,
  influencers,
}: EditRecommendationDialogProps) {
  const [formData, setFormData] = useState<RecommendationUpdate>({});
  const { t } = useTranslation();

  useEffect(() => {
    if (open && recommendation) {
      setFormData({
        symbol: recommendation.symbol,
        recommendation_date: recommendation.recommendation_date,
        initial_price: recommendation.initial_price || undefined,
        note: recommendation.note || '',
      });
    }
  }, [open, recommendation]);

  const handleSubmit = () => {
    if (!recommendation) return;

    onUpdate(recommendation.id, formData);
    onClose();
  };

  if (!recommendation) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('influencers.editRecommendation')}</DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}
      >
        <FormControl fullWidth margin="dense" disabled>
          <InputLabel>{t('influencers.influencerLabel')}</InputLabel>
          <Select
            value={recommendation.influencer_id}
            label="Influencer"
            readOnly
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
          value={formData.symbol || ''}
          onChange={e =>
            setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
          }
        />

        <TextField
          label={t('influencers.dateLabel')}
          type="date"
          fullWidth
          value={formData.recommendation_date || ''}
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
          disabled={!formData.symbol}
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
