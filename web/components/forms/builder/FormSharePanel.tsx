import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { Button } from '../../common/Button/Button';
import { ConfirmModal } from '../../common/Modal/ConfirmModal';
import MemberSelection from '../../common/MemberSelection/MemberSelection';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from '../../../context/UIContext';
import { regenerateFormLink, setFormEditors, setFormStatus } from '../../../services/domain/formsService';
import type { FormDoc } from '../../../types/forms';
import type { Member } from '../../../types';
import { formErrorText } from './formErrors';

interface FormSharePanelProps {
    tenantId: string;
    form: FormDoc;
    members: Member[];
    canManageEditors: boolean;
    currentUid: string;
    legalComplete: boolean;
    onOpenLegal: () => void;
}

const formLink = (token: string) => `${window.location.origin}/f/${token}`;

const embedSnippet = (token: string, title: string) => {
    const src = `${formLink(token)}?embed=1`;
    const safeTitle = title.replace(/"/g, '&quot;');
    return `<iframe src="${src}" title="${safeTitle}" style="width:100%;border:0;min-height:640px" loading="lazy"></iframe>
<script>window.addEventListener('message',function(e){if(e.data&&e.data.type==='pf-form-height'){document.querySelectorAll('iframe[src^="${formLink(token)}"]').forEach(function(f){if(f.contentWindow===e.source)f.style.height=e.data.height+'px';});}});</script>`;
};

/** Share mode: link, QR code, embed snippet, status and editors (STYLING §6.2: publishing lives here). */
export const FormSharePanel: React.FC<FormSharePanelProps> = ({ tenantId, form, members, canManageEditors, currentUid, legalComplete, onOpenLegal }) => {
    const { t } = useLanguage();
    const { showSuccess, showError } = useToast();
    const [qr, setQr] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [confirmRegenerate, setConfirmRegenerate] = useState(false);
    const token = form.shareToken;
    const published = form.publishedVersion !== null && form.publishedVersion !== undefined && !!token;

    useEffect(() => {
        if (!token) { setQr(null); return; }
        QRCode.toDataURL(formLink(token), { margin: 1, width: 360 }).then(setQr).catch(() => setQr(null));
    }, [token]);

    const copy = async (text: string, message: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showSuccess(message);
        } catch {
            showError(t('forms.share.copyFailed'));
        }
    };

    const run = async (key: string, action: () => Promise<unknown>) => {
        setBusy(key);
        try { await action(); } catch (error) { showError(formErrorText(t, error)); } finally { setBusy(null); }
    };

    const fullMembers = members.filter((member) => String(member.role) !== 'Guest' && member.uid !== form.ownerId);

    return (
        <div className="form-share">
            {form.audience === 'public' && !legalComplete && (
                <div className="form-builder__notice">
                    <span className="material-symbols-outlined" aria-hidden="true">gavel</span>
                    <span>{t('forms.share.legalMissing')}</span>
                    <Button variant="secondary" size="sm" onClick={onOpenLegal}>{t('forms.share.openLegal')}</Button>
                </div>
            )}

            {!published ? (
                <p className="form-builder__muted">{t('forms.share.notPublished')}</p>
            ) : (
                <>
                    <section className="form-share__group">
                        <h3>{t('forms.share.link')}</h3>
                        <div className="form-share__link">
                            <input className="form-builder__input" readOnly value={formLink(token!)} onFocus={(event) => event.target.select()} aria-label={t('forms.share.link')} />
                            <Button variant="secondary" icon={<span className="material-symbols-outlined">content_copy</span>}
                                onClick={() => void copy(formLink(token!), t('forms.share.copied'))}>
                                {t('forms.share.copy')}
                            </Button>
                            <Button variant="ghost" icon={<span className="material-symbols-outlined">open_in_new</span>}
                                onClick={() => window.open(formLink(token!), '_blank', 'noopener,noreferrer')}>
                                {t('forms.share.open')}
                            </Button>
                        </div>
                        {form.audience === 'workspace' && <p className="form-builder__muted">{t('forms.share.workspaceHint')}</p>}
                    </section>

                    <div className="form-share__columns">
                        <section className="form-share__group">
                            <h3>{t('forms.share.qr')}</h3>
                            {qr && (
                                <>
                                    <img className="form-share__qr" src={qr} alt={t('forms.share.qrAlt')} />
                                    <a className="form-share__download" href={qr} download={`${(form.title || 'form').replace(/[^\w-]+/g, '-')}-qr.png`}>{t('forms.share.downloadQr')}</a>
                                </>
                            )}
                        </section>
                        <section className="form-share__group">
                            <h3>{t('forms.share.embed')}</h3>
                            <pre className="form-share__code">{embedSnippet(token!, form.title)}</pre>
                            <Button variant="secondary" size="sm" icon={<span className="material-symbols-outlined">code</span>}
                                onClick={() => void copy(embedSnippet(token!, form.title), t('forms.share.embedCopied'))}>
                                {t('forms.share.copyEmbed')}
                            </Button>
                        </section>
                    </div>

                    <section className="form-share__group">
                        <h3>{t('forms.share.status')}</h3>
                        <p className="form-builder__muted">{t(`forms.share.statusHint.${form.status}`)}</p>
                        <div className="form-share__actions">
                            {form.status === 'published' && (
                                <Button variant="secondary" isLoading={busy === 'pause'} onClick={() => void run('pause', () => setFormStatus(tenantId, form.id, 'paused'))}>
                                    {t('forms.share.pause')}
                                </Button>
                            )}
                            {(form.status === 'paused' || form.status === 'closed') && (
                                <Button variant="secondary" isLoading={busy === 'resume'} onClick={() => void run('resume', () => setFormStatus(tenantId, form.id, 'published'))}>
                                    {t('forms.share.resume')}
                                </Button>
                            )}
                            {form.status !== 'closed' && (
                                <Button variant="ghost" isLoading={busy === 'close'} onClick={() => void run('close', () => setFormStatus(tenantId, form.id, 'closed'))}>
                                    {t('forms.share.close')}
                                </Button>
                            )}
                            <Button variant="ghost" isLoading={busy === 'regenerate'} onClick={() => setConfirmRegenerate(true)}>
                                {t('forms.share.regenerate')}
                            </Button>
                        </div>
                    </section>
                </>
            )}

            <section className="form-share__group">
                <h3>{t('forms.share.editors')}</h3>
                <p className="form-builder__muted">{t('forms.share.editorsHint')}</p>
                {canManageEditors ? (
                    <MemberSelection
                        members={fullMembers.map((member) => ({ uid: member.uid, displayName: member.displayName || member.email || '', email: member.email || '', photoURL: member.photoURL, role: String(member.role) }))}
                        selectedIds={form.editorIds}
                        onToggle={(uid) => void run('editors', () => setFormEditors(tenantId, form.id,
                            form.editorIds.includes(uid) ? form.editorIds.filter((id) => id !== uid) : [...form.editorIds, uid]))}
                        ariaLabel={t('forms.share.editors')}
                    />
                ) : (
                    <p className="form-builder__muted">{t('forms.share.editorsOwnerOnly')}</p>
                )}
                {form.ownerId !== currentUid && <p className="form-builder__muted">{t('forms.share.ownerIs').replace('{name}', members.find((member) => member.uid === form.ownerId)?.displayName || '—')}</p>}
            </section>

            <ConfirmModal
                isOpen={confirmRegenerate}
                onClose={() => setConfirmRegenerate(false)}
                onConfirm={() => { setConfirmRegenerate(false); void run('regenerate', () => regenerateFormLink(tenantId, form.id)); }}
                title={t('forms.share.regenerate')}
                message={t('forms.share.regenerateConfirm')}
                confirmLabel={t('forms.share.regenerate')}
                variant="danger"
            />
        </div>
    );
};
