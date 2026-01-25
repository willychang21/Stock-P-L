import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Chip,
  Rating,
  Stack,
  IconButton,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { Add } from '@mui/icons-material';

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
      <DialogTitle>Trade Journal</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Box>
            <Typography component="legend" gutterBottom>
              Execution Rating
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
                label="Add Tag"
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
            label="Notes / Thesis"
            type="text"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Enter strategy, thesis, or reasons for this trade..."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
