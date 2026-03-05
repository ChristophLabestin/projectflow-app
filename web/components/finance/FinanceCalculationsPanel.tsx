import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../common/Card/Card';
import { Button } from '../common/Button/Button';
import { Modal } from '../common/Modal/Modal';
import { TextInput } from '../common/Input/TextInput';
import { TextArea } from '../common/Input/TextArea';
import { Select, type SelectOption } from '../common/Select/Select';
import {
    createFinanceScenario,
    deleteFinanceScenario,
    subscribeFinanceScenarios,
    updateFinanceScenario,
} from '../../services/financeScenarioService';
import type { FinanceCostItem, FinanceScenario, FinanceScenarioPreset, Project } from '../../types';
import {
    calculateFinanceScenarioResult,
    createEmptyFinanceCostItem,
    resolveFinanceCostItemAmount,
    resolveFinanceCostItemTokens,
    sanitizeFinanceCostItems,
} from '../../utils/finance-calculations';
import { toDate } from '../../utils/time';

interface FinanceCalculationsPanelProps {
    tenantId: string | null;
    canManage: boolean;
    projects: Project[];
    formatCurrency: (value: number) => string;
    t: (key: string, fallback?: string) => any;
    showError: (message: string, detail?: string) => void;
    showSuccess: (message: string) => void;
    confirm: (title: string, message: string) => Promise<boolean>;
    locale: string;
}

interface DraftCostItem {
    id: string;
    label: string;
    amount: string;
    quantityPerUnit: string;
    unitCost: string;
    tokensPerUsage: string;
}

interface ScenarioDraft {
    projectId: string;
    name: string;
    preset: FinanceScenarioPreset;
    period: 'monthly';
    unitLabel: string;
    plannedUnits: string;
    pricePerUnit: string;
    tokenQuotaPerUnit: string;
    discountPercent: string;
    salesCommissionPercent: string;
    targetProfitPercentOnCost: string;
    fixedCostItems: DraftCostItem[];
    variableCostItemsPerUnit: DraftCostItem[];
    notes: string;
}

type CostMode = 'fixedCostItems' | 'variableCostItemsPerUnit';

type ScenarioPayload = Omit<FinanceScenario, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>;

const DECIMAL_INPUT_REGEX = /^(\d+([.,]\d*)?|[.,]\d*|)$/;
const INTEGER_TOKEN_INPUT_REGEX = /^[\d.,\s]*$/;

const isDecimalInput = (value: string) => DECIMAL_INPUT_REGEX.test(value);

const normalizeDecimal = (value: string) => value.replace(',', '.').trim();

const toPositiveNumber = (value: unknown) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value >= 0 ? value : 0;
    }

    const normalized = normalizeDecimal(String(value ?? ''));
    if (!normalized) return 0;

    const num = Number(normalized);
    return Number.isFinite(num) && num >= 0 ? num : 0;
};

const toPositiveIntegerNumber = (value: unknown) => {
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value < 0) return 0;
        return Math.floor(value);
    }

    const digitsOnly = String(value ?? '').replace(/[^\d]/g, '');
    if (!digitsOnly) return 0;

    const num = Number(digitsOnly);
    return Number.isFinite(num) && num >= 0 ? num : 0;
};

const toInputString = (value: unknown, emptyWhenZero = false) => {
    const normalized = toPositiveNumber(value);
    if (emptyWhenZero && normalized === 0) return '';
    return String(normalized);
};

const toDraftCostItem = (item?: Partial<FinanceCostItem>): DraftCostItem => {
    const fallback = createEmptyFinanceCostItem();

    return {
        id: item?.id || fallback.id,
        label: item?.label || '',
        amount: toInputString(item?.amount ?? 0),
        quantityPerUnit: toInputString(item?.quantityPerUnit ?? 0, true),
        unitCost: toInputString(item?.unitCost ?? 0, true),
        tokensPerUsage: toInputString(item?.tokensPerUsage ?? 0, true),
    };
};

const toFinanceCostItem = (item: DraftCostItem): FinanceCostItem => ({
    id: item.id,
    label: item.label,
    amount: toPositiveNumber(item.amount),
    quantityPerUnit: toPositiveNumber(item.quantityPerUnit),
    unitCost: toPositiveNumber(item.unitCost),
    tokensPerUsage: toPositiveIntegerNumber(item.tokensPerUsage),
});

const buildDraftFromScenario = (scenario: FinanceScenario): ScenarioDraft => ({
    projectId: scenario.projectId || '',
    name: scenario.name || '',
    preset: scenario.preset || 'software',
    period: 'monthly',
    unitLabel: scenario.unitLabel || 'User',
    plannedUnits: toInputString(scenario.plannedUnits),
    pricePerUnit: toInputString(scenario.pricePerUnit),
    tokenQuotaPerUnit: toInputString(scenario.tokenQuotaPerUnit ?? 0, true),
    discountPercent: toInputString(scenario.discountPercent ?? 0),
    salesCommissionPercent: toInputString(scenario.salesCommissionPercent ?? 0),
    targetProfitPercentOnCost: toInputString(scenario.targetProfitPercentOnCost),
    fixedCostItems: (scenario.fixedCostItems || []).map((item) => toDraftCostItem(item)),
    variableCostItemsPerUnit: (scenario.variableCostItemsPerUnit || []).map((item) => toDraftCostItem(item)),
    notes: scenario.notes || '',
});

