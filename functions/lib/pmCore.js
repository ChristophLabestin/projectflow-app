"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPmCoreDeprecated = exports.PM_CORE_DEPRECATED_CODE = exports.isPmCoreOnly = void 0;
const isPmCoreOnly = () => process.env.PM_CORE_ONLY !== 'false';
exports.isPmCoreOnly = isPmCoreOnly;
exports.PM_CORE_DEPRECATED_CODE = 'PM_CORE_DEPRECATED';
const sendPmCoreDeprecated = (res, entity) => {
    if (!(0, exports.isPmCoreOnly)()) {
        return false;
    }
    res.status(410).json({
        error: exports.PM_CORE_DEPRECATED_CODE,
        message: `${entity} were removed in PM-core mode. Use tasks and initiatives instead.`
    });
    return true;
};
exports.sendPmCoreDeprecated = sendPmCoreDeprecated;
//# sourceMappingURL=pmCore.js.map