import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from '../DatePicker';

describe('DatePicker', () => {
    it('portals the calendar popover outside clipped modal shells', async () => {
        const user = userEvent.setup();

        render(
            <div style={{ overflow: 'hidden' }}>
                <DatePicker
                    value={null}
                    onChange={vi.fn()}
                    placeholder="Pick a date"
                />
            </div>
        );

        await user.click(screen.getByPlaceholderText('Pick a date'));

        const popover = document.body.querySelector('.dt-picker__popover--portal');

        expect(popover).toBeInTheDocument();
        expect(popover?.parentElement).toBe(document.body);
        expect(popover).toHaveStyle({ position: 'fixed' });
    });
});
