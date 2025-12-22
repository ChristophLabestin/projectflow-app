import { useState, useEffect } from 'react';

export const useIsSafari = () => {
    const [isSafari, setIsSafari] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        // Chrome also includes 'safari', so we must exclude 'chrome'
        const isSafariBrowser = ua.indexOf('safari') > -1 && ua.indexOf('chrome') === -1;
        setIsSafari(isSafariBrowser);
    }, []);

    return isSafari;
};
