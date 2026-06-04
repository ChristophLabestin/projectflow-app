import { SocialPlatform, SocialPostFormat } from '../../types';

export const PLATFORM_FORMATS: Record<SocialPlatform, SocialPostFormat[]> = {
    'Instagram': ['Post', 'Story', 'Reel'],
    'Facebook': ['Text', 'Post', 'Reel', 'Story'],
    'LinkedIn': ['Text', 'Post', 'Carousel'],
    'TikTok': ['Video'],
    'X': ['Text', 'Post'],
    'YouTube': ['Video', 'Short'],
};