export const FinanceCalculationsPanel = ({
    tenantId,
    canManage,
    projects,
    formatCurrency,
    t,
    showError,
    showSuccess,
    confirm,
    locale,
}: FinanceCalculationsPanelProps) => {
    const [scenarios, setScenarios] = useState<FinanceScenario[]>([]);
    const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [scenarioSearch, setScenarioSearch] = useState('');
    const [showScenarioMenu, setShowScenarioMenu] = useState(false);
    const [activeDetailInfoId, setActiveDetailInfoId] = useState<string | null>(null);

    const createScenarioDraft = React.useCallback((): ScenarioDraft => ({
        projectId: '',
        name: '',
        preset: 'software',
        period: 'monthly',
        unitLabel: 'User',
        plannedUnits: '100',
        pricePerUnit: '0',
        tokenQuotaPerUnit: '',
        discountPercent: '0',
        salesCommissionPercent: '0',
        targetProfitPercentOnCost: '20',
        fixedCostItems: [
            toDraftCostItem({ label: t('finance.calc.presets.software.fixed1'), amount: 0 }),
            toDraftCostItem({ label: t('finance.calc.presets.software.fixed2'), amount: 0 }),
        ],
        variableCostItemsPerUnit: [
            toDraftCostItem({ label: t('finance.calc.presets.software.variable1'), amount: 0 }),
        ],
        notes: '',
    }), [t]);

    const [draft, setDraft] = useState<ScenarioDraft>(() => createScenarioDraft());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!tenantId) {
            setScenarios([]);
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeFinanceScenarios((nextScenarios) => {
            setScenarios(nextScenarios);
            setLoading(false);
        }, tenantId);

        return () => unsubscribe();
    }, [tenantId]);

    useEffect(() => {
        if (scenarios.length === 0) {
            setSelectedScenarioId(null);
            return;
        }

        if (isCreatingNew) return;

        setSelectedScenarioId((current) => {
            if (current && scenarios.some((scenario) => scenario.id === current)) return current;
            return scenarios[0].id;
        });
    }, [isCreatingNew, scenarios]);

    useEffect(() => {
        if (!selectedScenarioId) {
            setDraft(createScenarioDraft());
            return;
        }

        const selected = scenarios.find((scenario) => scenario.id === selectedScenarioId);
        if (!selected) return;

        setDraft(buildDraftFromScenario(selected));
    }, [createScenarioDraft, scenarios, selectedScenarioId]);

    const selectedScenario = useMemo(
        () => scenarios.find((scenario) => scenario.id === selectedScenarioId) || null,
        [scenarios, selectedScenarioId]
    );

    const presetOptions: SelectOption[] = [
        { value: 'software', label: t('finance.calc.preset.software') },
        { value: 'generic', label: t('finance.calc.preset.generic') },
    ];

    const projectOptions: SelectOption[] = [
        { value: '', label: t('finance.project.unassigned') },
        ...projects
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((project) => ({ value: project.id, label: project.title })),
    ];

    const projectNameLookup = useMemo(() => {
        const map = new Map<string, string>();
        projects.forEach((project) => map.set(project.id, project.title));
        return map;
    }, [projects]);

    const visibleScenarios = useMemo(() => {
        const query = scenarioSearch.trim().toLowerCase();
        if (!query) return scenarios;

        return scenarios.filter((scenario) => {
            const projectName = scenario.projectId
                ? (projectNameLookup.get(scenario.projectId) || '')
                : '';

            return (
                scenario.name.toLowerCase().includes(query) ||
                scenario.unitLabel.toLowerCase().includes(query) ||
                projectName.toLowerCase().includes(query)
            );
        });
    }, [projectNameLookup, scenarioSearch, scenarios]);

    const calculationInput = useMemo(() => ({
        plannedUnits: toPositiveNumber(draft.plannedUnits),
        pricePerUnit: toPositiveNumber(draft.pricePerUnit),
        tokenQuotaPerUnit: toPositiveIntegerNumber(draft.tokenQuotaPerUnit),
        discountPercent: toPositiveNumber(draft.discountPercent),
        salesCommissionPercent: toPositiveNumber(draft.salesCommissionPercent),
        targetProfitPercentOnCost: toPositiveNumber(draft.targetProfitPercentOnCost),
        fixedCostItems: draft.fixedCostItems.map(toFinanceCostItem),
        variableCostItemsPerUnit: draft.variableCostItemsPerUnit.map(toFinanceCostItem),
    }), [draft]);

    const result = useMemo(() => calculateFinanceScenarioResult(calculationInput), [calculationInput]);
    const formatNumber = React.useCallback((value: number, maxFractionDigits = 0) => (
        value.toLocaleString(locale, { maximumFractionDigits: maxFractionDigits })
    ), [locale]);
    const hasTokenQuota = result.tokenQuotaPerUnit > 0;
    const tokenQuotaStatusText = hasTokenQuota
        ? result.isTokenQuotaExceededPerUnit
            ? t('finance.calc.tokens.exceededPerUnit')
                .replace('{used}', formatNumber(result.tokensUsedPerUnit, 2))
                .replace('{quota}', formatNumber(result.tokenQuotaPerUnit, 2))
                .replace('{over}', formatNumber(result.tokensUsedPerUnit - result.tokenQuotaPerUnit, 2))
            : t('finance.calc.tokens.withinPerUnit')
                .replace('{used}', formatNumber(result.tokensUsedPerUnit, 2))
                .replace('{quota}', formatNumber(result.tokenQuotaPerUnit, 2))
                .replace('{remaining}', formatNumber(Math.max(0, result.tokensRemainingPerUnit), 2))
        : t('finance.calc.tokens.noQuotaSet');

    const detailedAnalysisItems = useMemo(() => ([
        {
            id: 'total-cost-unit',
            label: t('finance.calc.results.unitTitle', 'Total Cost per Unit'),
            value: formatCurrency(result.totalCostPerUnit),
            explanation: t(
                'finance.calc.explain.totalCostPerUnit',
                'Cost per unit including variable cost plus fixed-cost allocation.'
            ),
        },
        {
            id: 'net-revenue-unit',
            label: t('finance.calc.results.vvpPerUnit', 'vVP per unit'),
            value: formatCurrency(result.netRevenuePerUnit),
            explanation: t(
                'finance.calc.explain.vvpPerUnit',
                'vVP (provisional sale price) per unit after retrograde deductions.'
            ),
        },
        {
            id: 'profit-vvp-minus-sk',
            label: t('finance.calc.results.profitVvpMinusSk', 'Profit (vVP - SK)'),
            value: formatCurrency(result.netRevenuePerUnit - result.totalCostPerUnit),
            explanation: t(
                'finance.calc.explain.profitVvpMinusSk',
                'Profit per unit using the BWL shortcut: vVP minus self-cost (SK).'
            ),
        },
        {
            id: 'contribution-unit',
            label: t('finance.calc.results.contributionTitle', 'Contribution Margin p.U.'),
            value: formatCurrency(result.contributionPerUnit),
            explanation: t(
                'finance.calc.explain.contributionPerUnit',
                'Net revenue per unit minus variable cost per unit.'
            ),
        },
        {
            id: 'tokens-used-unit',
            label: t('finance.calc.results.tokensUsedPerUnit', 'Tokens used per unit'),
            value: `${formatNumber(result.tokensUsedPerUnit, 2)} tk`,
            explanation: t(
                'finance.calc.explain.tokensUsedPerUnit',
                'Estimated token usage per unit from usage-per-unit x tokens-per-usage across all variable AI items.'
            ),
        },
        {
            id: 'tokens-used-total',
            label: t('finance.calc.results.tokensUsedTotal', 'Tokens used total'),
            value: `${formatNumber(result.tokensUsedTotal, 2)} tk`,
            explanation: t(
                'finance.calc.explain.tokensUsedTotal',
                'Estimated total token usage across all planned units.'
            ),
        },
        {
            id: 'gross-revenue-total',
            label: t('finance.calc.results.revenueTotal', 'Gross Planned Revenue'),
            value: formatCurrency(result.revenueTotal),
            explanation: t(
                'finance.calc.explain.revenueTotal',
                'Total revenue before discount and commission deductions.'
            ),
        },
        {
            id: 'net-revenue-total',
            label: t('finance.calc.results.netRevenueTotal', 'Net Planned Revenue'),
            value: formatCurrency(result.netRevenueTotal),
            explanation: t(
                'finance.calc.explain.netRevenueTotal',
                'Total revenue after discount and commission deductions.'
            ),
        },
        {
            id: 'total-costs',
            label: t('finance.calc.results.totalCosts', 'Total Planned Costs'),
            value: formatCurrency(result.totalCosts),
            explanation: t(
                'finance.calc.explain.totalCosts',
                'Sum of fixed costs and all variable costs across planned units.'
            ),
        },
        {
            id: 'break-even-revenue',
            label: t('finance.calc.results.breakEvenRevenue', 'Break-Even Revenue'),
            value: result.breakEvenRevenue === null
                ? t('finance.calc.breakEven.unreachable')
                : formatCurrency(result.breakEvenRevenue),
            explanation: t(
                'finance.calc.explain.breakEvenRevenue',
                'Gross revenue needed at the current offer price to reach operating profit = 0.'
            ),
        },
        {
            id: 'token-quota-status',
            label: t('finance.calc.results.tokenQuotaPerUnit', 'Token quota per unit'),
            value: hasTokenQuota
                ? `${formatNumber(result.tokenQuotaPerUnit, 2)} tk`
                : t('finance.calc.tokens.noQuotaShort'),
            explanation: t(
                'finance.calc.explain.tokenQuotaPerUnit',
                'Configured token budget per unit (for example per user plan).'
            ),
        },
    ]), [formatCurrency, formatNumber, hasTokenQuota, result, t]);

    const retrogradePieceCostTable = useMemo(() => {
        const selfCost = result.totalCostPerUnit;
        const setOfferPrice = toPositiveNumber(draft.pricePerUnit);
        const targetProfitPercent = toPositiveNumber(draft.targetProfitPercentOnCost);
        const discountPercent = toPositiveNumber(draft.discountPercent);
        const commissionPercent = toPositiveNumber(draft.salesCommissionPercent);

        const discountFactor = 1 - (discountPercent / 100);
        const commissionFactor = 1 - (commissionPercent / 100);
        const isReachable = discountFactor > 0 && commissionFactor > 0;

        const profitMarkupAmount = selfCost * (targetProfitPercent / 100);
        const netTargetRevenue = selfCost + profitMarkupAmount;

        const priceAfterDiscountBeforeCommission = isReachable
            ? netTargetRevenue / commissionFactor
            : 0;
        const commissionAmount = Math.max(0, priceAfterDiscountBeforeCommission - netTargetRevenue);
        const targetOfferPrice = isReachable
            ? priceAfterDiscountBeforeCommission / discountFactor
            : 0;
        const discountAmount = Math.max(0, targetOfferPrice - priceAfterDiscountBeforeCommission);
        const setPriceAfterDiscountBeforeCommission = setOfferPrice * Math.max(0, discountFactor);
        const setNetRevenuePerUnit = setPriceAfterDiscountBeforeCommission * Math.max(0, commissionFactor);
        const setCommissionAmount = Math.max(0, setPriceAfterDiscountBeforeCommission - setNetRevenuePerUnit);
        const setDiscountAmount = Math.max(0, setOfferPrice - setPriceAfterDiscountBeforeCommission);
        const setProfitMarkupAmount = setNetRevenuePerUnit - selfCost;

        const shareOfOffer = (amount: number) => (
            targetOfferPrice > 0 ? (amount / targetOfferPrice) * 100 : 0
        );
        const shareOfSetOffer = (amount: number) => (
            setOfferPrice > 0 ? (amount / setOfferPrice) * 100 : 0
        );

        const rows = [
            {
                key: 'self',
                label: t('finance.calc.retro.rows.selfCost', 'Selbstkosten'),
                targetAmount: selfCost,
                rate: '—',
                targetShare: shareOfOffer(selfCost),
                setAmount: selfCost,
                setShare: shareOfSetOffer(selfCost),
            },
            {
                key: 'profit',
                label: t('finance.calc.retro.rows.profitMarkup', 'Gewinn (vVP - SK)'),
                targetAmount: profitMarkupAmount,
                rate: `${targetProfitPercent.toFixed(2)}%`,
                targetShare: shareOfOffer(profitMarkupAmount),
                setAmount: setProfitMarkupAmount,
                setShare: shareOfSetOffer(setProfitMarkupAmount),
            },
            {
                key: 'net-target',
                label: t('finance.calc.retro.rows.netTarget', 'vVP (vorläufiger Verkaufspreis)'),
                targetAmount: netTargetRevenue,
                rate: '—',
                targetShare: shareOfOffer(netTargetRevenue),
                setAmount: setNetRevenuePerUnit,
                setShare: shareOfSetOffer(setNetRevenuePerUnit),
            },
            {
                key: 'commission',
                label: t('finance.calc.retro.rows.salesCommission', 'Vertreterprovision'),
                targetAmount: commissionAmount,
                rate: `${commissionPercent.toFixed(2)}%`,
                targetShare: shareOfOffer(commissionAmount),
                setAmount: setCommissionAmount,
                setShare: shareOfSetOffer(setCommissionAmount),
            },
            {
                key: 'price-after-discount',
                label: t('finance.calc.retro.rows.priceAfterDiscount', 'Preis nach Rabatt (vor Provision)'),
                targetAmount: priceAfterDiscountBeforeCommission,
                rate: '—',
                targetShare: shareOfOffer(priceAfterDiscountBeforeCommission),
                setAmount: setPriceAfterDiscountBeforeCommission,
                setShare: shareOfSetOffer(setPriceAfterDiscountBeforeCommission),
            },
            {
                key: 'discount',
                label: t('finance.calc.retro.rows.discount', 'Rabatt'),
                targetAmount: discountAmount,
                rate: `${discountPercent.toFixed(2)}%`,
                targetShare: shareOfOffer(discountAmount),
                setAmount: setDiscountAmount,
                setShare: shareOfSetOffer(setDiscountAmount),
            },
            {
                key: 'offer',
                label: t('finance.calc.retro.rows.offerPrice', 'Angebotspreis'),
                targetAmount: targetOfferPrice,
                rate: '—',
                targetShare: targetOfferPrice > 0 ? 100 : 0,
                setAmount: setOfferPrice,
                setShare: setOfferPrice > 0 ? 100 : 0,
            },
        ];

        return { isReachable, rows };
    }, [draft.discountPercent, draft.salesCommissionPercent, draft.targetProfitPercentOnCost, result.totalCostPerUnit, t]);

    const toScenarioPayload = (source: ScenarioDraft): ScenarioPayload => ({
        projectId: source.projectId || undefined,
        name: source.name.trim(),
        preset: source.preset,
        period: 'monthly',
        unitLabel: source.unitLabel.trim(),
        plannedUnits: toPositiveNumber(source.plannedUnits),
        pricePerUnit: toPositiveNumber(source.pricePerUnit),
        tokenQuotaPerUnit: toPositiveIntegerNumber(source.tokenQuotaPerUnit),
        discountPercent: toPositiveNumber(source.discountPercent),
        salesCommissionPercent: toPositiveNumber(source.salesCommissionPercent),
        targetProfitPercentOnCost: toPositiveNumber(source.targetProfitPercentOnCost),
        fixedCostItems: sanitizeFinanceCostItems(source.fixedCostItems.map(toFinanceCostItem)),
        variableCostItemsPerUnit: sanitizeFinanceCostItems(source.variableCostItemsPerUnit.map(toFinanceCostItem)),
        notes: source.notes?.trim() || '',
    });

    const applyNumericInput = (value: string, apply: (next: string) => void) => {
        if (!isDecimalInput(value)) return;
        apply(value);
    };

    const applyTokenIntegerInput = (value: string, apply: (next: string) => void) => {
        if (!INTEGER_TOKEN_INPUT_REGEX.test(value)) return;
        apply(value.replace(/[^\d]/g, ''));
    };

    const applyPresetDefaults = (preset: FinanceScenarioPreset) => {
        if (preset === 'software') {
            setDraft((prev) => ({
                ...prev,
                preset,
                unitLabel: 'User',
                fixedCostItems: prev.fixedCostItems.length > 0
                    ? prev.fixedCostItems
                    : [
                        toDraftCostItem({ label: t('finance.calc.presets.software.fixed1'), amount: 0 }),
                        toDraftCostItem({ label: t('finance.calc.presets.software.fixed2'), amount: 0 }),
                    ],
                variableCostItemsPerUnit: prev.variableCostItemsPerUnit.length > 0
                    ? prev.variableCostItemsPerUnit
                    : [
                        toDraftCostItem({ label: t('finance.calc.presets.software.variable1'), amount: 0 }),
                    ],
            }));
            return;
        }

        setDraft((prev) => ({
            ...prev,
            preset,
            unitLabel: prev.unitLabel || t('finance.calc.presets.generic.unitFallback'),
        }));
    };

    const updateCostItem = (kind: CostMode, itemId: string, updates: Partial<DraftCostItem>) => {
        setDraft((prev) => ({
            ...prev,
            [kind]: prev[kind].map((item) => (
                item.id === itemId
                    ? { ...item, ...updates }
                    : item
            )),
        }));
    };

    const removeCostItem = (kind: CostMode, itemId: string) => {
        setDraft((prev) => ({
            ...prev,
            [kind]: prev[kind].filter((item) => item.id !== itemId),
        }));
    };

    const addCostItem = (kind: CostMode) => {
        setDraft((prev) => ({
            ...prev,
            [kind]: [...prev[kind], toDraftCostItem()],
        }));
    };

    const handleNewScenario = () => {
        setIsCreatingNew(true);
        setSelectedScenarioId(null);
        setDraft(createScenarioDraft());
        setShowScenarioMenu(false);
    };

    const handleDuplicateScenario = async () => {
        if (!tenantId || !canManage || !selectedScenario) return;

        try {
            const duplicatedDraft = buildDraftFromScenario(selectedScenario);
            const payload = toScenarioPayload({
                ...duplicatedDraft,
                name: `${selectedScenario.name} (${t('finance.calc.actions.copySuffix')})`,
            });
            const createdId = await createFinanceScenario(payload, tenantId);
            setIsCreatingNew(false);
            setSelectedScenarioId(createdId);
            showSuccess(t('finance.calc.toast.created'));
            setShowScenarioMenu(false);
        } catch (error: any) {
            console.error('Failed to duplicate finance scenario', error);
            showError(t('finance.calc.toast.error'), error?.message);
        }
    };

    const validateDraft = () => {
        if (!draft.name.trim()) {
            showError(t('finance.calc.validation.nameRequired'));
            return false;
        }

        if (!draft.unitLabel.trim()) {
            showError(t('finance.calc.validation.unitRequired'));
            return false;
        }

        if (toPositiveNumber(draft.plannedUnits) <= 0) {
            showError(t('finance.calc.validation.plannedUnitsRequired'));
            return false;
        }

        return true;
    };

    const handleSave = async () => {
        if (!tenantId || !canManage) return;
        if (!validateDraft()) return;

        setSaving(true);

        try {
            const payload = toScenarioPayload(draft);

            if (selectedScenario) {
                await updateFinanceScenario(selectedScenario.id, payload, tenantId);
                showSuccess(t('finance.calc.toast.updated'));
            } else {
                const createdId = await createFinanceScenario(payload, tenantId);
                setIsCreatingNew(false);
                setSelectedScenarioId(createdId);
                showSuccess(t('finance.calc.toast.created'));
            }
        } catch (error: any) {
            console.error('Failed to save finance scenario', error);
            showError(t('finance.calc.toast.error'), error?.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!tenantId || !canManage || !selectedScenario) return;

        const confirmed = await confirm(
            t('finance.calc.delete.title'),
            t('finance.calc.delete.message')
        );
        if (!confirmed) return;

        setDeleting(true);

        try {
            await deleteFinanceScenario(selectedScenario.id, tenantId);
            showSuccess(t('finance.calc.toast.deleted'));
            setIsCreatingNew(false);
            setSelectedScenarioId(null);
            setDraft(createScenarioDraft());
            setShowScenarioMenu(false);
        } catch (error: any) {
            console.error('Failed to delete finance scenario', error);
            showError(t('finance.calc.toast.error'), error?.message);
        } finally {
            setDeleting(false);
        }
    };

    const renderCostList = (kind: CostMode, title: string, emptyKey: string) => {
        const items = draft[kind];
        const isVariableList = kind === 'variableCostItemsPerUnit';

        return (
            <div className="finance-calc-enhanced__cost-block">
                <div className="finance-calc-enhanced__section-title" style={{ justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined">{isVariableList ? 'account_tree' : 'lock'}</span>
                        {title}
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => addCostItem(kind)} disabled={!canManage}>
                        {t('finance.calc.actions.addCostItem')}
                    </Button>
                </div>

                {isVariableList && (
                    <p className="text-muted finance-calc-simple__cost-hint" style={{ marginBottom: '12px' }}>
                        {t('finance.calc.variableCosts.usageHint')}
                    </p>
                )}

                <div className="finance-calc-enhanced__cost-list">
                    {items.length === 0 && <div className="finance-empty">{t(emptyKey)}</div>}
                    {items.map((item) => (
                        <div
                            className={`finance-calc-enhanced__cost-row ${isVariableList ? 'finance-calc-enhanced__cost-row--variable' : ''}`}
                            key={item.id}
                        >
                            <TextInput
                                label={t('finance.calc.fields.costLabel')}
                                value={item.label}
                                onChange={(event) => updateCostItem(kind, item.id, { label: event.target.value })}
                                disabled={!canManage}
                            />

                            {isVariableList ? (
                                <>
                                    <TextInput
                                        label={t('finance.calc.fields.usageQuantityPerUnit')}
                                        type="text"
                                        inputMode="decimal"
                                        value={item.quantityPerUnit}
                                        onChange={(event) => applyNumericInput(event.target.value, (next) => updateCostItem(kind, item.id, { quantityPerUnit: next }))}
                                        disabled={!canManage}
                                    />
                                    <TextInput
                                        label={t('finance.calc.fields.usageUnitCost')}
                                        type="text"
                                        inputMode="decimal"
                                        value={item.unitCost}
                                        onChange={(event) => applyNumericInput(event.target.value, (next) => updateCostItem(kind, item.id, { unitCost: next }))}
                                        disabled={!canManage}
                                    />
                                    <TextInput
                                        label={t('finance.calc.fields.directCostPerUnit')}
                                        type="text"
                                        inputMode="decimal"
                                        value={item.amount}
                                        onChange={(event) => applyNumericInput(event.target.value, (next) => updateCostItem(kind, item.id, { amount: next }))}
                                        disabled={!canManage}
                                    />
                                    <TextInput
                                        label={t('finance.calc.fields.tokensPerUsage')}
                                        type="text"
                                        inputMode="numeric"
                                        value={item.tokensPerUsage}
                                        onChange={(event) => applyTokenIntegerInput(event.target.value, (next) => updateCostItem(kind, item.id, { tokensPerUsage: next }))}
                                        disabled={!canManage}
                                    />
                                    <div className="finance-calc-simple__cost-computed">
                                        <span>{t('finance.calc.fields.calculatedCostPerUnit')}</span>
                                        <strong>{formatCurrency(resolveFinanceCostItemAmount(toFinanceCostItem(item)))}</strong>
                                        <span>{t('finance.calc.fields.calculatedTokensPerUnit')}</span>
                                        <strong>{formatNumber(resolveFinanceCostItemTokens(toFinanceCostItem(item)), 2)} tk</strong>
                                    </div>
                                </>
                            ) : (
                                <TextInput
                                    label={t('finance.calc.fields.costAmount')}
                                    type="text"
                                    inputMode="decimal"
                                    value={item.amount}
                                    onChange={(event) => applyNumericInput(event.target.value, (next) => updateCostItem(kind, item.id, { amount: next }))}
                                    disabled={!canManage}
                                />
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCostItem(kind, item.id)}
                                disabled={!canManage}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) {
        return <div className="finance-loading">{t('finance.loading')}</div>;
    }

    return (
        <div className="finance-calc-simple finance-calc-simple--full-width">
            <Modal isOpen={showScenarioMenu} onClose={() => setShowScenarioMenu(false)} title={t('finance.calc.scenarios.title', 'Scenarios')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p className="text-muted" style={{ margin: 0 }}>{t('finance.calc.scenarios.subtitle')}</p>

                    <div className="finance-calc-simple__sidebar-actions">
                        <Button variant="secondary" size="sm" onClick={handleNewScenario} disabled={!canManage}>
                            {t('finance.calc.actions.new')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleDuplicateScenario} disabled={!canManage || !selectedScenario}>
                            {t('finance.calc.actions.duplicate')}
                        </Button>
                    </div>

                    <TextInput
                        placeholder={t('finance.calc.search.placeholder')}
                        value={scenarioSearch}
                        onChange={(event) => setScenarioSearch(event.target.value)}
                        leftElement={<span className="material-symbols-outlined">search</span>}
                    />

                    <div className="finance-calc-simple__scenario-count text-muted">
                        {visibleScenarios.length} {t('finance.calc.sidebar.count')}
                    </div>

                    <div className="finance-calc-simple__scenario-list">
                        {visibleScenarios.length === 0 ? (
                            <div className="finance-empty">{t('finance.calc.scenarios.empty')}</div>
                        ) : (
                            visibleScenarios.map((scenario) => {
                                const updatedAt = toDate(scenario.updatedAt);

                                return (
                                    <button
                                        key={scenario.id}
                                        type="button"
                                        className={`finance-calc-simple__scenario-item ${scenario.id === selectedScenarioId ? 'finance-calc-simple__scenario-item--active' : ''}`}
                                        onClick={() => {
                                            setIsCreatingNew(false);
                                            setSelectedScenarioId(scenario.id);
                                            setShowScenarioMenu(false);
                                        }}
                                    >
                                        <span className="finance-calc-simple__scenario-title">{scenario.name}</span>
                                        <span className="finance-calc-simple__scenario-meta">
                                            {scenario.plannedUnits} {scenario.unitLabel}
                                        </span>
                                        <span className="finance-calc-simple__scenario-meta">
                                            {scenario.projectId
                                                ? (projectNameLookup.get(scenario.projectId) || t('finance.project.unknown'))
                                                : t('finance.project.unassigned')}
                                        </span>
                                        <span className="finance-calc-simple__scenario-meta">
                                            {updatedAt ? updatedAt.toLocaleDateString(locale) : '-'}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </Modal>

            <div className="finance-calc-simple__content">
                {selectedScenario && (
                    <div className="finance-calc-enhanced__summary">
                        <div className={`finance-calc-enhanced__stat-card ${result.operatingProfitTotal >= 0 ? 'finance-calc-enhanced__stat-card--positive' : 'finance-calc-enhanced__stat-card--negative'}`}>
                            <span>{t('finance.project.net')}</span>
                            <strong>{formatCurrency(result.operatingProfitTotal)}</strong>
                        </div>
                        <div className="finance-calc-enhanced__stat-card">
                            <span>{t('finance.calc.results.profitOnCost')}</span>
                            <strong>{result.profitPercentOnCost.toFixed(1)}%</strong>
                        </div>
                        <div className="finance-calc-enhanced__stat-card">
                            <span>{t('finance.calc.results.breakEvenUnits')}</span>
                            <strong>{result.breakEvenUnits === null ? '-' : result.breakEvenUnits}</strong>
                        </div>
                        <div className={`finance-calc-enhanced__stat-card ${hasTokenQuota && result.isTokenQuotaExceededPerUnit ? 'finance-calc-enhanced__stat-card--negative' : ''}`}>
                            <span>{t('finance.calc.results.tokensUsedPerUnit')}</span>
                            <strong>{formatNumber(result.tokensUsedPerUnit, 2)} tk</strong>
                        </div>
                        <div className="finance-calc-enhanced__stat-card">
                            <span>{t('finance.calc.results.offerPriceNeeded')}</span>
                            <strong>{formatCurrency(result.suggestedPricePerUnit)}</strong>
                        </div>
                    </div>
                )}

                <div className="finance-calc-simple__header" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <Button variant="ghost" size="sm" onClick={() => setShowScenarioMenu(true)} aria-label="Menu" style={{ marginTop: '2px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>menu</span>
                        </Button>
                        <div>
                            <h3 className="h3" style={{ margin: 0, lineHeight: 1 }}>{selectedScenario ? draft.name || t('finance.calc.editor.edit') : t('finance.calc.editor.new')}</h3>
                            <p className="text-muted" style={{ marginTop: '4px' }}>{selectedScenario ? t('finance.calc.editor.subtitle') : t('finance.calc.editor.newSubtitle', 'Create a new financial scenario')}</p>
                            {!canManage && (
                                <span className="finance-calc-readonly">{t('finance.calc.editor.readOnly')}</span>
                            )}
                        </div>
                    </div>
                    <div className="finance-calc-simple__actions">
                        {selectedScenario && (
                            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={!canManage || deleting}>
                                {t('finance.calc.actions.delete')}
                            </Button>
                        )}
                        <Button variant="primary" size="sm" onClick={handleSave} disabled={!canManage} isLoading={saving}>
                            {t('finance.calc.actions.save')}
                        </Button>
                    </div>
                </div>

                <div className="finance-calc-enhanced__grid">
                    <div className="finance-calc-enhanced__section">
                        <h4 className="finance-calc-enhanced__section-title">
                            <span className="material-symbols-outlined">settings</span>
                            {t('finance.calc.section.general', 'General Settings')}
                        </h4>
                        <div className="finance-calc-simple__form-grid">
                            <TextInput
                                label={t('finance.calc.fields.name')}
                                value={draft.name}
                                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                                disabled={!canManage}
                            />
                            <Select
                                label={t('finance.project.field')}
                                value={draft.projectId || ''}
                                onChange={(value) => setDraft((prev) => ({ ...prev, projectId: String(value) }))}
                                options={projectOptions}
                                disabled={!canManage}
                            />
                            <Select
                                label={t('finance.calc.fields.preset')}
                                value={draft.preset}
                                onChange={(value) => applyPresetDefaults(value as FinanceScenarioPreset)}
                                options={presetOptions}
                                disabled={!canManage}
                            />
                            <TextInput
                                label={t('finance.calc.fields.tokenQuotaPerUnit')}
                                type="text"
                                inputMode="numeric"
                                value={String(draft.tokenQuotaPerUnit)}
                                onChange={(event) => applyTokenIntegerInput(event.target.value, (next) => setDraft((prev) => ({ ...prev, tokenQuotaPerUnit: next })))}
                                disabled={!canManage}
                            />
                        </div>
                        <div style={{ marginTop: '12px' }}>
                            <TextArea
                                label={t('finance.calc.fields.notes')}
                                value={draft.notes || ''}
                                onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                                rows={3}
                                disabled={!canManage}
                            />
                        </div>
                    </div>

                    <div className="finance-calc-enhanced__section">
                        <h4 className="finance-calc-enhanced__section-title">
                            <span className="material-symbols-outlined">monitoring</span>
                            {t('finance.calc.section.economics', 'Unit Economics')}
                        </h4>
                        <div className="finance-calc-simple__form-grid">
                            <TextInput
                                label={t('finance.calc.fields.unitLabel')}
                                value={draft.unitLabel}
                                onChange={(event) => setDraft((prev) => ({ ...prev, unitLabel: event.target.value }))}
                                disabled={!canManage}
                            />
                            <TextInput
                                label={t('finance.calc.fields.plannedUnits')}
                                type="text"
                                inputMode="numeric"
                                value={String(draft.plannedUnits)}
                                onChange={(event) => applyNumericInput(event.target.value, (next) => setDraft((prev) => ({ ...prev, plannedUnits: next })))}
                                disabled={!canManage}
                            />
                            <TextInput
                                label={t('finance.calc.fields.pricePerUnit')}
                                type="text"
                                inputMode="decimal"
                                value={String(draft.pricePerUnit)}
                                onChange={(event) => applyNumericInput(event.target.value, (next) => setDraft((prev) => ({ ...prev, pricePerUnit: next })))}
                                disabled={!canManage}
                            />
                            <TextInput
                                label={t('finance.calc.fields.discountPercent')}
                                type="text"
                                inputMode="decimal"
                                value={String(draft.discountPercent)}
                                onChange={(event) => applyNumericInput(event.target.value, (next) => setDraft((prev) => ({ ...prev, discountPercent: next })))}
                                disabled={!canManage}
                            />
                            <TextInput
                                label={t('finance.calc.fields.salesCommissionPercent')}
                                type="text"
                                inputMode="decimal"
                                value={String(draft.salesCommissionPercent)}
                                onChange={(event) => applyNumericInput(event.target.value, (next) => setDraft((prev) => ({ ...prev, salesCommissionPercent: next })))}
                                disabled={!canManage}
                            />
                            <TextInput
                                label={t('finance.calc.fields.targetProfitPercentOnCost')}
                                type="text"
                                inputMode="decimal"
                                value={String(draft.targetProfitPercentOnCost)}
                                onChange={(event) => applyNumericInput(event.target.value, (next) => setDraft((prev) => ({ ...prev, targetProfitPercentOnCost: next })))}
                                disabled={!canManage}
                            />
                        </div>

                        {selectedScenario && (
                            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setDraft((prev) => ({ ...prev, pricePerUnit: String(result.suggestedPricePerUnit) }))}
                                    disabled={!canManage}
                                    style={{ width: '100%' }}
                                >
                                    {t('finance.calc.actions.applySuggestedPrice')} ({formatCurrency(result.suggestedPricePerUnit)})
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="finance-calc-enhanced__cost-grid">
                        <div className="finance-calc-enhanced__section">
                            {renderCostList('fixedCostItems', t('finance.calc.fixedCosts.title'), 'finance.calc.fixedCosts.empty')}
                            <div className="finance-calc-simple__result-item" style={{ marginTop: '16px', background: 'var(--color-surface-hover-light)' }}>
                                <span>{t('finance.calc.results.fixedCosts', 'Total Fixed Costs')}</span>
                                <strong>{formatCurrency(result.fixedCostsTotal)}</strong>
                            </div>
                        </div>
                        <div className="finance-calc-enhanced__section">
                            {renderCostList('variableCostItemsPerUnit', t('finance.calc.variableCosts.title'), 'finance.calc.variableCosts.empty')}
                            <div className="finance-calc-simple__result-item" style={{ marginTop: '16px', background: 'var(--color-surface-hover-light)' }}>
                                <span>{t('finance.calc.results.variableCostPerUnit', 'Variable Cost per Unit')}</span>
                                <strong>{formatCurrency(result.variableCostPerUnit)}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                {selectedScenario && (
                    <Card className="finance-panel finance-calc-simple__results" style={{ marginTop: '16px' }}>
                        <div className="finance-calc-simple__result-head">
                            <h3 className="h3">{t('finance.calc.section.liveDetailed', 'Detailed Analysis')}</h3>
                            <div className="finance-calc-simple__result-head-actions">
                                <span className={`finance-calc-simple__status ${result.operatingProfitTotal >= 0 ? 'finance-calc-simple__status--pos' : 'finance-calc-simple__status--neg'}`}>
                                    {result.operatingProfitTotal >= 0 ? t('finance.calc.results.statusProfit') : t('finance.calc.results.statusLoss')}
                                </span>
                            </div>
                        </div>

                        <p className={`finance-calc-simple__token-alert ${hasTokenQuota && result.isTokenQuotaExceededPerUnit ? 'finance-calc-simple__token-alert--neg' : 'finance-calc-simple__token-alert--pos'}`}>
                            {tokenQuotaStatusText}
                        </p>

                        <div className="finance-calc-simple__piece-table-wrap">
                            <table className="finance-calc-simple__piece-table">
                                <thead>
                                    <tr>
                                        <th>{t('finance.calc.retro.columns.step', 'Position')}</th>
                                        <th>{t('finance.calc.retro.columns.targetAmount', 'Retrograd EUR pro Stück')}</th>
                                        <th>{t('finance.calc.retro.columns.rate', 'Satz %')}</th>
                                        <th>{t('finance.calc.retro.columns.targetShare', 'Retrograd Anteil %')}</th>
                                        <th>{t('finance.calc.retro.columns.setAmount', 'Gesetzter Angebotspreis EUR')}</th>
                                        <th>{t('finance.calc.retro.columns.setShare', 'Gesetzter Anteil %')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {retrogradePieceCostTable.rows.map((row) => (
                                        <tr key={row.key}>
                                            <td>{row.label}</td>
                                            <td>{formatCurrency(row.targetAmount)}</td>
                                            <td>{row.rate}</td>
                                            <td>{row.targetShare.toFixed(2)}%</td>
                                            <td>{formatCurrency(row.setAmount)}</td>
                                            <td>{row.setShare.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {!retrogradePieceCostTable.isReachable && (
                                <p className="text-muted finance-calc-simple__piece-table-hint">
                                    {t('finance.calc.retro.unreachable')}
                                </p>
                            )}
                        </div>

                        <div className="finance-calc-simple__results-grid">
                            {detailedAnalysisItems.map((item) => (
                                <div key={item.id} className="finance-calc-simple__result-item finance-calc-simple__result-item--with-info">
                                    {activeDetailInfoId === item.id && (
                                        <div className="finance-calc-simple__info-popover">
                                            {item.explanation}
                                        </div>
                                    )}
                                    <div className="finance-calc-simple__result-item-head">
                                        <span>{item.label}</span>
                                        <button
                                            type="button"
                                            className="finance-calc-simple__info-button"
                                            onClick={() => setActiveDetailInfoId((current) => current === item.id ? null : item.id)}
                                            aria-label={t('finance.calc.actions.info')}
                                        >
                                            i
                                        </button>
                                    </div>
                                    <strong>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};
