import { format } from 'date-fns';

export const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export const getDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month + 1, 0).getDate();
};

export const getFirstDayOfMonth = (month: number, year: number): number => {
    return new Date(year, month, 1).getDay();
};

export const formatDate = (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
};

export const formatDateDisplay = (date: Date): string => {
    return format(date, 'MMM. dd yyyy');
};

export const formatDateTimeDisplay = (date: Date): string => {
    return format(date, 'yyyy-MM-dd HH:mm');
};

export const formatTime = (date: Date): string => {
    return format(date, 'HH:mm');
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
        date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear()
    );
};

export const isToday = (date: Date): boolean => {
    return isSameDay(date, new Date());
};
