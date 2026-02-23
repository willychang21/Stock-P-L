import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import { useState, useEffect } from 'react';
import Add from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';

interface TransactionNoteDialogProps {
  open: boolean;
  initialNote: string;
  initialTags?: string[];
  initialRating?: number;
  onClose: () => void;
  onSave: (note: string, tags: string[], rating: number) => Promise<void>;
}

export function TransactionNoteDialog({
  open,
  initialNote,
  initialTags = [],
  initialRating = 0,
  onClose,
  onSave,
}: TransactionNoteDialogProps) {
  const [note, setNote] = useState(initialNote);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setNote(initialNote || '');
    setTags(initialTags || []);
    setRating(initialRating || 0);
  }, [initialNote, initialTags, initialRating, open]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleDeleteTag = (tagToDelete: string) => {
    setTags(tags.filter(tag => tag !== tagToDelete));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(note, tags, rating || 0);
      onClose();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('dialog.tradeJournal')}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Box>
            <Typography component="legend" gutterBottom>
              {t('dialog.executionRating')}
            </Typography>
            <Rating
              name="execution-rating"
              value={rating}
              onChange={(_, newValue) => setRating(newValue)}
              size="large"
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                size="small"
                fullWidth
                label={t('dialog.addTag')}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. #FOMO, #Strategy"
              />
              <IconButton
                onClick={handleAddTag}
                color="primary"
                disabled={!tagInput.trim()}
              >
                <Add />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {tags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => handleDeleteTag(tag)}
                  size="small"
                />
              ))}
            </Box>
          </Box>

          <TextField
            autoFocus
            label={t('dialog.notesThesis')}
            type="text"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('dialog.notesPlaceholder')}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={isSaving}>
          {isSaving ? t('dialog.saving') : t('dialog.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
