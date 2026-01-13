import React, { useEffect, useMemo, useState } from 'react';

import { createPortal } from 'react-dom';

import { useArrowReplacement } from '../hooks/useArrowReplacement';

import { createIssue } from '../services/dataService';

import { MultiAssigneeSelector } from './MultiAssigneeSelector';

import { usePinnedTasks, PinnedItem } from '../context/PinnedTasksContext';

import { useLanguage } from '../context/LanguageContext';

import { Button } from './common/Button/Button';

import { TextInput } from './common/Input/TextInput';

import { TextArea } from './common/Input/TextArea';

import { Select, type SelectOption } from './common/Select/Select';



interface CreateIssueModalProps {

    isOpen: boolean;

    onClose: () => void;

    projectId: string;

    initialDescription?: string;

    initialTitle?: string;

}



export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({

    isOpen,

    onClose,

    projectId,

    initialDescription = '',

    initialTitle = ''

}) => {

    const [title, setTitle] = useState(initialTitle);

    const [description, setDescription] = useState(initialDescription);

    const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');

    const [status, setStatus] = useState<'Open' | 'In Progress' | 'Resolved' | 'Closed'>('Open');

    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

    const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);

    const [startDate, setStartDate] = useState('');

    const [dueDate, setDueDate] = useState('');

    const [isAdding, setIsAdding] = useState(false);

    const [pinOnCreate, setPinOnCreate] = useState(false);



    const { pinItem } = usePinnedTasks();

    const { t } = useLanguage();



    const handleTitleChange = useArrowReplacement((e) => setTitle(e.target.value));

    const handleDescriptionChange = useArrowReplacement((e) => setDescription(e.target.value));



    useEffect(() => {

        if (isOpen) {

            setTitle(initialTitle || '');

            setDescription(initialDescription || '');

            setPriority('Medium');

            setStatus('Open');

            setAssigneeIds([]);

            setAssignedGroupIds([]);

            setStartDate('');

            setDueDate('');

            setPinOnCreate(false);

        }

    }, [isOpen, initialTitle, initialDescription]);



    useEffect(() => {

        const handleEsc = (e: KeyboardEvent) => {

            if (e.key === 'Escape') onClose();

        };

        if (isOpen) {

            window.addEventListener('keydown', handleEsc);

        }

        return () => window.removeEventListener('keydown', handleEsc);

    }, [isOpen, onClose]);



    const handleSubmit = async (e?: React.FormEvent) => {

        e?.preventDefault();

        if (!title.trim()) return;

        setIsAdding(true);

        try {

            const newIssueId = await createIssue(projectId, {

                title: title.trim(),

                description,

                priority,

                status,

                assigneeIds,

                assignedGroupIds,

                startDate: startDate || undefined,

                dueDate: dueDate || undefined

            });



            // Pin the issue if checkbox is checked

            if (pinOnCreate && newIssueId) {

                const newPinnedItem: PinnedItem = {

                    id: newIssueId,

                    type: 'issue',

                    title: title.trim(),

                    projectId,

                    priority

                };

                pinItem(newPinnedItem);

            }



            onClose();

        } catch (error) {

            console.error('Failed to create issue', error);

        } finally {

            setIsAdding(false);

        }

    };



    const priorityLabels: Record<typeof priority, string> = {

        Urgent: t('tasks.priority.urgent'),

        High: t('tasks.priority.high'),

        Medium: t('tasks.priority.medium'),

        Low: t('tasks.priority.low'),

    };



    const statusLabels: Record<typeof status, string> = {

        Open: t('projectIssues.status.open'),

        'In Progress': t('projectIssues.status.inProgress'),

        Resolved: t('projectIssues.status.resolved'),

        Closed: t('projectIssues.status.closed'),

    };



    const priorityOptions = useMemo<SelectOption[]>(() => ([

        { value: 'Low', label: priorityLabels.Low },

        { value: 'Medium', label: priorityLabels.Medium },

        { value: 'High', label: priorityLabels.High },

        { value: 'Urgent', label: priorityLabels.Urgent },

    ]), [priorityLabels]);



    const statusOptions = useMemo<SelectOption[]>(() => ([

        { value: 'Open', label: statusLabels.Open },

        { value: 'In Progress', label: statusLabels['In Progress'] },

        { value: 'Resolved', label: statusLabels.Resolved },

        { value: 'Closed', label: statusLabels.Closed },

    ]), [statusLabels]);



    if (!isOpen) return null;



    return createPortal(

        <div

            className="modal-overlay issue-modal"

            onClick={onClose}

        >

            <div

                className="issue-modal__content"

                onClick={(e) => e.stopPropagation()}

            >

                <form onSubmit={handleSubmit} className="issue-modal__form">
                    <div className="issue-modal__title">

                        <TextInput

                            value={title}

                            onChange={handleTitleChange}

                            placeholder={t('createIssue.placeholder.title')}

                            autoFocus

                            maxLength={100}

                            aria-label={t('createIssue.placeholder.title')}

                            className="issue-modal__title-input"

                        />

                    </div>



                    <div className="issue-modal__toolbar">

                        <Select

                            label={t('projectIssues.modal.fields.priority')}

                            value={priority}

                            onChange={(value) => setPriority(value as typeof priority)}

                            options={priorityOptions}

                            className="issue-modal__select issue-modal__select--priority"

                        />

                        <Select

                            label={t('createIssue.labels.status')}

                            value={status}

                            onChange={(value) => setStatus(value as typeof status)}

                            options={statusOptions}

                            className="issue-modal__select issue-modal__select--status"

                        />

                    </div>



                    <div className="issue-modal__section issue-modal__section--description">

                        <TextArea

                            value={description}

                            onChange={handleDescriptionChange}

                            placeholder={t('createIssue.placeholder.description')}

                            rows={3}

                            aria-label={t('createIssue.placeholder.description')}

                            className="issue-modal__description-input"

                        />

                    </div>



                    <div className="issue-modal__section">

                        <label className="issue-modal__label">{t('createIssue.labels.assignees')}</label>

                        <MultiAssigneeSelector

                            projectId={projectId}

                            assigneeIds={assigneeIds}

                            assignedGroupIds={assignedGroupIds}

                            onChange={setAssigneeIds}

                            onGroupChange={setAssignedGroupIds}

                        />

                    </div>



                    <div className="issue-modal__dates">

                        <TextInput

                            type="date"

                            label={t('createIssue.labels.startDate')}

                            value={startDate}

                            onChange={(e) => setStartDate(e.target.value)}

                            className="issue-modal__date-input"

                        />

                        <TextInput

                            type="date"

                            label={t('createIssue.labels.dueDate')}

                            value={dueDate}

                            onChange={(e) => setDueDate(e.target.value)}

                            className="issue-modal__date-input"

                        />

                    </div>



                    {/* Footer */}

                    <div className="issue-modal__footer">

                        <span className="issue-modal__hint">

                            <kbd>{t('createIssue.hint.keyAlt')}</kbd>

                            <span>+</span>

                            <kbd>{t('createIssue.hint.keyP')}</kbd>

                            <span className="issue-modal__hint-label">{t('createIssue.hint.togglePin')}</span>

                        </span>

                        <div className="issue-modal__actions">

                            <Button type="button" variant="ghost" size="sm" onClick={onClose}>

                                {t('common.cancel')}

                            </Button>



                            {/* Pin on Create Toggle */}

                            <button
                                type="button"
                                onClick={() => setPinOnCreate(!pinOnCreate)}
                                className={`issue-modal__pin-toggle ${pinOnCreate ? 'is-active' : ''}`}
                            >
                                <span className="material-symbols-outlined">{pinOnCreate ? 'keep' : 'keep_off'}</span>
                                {t('createIssue.pin.label')}
                            </button>


                            <Button type="submit" size="sm" isLoading={isAdding} disabled={!title.trim()}>

                                {t('createIssue.actions.create')}

                            </Button>

                        </div>

                    </div>

                </form>

            </div>

        </div>,

        document.body

    );

};

