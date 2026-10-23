import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The platform admin area moved out of the app into its own console (admin/, hosting site projectflow-admin,
 * brain/plans/admin-console-concept.md). Old links (/admin/*, /insights/onboarding) land there.
 */
export const ADMIN_CONSOLE_URL = (import.meta.env.VITE_ADMIN_CONSOLE_URL as string | undefined) || 'https://admin.getprojectflow.com';

const target = (pathname: string) => {
    if (pathname.startsWith('/insights/onboarding')) return '/onboarding';
    const rest = pathname.replace(/^\/admin\/?/, '');
    return rest ? `/${rest}` : '/';
};

export const AdminConsoleRedirect = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.location.replace(`${ADMIN_CONSOLE_URL}${target(pathname)}`);
    }, [pathname]);
    return null;
};
