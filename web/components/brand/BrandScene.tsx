import React from 'react';
import { BrandMark } from './BrandMark';
import { FlowField } from './FlowField';
import { LoadingTrack } from './StatusDots';
import './brand.scss';

const NAME = 'ProjectFlow';

interface BrandSceneProps {
    /** Status line under the track (e.g. "Connecting to workspace..."). */
    label?: string;
    /** `screen`: fills the viewport (app start). `inline`: fills its container, no flow field. */
    variant?: 'screen' | 'inline';
}

/**
 * Loading scene shared with the desktop splash and the iOS launch: flow field, brand mark,
 * the name rising in letter by letter and a loading track. Announces `label` politely.
 */
export const BrandScene = ({ label, variant = 'screen' }: BrandSceneProps) => (
    <div className={`brand-scene brand-scene--${variant}`} role="status" aria-live="polite">
        {variant === 'screen' && <FlowField className="brand-scene__field" originY={0.42} />}
        <div className="brand-scene__center">
            <BrandMark size={variant === 'screen' ? 'lg' : 'md'} />
            {variant === 'screen' && (
                <span className="brand-scene__name" aria-hidden="true">
                    {[...NAME].map((char, index) => (
                        <span key={index} style={{ animationDelay: `${250 + index * 35}ms` }}>{char}</span>
                    ))}
                </span>
            )}
        </div>
        <div className="brand-scene__status">
            <LoadingTrack />
            {label && <span className="brand-scene__label">{label}</span>}
        </div>
    </div>
);
