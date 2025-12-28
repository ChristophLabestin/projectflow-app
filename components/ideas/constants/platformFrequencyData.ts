/**
 * Platform Frequency Guidelines
 * 
 * Industry-standard posting frequency recommendations for social media platforms.
 * Based on 2024 best practices and algorithm-optimized cadences.
 */

export interface PlatformFrequencyConfig {
    minPerWeek: number;
    optimalPerWeek: number;
    maxPerWeek: number;
    defaultUnit: 'Posts/Day' | 'Posts/Week' | 'Posts/Month';
    notes: string;
    productionEffort: 'low' | 'medium' | 'high';
}

export const PLATFORM_FREQUENCY_GUIDELINES: Record<string, PlatformFrequencyConfig> = {
    'Instagram': {
        minPerWeek: 3,
        optimalPerWeek: 5,
        maxPerWeek: 7,
        defaultUnit: 'Posts/Week',
        notes: 'Mix Reels, Carousels, and Stories. Reels get priority in algorithm.',
        productionEffort: 'medium'
    },
    'TikTok': {
        minPerWeek: 5,
        optimalPerWeek: 7,
        maxPerWeek: 14,
        defaultUnit: 'Posts/Week',
        notes: 'Algorithm heavily favors consistency. 1-3 posts/day optimal for growth.',
        productionEffort: 'low'
    },
    'YouTube Video': {
        minPerWeek: 0.5, // 1 every 2 weeks
        optimalPerWeek: 1,
        maxPerWeek: 2,
        defaultUnit: 'Posts/Week',
        notes: 'Long-form content. Quality over quantity. High production value expected.',
        productionEffort: 'high'
    },
    'YouTube Shorts': {
        minPerWeek: 5,
        optimalPerWeek: 7,
        maxPerWeek: 14,
        defaultUnit: 'Posts/Week',
        notes: 'Discovery engine for main channel. Repurpose content from long-form videos.',
        productionEffort: 'low'
    },
    'X': {
        minPerWeek: 3,
        optimalPerWeek: 7,
        maxPerWeek: 21,
        defaultUnit: 'Posts/Week',
        notes: 'High volume platform. Threads count as single post. Real-time engagement.',
        productionEffort: 'low'
    },
    'LinkedIn': {
        minPerWeek: 2,
        optimalPerWeek: 3,
        maxPerWeek: 5,
        defaultUnit: 'Posts/Week',
        notes: 'Professional content. Quality and thought leadership valued over quantity.',
        productionEffort: 'medium'
    },
    'Facebook': {
        minPerWeek: 2,
        optimalPerWeek: 3,
        maxPerWeek: 7,
        defaultUnit: 'Posts/Week',
        notes: 'Engagement-focused. Mix of video, links, and community posts.',
        productionEffort: 'low'
    }
};

/**
 * Phase intensity multipliers for campaign frequency
 */
export const PHASE_INTENSITY_MODIFIERS: Record<string, number> = {
    'Teaser': 0.5,       // Build anticipation with lower frequency
    'Pre-Launch': 0.75,  // Ramp up before launch
    'Launch': 1.5,       // Maximum impact during launch
    'Peak': 2.0,         // Highest intensity for key moments
    'Sustaining': 1.0,   // Standard cadence
    'Engagement': 1.25,  // Slightly elevated for engagement focus
    'Wrap-up': 0.75,     // Wind down gracefully
    'Evergreen': 0.5     // Long-term maintenance mode
};

/**
 * YouTube Synergy Rules
 * When YouTube Video is selected, Shorts should be recommended with these rules
 */
export const YOUTUBE_SYNERGY = {
    shortsToVideoRatio: 5, // Recommend 5 Shorts per 1 Video
    synergyMessage: 'YouTube Shorts acts as a discovery engine for your long-form Videos. Each Video should be supported by 3-5 Shorts (teasers, highlights, behind-the-scenes).',
    recommendedWorkflow: [
        'Create long-form Video content',
        'Extract 3-5 short clips for YouTube Shorts',
        'Post Shorts before and after Video release',
        'Use Shorts to drive traffic to full Video'
    ]
};

/**
 * Get default frequency for a platform when manually added
 */
export const getDefaultPlatformFrequency = (platform: string): { value: number; unit: string } => {
    const config = PLATFORM_FREQUENCY_GUIDELINES[platform];
    if (!config) {
        return { value: 3, unit: 'Posts/Week' };
    }
    return {
        value: config.optimalPerWeek,
        unit: config.defaultUnit
    };
};

/**
 * Generate the AI prompt section for platform frequencies
 */
export const generateFrequencyPromptSection = (): string => {
    const rows = Object.entries(PLATFORM_FREQUENCY_GUIDELINES).map(([platform, config]) => {
        return `| ${platform.padEnd(15)} | ${config.minPerWeek.toString().padEnd(8)} | ${config.optimalPerWeek.toString().padEnd(12)} | ${config.maxPerWeek.toString().padEnd(8)} | ${config.notes} |`;
    }).join('\n');

    return `
=== PLATFORM FREQUENCY GUIDELINES (MANDATORY) ===
Use these industry-standard frequencies as your baseline. Do NOT deviate significantly without strong justification.

| Platform        | Min/Week | Optimal/Week | Max/Week | Notes |
|-----------------|----------|--------------|----------|-------|
${rows}

**CRITICAL RULES:**
1. YouTube Video (long-form) MUST be 1-2 posts/week MAX. This is high-effort content.
2. YouTube Shorts MUST be 5-14 posts/week. This is the discovery engine.
3. TikTok frequency should NEVER be below 5/week for campaign success.
4. LinkedIn should NEVER exceed 5/week - quality over quantity.

=== PHASE INTENSITY MODIFIERS ===
Adjust base frequencies by phase:
- Teaser Phase: 0.5x base (build mystery, create anticipation)
- Pre-Launch: 0.75x base (gradually increase presence)
- Launch Phase: 1.5-2x base (MAXIMUM output for impact)
- Sustaining: 1x base (return to optimal cadence)
- Wrap-up: 0.75x base (graceful wind-down)

=== YOUTUBE SYNERGY (MANDATORY if YouTube selected) ===
If YouTube Video is in the platform list:
- You MUST strongly recommend adding YouTube Shorts if not already selected
- Shorts frequency should be 5-7x the Video frequency
- Shorts purpose: teasers, highlights, behind-the-scenes to drive Video views
- Example: 1 Video/week → 5-7 Shorts/week
`;
};
