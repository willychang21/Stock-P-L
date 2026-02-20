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
  Stack,
  Avatar,
} from '@mui/material';
import {
  Person,
  Delete,
  Add as AddIcon,
  YouTube,
  Instagram,
  Language,
  Edit as EditIcon,
  OpenInNew,
} from '@mui/icons-material';
import { useState } from 'react';
import {
  Influencer,
  InfluencerCreate,
  InfluencerUpdate,
  InfluencerWithStats,
} from '@domain/models/Influencer';
import { useTranslation } from 'react-i18next';
import { getFaviconUrl } from '@presentation/utils/favicon';

interface InfluencerListProps {
  influencers: InfluencerWithStats[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (data: InfluencerCreate) => void;
  onUpdate: (id: string, data: InfluencerUpdate) => void;
  onDelete: (id: string) => void;
}

export function InfluencerList({
  influencers,
  selectedId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
}: InfluencerListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<InfluencerCreate>({
    name: '',
    platform: '',
    url: '',
  });
  const { t } = useTranslation();

  const getIcon = (inf: Influencer) => {
    const platform = inf.platform?.toLowerCase() || '';
    if (platform.includes('youtube')) return <YouTube color="error" />;
    if (platform.includes('instagram') || platform.includes('ig'))
      return <Instagram color="secondary" />;
    if (platform.includes('thread')) return <Language />; // Placeholder for Threads
    return <Person />;
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ name: '', platform: '', url: '' });
    setIsOpen(true);
  };

  const handleOpenEdit = (inf: Influencer) => {
    setEditingId(inf.id);
    setFormData({
      name: inf.name,
      platform: inf.platform || '',
      url: inf.url || '',
    });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name) return;

    if (editingId) {
      onUpdate(editingId, formData);
    } else {
      onAdd(formData);
    }

    setIsOpen(false);
    setFormData({ name: '', platform: '', url: '' });
    setEditingId(null);
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
        <Button startIcon={<AddIcon />} size="small" onClick={handleOpenAdd}>
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
              <Stack direction="row" spacing={0.5} sx={{ pr: 1 }}>
                {inf.url && (
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={e => {
                      e.stopPropagation();
                      window.open(inf.url, '_blank');
                    }}
                  >
                    <OpenInNew fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  edge="end"
                  size="small"
                  onClick={e => {
                    e.stopPropagation();
                    handleOpenEdit(inf);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
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
              </Stack>
            }
          >
            <ListItemButton
              selected={selectedId === inf.id}
              onClick={() => onSelect(inf.id)}
            >
              <ListItemIcon>
                {inf.url ? (
                  <Avatar
                    src={getFaviconUrl(inf.url)}
                    alt={inf.name}
                    sx={{ width: 24, height: 24, bgcolor: 'transparent' }}
                  >
                    {getIcon(inf)}
                  </Avatar>
                ) : (
                  getIcon(inf)
                )}
              </ListItemIcon>
              <ListItemText
                primary={inf.name}
                secondary={
                  <Box
                    component="span"
                    sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                  >
                    <span>{inf.platform || ''}</span>
                    {inf.win_rate !== undefined && inf.win_rate !== null && (
                      <Typography
                        component="span"
                        variant="caption"
                        color={
                          inf.win_rate >= 0.5
                            ? 'success.main'
                            : 'text.secondary'
                        }
                        sx={{ fontWeight: 'bold' }}
                      >
                        {(inf.win_rate * 100).toFixed(0)}%勝率
                      </Typography>
                    )}
                    {inf.avg_return !== undefined &&
                      inf.avg_return !== null && (
                        <Typography
                          component="span"
                          variant="caption"
                          color={
                            inf.avg_return >= 0 ? 'success.main' : 'error.main'
                          }
                          sx={{ fontWeight: 'bold' }}
                        >
                          {inf.avg_return >= 0 ? '+' : ''}
                          {(inf.avg_return * 100).toFixed(1)}%
                        </Typography>
                      )}
                  </Box>
                }
                sx={{ pr: 12 }} // Reserve space for secondary actions (3 buttons)
                primaryTypographyProps={{
                  noWrap: true,
                  component: 'div',
                }}
                secondaryTypographyProps={{
                  noWrap: true,
                  component: 'div',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTitle>
          {editingId
            ? t('influencers.editInfluencer')
            : t('influencers.addInfluencer')}
        </DialogTitle>
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
          <Button onClick={() => setIsOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingId ? t('common.save') : t('influencers.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
