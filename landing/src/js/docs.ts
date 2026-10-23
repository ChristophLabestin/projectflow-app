import '../styles/docs.scss';

// Copy buttons: copy the sibling <code> (or data-copy-text) and confirm inline for 2 s.
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
    const label = button.querySelector('span');
    const original = label?.textContent ?? '';
    button.addEventListener('click', async () => {
        const text = button.dataset.copyText ?? button.closest('.code')?.querySelector('code')?.textContent ?? '';
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const area = Object.assign(document.createElement('textarea'), { value: text });
            document.body.append(area);
            area.select();
            document.execCommand('copy');
            area.remove();
        }
        button.classList.add('is-copied');
        if (label) label.textContent = button.dataset.copied ?? original;
        window.setTimeout(() => {
            button.classList.remove('is-copied');
            if (label) label.textContent = original;
        }, 2000);
    });
});

// Table of contents: highlight the section currently in view.
const links = new Map(Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc]')).map((a) => [a.dataset.toc!, a]));
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.removeAttribute('aria-current'));
        links.get(entry.target.id)?.setAttribute('aria-current', 'location');
    });
}, { rootMargin: '-20% 0px -70% 0px' });
links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
});
