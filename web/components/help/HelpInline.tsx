import React from 'react';

export type HelpInlineToken =
    | { kind: 'text'; value: string }
    | { kind: 'strong'; value: string }
    | { kind: 'code'; value: string }
    | { kind: 'link'; value: string; href: string };

const TOKEN_PATTERN = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Splits help copy into text / `**strong**` / `` `code` `` / `[label](/route)` tokens. */
export const parseHelpInline = (value: string): HelpInlineToken[] => {
    const tokens: HelpInlineToken[] = [];
    let last = 0;
    for (const match of value.matchAll(TOKEN_PATTERN)) {
        const index = match.index ?? 0;
        if (index > last) tokens.push({ kind: 'text', value: value.slice(last, index) });
        if (match[1] !== undefined) tokens.push({ kind: 'strong', value: match[1] });
        else if (match[2] !== undefined) tokens.push({ kind: 'code', value: match[2] });
        else tokens.push({ kind: 'link', value: match[3], href: match[4] });
        last = index + match[0].length;
    }
    if (last < value.length) tokens.push({ kind: 'text', value: value.slice(last) });
    return tokens;
};

type HelpInlineProps = {
    text: string;
    /** Called for in-app links (`/route`); the drawer navigates and closes. */
    onNavigate: (href: string) => void;
};

export const HelpInline = ({ text, onNavigate }: HelpInlineProps) => (
    <>
        {parseHelpInline(text).map((token, index) => {
            if (token.kind === 'strong') return <strong key={index}>{token.value}</strong>;
            if (token.kind === 'code') return <code key={index} className="help-code">{token.value}</code>;
            if (token.kind === 'link') {
                if (!token.href.startsWith('/')) {
                    return (
                        <a key={index} className="help-link" href={token.href} target="_blank" rel="noreferrer">
                            {token.value}
                        </a>
                    );
                }
                return (
                    <button key={index} type="button" className="help-link" onClick={() => onNavigate(token.href)}>
                        {token.value}
                    </button>
                );
            }
            return <React.Fragment key={index}>{token.value}</React.Fragment>;
        })}
    </>
);
