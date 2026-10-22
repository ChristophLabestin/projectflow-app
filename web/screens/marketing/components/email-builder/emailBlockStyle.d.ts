// Type-only extension of EmailBlockStyle with the typography, sizing and shadow styles
// that the email builder already reads and writes. Belongs in web/types.ts long term.
import type {} from '../../../../types';

declare module '../../../../types' {
    interface EmailBlockStyle {
        lineHeight?: number;
        letterSpacing?: number;
        textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
        textDecoration?: 'none' | 'underline' | 'line-through';
        fontStyle?: 'normal' | 'italic';
        maxWidth?: number;
        minWidth?: number;
        borderTopLeftRadius?: number;
        borderTopRightRadius?: number;
        borderBottomLeftRadius?: number;
        borderBottomRightRadius?: number;
        shadowX?: number;
        shadowY?: number;
        shadowBlur?: number;
        shadowSpread?: number;
        shadowColor?: string;
    }
}
