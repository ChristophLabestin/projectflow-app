import React from 'react';
import { SocialPlatform } from '../../../types';
import fbLogo from '../../../assets/Facebook Brand Asset Pack/Logo/Primary Logo/Facebook_Logo_Primary.png';
import igLogoWhite from '../../../assets/01 Static Glyph/02 White Glyph/Instagram_Glyph_White.png';
import liLogo from '../../../assets/in-logo/LI-In-Bug.png';
import ytLogoWhite from '../../../assets/YouTube_Icon/Digital/03 White/yt_icon_white_digital.png';
import ttLogo from '../../../assets/Dev Portal Logo Pack/TikTok Logo Pack/TikTok – Icons/TikTok_Icon_Black_Square.png';
import xLogoWhite from '../../../assets/x-logo/logo-white.png';

interface PlatformIconProps {
    platform: SocialPlatform | string;
    className?: string;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({ platform, className = "w-full h-full" }) => {
    // UNIFORM "APP ICON" STYLE: All icons are solid, brand-colored squares (Squaricles).
    // This creates a solid "tile" look with no transparent gaps.

    const Wrapper = ({ children, bg }: { children: React.ReactNode, bg: string }) => (
        <div className={`${className} ${bg} rounded-md flex items-center justify-center overflow-hidden shadow-sm`}>
            {children}
        </div>
    );

    switch (platform) {
        case 'Instagram':
            // White Glyph on Official Gradient Background
            return (
                <Wrapper bg="bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]">
                    <img src={igLogoWhite} alt="Instagram" className="w-[65%] h-[65%] object-contain" />
                </Wrapper>
            );

        case 'LinkedIn':
            // "Same as modal (Blue Bug) but with white background"
            return (
                <Wrapper bg="bg-white">
                    <img src={liLogo} alt="LinkedIn" className="w-[90%] h-[90%] object-contain" />
                </Wrapper>
            );

        case 'YouTube':
        case 'YouTube Video':
            // White Play Button on Red Background
            return (
                <Wrapper bg="bg-[#FF0000]">
                    <img src={ytLogoWhite} alt="YouTube" className="w-[60%] h-[60%] object-contain" />
                </Wrapper>
            );

        case 'YouTube Shorts':
            return (
                <Wrapper bg="bg-[#FF0000]">
                    <div className="relative w-full h-full flex items-center justify-center">
                        <img src={ytLogoWhite} alt="YouTube Shorts" className="w-[55%] h-[55%] object-contain" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="mt-6 text-[7px] font-black text-white uppercase tracking-tighter bg-black/20 px-1 rounded">Shorts</div>
                        </div>
                    </div>
                </Wrapper>
            );

        case 'TikTok':
            // Native Black Square Asset
            return (
                <div className={`${className} rounded-md overflow-hidden shadow-sm`}>
                    <img src={ttLogo} alt="TikTok" className="w-full h-full object-cover" />
                </div>
            );

        case 'Facebook':
            // "Same as modal" -> Primary Logo (which is the Blue Circle 'f')
            // Using generic container to let it be a circle.
            return (
                <div className={`${className} flex items-center justify-center`}>
                    <img src={fbLogo} alt="Facebook" className="w-full h-full object-contain" />
                </div>
            );

        case 'X':
            // White X on Black Background (App Icon)
            return (
                <Wrapper bg="bg-black">
                    <img src={xLogoWhite} alt="X" className="w-[60%] h-[60%] object-contain" />
                </Wrapper>
            );

        default:
            return null;
    }
};
