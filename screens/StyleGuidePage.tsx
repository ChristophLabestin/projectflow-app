import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/common/Button/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../components/common/Card/Card';
import { TextInput } from '../components/common/Input/TextInput';
import { TextArea } from '../components/common/Input/TextArea';
import { Badge } from '../components/common/Badge/Badge';
import { Divider } from '../components/common/Divider/Divider';
import { Modal } from '../components/common/Modal/Modal';
import { ConfirmModal } from '../components/common/Modal/ConfirmModal';
import { SettingsModal } from '../components/common/Modal/SettingsModal';
import './style-guide.scss';
import { Link } from '../routing/Router';
import { DatePicker } from '../components/common/DateTime/DatePicker';
import { TimePicker } from '../components/common/DateTime/TimePicker';
import { DateTimePicker } from '../components/common/DateTime/DateTimePicker';
import { PrioritySelect, type Priority } from '../components/common/PrioritySelect/PrioritySelect';
import { Select } from '../components/common/Select/Select';
import { MediaLibraryModal } from '../components/common/MediaLibrary/MediaLibraryModal';
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
    const { theme, toggleTheme } = useTheme();
    const { t } = useLanguage();

    // Modal States
    const [isBaseModalOpen, setBaseModalOpen] = useState(false);
    const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [isMediaModalOpen, setMediaModalOpen] = useState(false);
    const [actionNotice, setActionNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);

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

    return (
        <div className="style-guide">
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
                    <MediaLibraryModal
                        isOpen={isMediaModalOpen}
                        onClose={() => setMediaModalOpen(false)}
                        onSelect={handleMediaSelect}
                        allowMultiSelect
                    />
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
            </main>
        </div>
    );
}
