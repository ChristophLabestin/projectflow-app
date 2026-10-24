import '../styles/base.scss';
import './consent';
import { finePointer, prefersMotion } from './motion';

const header = document.querySelector<HTMLElement>('[data-header]');

// Frosted header once the page scrolls.
if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

// Mobile menu: toggle, Escape, close on navigation.
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
if (toggle && menu && header) {
    const label = toggle.querySelector<HTMLElement>('.sr-only');
    const setOpen = (open: boolean) => {
        toggle.setAttribute('aria-expanded', String(open));
        menu.hidden = !open;
        header.classList.toggle('is-open', open);
        if (label) label.textContent = open ? label.dataset.labelClose ?? '' : label.dataset.labelOpen ?? '';
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (event) => {
        if ((event.target as HTMLElement).closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !menu.hidden) {
            setOpen(false);
            toggle.focus();
        }
    });
    matchMedia('(min-width: 901px)').addEventListener('change', (e) => e.matches && setOpen(false));
}

// Magnetic CTAs: the button follows the pointer a few pixels, eased by its CSS transition.
if (prefersMotion() && finePointer()) {
    document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
        el.addEventListener('pointermove', (event) => {
            const rect = el.getBoundingClientRect();
            const dx = (event.clientX - rect.left - rect.width / 2) / rect.width;
            const dy = (event.clientY - rect.top - rect.height / 2) / rect.height;
            el.style.transform = `translate3d(${dx * 10}px, ${dy * 8}px, 0)`;
        });
        el.addEventListener('pointerleave', () => {
            el.style.transform = '';
        });
    });
}
