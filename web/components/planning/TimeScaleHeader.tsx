import React, { useMemo } from 'react';
import { format, getISOWeek } from 'date-fns';

import { useLanguage } from '../../context/LanguageContext';
import { addDays, type TimeScale } from './timeScale';

interface TimeScaleHeaderProps {
    scale: TimeScale;
    granularity: 'day' | 'week';
}

/** Two-row header: months on top, then days (timeline) or ISO weeks (roadmap). */
export const TimeScaleHeader = ({ scale, granularity }: TimeScaleHeaderProps) => {
    const { t, dateLocale } = useLanguage();

    const { months, cells } = useMemo(() => {
        const monthList: { key: string; label: string; left: number; width: number }[] = [];
        const cellList: { key: string; label: string; sub?: string; left: number; width: number; weekend?: boolean; today?: boolean }[] = [];
        const todayKey = new Date().toDateString();
        for (let index = 0; index < scale.days; index += 1) {
            const date = addDays(scale.start, index);
            const left = index * scale.dayWidth;
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            const last = monthList[monthList.length - 1];
            if (!last || last.key !== monthKey) {
                monthList.push({ key: monthKey, label: format(date, 'MMMM yyyy', { locale: dateLocale }), left, width: scale.dayWidth });
            } else {
                last.width += scale.dayWidth;
            }
            if (granularity === 'day') {
                cellList.push({
                    key: date.toDateString(),
                    label: format(date, 'd'),
                    sub: format(date, 'EEEEEE', { locale: dateLocale }),
                    left,
                    width: scale.dayWidth,
                    weekend: date.getDay() === 0 || date.getDay() === 6,
                    today: date.toDateString() === todayKey
                });
            } else if (date.getDay() === 1 || index === 0) {
                // A leading partial week only gets a label if it has room for one.
                const daysInWeek = date.getDay() === 1 ? 7 : ((8 - date.getDay()) % 7) || 7;
                const width = scale.dayWidth * Math.min(daysInWeek, scale.days - index);
                cellList.push({
                    key: date.toDateString(),
                    label: width >= 38 ? t('planning.weekShort').replace('{week}', String(getISOWeek(date))) : '',
                    left,
                    width
                });
            }
        }
        return { months: monthList, cells: cellList };
    }, [scale, granularity, dateLocale, t]);

    return (
        <div className={`timescale timescale--${granularity}`} style={{ width: scale.width }} aria-hidden="true">
            <div className="timescale__months">
                {months.map((month) => (
                    <span key={month.key} className="timescale__month" style={{ left: month.left, width: month.width }}>
                        <span>{month.label}</span>
                    </span>
                ))}
            </div>
            <div className="timescale__cells">
                {cells.map((cell) => (
                    <span
                        key={cell.key}
                        className={`timescale__cell ${cell.weekend ? 'is-weekend' : ''} ${cell.today ? 'is-today' : ''}`}
                        style={{ left: cell.left, width: cell.width }}
                    >
                        {cell.sub && <span className="timescale__sub">{cell.sub}</span>}
                        <span className="timescale__label">{cell.label}</span>
                    </span>
                ))}
            </div>
        </div>
    );
};

/** Background stripes for weekends (day scale) and the today line. */
export const TimeScaleBackdrop = ({ scale, granularity }: TimeScaleHeaderProps) => {
    const stripes = useMemo(() => {
        if (granularity !== 'day') return [];
        const list: number[] = [];
        for (let index = 0; index < scale.days; index += 1) {
            const day = addDays(scale.start, index).getDay();
            if (day === 0 || day === 6) list.push(index * scale.dayWidth);
        }
        return list;
    }, [scale, granularity]);
    const todayX = scale.x(new Date());

    return (
        <div className="timescale-backdrop" style={{ width: scale.width }} aria-hidden="true">
            {stripes.map((left) => (
                <span key={left} className="timescale-backdrop__weekend" style={{ left, width: scale.dayWidth }} />
            ))}
            <span className="timescale-backdrop__today" style={{ left: todayX + scale.dayWidth / 2 }} />
        </div>
    );
};
