import React, { useEffect, useState } from 'react';
import { Issue } from '../types';
import { updateIssue } from '../services/dataService';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './common/Button/Button';
import { TextInput } from './common/Input/TextInput';
import { TextArea } from './common/Input/TextArea';
import { Modal } from './common/Modal/Modal';
import { MultiAssigneeSelector } from './MultiAssigneeSelector';

interface EditIssueModalProps {
    issue: Issue;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export const EditIssueModal: React.FC<EditIssueModalProps> = ({ issue, isOpen, onClose, onUpdate }) => {
    const [title, setTitle] = useState(issue.title);
    const [description, setDescription] = useState(issue.description || '');
    const [assigneeIds, setAssigneeIds] = useState<string[]>(issue.assigneeIds || (issue.assigneeId ? [issue.assigneeId] : []));
    const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>(issue.assignedGroupIds || []);
    const [startDate, setStartDate] = useState(issue.startDate || '');
    const [dueDate, setDueDate] = useState(issue.dueDate || issue.scheduledDate || '');
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        if (isOpen) {
            setTitle(issue.title);
            setDescription(issue.description || '');
            setAssigneeIds(issue.assigneeIds || (issue.assigneeId ? [issue.assigneeId] : []));
            setAssignedGroupIds(issue.assignedGroupIds || []);
            setStartDate(issue.startDate || '');
            setDueDate(issue.dueDate || issue.scheduledDate || '');
        }
    }, [isOpen, issue]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateIssue(issue.id, {
                title,
                description,
                assigneeIds,
                assignedGroupIds,
                startDate: startDate || undefined,
                dueDate: dueDate || undefined
            }, issue.projectId, issue.tenantId);
            onUpdate();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" title={t('issueEdit.title')}>
            <form onSubmit={handleSave} className="issue-edit">
                <p className="issue-edit__subtitle">{t('issueEdit.subtitle')}</p>
                <div className="issue-edit__fields">
                    <TextInput
                        label={t('projectIssues.modal.fields.title')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('projectIssues.modal.fields.titlePlaceholder')}
                        required
                        className="issue-edit__title"
                    />

                    <TextArea
                        label={t('projectIssues.modal.fields.description')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('projectIssues.modal.fields.descriptionPlaceholder')}
                        rows={8}
                        className="issue-edit__description"
                    />

                    <div className="issue-edit__field">
                        <label className="issue-edit__label">{t('projectIssues.modal.fields.assignees')}</label>
                        <MultiAssigneeSelector
                            projectId={issue.projectId}
                            assigneeIds={assigneeIds}
                            assignedGroupIds={assignedGroupIds}
                            onChange={setAssigneeIds}
                            onGroupChange={setAssignedGroupIds}
                        />
                    </div>

                    <div className="issue-edit__dates">
                        <TextInput
                            type="date"
                            label={t('createIssue.labels.startDate')}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="issue-edit__date-input"
                        />
                        <TextInput
                            type="date"
                            label={t('createIssue.labels.dueDate')}
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="issue-edit__date-input"
                        />
                    </div>
                </div>

                <div className="issue-edit__actions">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" isLoading={loading} disabled={!title.trim()}>
                        {t('common.saveChanges')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
