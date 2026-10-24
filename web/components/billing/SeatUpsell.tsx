import React, { useEffect, useState } from 'react';

import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { changeSeats, formatMoney, planErrorMessage, previewSeatChange } from '../../services/billingService';
import { Button } from '../ui/Button';

type SeatUpsellProps = {
    tenantId: string;
    seats: number;
    isOwner: boolean;
    onAdded?: () => void;
};

/**
 * Invite dialog, all paid seats taken: the owner can buy one more seat (prorated price shown, explicit
 * confirmation); everyone else is asked to contact the owner. Never buys seats automatically.
 */
export const SeatUpsell: React.FC<SeatUpsellProps> = ({ tenantId, seats, isOwner, onAdded }) => {
    const { t, language } = useLanguage();
    const { showError, showSuccess } = useToast();
    const [amountToday, setAmountToday] = useState<{ cents: number; currency: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!isOwner) return;
        previewSeatChange({ tenantId, seats: seats + 1 })
            .then((preview) => setAmountToday({ cents: preview.amountToday, currency: preview.currency }))
            .catch(() => setAmountToday(null));
    }, [isOwner, tenantId, seats]);

    if (!isOwner) return <div className="seat-upsell">{t('billing.seats.askOwner')}</div>;

    const buy = async () => {
        setBusy(true);
        try {
            const result = await changeSeats({ tenantId, seats: seats + 1 });
            if (result.status === 'applied') {
                showSuccess(t('billing.seats.applied').replace('{amount}', formatMoney(result.amountPaid, amountToday?.currency || 'eur', language)));
                onAdded?.();
            } else if (result.status === 'payment-required') {
                setPaymentUrl(result.hostedInvoiceUrl);
                showError(t('billing.seats.paymentRequired'));
            }
        } catch (error) {
            showError(planErrorMessage(error, t) || t('billing.errors.generic'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="seat-upsell">
            <span>{t('billing.seats.full').replace('{seats}', String(seats))}</span>
            <div className="seat-upsell__actions">
                <Button size="sm" onClick={() => void buy()} isLoading={busy} disabled={!amountToday}>
                    {amountToday
                        ? t('billing.seats.buyOne').replace('{amount}', formatMoney(amountToday.cents, amountToday.currency, language))
                        : t('billing.seats.buyOneLoading')}
                </Button>
                {paymentUrl && <a href={paymentUrl} target="_blank" rel="noreferrer">{t('billing.seats.payInvoice')}</a>}
            </div>
        </div>
    );
};
