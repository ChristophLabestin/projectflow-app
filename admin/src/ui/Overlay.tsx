import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/** Stack of open overlays, so Escape and the global shortcuts only act on the top-most one. */
const overlayStack: symbol[] = [];
export const overlayOpen = () => overlayStack.length > 0;

const useOverlayLayer = (onClose: () => void) => {
    const id = useRef(Symbol('overlay'));
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const me = id.current;
        overlayStack.push(me);
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && overlayStack[overlayStack.length - 1] === me) {
                event.preventDefault();
                close.current();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            const index = overlayStack.indexOf(me);
            if (index >= 0) overlayStack.splice(index, 1);
        };
    }, []);
};

export const Drawer: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; actions?: React.ReactNode; footer?: React.ReactNode; wide?: boolean; children: React.ReactNode }> = ({ title, subtitle, onClose, actions, footer, wide, children }) => {
    useOverlayLayer(onClose);
    return createPortal(
        <>
            <div className="ac-overlay" onClick={onClose} />
            <aside className={`ac-drawer ${wide ? 'ac-drawer--wide' : ''}`} role="dialog" aria-modal="true">
                <header className="ac-drawer__head">
                    <div>
                        <h2>{title}</h2>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    {actions}
                    <button className="ac-btn ac-btn--ghost ac-btn--icon ac-btn--sm" onClick={onClose} aria-label="Schließen"><X size={16} /></button>
                </header>
                <div className="ac-drawer__body">{children}</div>
                {footer && <footer className="ac-drawer__foot">{footer}</footer>}
            </aside>
        </>,
        document.body
    );
};

type ConfirmOptions = { title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; requireText?: string };
type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; text: string };

const UiContext = createContext<{ confirm: (options: ConfirmOptions) => Promise<boolean>; toast: (text: string, kind?: ToastKind) => void } | null>(null);

export const useUi = () => {
    const ctx = useContext(UiContext);
    if (!ctx) throw new Error('UiProvider missing');
    return ctx;
};

const ConfirmDialog: React.FC<ConfirmOptions & { onResult: (ok: boolean) => void }> = ({ title, message, confirmLabel, danger, requireText, onResult }) => {
    const [typed, setTyped] = useState('');
    useOverlayLayer(() => onResult(false));
    const blocked = Boolean(requireText) && typed.trim() !== requireText;
    return createPortal(
        <>
            <div className="ac-overlay ac-overlay--dialog" onClick={() => onResult(false)} />
            <div className="ac-dialog" role="alertdialog" aria-modal="true">
                <form onSubmit={(event) => { event.preventDefault(); if (!blocked) onResult(true); }}>
                    <div className="ac-dialog__body">
                        <h3>{title}</h3>
                        <p>{message}</p>
                        {requireText && (
                            <label className="ac-field">
                                <span>Zur Bestätigung <code>{requireText}</code> eingeben</span>
                                <input className="ac-input" autoFocus value={typed} onChange={(event) => setTyped(event.target.value)} />
                            </label>
                        )}
                    </div>
                    <div className="ac-dialog__foot">
                        <button type="button" className="ac-btn" onClick={() => onResult(false)}>Abbrechen</button>
                        <button type="submit" autoFocus={!requireText} disabled={blocked} className={`ac-btn ${danger ? 'ac-btn--danger-solid' : 'ac-btn--primary'}`}>{confirmLabel || 'Bestätigen'}</button>
                    </div>
                </form>
            </div>
        </>,
        document.body
    );
};

export const UiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const seq = useRef(0);

    const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })), []);
    const toast = useCallback((text: string, kind: ToastKind = 'success') => {
        const id = ++seq.current;
        setToasts((list) => [...list.slice(-3), { id, kind, text }]);
        setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), kind === 'error' ? 7000 : 3500);
    }, []);

    return (
        <UiContext.Provider value={{ confirm, toast }}>
            {children}
            {pending && <ConfirmDialog {...pending} onResult={(ok) => { pending.resolve(ok); setPending(null); }} />}
            {createPortal(
                <div className="ac-toasts" aria-live="polite">
                    {toasts.map((item) => (
                        <div key={item.id} className={`ac-toast ac-toast--${item.kind}`}>
                            {item.kind === 'error' ? <AlertTriangle size={16} /> : item.kind === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
                            <span>{item.text}</span>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </UiContext.Provider>
    );
};
