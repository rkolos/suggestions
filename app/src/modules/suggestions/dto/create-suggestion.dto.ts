export interface CreateSuggestionDto {
  title: string;
  description: string;
  category: string;
  isOfficial?: boolean;
  source?: 'WEB' | 'DISCORD';
  images?: string[];
}
