import React from 'react';
import { getAllWorkspaceProjects, getAllWorkspaceTasks } from '../../services/dataService';
import { getWorkspaceMembers } from '../../services/domain/workspaceMembersService';
import { getAccessibleWikiDocs } from '../../services/wiki/wikiService';
import type { Member, Project, Task } from '../../types';
import type { WikiDocMeta, WikiSpace } from '../../types/wiki';

/** Lookup data for mentions, live chips and embedded task lists. Loaded lazily, cached per tenant. */
export interface WikiLookups {
    projects: Project[];
    tasks: Task[];
    members: Member[];
    docs: WikiDocMeta[];
}

export interface WikiDataValue {
    tenantId: string;
    space: WikiSpace;
    isGuest: boolean;
    uid: string;
    /** Pages of the current space (live). */
    spaceDocs: WikiDocMeta[];
    lookups: WikiLookups | null;
    ensureLookups: (force?: boolean) => Promise<WikiLookups>;
    docHref: (doc: Pick<WikiDocMeta, 'id' | 'spaceType' | 'projectId'>) => string;
    findDoc: (id: string) => WikiDocMeta | undefined;
}

const WikiDataContext = React.createContext<WikiDataValue | null>(null);

export const useWikiData = () => {
    const value = React.useContext(WikiDataContext);
    if (!value) throw new Error('useWikiData must be used within WikiDataProvider');
    return value;
};

/** Safe variant for node views that may render outside the wiki (read-only previews). */
export const useOptionalWikiData = () => React.useContext(WikiDataContext);

export const wikiDocHref = (doc: Pick<WikiDocMeta, 'id' | 'spaceType' | 'projectId'>) =>
    doc.spaceType === 'project' && doc.projectId ? `/project/${doc.projectId}/wiki/${doc.id}` : `/wiki/${doc.id}`;

const LOOKUP_TTL_MS = 60_000;
let lookupCache: { key: string; at: number; promise: Promise<WikiLookups> } | null = null;

export const WikiDataProvider: React.FC<{
    tenantId: string;
    space: WikiSpace;
    isGuest: boolean;
    uid: string;
    spaceDocs: WikiDocMeta[];
    children: React.ReactNode;
}> = ({ tenantId, space, isGuest, uid, spaceDocs, children }) => {
    const [lookups, setLookups] = React.useState<WikiLookups | null>(null);

    const ensureLookups = React.useCallback(async (force = false) => {
        const key = `${uid}:${tenantId}`;
        if (force || !lookupCache || lookupCache.key !== key || Date.now() - lookupCache.at > LOOKUP_TTL_MS) {
            const promise = (async () => {
                const projects = await getAllWorkspaceProjects(tenantId).catch(() => [] as Project[]);
                const [tasks, members, docs] = await Promise.all([
                    getAllWorkspaceTasks(tenantId).catch(() => [] as Task[]),
                    getWorkspaceMembers(tenantId).catch(() => [] as Member[]),
                    getAccessibleWikiDocs(tenantId, isGuest ? projects.map((p) => p.id) : undefined).catch(() => [] as WikiDocMeta[]),
                ]);
                return { projects, tasks, members, docs };
            })();
            lookupCache = { key, at: Date.now(), promise };
        }
        const next = await lookupCache.promise;
        setLookups(next);
        return next;
    }, [isGuest, tenantId, uid]);

    React.useEffect(() => {
        void ensureLookups();
    }, [ensureLookups]);

    const findDoc = React.useCallback((id: string) =>
        spaceDocs.find((doc) => doc.id === id) || lookups?.docs.find((doc) => doc.id === id), [lookups, spaceDocs]);

    const value = React.useMemo<WikiDataValue>(() => ({
        tenantId,
        space,
        isGuest,
        uid,
        spaceDocs,
        lookups,
        ensureLookups,
        docHref: wikiDocHref,
        findDoc,
    }), [ensureLookups, findDoc, isGuest, lookups, space, spaceDocs, tenantId, uid]);

    return <WikiDataContext.Provider value={value}>{children}</WikiDataContext.Provider>;
};
