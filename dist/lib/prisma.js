"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.getPrismaClient = getPrismaClient;
exports.setPrismaClient = setPrismaClient;
const client_1 = require("@prisma/client");
let prismaInstance = null;
function getPrismaClient() {
    if (!prismaInstance) {
        prismaInstance = new client_1.PrismaClient();
    }
    return prismaInstance;
}
function setPrismaClient(instance) {
    prismaInstance = instance;
}
exports.prisma = getPrismaClient();
//# sourceMappingURL=prisma.js.map