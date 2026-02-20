/**
 * ScrapedPostsHistory — Shows all AI-analyzed posts including skipped/irrelevant ones.
 * Allows the user to verify whether the classifier made the correct decision.
 */

import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Avatar,
  Tooltip,
  IconButton,
  Checkbox,
  Button,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  OpenInNew,
  ExpandMore,
  ExpandLess,
  Delete as DeleteIcon,
  DeleteSweep,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
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
  { label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default' }
> = {
  single_pick: { label: '單一推薦', color: 'success' },
  portfolio_update: { label: '持股更新', color: 'success' },
  trade_journal: { label: '交易日誌', color: 'success' },
  earnings_review: { label: '財報解讀', color: 'info' },
  company_analysis: { label: '公司分析', color: 'info' },
  market_commentary: { label: '市場評論', color: 'warning' },
  educational: { label: '教學文', color: 'default' },
  lifestyle: { label: '生活', color: 'default' },
  other: { label: '其他', color: 'default' },
  irrelevant: { label: '無關', color: 'default' },
  error: { label: '分析錯誤', color: 'error' },
};

export function ScrapedPostsHistory({
  selectedInfluencerId,
}: ScrapedPostsHistoryProps) {
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
    if (!confirm(`確定刪除 ${selectedIds.size} 筆紀錄？`)) return;
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
          尚無分析紀錄。請先觸發自動追蹤來分析貼文。
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Filter chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip
          label={`全部 (${posts.length})`}
          variant={filter === 'all' ? 'filled' : 'outlined'}
          onClick={() => setFilter('all')}
          color="primary"
          size="small"
        />
        <Chip
          icon={<CheckCircle fontSize="small" />}
          label={`已抽取 (${investmentCount})`}
          variant={filter === 'investment' ? 'filled' : 'outlined'}
          onClick={() => setFilter('investment')}
          color="success"
          size="small"
        />
        <Chip
          icon={<Cancel fontSize="small" />}
          label={`已跳過 (${skippedCount})`}
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
            {deleting ? '刪除中...' : `刪除已選 (${selectedIds.size})`}
          </Button>
          <Button size="small" onClick={() => setSelectedIds(new Set())}>
            取消選擇
          </Button>
        </Stack>
      )}

      {/* Posts list */}
      <Stack spacing={1}>
        {filteredPosts.map(post => {
          const isExpanded = expandedId === post.id;
          const typeInfo = POST_TYPE_LABELS[post.post_type] ?? {
            label: '其他',
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
                    label={typeInfo.label}
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
                  <Tooltip title="刪除此紀錄">
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
                            ? '✅ 已抽取為推薦'
                            : '❌ AI 判定為非投資內容'
                        }
                        size="small"
                        color={
                          post.is_investment_related ? 'success' : 'default'
                        }
                      />
                      <Chip
                        label={`分類: ${typeInfo.label}`}
                        size="small"
                        variant="outlined"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {post.analyzed_at
                          ? new Date(post.analyzed_at).toLocaleString()
                          : ''}
                      </Typography>
                      {post.source_url && (
                        <Tooltip title="開啟原文">
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
