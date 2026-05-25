import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './common/Button/Button';
import { CreateProjectWizard } from '../screens/CreateProjectWizard';
import { useLanguage } from '../context/LanguageContext';

type CreateProjectModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();

    const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target;

        if (!(target instanceof Node) || !event.currentTarget.contains(target)) {
            event.stopPropagation();
            return;
        }

        if (target instanceof Element && target.closest('.create-project__shell, .create-project__blocked')) {
            event.stopPropagation();
            return;
        }

        onClose();
    };

    useEffect(() => {
        if (!isOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="create-project-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('createProjectWizard.header.title')}
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <Button
                type="button"
                variant="secondary"
                size="icon"
                className="create-project-modal__close"
                onClick={onClose}
                aria-label={t('createProjectWizard.actions.close')}
            >
                <span className="material-symbols-outlined">close</span>
            </Button>
            <div
                className="create-project-modal__content"
                onClick={handleContentClick}
            >
                <CreateProjectWizard onClose={onClose} />
            </div>
        </div>,
        document.body
    );
};

export default CreateProjectModal;
