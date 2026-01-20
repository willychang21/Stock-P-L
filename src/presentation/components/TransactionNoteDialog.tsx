import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import { useState, useEffect } from 'react';

interface TransactionNoteDialogProps {
  open: boolean;
  initialNote: string;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
}

export function TransactionNoteDialog({
  open,
  initialNote,
  onClose,
  onSave,
}: TransactionNoteDialogProps) {
  const [note, setNote] = useState(initialNote);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNote(initialNote || '');
  }, [initialNote, open]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(note);
      onClose();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Transaction Note</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Notes"
          type="text"
          fullWidth
          multiline
          rows={4}
          variant="outlined"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Enter strategy, thesis, or reasons for this trade..."
        />
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
