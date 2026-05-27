import React, { useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { Milestone } from '../../types';
import { createMilestone, updateMilestone } from '../../services/dataService';
import { ensureProjectInitiativesMigrated } from '../../services/domain/initiativesService';
import { db } from '../../services/firebase';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { TextInput } from '../common/Input/TextInput';
import { TextArea } from '../common/Input/TextArea';
import { Select, type SelectOption } from '../common/Select/Select';
import { Checkbox } from '../common/Checkbox/Checkbox';
import { DatePicker } from '../common/DateTime/DatePicker';
import { useLanguage } from '../../context/LanguageContext';
import confetti from 'canvas-confetti';

interface MilestoneModalProps {
    projectId: string;
    tenantId?: string;
    isOpen: boolean;
    onClose: () => void;
    milestone?: Milestone;
}

export const MilestoneModal = ({ projectId, tenantId, isOpen, onClose, milestone }: MilestoneModalProps) => {
    const { t } = useLanguage();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [status, setStatus] = useState<'Pending' | 'Achieved' | 'Missed'>('Pending');
    const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
    const [linkedInitiativeId, setLinkedInitiativeId] = useState<string>('');
    const [availableTasks, setAvailableTasks] = useState<any[]>([]);
    const [availableInitiatives, setAvailableInitiatives] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const initiativeOptions = useMemo<SelectOption[]>(() => ([
        { value: '', label: t('projectMilestones.modal.fields.initiativeNone') },
        ...availableInitiatives.map(idea => ({ value: idea.id, label: idea.title }))
    ]), [availableInitiatives, t]);

    const statusOptions = useMemo<SelectOption[]>(() => ([
        { value: 'Pending', label: t('projectMilestones.status.pending') },
        { value: 'Achieved', label: t('projectMilestones.status.achieved') },
        { value: 'Missed', label: t('projectMilestones.status.missed') }
    ]), [t]);

    useEffect(() => {
        const fetchData = async () => {
            if (!projectId) return;

            try {
                const tasksSnap = tenantId
                    ? await getDocs(collection(db, 'tenants', tenantId, 'projects', projectId, 'tasks'))
                    : await getDocs(query(collectionGroup(db, 'tasks'), where('projectId', '==', projectId)));
                setAvailableTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data(), ref: d.ref })));

                await ensureProjectInitiativesMigrated(projectId, tenantId).catch(console.error);

                const initiativesSnap = tenantId
                    ? await getDocs(collection(db, 'tenants', tenantId, 'projects', projectId, 'initiatives'))
                    : await getDocs(query(collectionGroup(db, 'initiatives'), where('projectId', '==', projectId)));
                const nextInitiatives = initiativesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                if (nextInitiatives.length > 0) {
                    setAvailableInitiatives(nextInitiatives);
                } else {
                    const ideasSnap = tenantId
                        ? await getDocs(collection(db, 'tenants', tenantId, 'projects', projectId, 'ideas'))
                        : await getDocs(query(collectionGroup(db, 'ideas'), where('projectId', '==', projectId)));
                    setAvailableInitiatives(ideasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                }
            } catch (e) {
                console.error('Error fetching dependencies', e);
            }
        };

        if (isOpen) {
            fetchData();
            if (milestone) {
                setTitle(milestone.title);
                setDescription(milestone.description || '');
                setDueDate(milestone.dueDate || '');
                setStatus(milestone.status);
                setLinkedTaskIds(milestone.linkedTaskIds || []);
                setLinkedInitiativeId(milestone.linkedInitiativeId || '');
            } else {
                setTitle('');
                setDescription('');
                setDueDate('');
                setStatus('Pending');
                setLinkedTaskIds([]);
                setLinkedInitiativeId('');
            }
        }
    }, [isOpen, milestone, projectId, tenantId]);

    const handleSave = async () => {
        setLoading(true);

        try {
            const payload = {
                title,
                description,
                dueDate,
                status,
                linkedTaskIds,
                linkedInitiativeId
            };

            if (status === 'Achieved' && (!milestone || milestone.status !== 'Achieved')) {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }

            if (milestone) {
                await updateMilestone(projectId, milestone.id, payload, tenantId || milestone.tenantId);
            } else {
                await createMilestone(projectId, payload, tenantId);
            }

            if (dueDate && linkedTaskIds.length > 0) {
                const allTasksSnap = tenantId
                    ? await getDocs(collection(db, 'tenants', tenantId, 'projects', projectId, 'tasks'))
                    : await getDocs(query(collectionGroup(db, 'tasks'), where('projectId', '==', projectId)));

                const batchUpdates: Promise<void>[] = [];
                allTasksSnap.forEach(docSnap => {
                    if (linkedTaskIds.includes(docSnap.id)) {
                        const taskData = docSnap.data();
                        if (!taskData.dueDate) {
                            batchUpdates.push(updateDoc(docSnap.ref, { dueDate }));
                        }
                    }
                });

                await Promise.all(batchUpdates);
            }

            onClose();
        } catch (error) {
            console.error('Failed to save milestone', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={milestone ? t('projectMilestones.modal.title.edit') : t('projectMilestones.modal.title.new')}
            size="md"
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        {t('projectMilestones.modal.actions.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={loading}
                        disabled={!title || loading}
                    >
                        {milestone ? t('projectMilestones.modal.actions.update') : t('projectMilestones.modal.actions.create')}
                    </Button>
                </>
            )}
        >
            <div className="milestone-modal">
                <div className="milestone-modal__form">
                    <TextInput
                        label={t('projectMilestones.modal.fields.title')}
                        placeholder={t('projectMilestones.modal.fields.titlePlaceholder')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        autoFocus
                    />

                    <TextArea
                        label={t('projectMilestones.modal.fields.description')}
                        placeholder={t('projectMilestones.modal.fields.descriptionPlaceholder')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                    />

                    <DatePicker
                        label={t('projectMilestones.modal.fields.dueDate')}
                        value={dueDate ? new Date(dueDate) : null}
                        onChange={(date) => setDueDate(date ? format(date, 'yyyy-MM-dd') : '')}
                    />

                    <Select
                        label={t('projectMilestones.modal.fields.initiative')}
                        value={linkedInitiativeId}
                        onChange={(value) => setLinkedInitiativeId(String(value))}
                        options={initiativeOptions}
                        className="milestone-modal__select"
                    />

                    <div className="milestone-modal__tasks">
                        <div className="milestone-modal__tasks-header">
                            <span>{t('projectMilestones.modal.fields.tasks')}</span>
                            <span className="milestone-modal__tasks-hint">{t('projectMilestones.modal.fields.tasksHint')}</span>
                        </div>
                        <div className="milestone-modal__tasks-list">
                            {availableTasks.length === 0 && (
                                <p className="milestone-modal__tasks-empty">{t('projectMilestones.modal.fields.tasksEmpty')}</p>
                            )}
                            {availableTasks.map(task => (
                                <Checkbox
                                    key={task.id}
                                    checked={linkedTaskIds.includes(task.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) setLinkedTaskIds([...linkedTaskIds, task.id]);
                                        else setLinkedTaskIds(linkedTaskIds.filter(id => id !== task.id));
                                    }}
                                    label={<span className="milestone-modal__task-title">{task.title}</span>}
                                />
                            ))}
                        </div>
                    </div>

                    {milestone && (
                        <Select
                            label={t('projectMilestones.modal.fields.status')}
                            value={status}
                            onChange={(value) => setStatus(value as 'Pending' | 'Achieved' | 'Missed')}
                            options={statusOptions}
                            className="milestone-modal__select"
                        />
                    )}
                </div>
            </div>
        </Modal>
    );
};
