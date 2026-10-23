import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Safe renderer for assistant answers: plain text with **bold**, `code`, "- " lists and links to
 * ProjectFlow objects (`pf://task/P/T`, `pf://project/P`). External links render as plain text and
 * images not at all, so injected content cannot exfiltrate data via URLs (concept §4.9). No HTML.
 */
const internalPath = (href: string): string | null => {
    const task = /^pf:\/\/task\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/.exec(href);
    if (task) return `/project/${task[1]}/tasks/${task[2]}`;
    const project = /^pf:\/\/project\/([A-Za-z0-9_-]+)$/.exec(href);
    if (project) return `/project/${project[1]}`;
    return null;
};

const INLINE = /(!?\[([^\]]*)\]\(([^)\s]*)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;

export const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let index = 0;
    for (const match of text.matchAll(INLINE)) {
        const start = match.index ?? 0;
        if (start > last) nodes.push(text.slice(last, start));
        const key = `${keyPrefix}-${index++}`;
        if (match[2] !== undefined) {
            const isImage = match[1].startsWith('!');
            const path = isImage ? null : internalPath(match[3]);
            if (path) nodes.push(<Link key={key} to={path} className="ai-message__link">{match[2] || path}</Link>);
            else if (!isImage) nodes.push(match[2]);
        } else if (match[4] !== undefined) {
            nodes.push(<strong key={key}>{match[4]}</strong>);
        } else if (match[5] !== undefined) {
            nodes.push(<code key={key}>{match[5]}</code>);
        }
        last = start + match[0].length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
};

/** `streaming`: lines mount as they arrive and fade in (key = line index, so finished lines stay put). */
export const AiMessageText: React.FC<{ text: string; streaming?: boolean }> = ({ text, streaming = false }) => {
    const blocks: React.ReactNode[] = [];
    let list: React.ReactNode[] = [];
    const flush = (key: string) => {
        if (list.length) blocks.push(<ul key={`ul-${key}`}>{list}</ul>);
        list = [];
    };
    text.split('\n').forEach((raw, i) => {
        const line = raw.trimEnd();
        const bullet = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(line);
        if (bullet) {
            list.push(<li key={`li-${i}`} className="ai-message__block">{renderInline(bullet[1], `l${i}`)}</li>);
            return;
        }
        flush(String(i));
        if (!line.trim()) return;
        const heading = /^#{1,4}\s+(.*)$/.exec(line);
        blocks.push(heading
            ? <p key={`p-${i}`} className="ai-message__block ai-message__heading">{renderInline(heading[1], `h${i}`)}</p>
            : <p key={`p-${i}`} className="ai-message__block">{renderInline(line, `p${i}`)}</p>);
    });
    flush('end');
    return (
        <div className={`ai-message__text${streaming ? ' is-streaming' : ''}`}>
            {blocks}
            {streaming && <span className="ai-stream__caret" aria-hidden="true" />}
        </div>
    );
};
