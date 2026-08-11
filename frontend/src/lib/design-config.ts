export type FormatType = 'INSTAGRAM_FEED' | 'INSTAGRAM_STORY' | 'YOUTUBE_THUMBNAIL';
export type TemplateType = 'MINIMAL_POSTER' | 'REVIEW_CARD' | 'RATING_CARD' | 'QUOTE_CARD' | 'TOP_5_REASONS';

export interface RenderConfig {
  template: TemplateType;
  format: FormatType;
  width: number;
  height: number;
}

export const FORMAT_DIMENSIONS: Record<FormatType, { width: number, height: number }> = {
  INSTAGRAM_FEED: { width: 1080, height: 1350 },
  INSTAGRAM_STORY: { width: 1080, height: 1920 },
  YOUTUBE_THUMBNAIL: { width: 1920, height: 1080 },
};
