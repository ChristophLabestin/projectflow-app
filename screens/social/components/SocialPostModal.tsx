
import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { SocialPost, SocialPlatform, SocialPostFormat, SocialAsset } from '../../../types';
import { createSocialPost, updateSocialPost } from '../../../services/dataService';
import { useParams } from 'react-router-dom';
import { AICaptionGenerator } from './AICaptionGenerator';
import { AssetPickerModal } from './AssetPickerModal';
import { auth } from '../../../services/firebase';
import { DatePicker } from '../../../components/ui/DatePicker';
import { TimePicker } from '../../../components/ui/TimePicker';
import { useToast } from '../../../context/UIContext';

interface SocialPostModalProps {
    isOpen: boolean;
    onClose: () => void;
    post?: SocialPost;
    defaultDate?: string;
}

export const SocialPostModal: React.FC<SocialPostModalProps> = ({ isOpen, onClose, post, defaultDate }) => {
    const { id: projectId } = useParams<{ id: string }>();

    // Form State
    const [platform, setPlatform] = useState<SocialPlatform>('Instagram');
    const [format, setFormat] = useState<SocialPostFormat>('Image');
    const [caption, setCaption] = useState('');
    const [hashtags, setHashtags] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [loading, setLoading] = useState(false);
    const { showInfo } = useToast();

    // Asset State
    const [assets, setAssets] = useState<SocialAsset[]>([]);
    const [showAssetPicker, setShowAssetPicker] = useState(false);

    // AI Modal State
    const [showAIGenerator, setShowAIGenerator] = useState(false);

    useEffect(() => {
        if (post) {
            setPlatform(post.platform);
            setFormat(post.format);
            setCaption(post.content.caption || '');
            setHashtags(post.content.hashtags?.join(' ') || '');
            setAssets(post.assets || []);

            if (post.scheduledFor) {
                const d = new Date(post.scheduledFor);
                setScheduledDate(d.toISOString().split('T')[0]);
                setScheduledTime(d.toTimeString().slice(0, 5));
            } else {
                setScheduledDate('');
                setScheduledTime('');
            }
        } else {
            setPlatform('Instagram');
            setFormat('Image');
            setCaption('');
            setHashtags('');
            setAssets([]);

            if (defaultDate) {
                setScheduledDate(defaultDate);
                setScheduledTime('12:00');
            } else {
                setScheduledDate('');
                setScheduledTime('');
            }
        }
    }, [post, isOpen, defaultDate]);

    const handleSubmit = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            let scheduledFor = null;
            if (scheduledDate) {
                const dateTimeStr = scheduledTime ? `${scheduledDate}T${scheduledTime}` : `${scheduledDate}T12:00`;
                scheduledFor = new Date(dateTimeStr).toISOString();
            }

            const data: any = {
                platform,
                format,
                content: {
                    caption,
                    hashtags: hashtags.split(' ').filter(h => h.startsWith('#')),
                },
                assets,
                scheduledFor,
                status: scheduledFor ? 'Scheduled' : 'Draft',
                projectId
            };

            if (post) {
                await updateSocialPost(projectId, post.id, data);
            } else {
                await createSocialPost(projectId, data);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save post", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={post ? 'Edit Post' : 'New Post'}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleSubmit} isLoading={loading}>
                        {post ? 'Save Changes' : 'Create Post'}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Select label="Platform" value={platform} onChange={e => setPlatform(e.target.value as any)}>
                        <option value="Instagram">Instagram</option>
                        <option value="Facebook">Facebook</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="TikTok">TikTok</option>
                        <option value="X">X (Twitter)</option>
                    </Select>
                    <Select label="Format" value={format} onChange={e => setFormat(e.target.value as any)}>
                        <option value="Image">Image</option>
                        <option value="Video">Video</option>
                        <option value="Carousel">Carousel</option>
                        <option value="Story">Story</option>
                        <option value="Reel">Reel</option>
                    </Select>
                </div>

                {/* Approval Workflow */}
                {post && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-[var(--color-surface-border)]">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${post.status === 'Approved' ? 'bg-green-500' :
                                    post.status === 'In Review' ? 'bg-amber-500' :
                                        post.status === 'Rejected' ? 'bg-red-500' : 'bg-gray-400'
                                    }`} />
                                <span className="text-sm font-semibold">Status: {post.status}</span>
                            </div>
                            {post.approvals && post.approvals.length > 0 && (
                                <span className="text-xs text-[var(--color-text-muted)]">
                                    Last action by User
                                </span>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {post.status === 'Draft' && (
                                <Button
                                    className="w-full" variant="secondary"
                                    onClick={async () => {
                                        if (!projectId) return;
                                        setLoading(true);
                                        // Mock adding an approval entry
                                        const newApproval = {
                                            required: true,
                                            status: 'Pending',
                                            approvedBy: auth.currentUser?.uid,
                                            approvedAt: new Date().toISOString()
                                        };
                                        await updateSocialPost(projectId, post.id, {
                                            status: 'In Review',
                                            approvals: [...(post.approvals || []), newApproval as any]
                                        });
                                        setLoading(false);
                                        onClose();
                                    }}
                                >
                                    Request Review
                                </Button>
                            )}

                            {post.status === 'In Review' && (
                                <>
                                    <Button
                                        className="flex-1" variant="ghost" className="text-red-500 hover:bg-red-50"
                                        onClick={async () => {
                                            if (!projectId) return;
                                            setLoading(true);
                                            await updateSocialPost(projectId, post.id, { status: 'Rejected' }); // Simplified status update
                                            setLoading(false);
                                            onClose();
                                        }}
                                    >
                                        Reject
                                    </Button>
                                    <Button
                                        className="flex-1" variant="primary"
                                        onClick={async () => {
                                            if (!projectId) return;
                                            setLoading(true);
                                            await updateSocialPost(projectId, post.id, {
                                                status: post.scheduledFor ? 'Scheduled' : 'Approved'
                                            });
                                            setLoading(false);
                                            onClose();
                                        }}
                                    >
                                        Approve
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Media Selection */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase ml-1">Media</label>
                        <button
                            onClick={() => setShowAssetPicker(true)}
                            className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                            Add from Library
                        </button>
                    </div>
                    {assets.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                            {assets.map((asset, idx) => (
                                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-black/5 group border border-[var(--color-surface-border)]">
                                    <img src={asset.url} alt="Post media" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => setAssets(prev => prev.filter((_, i) => i !== idx))}
                                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div
                            onClick={() => setShowAssetPicker(true)}
                            className="h-32 border-2 border-dashed border-[var(--color-surface-border)] rounded-xl flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)]/50 transition-all cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-3xl mb-1">add_photo_alternate</span>
                            <span className="text-sm">Add Media</span>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase ml-1">Caption</label>
                        <button
                            onClick={() => setShowAIGenerator(true)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                            AI Assistant
                        </button>
                    </div>
                    <Textarea
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        placeholder="Write your caption here..."
                        className="min-h-[120px]"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                        <span>{caption.length} characters</span>
                        <span>{caption.split(/\s+/).filter(w => w.startsWith('#')).length} hashtags</span>
                    </div>
                </div>

                <Input
                    label="Hashtags"
                    value={hashtags}
                    onChange={e => setHashtags(e.target.value)}
                    placeholder="#marketing #social"
                />

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--color-surface-border)]">
                    <DatePicker
                        label="Schedule Date"
                        value={scheduledDate || undefined}
                        onChange={(date) => setScheduledDate(date)}
                    />
                    <TimePicker
                        label="Time"
                        value={scheduledTime}
                        onChange={(val) => setScheduledTime(val)}
                    />
                </div>

                {/* Assisted Publishing Section */}
                {post && (post.status === 'Needs Manual Publish' || post.status === 'Scheduled') && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mt-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-amber-600 mt-0.5">handyman</span>
                            <div>
                                <h4 className="font-bold text-sm text-amber-900 dark:text-amber-100">Manual Publishing Required</h4>
                                <p className="text-xs text-amber-800 dark:text-amber-200/80">
                                    {platform} doesn't support auto-publishing for this format yet, or the connection is missing.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(caption)} icon={<span className="material-symbols-outlined">content_copy</span>}>
                                Copy Caption
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => showInfo("Assets downloaded! (Mock)")} icon={<span className="material-symbols-outlined">download</span>}>
                                Download Assets
                            </Button>
                        </div>

                        <Button
                            className="w-full"
                            variant="primary"
                            onClick={async () => {
                                if (projectId && post) {
                                    setLoading(true);
                                    await updateSocialPost(projectId, post.id, { status: 'Published', publishedAt: new Date().toISOString() });
                                    setLoading(false);
                                    onClose();
                                }
                            }}
                        >
                            Mark as Published
                        </Button>
                    </div>
                )}
            </div>

            <AICaptionGenerator
                isOpen={showAIGenerator}
                onClose={() => setShowAIGenerator(false)}
                onGenerate={(text) => setCaption(prev => prev + (prev ? '\n\n' : '') + text)}
            />

            <AssetPickerModal
                isOpen={showAssetPicker}
                onClose={() => setShowAssetPicker(false)}
                onSelect={(asset) => setAssets(prev => [...prev, asset])}
            />
        </Modal>
    );
};
