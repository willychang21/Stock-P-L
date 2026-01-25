import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  List,
  IconButton,
  Divider,
  Paper,
  Select,
  MenuItem,
  FormControl,
  Chip,
  Link,
  Stack,
  Grid,
} from '@mui/material';
import {
  Delete,
  Save,
  AddLink,
  TrendingUp,
  TrendingDown,
  Remove,
} from '@mui/icons-material';
import {
  ResearchService,
  ResearchNote,
} from '../../../application/services/ResearchService';

const SENTIMENT_COLORS = {
  BULLISH: 'success',
  BEARISH: 'error',
  NEUTRAL: 'default',
};

const SOURCE_PATTERNS = [
  { pattern: 'reddit.com', name: 'Reddit', color: '#ff4500' },
  { pattern: 'seekingalpha.com', name: 'Seeking Alpha', color: '#ff8800' },
  { pattern: 'twitter.com', name: 'X', color: '#1da1f2' },
  { pattern: 'x.com', name: 'X', color: '#1da1f2' },
  { pattern: 'ycombinator.com', name: 'Hacker News', color: '#ff6600' },
  { pattern: 'wsj.com', name: 'WSJ', color: '#000' },
  { pattern: 'bloomberg.com', name: 'Bloomberg', color: '#290656' },
];

const getSourceInfo = (url: string) => {
  const match = SOURCE_PATTERNS.find(p => url.includes(p.pattern));
  return match || { name: 'Link', color: 'grey' };
};

export const ResearchNotes: React.FC = () => {
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [symbol, setSymbol] = useState('');
  const [content, setContent] = useState('');
  const [forwardPe, setForwardPe] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [sentiment, setSentiment] = useState<
    'BULLISH' | 'BEARISH' | 'NEUTRAL' | ''
  >('');
  const [linkInput, setLinkInput] = useState('');
  const [links, setLinks] = useState<
    Array<{ url: string; title: string; source: string }>
  >([]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const data = await ResearchService.getNotes();
      setNotes(data);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleAddLink = () => {
    if (!linkInput) return;
    const sourceInfo = getSourceInfo(linkInput);
    setLinks([
      ...links,
      { url: linkInput, title: sourceInfo.name, source: sourceInfo.name },
    ]);
    setLinkInput('');
  };

  const handleSave = async () => {
    if (!symbol) return;

    try {
      await ResearchService.saveNote({
        symbol: symbol.toUpperCase(),
        content,
        forward_pe: forwardPe ? parseFloat(forwardPe) : undefined,
        target_price: targetPrice ? parseFloat(targetPrice) : undefined,
        sentiment: (sentiment as any) || undefined,
        external_links: links,
      });

      // Reset form
      setSymbol('');
      setContent('');
      setForwardPe('');
      setTargetPrice('');
      setSentiment('');
      setLinks([]);
      setLinkInput('');

      // Refresh list
      fetchNotes();
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await ResearchService.deleteNote(id);
      setNotes(notes.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        background: 'rgba(24, 24, 27, 0.6)',
        backdropFilter: 'blur(12px)',
        borderRadius: 4,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Typography
          variant="h6"
          gutterBottom
          sx={{ fontWeight: 700, color: 'text.primary' }}
        >
          Research Hub
        </Typography>
        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Input Section */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Symbol (e.g. NVDA)"
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                InputProps={{
                  sx: { fontFamily: 'monospace', fontWeight: 700 },
                }}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Fwd P/E"
                type="number"
                value={forwardPe}
                onChange={e => setForwardPe(e.target.value)}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Target $"
                type="number"
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
              />
            </Grid>
            <Grid item xs={3}>
              <FormControl fullWidth size="small">
                <Select
                  value={sentiment}
                  displayEmpty
                  onChange={e => setSentiment(e.target.value as any)}
                  renderValue={selected => {
                    if (!selected)
                      return <span style={{ color: '#aaa' }}>Sentiment</span>;
                    return selected;
                  }}
                >
                  <MenuItem value="BULLISH" sx={{ color: 'success.main' }}>
                    <TrendingUp fontSize="small" sx={{ mr: 1 }} /> Bullish
                  </MenuItem>
                  <MenuItem value="BEARISH" sx={{ color: 'error.main' }}>
                    <TrendingDown fontSize="small" sx={{ mr: 1 }} /> Bearish
                  </MenuItem>
                  <MenuItem value="NEUTRAL" sx={{ color: 'text.secondary' }}>
                    <Remove fontSize="small" sx={{ mr: 1 }} /> Neutral
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add Link (URL)"
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
            />
            <Button
              variant="outlined"
              startIcon={<AddLink />}
              onClick={handleAddLink}
            >
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            {links.map((link, i) => (
              <Chip
                key={i}
                label={link.title}
                size="small"
                onDelete={() => setLinks(links.filter((_, idx) => idx !== i))}
                sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}
              />
            ))}
          </Box>

          <TextField
            fullWidth
            sx={{ mt: 2 }}
            placeholder="Investment Thesis / Notes..."
            multiline
            rows={3}
            value={content}
            onChange={e => setContent(e.target.value)}
            size="small"
          />

          <Button
            variant="contained"
            fullWidth
            startIcon={<Save />}
            onClick={handleSave}
            sx={{ mt: 2 }}
            disabled={!symbol}
          >
            Save Research
          </Button>
        </Box>

        <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* List Section */}
        <List sx={{ flexGrow: 1, overflow: 'auto' }}>
          {notes.map(note => (
            <Paper
              key={note.id}
              sx={{
                mb: 2,
                p: 2,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 800,
                      color: 'primary.light',
                      bgcolor: 'rgba(99, 102, 241, 0.1)',
                      px: 1,
                      borderRadius: 1,
                    }}
                  >
                    {note.symbol}
                  </Typography>
                  {note.sentiment && (
                    <Chip
                      label={note.sentiment}
                      size="small"
                      color={SENTIMENT_COLORS[note.sentiment] as any}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(note.updated_at).toLocaleDateString()}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => handleDelete(note.id)}>
                  <Delete fontSize="small" sx={{ color: 'text.secondary' }} />
                </IconButton>
              </Box>

              <Stack direction="row" spacing={2} sx={{ mb: 1, opacity: 0.8 }}>
                {note.forward_pe && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    Fwd P/E:{' '}
                    <span style={{ color: '#fff' }}>{note.forward_pe}</span>
                  </Typography>
                )}
                {note.target_price && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    Target:{' '}
                    <span style={{ color: '#fff' }}>${note.target_price}</span>
                  </Typography>
                )}
              </Stack>

              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', color: 'text.primary', mb: 1.5 }}
              >
                {note.content}
              </Typography>

              {note.external_links && note.external_links.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {note.external_links.map((link, i) => {
                    const info = getSourceInfo(link.url);
                    return (
                      <Link
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ textDecoration: 'none' }}
                      >
                        <Chip
                          label={info.name}
                          size="small"
                          icon={<AddLink sx={{ fontSize: 14 }} />}
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            borderColor: 'rgba(255,255,255,0.1)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                          }}
                          variant="outlined"
                        />
                      </Link>
                    );
                  })}
                </Box>
              )}
            </Paper>
          ))}
          {notes.length === 0 && !loading && (
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ mt: 4 }}
            >
              Start your research. Track P/E, sentiment, and keep links to
              analysis.
            </Typography>
          )}
        </List>
      </CardContent>
    </Card>
  );
};
