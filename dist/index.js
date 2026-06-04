"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./routes"));
const error_handler_1 = require("./lib/error-handler");
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/api/v1', routes_1.default);
    app.use(error_handler_1.errorHandlerMiddleware);
    return app;
}
const app = createApp();
exports.default = app;
//# sourceMappingURL=index.js.map