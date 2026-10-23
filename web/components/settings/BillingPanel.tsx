import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';

import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { useEntitlements } from '../../hooks/useEntitlements';
import { resetOwnAiKeyCheck } from '../../hooks/useAiAccess';
import { auth, db } from '../../services/firebase';
import {
    billingErrorKey, createBillingCheckout, createBillingPortal, personalAiKey, type PersonalAiKeyStatus, setAiAddonMembers,
} from '../../services/billingService';
import {
    AI_ADDON_PRICE, type BillingInterval, FREE_PROJECT_LIMIT, TEAM_MEMBER_LIMIT, TEAM_PRICE, daysLeft, isCheckoutAvailable,
} from '../../utils/billingPlans';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';

type BillingPanelProps = {
    tenantId: string;
    role?: string;
};

/** Settings → Billing: plan, trial/grace state, Stripe Checkout + Customer Portal, own OpenAI key on Free. */
export const BillingPanel: React.FC<BillingPanelProps> = ({ tenantId, role }) => {
    const { t, language } = useLanguage();
    const { showError, showSuccess } = useToast();
    const ent = useEntitlements(tenantId);
    const [searchParams] = useSearchParams();
    const [interval, setBillingInterval] = useState<BillingInterval>('year');
    const [busy, setBusy] = useState<'checkout' | 'portal' | 'key' | 'ai' | null>(null);
    const [members, setMembers] = useState<{ uid: string; name: string }[]>([]);
    const [aiSelection, setAiSelection] = useState<string[] | null>(null);
    const uid = auth.currentUser?.uid || null;
    const [keyStatus, setKeyStatus] = useState<PersonalAiKeyStatus | null>(null);
    const [keyInput, setKeyInput] = useState('');
    const isOwner = role === 'Owner';
    const checkoutResult = searchParams.get('checkout');
    const checkoutAvailable = isCheckoutAvailable();

    const needsOwnKey = Boolean(ent && !ent.aiEnabledFor(uid));
    useEffect(() => {
        if (!needsOwnKey) return;
        personalAiKey('get').then(setKeyStatus).catch(() => setKeyStatus(null));
    }, [needsOwnKey]);

    // Full members for the AI add-on assignment (guests cannot get it).
    const showAiAssign = Boolean(ent?.aiAddonAvailable && ent.hasSubscription && isOwner);
    useEffect(() => {
        if (!showAiAssign) return;
        getDocs(collection(db, 'tenants', tenantId, 'members'))
            .then((snap) => setMembers(snap.docs
                .filter((doc) => String(doc.data().role || 'Member') !== 'Guest')
                .map((doc) => ({ uid: doc.id, name: String(doc.data().displayName || doc.data().email || doc.id) }))
                .sort((a, b) => a.name.localeCompare(b.name))))
            .catch(() => setMembers([]));
    }, [showAiAssign, tenantId]);

    const formatDate = (date: Date | null) =>
        date ? date.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    const fail = (error: unknown) => {
        const key = billingErrorKey(error);
        showError(key ? t(key) : String((error as Error)?.message || t('billing.errors.generic')));
    };

    const redirect = async (kind: 'checkout' | 'portal') => {
        setBusy(kind);
        try {
            const url = kind === 'checkout'
                ? await createBillingCheckout(tenantId, interval, language)
                : await createBillingPortal(tenantId, language);
            window.location.assign(url);
        } catch (error) {
            fail(error);
            setBusy(null);
        }
    };

    const selectedAi = aiSelection ?? ent?.aiMemberIds ?? [];
    const toggleAi = (memberUid: string) => setAiSelection(
        selectedAi.includes(memberUid) ? selectedAi.filter((id) => id !== memberUid) : [...selectedAi, memberUid]);
    const saveAi = async () => {
        setBusy('ai');
        try {
            await setAiAddonMembers(tenantId, selectedAi);
            setAiSelection(null);
            showSuccess(t('billing.aiAddon.saved'));
        } catch (error) {
            fail(error);
        } finally {
            setBusy(null);
        }
    };

    const saveKey = async (action: 'set' | 'clear') => {
        setBusy('key');
        try {
            setKeyStatus(await personalAiKey(action, action === 'set' ? keyInput : undefined));
            resetOwnAiKeyCheck();
            setKeyInput('');
            showSuccess(t(action === 'set' ? 'billing.ownKey.saved' : 'billing.ownKey.removed'));
        } catch (error) {
            fail(error);
        } finally {
            setBusy(null);
        }
    };

    if (!ent) return <div className="billing-settings"><p className="billing-settings__muted">{t('billing.loading')}</p></div>;

    const planName = t(`billing.plan.${ent.plan}`);
    const statusLine = (() => {
        switch (ent.status) {
            case 'trialing':
                return ent.hasSubscription
                    ? t('billing.status.trialSubscribed').replace('{date}', formatDate(ent.trialEndsAt))
                    : t('billing.status.trialing').replace('{days}', String(daysLeft(ent.trialEndsAt) ?? 0));
            case 'grace':
                return ent.graceEndsAt
                    ? t('billing.status.graceUntil').replace('{date}', formatDate(ent.graceEndsAt))
                    : t('billing.status.grace');
            case 'active':
                return t(ent.cancelAtPeriodEnd ? 'billing.status.cancelling' : 'billing.status.active')
                    .replace('{seats}', String(ent.seats))
                    .replace('{interval}', t(`billing.interval.${ent.billingInterval || 'year'}`))
                    .replace('{date}', formatDate(ent.currentPeriodEnd));
            case 'past_due':
                return t('billing.status.pastDue');
            default:
                return t('billing.status.free');
        }
    })();
    const canSubscribe = !ent.hasSubscription && ent.plan !== 'organization';

    return (
        <div className="billing-settings">
            {checkoutResult === 'success' && <p className="billing-settings__banner billing-settings__banner--success">{t('billing.checkout.success')}</p>}
            {checkoutResult === 'cancel' && <p className="billing-settings__banner">{t('billing.checkout.cancel')}</p>}
            {ent.status === 'past_due' && <p className="billing-settings__banner billing-settings__banner--warning">{t('billing.pastDueBanner')}</p>}
            {ent.lockedProjectIds.length > 0 && (
                <p className="billing-settings__banner billing-settings__banner--warning">
                    {t('billing.lockedBanner').replace('{count}', String(ent.lockedProjectIds.length))}
                </p>
            )}

            <section className="billing-settings__card">
                <header className="billing-settings__head">
                    <div>
                        <span className="billing-settings__eyebrow">{t('billing.currentPlan')}</span>
                        <h3>{planName}</h3>
                        <p>{statusLine}</p>
                    </div>
                    <span className={`billing-settings__badge billing-settings__badge--${ent.status}`}>{t(`billing.badge.${ent.status}`)}</span>
                </header>
                <ul className="billing-settings__facts">
                    <li>
                        <span className="material-symbols-outlined" aria-hidden="true">folder</span>
                        {ent.projectLimit === null
                            ? t('billing.facts.projectsUnlimited')
                            : t('billing.facts.projects').replace('{count}', String(ent.projectCount)).replace('{limit}', String(ent.projectLimit))}
                    </li>
                    <li>
                        <span className="material-symbols-outlined" aria-hidden="true">group</span>
                        {ent.plan === 'free' ? t('billing.facts.membersFree') : t('billing.facts.members').replace('{limit}', String(ent.memberLimit ?? '∞'))}
                    </li>
                    <li>
                        <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                        {ent.plan === 'free'
                            ? t('billing.facts.aiOwnKey')
                            : ent.aiIncluded
                                ? t('billing.facts.aiTrial')
                                : t('billing.facts.aiAddon').replace('{count}', String(ent.aiAddonSeats))}
                    </li>
                </ul>
                {ent.hasSubscription && (
                    <div className="billing-settings__actions">
                        {isOwner
                            ? <Button variant="secondary" onClick={() => void redirect('portal')} isLoading={busy === 'portal'}>{t('billing.manage')}</Button>
                            : <p className="billing-settings__muted">{t('billing.ownerOnly')}</p>}
                    </div>
                )}
            </section>

            {canSubscribe && (
                <section className="billing-settings__card">
                    <header className="billing-settings__head">
                        <div>
                            <h3>{t('billing.upgrade.title')}</h3>
                            <p>{t('billing.upgrade.subtitle').replace('{limit}', String(TEAM_MEMBER_LIMIT))}</p>
                        </div>
                    </header>
                    <div className="billing-settings__intervals" role="radiogroup" aria-label={t('billing.upgrade.interval')}>
                        {(['year', 'month'] as BillingInterval[]).map((option) => (
                            <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={interval === option}
                                className={`billing-settings__interval${interval === option ? ' is-active' : ''}`}
                                onClick={() => setBillingInterval(option)}
                            >
                                <strong>{TEAM_PRICE[option]} €</strong>
                                <span>{t(`billing.upgrade.per.${option}`)}</span>
                                {option === 'year' && <em>{t('billing.upgrade.save')}</em>}
                            </button>
                        ))}
                    </div>
                    <ul className="billing-settings__facts">
                        <li><span className="material-symbols-outlined" aria-hidden="true">check</span>{t('billing.upgrade.f1')}</li>
                        <li><span className="material-symbols-outlined" aria-hidden="true">check</span>{t('billing.upgrade.f2')}</li>
                        <li><span className="material-symbols-outlined" aria-hidden="true">check</span>{t('billing.upgrade.f3')}</li>
                    </ul>
                    <p className="billing-settings__muted">
                        {ent.status === 'trialing' ? t('billing.upgrade.trialNote') : t('billing.upgrade.note')}
                    </p>
                    <div className="billing-settings__actions">
                        {!isOwner ? (
                            <p className="billing-settings__muted">{t('billing.ownerOnly')}</p>
                        ) : checkoutAvailable ? (
                            <Button onClick={() => void redirect('checkout')} isLoading={busy === 'checkout'}>{t('billing.upgrade.cta')}</Button>
                        ) : (
                            <>
                                <Button disabled>{t('billing.upgrade.comingSoon')}</Button>
                                <p className="billing-settings__muted">{t('billing.upgrade.comingSoonNote')}</p>
                            </>
                        )}
                    </div>
                </section>
            )}

            {ent.aiAddonAvailable && (
                <section className="billing-settings__card">
                    <header className="billing-settings__head">
                        <div>
                            <h3>{t('billing.aiAddon.title')}</h3>
                            <p>{t('billing.aiAddon.subtitle').replace('{price}', String(AI_ADDON_PRICE))}</p>
                        </div>
                    </header>
                    {ent.aiIncluded && <p className="billing-settings__muted">{t('billing.aiAddon.trialNote')}</p>}
                    {!ent.hasSubscription && <p className="billing-settings__muted">{t('billing.aiAddon.needsSubscription')}</p>}
                    {ent.hasSubscription && !isOwner && <p className="billing-settings__muted">{t('billing.ownerOnly')}</p>}
                    {showAiAssign && (
                        <>
                            <ul className="billing-settings__members">
                                {members.map((member) => (
                                    <li key={member.uid}>
                                        <Checkbox
                                            checked={selectedAi.includes(member.uid)}
                                            onChange={() => toggleAi(member.uid)}
                                            label={member.name}
                                        />
                                    </li>
                                ))}
                            </ul>
                            <div className="billing-settings__actions">
                                <span className="billing-settings__muted">
                                    {t('billing.aiAddon.total')
                                        .replace('{count}', String(selectedAi.length))
                                        .replace('{amount}', String(selectedAi.length * AI_ADDON_PRICE))}
                                </span>
                                <Button onClick={() => void saveAi()} disabled={aiSelection === null} isLoading={busy === 'ai'}>
                                    {t('billing.aiAddon.save')}
                                </Button>
                            </div>
                        </>
                    )}
                </section>
            )}

            {needsOwnKey && (
                <section className="billing-settings__card">
                    <header className="billing-settings__head">
                        <div>
                            <h3>{t('billing.ownKey.title')}</h3>
                            <p>{t('billing.ownKey.subtitle')}</p>
                        </div>
                    </header>
                    {keyStatus?.hasKey ? (
                        <div className="billing-settings__actions">
                            <span className="billing-settings__muted">{t('billing.ownKey.active').replace('{last4}', keyStatus.last4 || '')}</span>
                            <Button variant="ghost" size="sm" onClick={() => void saveKey('clear')} isLoading={busy === 'key'}>{t('billing.ownKey.remove')}</Button>
                        </div>
                    ) : (
                        <div className="billing-settings__key">
                            <Input
                                type="password"
                                autoComplete="off"
                                value={keyInput}
                                placeholder="sk-…"
                                aria-label={t('billing.ownKey.title')}
                                onChange={(event) => setKeyInput(event.target.value)}
                            />
                            <Button onClick={() => void saveKey('set')} disabled={!keyInput.trim()} isLoading={busy === 'key'}>{t('billing.ownKey.save')}</Button>
                        </div>
                    )}
                </section>
            )}

            <p className="billing-settings__muted">{t('billing.footnote').replace('{limit}', String(FREE_PROJECT_LIMIT))}</p>
        </div>
    );
};
