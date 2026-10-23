import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/common/Button/Button';
import { BrandMark, BrandScene, FlowField, LoadingTrack, StatusDots } from '../components/brand';
import { Card, CardHeader, CardBody, CardFooter } from '../components/common/Card/Card';
import { TextInput } from '../components/common/Input/TextInput';
import { TextArea } from '../components/common/Input/TextArea';
import { Badge } from '../components/common/Badge/Badge';
import { Divider } from '../components/common/Divider/Divider';
import { Modal } from '../components/common/Modal/Modal';
import { ConfirmModal } from '../components/common/Modal/ConfirmModal';
import { SettingsModal } from '../components/common/Modal/SettingsModal';
import './style-guide.scss';
import { MotionShowcase } from './style-guide/MotionShowcase';
import { AiDirections } from './style-guide/AiDirections';
import { Link } from 'react-router-dom';
import { DatePicker } from '../components/common/DateTime/DatePicker';
import { TimePicker } from '../components/common/DateTime/TimePicker';
import { DateTimePicker } from '../components/common/DateTime/DateTimePicker';
import { PrioritySelect, type Priority } from '../components/common/PrioritySelect/PrioritySelect';
import { Select } from '../components/common/Select/Select';
import { Checkbox } from '../components/common/Checkbox/Checkbox';
import { EmptyState } from '../components/common/EmptyState/EmptyState';
import { FilterMenu } from '../components/common/FilterMenu/FilterMenu';
import { InlineEditCell } from '../components/common/InlineEditCell/InlineEditCell';
import { ListToolbar } from '../components/common/ListToolbar/ListToolbar';
import { SkeletonBlock } from '../components/common/Skeleton/Skeleton';
import { Stepper, type StepperStep } from '../components/common/Stepper/Stepper';
import { MediaLibrary } from '../components/MediaLibrary/MediaLibraryModal';
import { useLanguage } from '../context/LanguageContext';

type NoticeTone = 'info' | 'success';

const PrioritySelectExample = ({
    dropdownLabel,
    groupLabel,
}: {
    dropdownLabel: string;
    groupLabel: string;
}) => {
    const [priority, setPriority] = useState<Priority>('low');
    return (
        <div className="style-guide__field-stack">
            <div className="style-guide__field">
                <label className="style-guide__field-label">{dropdownLabel}</label>
                <PrioritySelect value={priority} onChange={setPriority} />
            </div>
            <div className="style-guide__field">
                <label className="style-guide__field-label">{groupLabel}</label>
                <PrioritySelect value={priority} onChange={setPriority} variant="group" />
            </div>
        </div>
    );
};

const SelectExample = ({
    label,
    placeholder,
    options,
}: {
    label: string;
    placeholder: string;
    options: Array<{ label: string; value: string; disabled?: boolean }>;
}) => {
    const [value, setValue] = useState<string | number | null>(null);
    return <Select label={label} value={value} onChange={setValue} options={options} placeholder={placeholder} />;
};

const DatePickerExample = ({ label }: { label: string }) => {
    const [date, setDate] = useState<Date | null>(null);
    return <DatePicker label={label} value={date} onChange={setDate} />;
};

const TimePickerExample = ({ label }: { label: string }) => {
    const [time, setTime] = useState<Date | null>(null);
    return <TimePicker label={label} value={time} onChange={setTime} />;
};

const DateTimePickerExample = ({ label }: { label: string }) => {
    const [dateTime, setDateTime] = useState<Date | null>(null);
    return <DateTimePicker label={label} value={dateTime} onChange={setDateTime} />;
};

const ToggleExample = ({
    checked,
    label,
    description,
    onChange,
}: {
    checked: boolean;
    label: string;
    description: string;
    onChange: (checked: boolean) => void;
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`style-switch ${checked ? 'is-checked' : ''}`.trim()}
        onClick={() => onChange(!checked)}
    >
        <span className="style-switch__copy">
            <span>{label}</span>
            <small>{description}</small>
        </span>
        <span className="style-switch__track" aria-hidden="true">
            <span className="style-switch__thumb" />
        </span>
    </button>
);

const ColorSwatch = ({ name, token }: { name: string; token: string }) => (
    <div className="color-swatch">
        <div className="color-swatch__preview" style={{ backgroundColor: `var(${token})` }} />
        <div className="color-swatch__info">
            <span className="color-swatch__name">{name}</span>
            <span className="color-swatch__token">{token}</span>
        </div>
    </div>
);

