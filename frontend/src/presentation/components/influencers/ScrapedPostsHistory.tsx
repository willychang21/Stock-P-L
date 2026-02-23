/**
 * ScrapedPostsHistory — Shows all AI-analyzed posts including skipped/irrelevant ones.
 * Allows the user to verify whether the classifier made the correct decision.
 */

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Cancel from '@mui/icons-material/Cancel';
import OpenInNew from '@mui/icons-material/OpenInNew';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweep from '@mui/icons-material/DeleteSweep';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@infrastructure/api/client';
import { getFaviconUrl } from '@presentation/utils/favicon';

interface ScrapedPost {
  id: string;
  influencer_id: string;
  influencer_name: string;
  source: string;
  source_url: string;
  original_content: string;
  is_investment_related: boolean;
  post_type: string;
  analyzed_at: string;
  content_hash: string;
}

interface ScrapedPostsHistoryProps {
  selectedInfluencerId: string | null;
}

const POST_TYPE_LABELS: Record<
  string,
  {
    labelKey: string;
    color: 'success' | 'error' | 'warning' | 'info' | 'default';
  }
> = {
  single_pick: {
    labelKey: 'influencers.scrapedPosts.types.single_pick',
    color: 'success',
  },
  portfolio_update: {
    labelKey: 'influencers.scrapedPosts.types.portfolio_update',
    color: 'success',
  },
  trade_journal: {
    labelKey: 'influencers.scrapedPosts.types.trade_journal',
    color: 'success',
  },
  earnings_review: {
    labelKey: 'influencers.scrapedPosts.types.earnings_review',
    color: 'info',
  },
  company_analysis: {
    labelKey: 'influencers.scrapedPosts.types.company_analysis',
    color: 'info',
  },
  market_commentary: {
    labelKey: 'influencers.scrapedPosts.types.market_commentary',
    color: 'warning',
  },
  educational: {
    labelKey: 'influencers.scrapedPosts.types.educational',
    color: 'default',
  },
  lifestyle: {
    labelKey: 'influencers.scrapedPosts.types.lifestyle',
    color: 'default',
  },
  other: { labelKey: 'influencers.scrapedPosts.types.other', color: 'default' },
  irrelevant: {
    labelKey: 'influencers.scrapedPosts.types.irrelevant',
    color: 'default',
  },
  error: { labelKey: 'influencers.scrapedPosts.types.error', color: 'error' },
};

