import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Paper,
} from '@mui/material';
import { Delete, Edit, Save } from '@mui/icons-material';

interface Note {
  id: string;
  symbol: string; // can be "GENERAL"
  content: string;
  date: string;
}

export const ResearchNotes: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');

  // Persist to localStorage for now
  useEffect(() => {
    const saved = localStorage.getItem('research_notes');
    if (saved) {
      setNotes(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('research_notes', JSON.stringify(notes));
  }, [notes]);

  const handleAddNote = () => {
    if (!newNote.trim()) return;

    const note: Note = {
      id: Date.now().toString(),
      symbol: selectedSymbol.toUpperCase() || 'GENERAL',
      content: newNote,
      date: new Date().toISOString(),
    };

    setNotes([note, ...notes]);
    setNewNote('');
    setSelectedSymbol('');
  };

  const handleDelete = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <Card
      sx={{
        height: '100%',
        background: 'rgba(24, 24, 27, 0.6)',
        backdropFilter: 'blur(12px)',
        borderRadius: 4,
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <CardContent>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ fontWeight: 700, color: 'text.primary' }}
        >
          Research Notes
        </Typography>
        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
            <TextField
              placeholder="Sym (Optional)"
              value={selectedSymbol}
              onChange={e => setSelectedSymbol(e.target.value)}
              size="small"
              sx={{ width: 120 }}
            />
            <TextField
              fullWidth
              placeholder="Add a new insight (e.g., 'NVDA strong demand in DC from latest earnings call...')"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              size="small"
              multiline
              rows={2}
            />
          </Box>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleAddNote}
            fullWidth
            disabled={!newNote.trim()}
          >
            Save Note
          </Button>
        </Box>

        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {notes.map(note => (
            <Paper
              key={note.id}
              sx={{
                mb: 2,
                p: 2,
                background: 'rgba(255,255,255,0.03)',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: 'primary.main',
                      bgcolor: 'rgba(99, 102, 241, 0.1)',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      mr: 1,
                    }}
                  >
                    {note.symbol}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    {new Date(note.date).toLocaleDateString()}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(note.id)}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'error.main' },
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
              <Typography
                variant="body2"
                sx={{ mt: 1, whiteSpace: 'pre-wrap', color: 'text.primary' }}
              >
                {note.content}
              </Typography>
            </Paper>
          ))}
          {notes.length === 0 && (
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ mt: 4 }}
            >
              No notes yet. Add thoughts from Thread, Substack, or Reddit here.
            </Typography>
          )}
        </List>
      </CardContent>
    </Card>
  );
};
