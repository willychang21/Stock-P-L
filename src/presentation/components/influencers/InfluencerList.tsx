import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Typography,
  Paper,
} from '@mui/material';
import {
  Person,
  Delete,
  Add as AddIcon,
  YouTube,
  Instagram,
  Language,
} from '@mui/icons-material';
import { useState } from 'react';
import { Influencer, InfluencerCreate } from '@domain/models/Influencer';
import { useTranslation } from 'react-i18next';

interface InfluencerListProps {
  influencers: Influencer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (data: InfluencerCreate) => void;
  onDelete: (id: string) => void;
}

export function InfluencerList({
  influencers,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: InfluencerListProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState<InfluencerCreate>({
    name: '',
    platform: '',
    url: '',
  });
  const { t } = useTranslation();

  const getIcon = (platform?: string) => {
    const p = platform?.toLowerCase() || '';
    if (p.includes('youtube')) return <YouTube color="error" />;
    if (p.includes('instagram') || p.includes('ig'))
      return <Instagram color="secondary" />;
    if (p.includes('thread')) return <Language />; // Placeholder for Threads
    return <Person />;
  };

  const handleAdd = () => {
    if (!formData.name) return;
    onAdd(formData);
    setFormData({ name: '', platform: '', url: '' });
    setIsAddOpen(false);
  };

  return (
    <Paper
      sx={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6">{t('influencers.title')}</Typography>
        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={() => setIsAddOpen(true)}
        >
          {t('influencers.add')}
        </Button>
      </Box>

      <List sx={{ overflow: 'auto', flex: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            selected={selectedId === null}
            onClick={() => onSelect(null)}
          >
            <ListItemIcon>
              <Person />
            </ListItemIcon>
            <ListItemText primary={t('influencers.allInfluencers')} />
          </ListItemButton>
        </ListItem>

        {influencers.map(inf => (
          <ListItem
            key={inf.id}
            disablePadding
            secondaryAction={
              <IconButton
                edge="end"
                size="small"
                onClick={e => {
                  e.stopPropagation();
                  onDelete(inf.id);
                }}
              >
                <Delete fontSize="small" />
              </IconButton>
            }
          >
            <ListItemButton
              selected={selectedId === inf.id}
              onClick={() => onSelect(inf.id)}
            >
              <ListItemIcon>{getIcon(inf.platform)}</ListItemIcon>
              <ListItemText primary={inf.name} secondary={inf.platform} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Dialog open={isAddOpen} onClose={() => setIsAddOpen(false)}>
        <DialogTitle>{t('influencers.addInfluencer')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('influencers.name')}
            fullWidth
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label={t('influencers.platform')}
            fullWidth
            value={formData.platform}
            onChange={e =>
              setFormData({ ...formData, platform: e.target.value })
            }
          />
          <TextField
            margin="dense"
            label={t('influencers.url')}
            fullWidth
            value={formData.url}
            onChange={e => setFormData({ ...formData, url: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleAdd} variant="contained">
            {t('influencers.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
