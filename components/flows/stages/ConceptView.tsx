import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { generateIdeaConceptAI } from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface ConceptViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
    chatHistoryRef?: { role: string; content: string }[];
}

const MenuBar = ({ editor }: { editor: any }) => {
    const { t } = useLanguage();
    if (!editor) return null;

    return (
        <div className="flow-concept__toolbar">
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`flow-concept__tool ${editor.isActive('bold') ? 'is-active' : ''}`}
                title={t('flowStages.concept.toolbar.bold')}
            >
                <span className="material-symbols-outlined">format_bold</span>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`flow-concept__tool ${editor.isActive('italic') ? 'is-active' : ''}`}
                title={t('flowStages.concept.toolbar.italic')}
            >
                <span className="material-symbols-outlined">format_italic</span>
            </button>
            <div className="flow-concept__divider" />
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`flow-concept__tool ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
                title={t('flowStages.concept.toolbar.heading1')}
            >
                <span className="material-symbols-outlined">format_h1</span>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`flow-concept__tool ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
                title={t('flowStages.concept.toolbar.heading2')}
            >
                <span className="material-symbols-outlined">format_h2</span>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`flow-concept__tool ${editor.isActive('bulletList') ? 'is-active' : ''}`}
                title={t('flowStages.concept.toolbar.bullets')}
            >
                <span className="material-symbols-outlined">format_list_bulleted</span>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`flow-concept__tool ${editor.isActive('orderedList') ? 'is-active' : ''}`}
                title={t('flowStages.concept.toolbar.numbered')}
            >
                <span className="material-symbols-outlined">format_list_numbered</span>
            </button>
            <div className="flow-concept__divider" />
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`flow-concept__tool ${editor.isActive('blockquote') ? 'is-active' : ''}`}
                title={t('flowStages.concept.toolbar.quote')}
            >
                <span className="material-symbols-outlined">format_quote</span>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className="flow-concept__tool"
                title={t('flowStages.concept.toolbar.divider')}
            >
                <span className="material-symbols-outlined">horizontal_rule</span>
            </button>
        </div>
    );
};

export const ConceptView: React.FC<ConceptViewProps> = ({ idea, onUpdate, chatHistoryRef }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: t('flowStages.concept.placeholder'),
            }),
        ],
        content: idea.concept || '',
        editorProps: {
            attributes: {
                class: 'flow-concept__editor-content prose',
            },
        },
        onUpdate: ({ editor }) => {
            onUpdate({ concept: editor.getHTML() });
        },
    });

    const handleGenerateConcept = async () => {
        if (!editor) return;
        setGenerating(true);
        try {
            const context = chatHistoryRef
                ? chatHistoryRef.map(m => `${m.role}: ${m.content}`).join('\n')
                : '';

            const htmlContent = await generateIdeaConceptAI(idea, context);
            editor.commands.setContent(htmlContent);
            onUpdate({ concept: htmlContent });
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };



    return (
        <div className="flow-concept">
            <div className="flow-concept__topbar">
                <MenuBar editor={editor} />

                <div className="flow-concept__actions">
                    {!idea.concept && (
                        <span className="flow-concept__hint">
                            {t('flowStages.concept.ready')}
                        </span>
                    )}
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={handleGenerateConcept}
                        isLoading={generating}
                        className="flow-concept__draft"
                        icon={<span className="material-symbols-outlined">auto_awesome</span>}
                    >
                        {t('flowStages.concept.actions.draftAi')}
                    </Button>
                    <div className="flow-concept__divider" />
                    <Button
                        size="sm"
                        onClick={() => onUpdate({ stage: idea.type === 'Product' ? 'Launch' : 'Review' })}
                        className="flow-concept__advance"
                        icon={<span className="material-symbols-outlined">arrow_forward</span>}
                        iconPosition="right"
                    >
                        {t('flowStages.concept.actions.advance')}
                    </Button>
                </div>
            </div>

            <div className="flow-concept__body">
                <div className="flow-concept__editor" onClick={() => editor?.commands.focus()}>
                    <EditorContent editor={editor} className="flow-concept__editor-shell" />

                    {generating && (
                        <div className="flow-concept__overlay">
                            <div className="flow-concept__overlay-card">
                                <div className="flow-concept__overlay-icon">
                                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                    <span className="material-symbols-outlined">auto_awesome</span>
                                </div>
                                <p>{t('flowStages.concept.generating')}</p>
                            </div>
                        </div>
                    )}

                    {(!editor || editor.isEmpty) && !generating && (
                        <div className="flow-concept__empty">
                            <span className="material-symbols-outlined">article</span>
                            <p>{t('flowStages.concept.empty')}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flow-concept__footer">
                <span>{t('flowStages.concept.footer.markdown')}</span>
                <span>{t('flowStages.concept.footer.words').replace('{count}', String(editor?.storage.characterCount?.words() || 0))}</span>
            </div>
        </div>
    );
};