export const StyleGuidePage = () => {
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    // Modal States
    const [isBaseModalOpen, setBaseModalOpen] = useState(false);
    const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [isMediaModalOpen, setMediaModalOpen] = useState(false);
    const [actionNotice, setActionNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
    const [isWorkspaceChecked, setWorkspaceChecked] = useState(true);
    const [isExternalChecked, setExternalChecked] = useState(false);
    const [isDisabledChecked] = useState(false);
    const [isCompactMode, setCompactMode] = useState(true);
    const [isNotificationsEnabled, setNotificationsEnabled] = useState(false);
    const [toolbarSearch, setToolbarSearch] = useState('');
    const [filterMineOnly, setFilterMineOnly] = useState(true);
    const [filterBlocked, setFilterBlocked] = useState(false);
    const [inlineOwner, setInlineOwner] = useState(t('styleGuide.primitives.inlineEdit.value'));
    const [activeStepId, setActiveStepId] = useState('scope');

    // Mock Settings Tabs
    const settingsTabs = [
        { id: 'general', label: t('styleGuide.settings.general.label'), content: <p>{t('styleGuide.settings.general.content')}</p> },
        { id: 'profile', label: t('styleGuide.settings.profile.label'), content: <p>{t('styleGuide.settings.profile.content')}</p> },
        { id: 'notifications', label: t('styleGuide.settings.notifications.label'), content: <p>{t('styleGuide.settings.notifications.content')}</p> },
        { id: 'advanced', label: t('styleGuide.settings.advanced.label'), content: <p>{t('styleGuide.settings.advanced.content')}</p> },
    ];

    const handleConfirm = () => {
        setActionNotice({ message: t('styleGuide.modals.confirmedMessage'), tone: 'info' });
        setConfirmModalOpen(false);
    };

    const handleSaveChanges = () => {
        setActionNotice({ message: t('styleGuide.modals.savedMessage'), tone: 'success' });
        setBaseModalOpen(false);
    };

    const handleMediaSelect = (assets: Array<{ id?: string }>) => {
        const message = t('styleGuide.mediaLibrary.selectedMessage').replace('{count}', String(assets.length));
        setActionNotice({ message, tone: 'success' });
        setMediaModalOpen(false);
    };

    const selectOptions = [
        { label: t('styleGuide.inputs.select.option1'), value: '1' },
        { label: t('styleGuide.inputs.select.option2'), value: '2' },
        { label: t('styleGuide.inputs.select.option3'), value: '3' },
        { label: t('styleGuide.inputs.select.optionDisabled'), value: '4', disabled: true },
    ];

    const depthLevels = [
        {
            label: t('styleGuide.depth.canvas.label'),
            name: t('styleGuide.depth.canvas.name'),
            usage: t('styleGuide.depth.canvas.usage'),
            className: 'depth-card--canvas',
            token: '--color-surface-bg',
        },
        {
            label: t('styleGuide.depth.level1.label'),
            name: t('styleGuide.depth.level1.name'),
            usage: t('styleGuide.depth.level1.usage'),
            className: 'depth-card--level-1',
            token: '--color-surface-card',
        },
        {
            label: t('styleGuide.depth.level2.label'),
            name: t('styleGuide.depth.level2.name'),
            usage: t('styleGuide.depth.level2.usage'),
            className: 'depth-card--level-2',
            token: '--color-surface-hover',
        },
        {
            label: t('styleGuide.depth.level3.label'),
            name: t('styleGuide.depth.level3.name'),
            usage: t('styleGuide.depth.level3.usage'),
            className: 'depth-card--level-3',
            token: 'rgba(--color-surface-hover-rgb, 0.72)',
        },
        {
            label: t('styleGuide.depth.overlay.label'),
            name: t('styleGuide.depth.overlay.name'),
            usage: t('styleGuide.depth.overlay.usage'),
            className: 'depth-card--overlay',
            token: '--shadow-lg',
        },
    ];

    const containerSamples = [
        {
            label: t('styleGuide.containers.dense.label'),
            width: '1680px',
            token: 'max-width: 1680px',
            usage: t('styleGuide.containers.dense.usage'),
            modifier: 'dense',
        },
        {
            label: t('styleGuide.containers.standard.label'),
            width: '1480px',
            token: 'max-width: 1480px',
            usage: t('styleGuide.containers.standard.usage'),
            modifier: 'standard',
        },
        {
            label: t('styleGuide.containers.form.label'),
            width: '1120px',
            token: 'max-width: 1120px',
            usage: t('styleGuide.containers.form.usage'),
            modifier: 'form',
        },
        {
            label: t('styleGuide.containers.readable.label'),
            width: '720px',
            token: 'max-width: 720px',
            usage: t('styleGuide.containers.readable.usage'),
            modifier: 'readable',
        },
    ];

    const activeFilterCount = Number(filterMineOnly) + Number(filterBlocked);
    const primitiveSteps: StepperStep[] = [
        {
            id: 'scope',
            label: t('styleGuide.primitives.stepper.scope.label'),
            description: t('styleGuide.primitives.stepper.scope.description'),
        },
        {
            id: 'build',
            label: t('styleGuide.primitives.stepper.build.label'),
            description: t('styleGuide.primitives.stepper.build.description'),
        },
        {
            id: 'review',
            label: t('styleGuide.primitives.stepper.review.label'),
            description: t('styleGuide.primitives.stepper.review.description'),
        },
        {
            id: 'ship',
            label: t('styleGuide.primitives.stepper.ship.label'),
            description: t('styleGuide.primitives.stepper.ship.description'),
        },
    ];
    const activeStepIndex = primitiveSteps.findIndex((step) => step.id === activeStepId);
    const stepperSteps = primitiveSteps.map((step, index) => ({
        ...step,
        status: index < activeStepIndex ? 'complete' as const : index === activeStepIndex ? 'current' as const : 'upcoming' as const,
    }));
    const demoRows = [
        t('styleGuide.primitives.toolbar.row1'),
        t('styleGuide.primitives.toolbar.row2'),
        t('styleGuide.primitives.toolbar.row3'),
    ];

    return (
        <div className="style-guide">
            <div className="style-guide__content-wrapper">
                <header className="style-guide__header">
                    <h1>{t('styleGuide.title')}</h1>
                    <div className="style-guide__actions">
                        <Button variant="ghost" onClick={toggleTheme}>
                            {theme === 'light' ? t('styleGuide.toggleDark') : t('styleGuide.toggleLight')}
                        </Button>
                        <Link className="style-guide__link" to="/">{t('styleGuide.backHome')}</Link>
                    </div>
                </header>

                <main className="style-guide__content">
                    {actionNotice && (
                        <div className={`style-guide__notice style-guide__notice--${actionNotice.tone}`}>
                            <span className="material-symbols-outlined">
                                {actionNotice.tone === 'success' ? 'check_circle' : 'info'}
                            </span>
                            <span>{actionNotice.message}</span>
                        </div>
                    )}

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.colors')}</h2>
                        <div className="color-grid">
                            <ColorSwatch name={t('styleGuide.colors.primary')} token="--color-primary" />
                            <ColorSwatch name={t('styleGuide.colors.primaryDark')} token="--color-primary-dark" />
                            <ColorSwatch name={t('styleGuide.colors.primaryLight')} token="--color-primary-light" />
                            <ColorSwatch name={t('styleGuide.colors.surfaceBg')} token="--color-surface-bg" />
                            <ColorSwatch name={t('styleGuide.colors.surfaceCard')} token="--color-surface-card" />
                            <ColorSwatch name={t('styleGuide.colors.surfaceHover')} token="--color-surface-hover" />
                            <ColorSwatch name={t('styleGuide.colors.success')} token="--color-success" />
                            <ColorSwatch name={t('styleGuide.colors.warning')} token="--color-warning" />
                            <ColorSwatch name={t('styleGuide.colors.error')} token="--color-error" />
                            <ColorSwatch name={t('styleGuide.colors.textMain')} token="--color-text-main" />
                            <ColorSwatch name={t('styleGuide.colors.textMuted')} token="--color-text-muted" />
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.brand')}</h2>
                        <p className="guide-brand__intro">{t('styleGuide.brand.intro')}</p>
                        <div className="color-grid">
                            <ColorSwatch name={t('styleGuide.brand.blue')} token="--brand-blue" />
                            <ColorSwatch name={t('styleGuide.brand.violet')} token="--brand-violet" />
                            <ColorSwatch name={t('styleGuide.brand.amber')} token="--brand-amber" />
                            <ColorSwatch name={t('styleGuide.brand.green')} token="--brand-green" />
                        </div>
                        <div className="guide-brand__row">
                            <figure><BrandMark size="sm" /><figcaption>BrandMark sm</figcaption></figure>
                            <figure><BrandMark size="md" /><figcaption>BrandMark md</figcaption></figure>
                            <figure><BrandMark size="lg" /><figcaption>BrandMark lg</figcaption></figure>
                            <figure><StatusDots size="md" /><figcaption>StatusDots</figcaption></figure>
                            <figure><StatusDots size="md" motion="wave" /><figcaption>StatusDots wave</figcaption></figure>
                            <figure><LoadingTrack /><figcaption>LoadingTrack</figcaption></figure>
                        </div>
                        <div className="guide-brand__field">
                            <FlowField originX={0.15} originY={0.5} />
                            <span>FlowField</span>
                        </div>
                        <div className="guide-brand__scene">
                            <BrandScene variant="inline" label={t('app.loading.connecting')} />
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.typography')}</h2>
                        <div className="type-sample">
                            <h1>{t('styleGuide.typography.heading1')}</h1>
                            <span className="type-sample__meta">{t('styleGuide.typography.weight700')}</span>
                        </div>
                        <div className="type-sample">
                            <h2>{t('styleGuide.typography.heading2')}</h2>
                            <span className="type-sample__meta">{t('styleGuide.typography.weight600')}</span>
                        </div>
                        <div className="type-sample">
                            <h3>{t('styleGuide.typography.heading3')}</h3>
                            <span className="type-sample__meta">{t('styleGuide.typography.weight600')}</span>
                        </div>
                        <div className="type-sample">
                            <p>{t('styleGuide.typography.bodySample')}</p>
                            <span className="type-sample__meta">{t('styleGuide.typography.weight400')}</span>
                        </div>
                        <div className="type-sample">
                            <small>{t('styleGuide.typography.smallSample')}</small>
                            <span className="type-sample__meta">{t('styleGuide.typography.weight400')}</span>
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.buttons')}</h2>
                        <div className="guide-row">
                            <Button variant="primary">{t('styleGuide.buttons.primary')}</Button>
                            <Button variant="secondary">{t('styleGuide.buttons.secondary')}</Button>
                            <Button variant="ghost">{t('styleGuide.buttons.ghost')}</Button>
                        </div>
                        <div className="guide-row">
                            <Button size="sm">{t('styleGuide.buttons.small')}</Button>
                            <Button size="md">{t('styleGuide.buttons.medium')}</Button>
                            <Button size="lg">{t('styleGuide.buttons.large')}</Button>
                        </div>
                        <div className="guide-row">
                            <Button isLoading>{t('styleGuide.buttons.loading')}</Button>
                            <Button disabled>{t('styleGuide.buttons.disabled')}</Button>
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.modals')}</h2>
                        <div className="guide-row">
                            <Button onClick={() => setBaseModalOpen(true)}>{t('styleGuide.modals.openBase')}</Button>
                            <Button variant="secondary" onClick={() => setConfirmModalOpen(true)}>{t('styleGuide.modals.openConfirm')}</Button>
                            <Button variant="ghost" onClick={() => setSettingsModalOpen(true)}>{t('styleGuide.modals.openSettings')}</Button>
                        </div>
                    </section>

                    {/* Base Modal Demo */}
                    <Modal
                        isOpen={isBaseModalOpen}
                        onClose={() => setBaseModalOpen(false)}
                        title={t('styleGuide.modals.baseTitle')}
                        footer={
                            <>
                                <Button variant="ghost" onClick={() => setBaseModalOpen(false)}>{t('styleGuide.modals.cancel')}</Button>
                                <Button onClick={handleSaveChanges}>{t('styleGuide.modals.saveChanges')}</Button>
                            </>
                        }
                    >
                        <p>{t('styleGuide.modals.baseDescription')}</p>
                        <div className="style-guide__modal-field">
                            <TextInput label={t('styleGuide.modals.baseInputLabel')} placeholder={t('styleGuide.modals.baseInputPlaceholder')} />
                        </div>
                    </Modal>

                    {/* Confirm Modal Demo */}
                    <ConfirmModal
                        isOpen={isConfirmModalOpen}
                        onClose={() => setConfirmModalOpen(false)}
                        onConfirm={handleConfirm}
                        title={t('styleGuide.modals.confirmTitle')}
                        message={t('styleGuide.modals.confirmMessage')}
                        confirmLabel={t('styleGuide.modals.confirmAction')}
                        variant="danger"
                    />

                    {/* Settings Modal Demo */}
                    <SettingsModal
                        isOpen={isSettingsModalOpen}
                        onClose={() => setSettingsModalOpen(false)}
                        tabs={settingsTabs}
                    />

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.cards')}</h2>
                        <div className="guide-grid">
                            <Card>
                                <CardHeader><h3>{t('styleGuide.cards.title')}</h3></CardHeader>
                                <CardBody>
                                    <p>{t('styleGuide.cards.body')}</p>
                                </CardBody>
                                <CardFooter>
                                    <Button size="sm" variant="ghost">{t('styleGuide.cards.cancel')}</Button>
                                    <Button size="sm">{t('styleGuide.cards.action')}</Button>
                                </CardFooter>
                            </Card>

                            <Card>
                                <CardBody>
                                    <p>{t('styleGuide.cards.bodyOnly')}</p>
                                </CardBody>
                            </Card>
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.depth')}</h2>
                        <p className="guide-section__intro">{t('styleGuide.depth.intro')}</p>
                        <div className="depth-grid">
                            {depthLevels.map((item) => (
                                <div key={item.label} className={`depth-card ${item.className}`}>
                                    <span className="depth-card__label">{item.label}</span>
                                    <h3>{item.name}</h3>
                                    <p>{item.usage}</p>
                                    <code>{item.token}</code>
                                </div>
                            ))}
                        </div>
                        <div className="depth-rule">
                            <span className="material-symbols-outlined" aria-hidden="true">layers</span>
                            <p>{t('styleGuide.depth.rule')}</p>
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.containers')}</h2>
                        <p className="guide-section__intro">{t('styleGuide.containers.intro')}</p>
                        <div className="container-stack" aria-label={t('styleGuide.sections.containers')}>
                            {containerSamples.map((item) => (
                                <div key={item.label} className={`container-sample container-sample--${item.modifier}`}>
                                    <div>
                                        <span>{item.label}</span>
                                        <strong>{item.width}</strong>
                                        <p>{item.usage}</p>
                                    </div>
                                    <code>{item.token}</code>
                                </div>
                            ))}
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.inputs')}</h2>
                        <div className="guide-grid">
                            <TextInput label={t('styleGuide.inputs.username.label')} placeholder={t('styleGuide.inputs.username.placeholder')} />
                            <TextInput label={t('styleGuide.inputs.email.label')} placeholder={t('styleGuide.inputs.email.placeholder')} helpText={t('styleGuide.inputs.email.help')} />
                            <TextInput label={t('styleGuide.inputs.password.label')} type="password" error={t('styleGuide.inputs.password.error')} placeholder={t('styleGuide.inputs.password.placeholder')} />
                            <TextArea label={t('styleGuide.inputs.bio.label')} placeholder={t('styleGuide.inputs.bio.placeholder')} helpText={t('styleGuide.inputs.bio.help')} />
                            <PrioritySelectExample
                                dropdownLabel={t('styleGuide.inputs.priority.dropdown')}
                                groupLabel={t('styleGuide.inputs.priority.group')}
                            />
                            <SelectExample
                                label={t('styleGuide.inputs.select.label')}
                                placeholder={t('styleGuide.inputs.select.placeholder')}
                                options={selectOptions}
                            />
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.booleanControls')}</h2>
                        <p className="guide-section__intro">{t('styleGuide.booleanControls.intro')}</p>
                        <div className="guide-grid">
                            <div className="control-sample">
                                <h3>{t('styleGuide.booleanControls.checkboxes.title')}</h3>
                                <p>{t('styleGuide.booleanControls.checkboxes.body')}</p>
                                <div className="control-sample__stack">
                                    <Checkbox
                                        checked={isWorkspaceChecked}
                                        onChange={(event) => setWorkspaceChecked(event.target.checked)}
                                        label={t('styleGuide.booleanControls.checkboxes.workspace')}
                                    />
                                    <Checkbox
                                        checked={isExternalChecked}
                                        onChange={(event) => setExternalChecked(event.target.checked)}
                                        label={t('styleGuide.booleanControls.checkboxes.external')}
                                    />
                                    <Checkbox
                                        checked={isDisabledChecked}
                                        disabled
                                        label={t('styleGuide.booleanControls.checkboxes.disabled')}
                                    />
                                </div>
                            </div>
                            <div className="control-sample">
                                <h3>{t('styleGuide.booleanControls.toggles.title')}</h3>
                                <p>{t('styleGuide.booleanControls.toggles.body')}</p>
                                <div className="control-sample__stack">
                                    <ToggleExample
                                        checked={isCompactMode}
                                        onChange={setCompactMode}
                                        label={t('styleGuide.booleanControls.toggles.compact.label')}
                                        description={t('styleGuide.booleanControls.toggles.compact.description')}
                                    />
                                    <ToggleExample
                                        checked={isNotificationsEnabled}
                                        onChange={setNotificationsEnabled}
                                        label={t('styleGuide.booleanControls.toggles.notifications.label')}
                                        description={t('styleGuide.booleanControls.toggles.notifications.description')}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.dateTime')}</h2>
                        <div className="guide-grid">
                            <DatePickerExample label={t('styleGuide.dateTime.date')} />
                            <TimePickerExample label={t('styleGuide.dateTime.time')} />
                            <DateTimePickerExample label={t('styleGuide.dateTime.dateTime')} />
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.mediaLibrary')}</h2>
                        <Button onClick={() => setMediaModalOpen(true)}>{t('styleGuide.mediaLibrary.open')}</Button>
                        {/* Media Modal Demo */}
                        <MediaLibrary
                            isOpen={isMediaModalOpen}
                            onClose={() => setMediaModalOpen(false)}
                            onSelect={(asset) => handleMediaSelect([asset])}
                            projectId="styleguide"
                            storagePath="uploads"
                        />
                    </section>

                    <Divider />

                    <section className="guide-section" id="ai">
                        <h2>{t('styleGuide.sections.ai')}</h2>
                        <p className="guide-section__intro">{t('styleGuide.ai.intro')}</p>
                        <AiDirections />
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.motion')}</h2>
                        <p className="guide-section__intro">{t('styleGuide.motion.intro')}</p>
                        <MotionShowcase />
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.badges')}</h2>
                        <div className="guide-row">
                            <Badge variant="neutral">{t('styleGuide.badges.neutral')}</Badge>
                            <Badge variant="success">{t('styleGuide.badges.success')}</Badge>
                            <Badge variant="warning">{t('styleGuide.badges.warning')}</Badge>
                            <Badge variant="error">{t('styleGuide.badges.error')}</Badge>
                        </div>
                    </section>

                    <Divider />

                    <section className="guide-section">
                        <h2>{t('styleGuide.sections.standardizeNext')}</h2>
                        <p className="guide-section__intro">{t('styleGuide.standardize.intro')}</p>
                        <div className="primitive-grid">
                            <article className="primitive-demo primitive-demo--wide">
                                <div className="primitive-demo__header">
                                    <span className="material-symbols-outlined" aria-hidden="true">tune</span>
                                    <div>
                                        <h3>{t('styleGuide.standardize.toolbar.title')}</h3>
                                        <p>{t('styleGuide.standardize.toolbar.body')}</p>
                                    </div>
                                </div>
                                <ListToolbar
                                    title={t('styleGuide.primitives.toolbar.title')}
                                    description={t('styleGuide.primitives.toolbar.description')}
                                    searchValue={toolbarSearch}
                                    onSearchChange={setToolbarSearch}
                                    searchPlaceholder={t('styleGuide.primitives.toolbar.search')}
                                    filters={
                                        <FilterMenu
                                            label={t('styleGuide.primitives.filterMenu.label')}
                                            title={t('styleGuide.primitives.filterMenu.title')}
                                            activeCount={activeFilterCount}
                                            onReset={() => {
                                                setFilterMineOnly(false);
                                                setFilterBlocked(false);
                                            }}
                                            resetLabel={t('styleGuide.primitives.filterMenu.reset')}
                                        >
                                            <Checkbox
                                                checked={filterMineOnly}
                                                onChange={(event) => setFilterMineOnly(event.target.checked)}
                                                label={t('styleGuide.primitives.filterMenu.mine')}
                                            />
                                            <Checkbox
                                                checked={filterBlocked}
                                                onChange={(event) => setFilterBlocked(event.target.checked)}
                                                label={t('styleGuide.primitives.filterMenu.blocked')}
                                            />
                                        </FilterMenu>
                                    }
                                    actions={<Button size="sm">{t('styleGuide.primitives.toolbar.action')}</Button>}
                                />
                                <div className="primitive-demo__rows">
                                    {demoRows.map((row) => (
                                        <div key={row} className="primitive-demo__row">
                                            <span>{row}</span>
                                            <Badge variant="neutral">{t('styleGuide.primitives.toolbar.status')}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </article>

                            <article className="primitive-demo">
                                <div className="primitive-demo__header">
                                    <span className="material-symbols-outlined" aria-hidden="true">inbox</span>
                                    <div>
                                        <h3>{t('styleGuide.standardize.empty.title')}</h3>
                                        <p>{t('styleGuide.standardize.empty.body')}</p>
                                    </div>
                                </div>
                                <EmptyState
                                    compact
                                    title={t('styleGuide.primitives.empty.title')}
                                    message={t('styleGuide.primitives.empty.message')}
                                    actions={<Button size="sm" variant="secondary">{t('styleGuide.primitives.empty.action')}</Button>}
                                />
                            </article>

                            <article className="primitive-demo">
                                <div className="primitive-demo__header">
                                    <span className="material-symbols-outlined" aria-hidden="true">hourglass_empty</span>
                                    <div>
                                        <h3>{t('styleGuide.standardize.skeleton.title')}</h3>
                                        <p>{t('styleGuide.standardize.skeleton.body')}</p>
                                    </div>
                                </div>
                                <SkeletonBlock rows={3} label={t('styleGuide.primitives.skeleton.loading')} />
                            </article>

                            <article className="primitive-demo">
                                <div className="primitive-demo__header">
                                    <span className="material-symbols-outlined" aria-hidden="true">edit_square</span>
                                    <div>
                                        <h3>{t('styleGuide.standardize.inlineEdit.title')}</h3>
                                        <p>{t('styleGuide.standardize.inlineEdit.body')}</p>
                                    </div>
                                </div>
                                <InlineEditCell
                                    label={t('styleGuide.primitives.inlineEdit.label')}
                                    value={inlineOwner}
                                    emptyLabel={t('styleGuide.primitives.inlineEdit.empty')}
                                    saveLabel={t('common.save')}
                                    cancelLabel={t('styleGuide.modals.cancel')}
                                    onSave={(value) => setInlineOwner(value)}
                                />
                            </article>

                            <article className="primitive-demo">
                                <div className="primitive-demo__header">
                                    <span className="material-symbols-outlined" aria-hidden="true">filter_alt</span>
                                    <div>
                                        <h3>{t('styleGuide.standardize.filters.title')}</h3>
                                        <p>{t('styleGuide.standardize.filters.body')}</p>
                                    </div>
                                </div>
                                <div className="primitive-demo__inline">
                                    <FilterMenu
                                        label={t('styleGuide.primitives.filterMenu.label')}
                                        title={t('styleGuide.primitives.filterMenu.title')}
                                        activeCount={activeFilterCount}
                                        onReset={() => {
                                            setFilterMineOnly(false);
                                            setFilterBlocked(false);
                                        }}
                                        resetLabel={t('styleGuide.primitives.filterMenu.reset')}
                                    >
                                        <Checkbox
                                            checked={filterMineOnly}
                                            onChange={(event) => setFilterMineOnly(event.target.checked)}
                                            label={t('styleGuide.primitives.filterMenu.mine')}
                                        />
                                        <Checkbox
                                            checked={filterBlocked}
                                            onChange={(event) => setFilterBlocked(event.target.checked)}
                                            label={t('styleGuide.primitives.filterMenu.blocked')}
                                        />
                                    </FilterMenu>
                                </div>
                            </article>

                            <article className="primitive-demo primitive-demo--wide">
                                <div className="primitive-demo__header">
                                    <span className="material-symbols-outlined" aria-hidden="true">linear_scale</span>
                                    <div>
                                        <h3>{t('styleGuide.standardize.stepper.title')}</h3>
                                        <p>{t('styleGuide.standardize.stepper.body')}</p>
                                    </div>
                                </div>
                                <Stepper steps={stepperSteps} onStepClick={(step) => setActiveStepId(step.id)} />
                            </article>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
