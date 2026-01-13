
import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { generateSocialCaption } from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface AICaptionGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (caption: string) => void;
    platform?: string;
}

const TONES = [
    { id: 'Professional', key: 'social.aiCaption.tones.professional' },
    { id: 'Casual', key: 'social.aiCaption.tones.casual' },
    { id: 'Funny', key: 'social.aiCaption.tones.funny' },
    { id: 'Urgent', key: 'social.aiCaption.tones.urgent' },
    { id: 'Inspirational', key: 'social.aiCaption.tones.inspirational' },
    { id: 'Educational', key: 'social.aiCaption.tones.educational' }
];

export const AICaptionGenerator: React.FC<AICaptionGeneratorProps> = ({ isOpen, onClose, onGenerate, platform = 'Instagram' }) => {
    const [topic, setTopic] = useState('');
    const [tone, setTone] = useState('Professional');
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    const generate = async () => {
        setLoading(true);
        try {
            const caption = await generateSocialCaption(topic, tone, platform);
            onGenerate(caption);
            onClose();
        } catch (error) {
            console.error("Failed to generate caption", error);
            // Fallback or error state could be handled here
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('social.aiCaption.title')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>{t('social.aiCaption.cancel')}</Button>
                    <Button variant="primary" onClick={generate} isLoading={loading} disabled={!topic}>
                        <span className="material-symbols-outlined mr-2">auto_awesome</span>
                        {t('social.aiCaption.generate')}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-indigo-600">auto_awesome</span>
                    <p className="text-sm text-indigo-900 dark:text-indigo-200">
                        {t('social.aiCaption.description')}
                    </p>
                </div>

                <Input
                    label={t('social.aiCaption.topicLabel')}
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder={t('social.aiCaption.topicPlaceholder')}
                    autoFocus
                />

                <Select label={t('social.aiCaption.toneLabel')} value={tone} onChange={e => setTone(e.target.value)}>
                    {TONES.map(toneOption => (
                        <option key={toneOption.id} value={toneOption.id}>{t(toneOption.key)}</option>
                    ))}
                </Select>
            </div>
        </Modal>
    );
};
