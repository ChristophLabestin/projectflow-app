/**
 * Viewport position of a character offset inside a textarea/input (the blinking caret), via a hidden
 * mirror element that copies the field's text metrics. Used to anchor the ✦ trigger just below the
 * caret. Returns null when the element is not laid out.
 */
const COPY = [
    'boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
    'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant',
    'fontWeight', 'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
    'letterSpacing', 'wordSpacing', 'tabSize'
] as const;

export interface CaretRect { left: number; top: number; bottom: number; height: number }

export const getCaretRect = (field: HTMLTextAreaElement | HTMLInputElement, offset = field.selectionEnd ?? 0): CaretRect | null => {
    const box = field.getBoundingClientRect();
    if (!box.width) return null;
    const style = window.getComputedStyle(field);
    const mirror = document.createElement('div');
    const isInput = field.nodeName === 'INPUT';
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '-9999px';
    mirror.style.whiteSpace = isInput ? 'pre' : 'pre-wrap';
    mirror.style.overflowWrap = 'break-word';
    COPY.forEach((key) => { (mirror.style as any)[key] = style[key]; });
    mirror.textContent = field.value.slice(0, offset);
    const marker = document.createElement('span');
    marker.textContent = field.value.slice(offset) || '.';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
    const left = box.left + marker.offsetLeft - field.scrollLeft + parseFloat(style.borderLeftWidth || '0');
    const top = box.top + marker.offsetTop - field.scrollTop + parseFloat(style.borderTopWidth || '0');
    document.body.removeChild(mirror);
    return { left, top, bottom: top + lineHeight, height: lineHeight };
};
