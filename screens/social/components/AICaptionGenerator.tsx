
import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

interface AICaptionGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (caption: string) => void;
}

const TONES = ['Professional', 'Casual', 'Funny', 'Urgent', 'Inspirational'];

export const AICaptionGenerator: React.FC<AICaptionGeneratorProps> = ({ isOpen, onClose, onGenerate }) => {
    const [topic, setTopic] = useState('');
    const [tone, setTone] = useState('Professional');
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        setLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        const templates = [
            `🚀 Excited to share our latest update on ${topic}! We've been working hard to bring this to you. #updates #news`,
            `💡 Did you know? ${topic} is changing the game. Learn more at the link in bio!`,
            `✨ ${topic} vibes only today. What are your thoughts? 👇`,
            `🔥 Don't miss out on ${topic}. Limited time only!`,
            `Here's why ${topic} matters more than ever... 🧵`
        ];

        const randomCaption = templates[Math.floor(Math.random() * templates.length)];
        onGenerate(randomCaption);
        setLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI Caption Generator"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={generate} isLoading={loading} disabled={!topic}>
                        <span className="material-symbols-outlined mr-2">auto_awesome</span>
                        Generate
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-indigo-600">auto_awesome</span>
                    <p className="text-sm text-indigo-900 dark:text-indigo-200">
                        Describe what you want to post about, and I'll generate a catchy caption for you.
                    </p>
                </div>

                <Input
                    label="What is this post about?"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g. New Summer Collection launch"
                    autoFocus
                />

                <Select label="Tone" value={tone} onChange={e => setTone(e.target.value)}>
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
            </div>
        </Modal>
    );
};
