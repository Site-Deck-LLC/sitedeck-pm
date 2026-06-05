"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const routes_1 = __importDefault(require("./routes"));
const error_handler_1 = require("./lib/error-handler");
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Serve React frontend build if it exists
    const frontendDist = path_1.default.join(__dirname, '../frontend/dist');
    app.use(express_1.default.static(frontendDist, { maxAge: 0, etag: false, lastModified: false }));
    app.use('/api/v1', routes_1.default);
    // SPA catch-all: serve index.html for any non-API route
    app.get('*', (_req, res) => {
        res.sendFile(path_1.default.join(frontendDist, 'index.html'));
    });
    app.use(error_handler_1.errorHandlerMiddleware);
    return app;
}
const app = createApp();
exports.default = app;
//# sourceMappingURL=index.js.map