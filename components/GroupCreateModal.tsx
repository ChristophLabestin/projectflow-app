import React, { useState } from 'react';
import { Modal } from './common/Modal/Modal';
import { Button } from './common/Button/Button';
import { TextInput } from './common/Input/TextInput';
import { TextArea } from './common/Input/TextArea';
import { useLanguage } from '../context/LanguageContext';

interface GroupCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, description: string, color: string) => Promise<void>;
}

export const GroupCreateModal: React.FC<GroupCreateModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#3b82f6'); // Default Blue
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        try {
            setLoading(true);
            await onCreate(name, description, color);
            onClose();
            setName('');
            setDescription('');
            setColor('#3b82f6');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const colors = [
        '#ef4444', // Red
        '#f97316', // Orange
        '#f59e0b', // Amber
        '#10b981', // Emerald
        '#3b82f6', // Blue
        '#6366f1', // Indigo
        '#8b5cf6', // Violet
        '#ec4899', // Pink
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('projectGroups.modal.createTitle')}>
            <div className="group-create-modal">
                <form onSubmit={handleSubmit} className="group-create-modal__form">
                    <TextInput
                        label={t('projectGroups.modal.fields.name')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('projectGroups.modal.fields.namePlaceholder')}
                        required
                        className="group-create-modal__field"
                    />

                    <TextArea
                        label={t('projectGroups.modal.fields.description')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('projectGroups.modal.fields.descriptionPlaceholder')}
                        className="group-create-modal__field group-create-modal__textarea"
                    />

                    <div className="group-create-modal__color">
                        <label className="group-create-modal__label">{t('projectGroups.modal.fields.color')}</label>
                        <div className="group-create-modal__swatches">
                            {colors.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`group-create-modal__swatch ${color === c ? 'is-selected' : ''}`}
                                    style={{ backgroundColor: c }}
                                    aria-pressed={color === c}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="group-create-modal__actions">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={loading}
                            disabled={loading || !name.trim()}
                        >
                            {t('projectGroups.actions.create')}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};
