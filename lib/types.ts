export type ReviewStatus = 'undone' | 'done' | 'skip';
export const REVIEW_STATUSES = ['undone', 'done', 'skip'] as const;
export const ARTICLE_COLUMNS = [
  'id',
  'url_hash',
  'canonical_url',
  'title',
  'content',
  'creator',
  'pub_date',
  'fetched_at',
  'status',
  'mode',
  'language',
  'region',
  'raw_url',
  'ai_title',
  'ai_full_summary',
  'ai_short_summary_2_sentences',
  'do_status',
  'preverdict',
] as const;
export type Article = {
  id: string | number;
  url_hash: string | null;
  canonical_url: string | null;
  title: string | null;
  content: string | null;
  creator: string | null;
  pub_date: string | null;
  fetched_at: string | null;
  status: string | null;
  mode: string | null;
  language: string | null;
  region: string | null;
  raw_url: string | null;
  ai_title: string | null;
  ai_full_summary: string | null;
  ai_short_summary_2_sentences: string | null;
  do_status: string | null;
  preverdict?: unknown;
};
export type ArticleFilters = {
  page: number;
  pageSize: number;
  search: string;
  status: string;
  do_status: string;
  mode: string;
  language: string;
  region: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};
export type PageResult = {
  items: Article[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
