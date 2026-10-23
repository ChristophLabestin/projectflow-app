import type React from 'react';

export type HelpCenterSectionIndex = {
    id: string;
    title: string;
    summary: string;
    content?: string;
    keywords?: string[];
};

/** Resolves a help-center i18n key (`help.<page>.…` from `web/locales/help/*`). */
export type HelpT = (key: string) => string;

/** Builds a section index from the loaded help dictionaries; keywords keys hold comma-separated lists. */
export type HelpCenterSectionsBuilder = (t: HelpT) => HelpCenterSectionIndex[];

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
