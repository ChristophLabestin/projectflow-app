"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.newsletterUnsubscribe = exports.newsletterSubscribe = exports.testSMTPConnection = void 0;
const email_1 = require("./email");
Object.defineProperty(exports, "testSMTPConnection", { enumerable: true, get: function () { return email_1.testSMTPConnection; } });
const newsletter_1 = require("./newsletter");
Object.defineProperty(exports, "newsletterSubscribe", { enumerable: true, get: function () { return newsletter_1.newsletterSubscribe; } });
Object.defineProperty(exports, "newsletterUnsubscribe", { enumerable: true, get: function () { return newsletter_1.newsletterUnsubscribe; } });
Object.defineProperty(exports, "api", { enumerable: true, get: function () { return newsletter_1.api; } });
//# sourceMappingURL=index.js.map