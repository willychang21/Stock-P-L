export interface ResearchNote {
  id: string;
  symbol: string;
  content: string;
  forward_pe?: number;
  revenue_growth?: number;
  target_price?: number;
  sentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  external_links: Array<{ url: string; title: string; source: string }>;
  updated_at: string;
}

const API_BASE_URL = 'http://localhost:3001/api/research';

export const ResearchService = {
  getNotes: async (symbol?: string): Promise<ResearchNote[]> => {
    const url = symbol ? `${API_BASE_URL}/${symbol}` : API_BASE_URL;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch notes');
    return response.json();
  },

  saveNote: async (note: Partial<ResearchNote>): Promise<ResearchNote> => {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(note),
    });
    if (!response.ok) throw new Error('Failed to save note');
    return response.json();
  },

  deleteNote: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete note');
  },
};