export function ScrapedPostsHistory({
  selectedInfluencerId,
}: ScrapedPostsHistoryProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<ScrapedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'investment' | 'skipped'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, [selectedInfluencerId]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getScrapedPosts(
        selectedInfluencerId || undefined
      );
      setPosts(data);
    } catch (error) {
      console.error('Failed to fetch scraped posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = posts.filter(p => {
    if (filter === 'investment') return p.is_investment_related;
    if (filter === 'skipped') return !p.is_investment_related;
    return true;
  });

  const investmentCount = posts.filter(p => p.is_investment_related).length;
  const skippedCount = posts.filter(p => !p.is_investment_related).length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        t('influencers.scrapedPosts.confirmDelete', { count: selectedIds.size })
      )
    )
      return;
    setDeleting(true);
    try {
      await apiClient.bulkDeleteScrapedPosts(Array.from(selectedIds));
      setPosts(prev => prev.filter(p => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.deleteScrapedPost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      setSelectedIds(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (posts.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          {t('influencers.scrapedPosts.empty')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Filter chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip
          label={t('influencers.scrapedPosts.filterAll', {
            count: posts.length,
          })}
          variant={filter === 'all' ? 'filled' : 'outlined'}
          onClick={() => setFilter('all')}
          color="primary"
          size="small"
        />
        <Chip
          icon={<CheckCircle fontSize="small" />}
          label={t('influencers.scrapedPosts.filterInvestment', {
            count: investmentCount,
          })}
          variant={filter === 'investment' ? 'filled' : 'outlined'}
          onClick={() => setFilter('investment')}
          color="success"
          size="small"
        />
        <Chip
          icon={<Cancel fontSize="small" />}
          label={t('influencers.scrapedPosts.filterSkipped', {
            count: skippedCount,
          })}
          variant={filter === 'skipped' ? 'filled' : 'outlined'}
          onClick={() => setFilter('skipped')}
          color="error"
          size="small"
        />
      </Stack>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteSweep />}
            onClick={handleDeleteSelected}
            disabled={deleting}
          >
            {deleting
              ? t('influencers.scrapedPosts.deleting')
              : t('influencers.scrapedPosts.deleteSelected', {
                  count: selectedIds.size,
                })}
          </Button>
          <Button size="small" onClick={() => setSelectedIds(new Set())}>
            {t('influencers.scrapedPosts.cancelSelection')}
          </Button>
        </Stack>
      )}

      {/* Posts list */}
      <Stack spacing={1}>
        {filteredPosts.map(post => {
          const isExpanded = expandedId === post.id;
          const typeInfo = POST_TYPE_LABELS[post.post_type] ?? {
            labelKey: 'influencers.scrapedPosts.types.other',
            color: 'default' as const,
          };
          const contentPreview =
            post.original_content?.substring(0, 80) +
            (post.original_content?.length > 80 ? '...' : '');

          return (
            <Card
              key={post.id}
              variant="outlined"
              sx={{
                borderLeft: 4,
                borderLeftColor: post.is_investment_related
                  ? 'success.main'
                  : 'grey.400',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => setExpandedId(isExpanded ? null : post.id)}
            >
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {/* Checkbox for selection */}
                  <Checkbox
                    size="small"
                    checked={selectedIds.has(post.id)}
                    onClick={e => {
                      e.stopPropagation();
                      toggleSelect(post.id);
                    }}
                    sx={{ p: 0 }}
                  />

                  {/* Status icon */}
                  {post.is_investment_related ? (
                    <CheckCircle fontSize="small" color="success" />
                  ) : (
                    <Cancel fontSize="small" color="disabled" />
                  )}

                  {/* Influencer avatar */}
                  {post.source_url && (
                    <Avatar
                      src={getFaviconUrl(post.source_url)}
                      sx={{ width: 20, height: 20 }}
                    />
                  )}

                  {/* Content preview */}
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: post.is_investment_related
                        ? 'text.primary'
                        : 'text.secondary',
                    }}
                  >
                    <strong>{post.influencer_name}</strong>: {contentPreview}
                  </Typography>

                  {/* Post type chip */}
                  <Chip
                    label={t(typeInfo.labelKey)}
                    size="small"
                    color={typeInfo.color}
                    variant="outlined"
                    sx={{ minWidth: 70 }}
                  />

                  {/* Date */}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ minWidth: 90 }}
                  >
                    {post.analyzed_at
                      ? new Date(post.analyzed_at).toLocaleDateString()
                      : ''}
                  </Typography>

                  {/* Expand/collapse */}
                  <IconButton size="small">
                    {isExpanded ? (
                      <ExpandLess fontSize="small" />
                    ) : (
                      <ExpandMore fontSize="small" />
                    )}
                  </IconButton>

                  {/* Delete single */}
                  <Tooltip title={t('influencers.scrapedPosts.deleteSingle')}>
                    <IconButton
                      size="small"
                      onClick={e => handleDeleteSingle(post.id, e)}
                      sx={{
                        color: 'error.main',
                        opacity: 0.6,
                        '&:hover': { opacity: 1 },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                {/* Expanded content */}
                {isExpanded && (
                  <Box sx={{ mt: 1.5, pl: 4 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        bgcolor: 'action.selected',
                        color: 'text.primary',
                        p: 1.5,
                        borderRadius: 1,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                      }}
                    >
                      {post.original_content}
                    </Typography>

                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ mt: 1 }}
                      alignItems="center"
                    >
                      <Chip
                        label={
                          post.is_investment_related
                            ? t('influencers.scrapedPosts.statusInvestment')
                            : t('influencers.scrapedPosts.statusSkipped')
                        }
                        size="small"
                        color={
                          post.is_investment_related ? 'success' : 'default'
                        }
                      />
                      <Chip
                        label={t('influencers.scrapedPosts.categoryLabel', {
                          label: t(typeInfo.labelKey),
                        })}
                        size="small"
                        variant="outlined"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {post.analyzed_at
                          ? new Date(post.analyzed_at).toLocaleString()
                          : ''}
                      </Typography>
                      {post.source_url && (
                        <Tooltip
                          title={t('influencers.scrapedPosts.viewSource')}
                        >
                          <IconButton
                            size="small"
                            href={post.source_url}
                            target="_blank"
                            onClick={e => e.stopPropagation()}
                          >
                            <OpenInNew fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
