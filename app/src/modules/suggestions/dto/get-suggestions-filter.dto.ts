export type SortField = 'createdAt' | 'score';
export type SortOrder = 'asc' | 'desc';

export interface GetSuggestionsFilterDto {
  page?: number;
  limit?: number;
  status?: string[];
  category?: string;
  authorId?: string;
  sort?: SortField;
  order?: SortOrder;
}
