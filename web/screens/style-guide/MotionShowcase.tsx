import { useRef, useState } from 'react';
import { Button } from '../../components/common/Button/Button';
import { AnimatedNumber, useFlipList, usePresence, useSlidingIndicator } from '../../components/motion';
import { useLanguage } from '../../context/LanguageContext';
import './motion-showcase.scss';

const SEGMENTS = ['list', 'board', 'calendar'] as const;

/** /ui "Motion" section: one live example per primitive of the motion system. */
export const MotionShowcase = () => {
    const { t } = useLanguage();
    const [items, setItems] = useState([1, 2, 3, 4]);
    const [nextId, setNextId] = useState(5);
    const [open, setOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [count, setCount] = useState(128);
    const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('list');
    const [staggerKey, setStaggerKey] = useState(0);
    const listRef = useRef<HTMLUListElement>(null);
    const segmentsRef = useRef<HTMLDivElement>(null);
    const presence = usePresence(open);
    const indicator = useSlidingIndicator(segmentsRef, segment);
    useFlipList(listRef);

    return (
        <div className="motion-showcase">
            <div className="motion-showcase__tile">
                <h3>{t('styleGuide.motion.list')}</h3>
                <ul ref={listRef} className="motion-showcase__list">
                    {items.map((id) => (
                        <li key={id} data-flip-key={id} className="motion-showcase__item">
                            {t('styleGuide.motion.item').replace('{n}', String(id))}
                            <button type="button" onClick={() => setItems((list) => list.filter((value) => value !== id))}>
                                <span className="material-symbols-outlined" aria-hidden="true">check</span>
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="motion-showcase__actions">
                    <Button size="sm" variant="secondary" onClick={() => { setItems((list) => [nextId, ...list]); setNextId(nextId + 1); }}>{t('styleGuide.motion.add')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setItems((list) => [...list].reverse())}>{t('styleGuide.motion.shuffle')}</Button>
                </div>
            </div>

            <div className="motion-showcase__tile">
                <h3>{t('styleGuide.motion.presence')}</h3>
                <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>{t('styleGuide.motion.toggle')}</Button>
                <div className="motion-showcase__stage">
                    {presence.mounted && (
                        <div className={`motion-showcase__popover ${presence.exiting ? 'motion-exit-pop' : 'motion-drop-in'}`}>
                            {t('styleGuide.motion.popover')}
                        </div>
                    )}
                </div>
            </div>

            <div className="motion-showcase__tile">
                <h3>{t('styleGuide.motion.collapse')}</h3>
                <Button size="sm" variant="secondary" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{t('styleGuide.motion.toggle')}</Button>
                <div className="motion-collapse" data-open={expanded}>
                    <div><p className="motion-showcase__copy">{t('styleGuide.motion.collapseBody')}</p></div>
                </div>
            </div>

            <div className="motion-showcase__tile">
                <h3>{t('styleGuide.motion.segments')}</h3>
                <div ref={segmentsRef} className="motion-showcase__segments" role="tablist">
                    <span className="motion-indicator motion-showcase__indicator" style={indicator} aria-hidden="true" />
                    {SEGMENTS.map((value) => (
                        <button key={value} type="button" role="tab" aria-selected={segment === value} onClick={() => setSegment(value)}>
                            {t(`styleGuide.motion.segment.${value}`)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="motion-showcase__tile">
                <h3>{t('styleGuide.motion.number')}</h3>
                <p className="motion-showcase__number"><AnimatedNumber value={count} /></p>
                <div className="motion-showcase__actions">
                    <Button size="sm" variant="secondary" onClick={() => setCount(count + 17)}>+17</Button>
                    <Button size="sm" variant="ghost" onClick={() => setCount(Math.max(0, count - 40))}>−40</Button>
                </div>
            </div>

            <div className="motion-showcase__tile">
                <h3>{t('styleGuide.motion.stagger')}</h3>
                <div key={staggerKey} className="motion-stagger motion-showcase__chips">
                    {[1, 2, 3, 4, 5, 6].map((value) => <span key={value} className="motion-showcase__chip" />)}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setStaggerKey(staggerKey + 1)}>{t('styleGuide.motion.replay')}</Button>
            </div>
        </div>
    );
};
