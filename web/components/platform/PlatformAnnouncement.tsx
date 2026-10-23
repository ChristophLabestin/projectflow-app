import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../services/firebase';
import './platform-announcement.scss';

/**
 * Platform-wide banner set in the admin console (`platform_config/announcement`, public read).
 * Shown while `active` and inside [startsAt, endsAt]; dismissing hides this version (`id`) per device.
 * Contract for iOS: brain/plans/admin-console-concept.md → "Ankündigungsbanner".
 */
type Announcement = {
    id: string;
    active: boolean;
    type: 'info' | 'maintenance' | 'warning';
    text: { de: string; en: string };
    link: { url: string; label: { de: string; en: string } } | null;
    startsAt: { toMillis: () => number } | null;
    endsAt: { toMillis: () => number } | null;
    dismissible: boolean;
};

const DISMISS_KEY = 'pf.announcement.dismissed';
const ICON = { info: 'campaign', maintenance: 'construction', warning: 'warning' } as const;

export const PlatformAnnouncement = () => {
    const { language } = useLanguage();
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY));
    const [now, setNow] = useState(Date.now());

    useEffect(() => onSnapshot(doc(db, 'platform_config', 'announcement'),
        (snap) => setAnnouncement(snap.exists() ? (snap.data() as Announcement) : null),
        () => setAnnouncement(null)), []);

    // Re-evaluate the time window every minute (start/end without a new snapshot).
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    if (!announcement?.active || announcement.id === dismissed) return null;
    if (announcement.startsAt && announcement.startsAt.toMillis() > now) return null;
    if (announcement.endsAt && announcement.endsAt.toMillis() <= now) return null;
    const lang = language === 'de' ? 'de' : 'en';
    const text = announcement.text?.[lang] || announcement.text?.en;
    if (!text) return null;
    const type = ICON[announcement.type] ? announcement.type : 'info';

    return (
        <div className={`platform-announcement platform-announcement--${type}`} role={type === 'warning' ? 'alert' : 'status'}>
            <span className="material-symbols-outlined platform-announcement__icon" aria-hidden="true">{ICON[type]}</span>
            <span className="platform-announcement__text">{text}</span>
            {announcement.link?.url && (
                <a className="platform-announcement__link" href={announcement.link.url} target="_blank" rel="noopener noreferrer">
                    {announcement.link.label?.[lang] || announcement.link.label?.en}
                </a>
            )}
            {announcement.dismissible && (
                <button
                    type="button"
                    className="platform-announcement__close"
                    aria-label={lang === 'de' ? 'Hinweis schließen' : 'Dismiss'}
                    onClick={() => { localStorage.setItem(DISMISS_KEY, announcement.id); setDismissed(announcement.id); }}
                >
                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
            )}
        </div>
    );
};
