import type React from 'react';

export type HelpCenterSectionIndex = {
    id: string;
    title: string;
    summary: string;
    content?: string;
    keywords?: string[];
};

export type HelpCenterPageProps = {
    sections: HelpCenterSectionIndex[];
    activeSectionId: string | null;
    onSectionSelect: (sectionId: string) => void;
};

export type HelpCenterPageDefinition = {
    id: string;
    title: string;
    description: string;
    category: string;
    keywords?: string[];
    sections: HelpCenterSectionIndex[];
    component: React.FC<HelpCenterPageProps>;
};
