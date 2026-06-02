export const isPmCoreOnly = (): boolean => process.env.PM_CORE_ONLY !== 'false';

export const PM_CORE_DEPRECATED_CODE = 'PM_CORE_DEPRECATED';

export const sendPmCoreDeprecated = (res: { status: (code: number) => { json: (body: unknown) => void } }, entity: 'ideas' | 'issues'): boolean => {
    if (!isPmCoreOnly()) {
        return false;
    }
    res.status(410).json({
        error: PM_CORE_DEPRECATED_CODE,
        message: `${entity} were removed in PM-core mode. Use tasks and initiatives instead.`
    });
    return true;
};
