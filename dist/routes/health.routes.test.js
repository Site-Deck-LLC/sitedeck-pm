"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../index");
describe('GET /api/v1/health', () => {
    it('returns ok status', async () => {
        const app = (0, index_1.createApp)();
        const res = await (0, supertest_1.default)(app).get('/api/v1/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('sitedeck-pm');
    });
});
//# sourceMappingURL=health.routes.test.js.map