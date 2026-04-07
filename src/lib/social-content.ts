export type SocialTone = 'professional' | 'friendly' | 'adventurous' | 'luxurious' | 'urgent';

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'instagram_story'
  | 'whatsapp'
  | 'twitter'
  | 'linkedin';

export type SocialTemplateId =
  | 'featured_stay'
  | 'special_offer'
  | 'lifestyle_escape'
  | 'stay_carousel'
  | 'story_pack'
  | 'quick_facts'
  | 'weekend_escape';

export type SocialTemplateDefinition = {
  id: SocialTemplateId;
  name: string;
  shortDescription: string;
  category: 'single' | 'multi';
  recommended: boolean;
  supportsSpecialOffer: boolean;
  supportsHeadlineOverride: boolean;
  supportedPlatforms: SocialPlatform[];
};

export const SOCIAL_PLATFORMS: Array<{ id: SocialPlatform; label: string }> = [
  { id: 'instagram', label: 'Instagram Feed' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram_story', label: 'Instagram Story' },
  { id: 'whatsapp', label: 'WhatsApp Status' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'linkedin', label: 'LinkedIn' },
];

export const SOCIAL_TEMPLATES: SocialTemplateDefinition[] = [
  {
    id: 'featured_stay',
    name: 'Featured Stay',
    shortDescription: 'Standard hero post with location, features, price, and CTA.',
    category: 'single',
    recommended: true,
    supportsSpecialOffer: false,
    supportsHeadlineOverride: true,
    supportedPlatforms: ['instagram', 'facebook', 'twitter', 'linkedin'],
  },
  {
    id: 'special_offer',
    name: 'Special Offer',
    shortDescription: 'Deal-led post for low occupancy, last-minute pushes, and promos.',
    category: 'single',
    recommended: true,
    supportsSpecialOffer: true,
    supportsHeadlineOverride: true,
    supportedPlatforms: ['instagram', 'facebook', 'twitter', 'linkedin', 'instagram_story', 'whatsapp'],
  },
  {
    id: 'lifestyle_escape',
    name: 'Luxury Escape',
    shortDescription: 'Emotion-first post that sells the feeling, not the room.',
    category: 'single',
    recommended: true,
    supportsSpecialOffer: false,
    supportsHeadlineOverride: true,
    supportedPlatforms: ['instagram', 'facebook', 'twitter', 'linkedin', 'instagram_story'],
  },
  {
    id: 'stay_carousel',
    name: 'Stay Carousel',
    shortDescription: 'Swipe-ready gallery pack with space, features, price, and CTA slides.',
    category: 'multi',
    recommended: true,
    supportsSpecialOffer: false,
    supportsHeadlineOverride: false,
    supportedPlatforms: ['instagram', 'facebook', 'linkedin'],
  },
  {
    id: 'story_pack',
    name: 'Story Pack',
    shortDescription: 'Three-story vertical pack for stories and status placements.',
    category: 'multi',
    recommended: true,
    supportsSpecialOffer: true,
    supportsHeadlineOverride: false,
    supportedPlatforms: ['instagram_story', 'whatsapp', 'facebook'],
  },
  {
    id: 'quick_facts',
    name: 'Quick Facts',
    shortDescription: 'Practical, info-heavy design for guests comparing options.',
    category: 'single',
    recommended: false,
    supportsSpecialOffer: false,
    supportsHeadlineOverride: false,
    supportedPlatforms: ['facebook', 'instagram', 'linkedin'],
  },
  {
    id: 'weekend_escape',
    name: 'Weekend Escape',
    shortDescription: 'Short-break positioning for Friday pushes and quick getaways.',
    category: 'single',
    recommended: false,
    supportsSpecialOffer: true,
    supportsHeadlineOverride: true,
    supportedPlatforms: ['instagram', 'facebook', 'instagram_story', 'whatsapp', 'twitter'],
  },
];

export function getSocialTemplate(templateId: SocialTemplateId) {
  return SOCIAL_TEMPLATES.find((template) => template.id === templateId) ?? SOCIAL_TEMPLATES[0];
}

export function getPlatformLabel(platform: SocialPlatform) {
  return SOCIAL_PLATFORMS.find((item) => item.id === platform)?.label ?? platform;
}
