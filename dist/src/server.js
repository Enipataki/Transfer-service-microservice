"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const transfer_routes_1 = require("./routes/transfer-routes");
const logger_service_1 = require("./services/logger-service");
const environment_1 = require("./config/environment");
/**
 * Transfer service server
 * Main entry point for the Transfer service microservice
 * Sets up Express server, middleware, routes and error handling
 */
class TransferServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.port = environment_1.env.PORT;
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }
    requestlogger(req, res, next) {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger_service_1.logger.info('HTTp Request', {
                method: req.method,
                url: req.url,
                status: res.statusCode,
                duration: `${duration}ms`,
                userAgents: req.get('User-Agent'),
                ip: req.ip
            });
        });
        next();
    }
    globalErrorHandler(error, req, res, next) {
        logger_service_1.logger.error('Unhandled error', {
            error: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method
        });
        //Don't leak error details in production
        const message = environment_1.env.NODE_ENV === 'production' ? 'Internal server error' : error.message;
        res.status(error.status || 500).json(Object.assign({ success: false, message, data: null }, (environment_1.env.NODE_ENV !== 'production') && { stack: error.stack }));
    }
    /**
     * Initialize all middleware
     */
    initializeMiddleware() {
        //security middleware
        this.app.use((0, helmet_1.default)());
        //Body parsing middleware
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        //CORS middleware
        const corsOptions = {
            origin: true, // Allows ALL origins (use only in development)
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"]
        };
        this.app.use((0, cors_1.default)(corsOptions));
        //Request logging middleware
        this.app.use(this.requestlogger);
    }
    /**
     * initialize all routes
     */
    initializeRoutes() {
        //Transfer routes
        this.app.use('/api/v1/transfers', transfer_routes_1.transferRoutes.getRouter());
        //Root endpoint
        this.app.get('/', (req, res) => {
            res.status(200).json({
                success: true,
                message: 'Transfer Service API',
                data: {
                    service: 'transfer-service',
                    version: '1.0.0',
                    status: 'operational',
                    documentation: '/api/docs'
                }
            });
        });
        // 404 handler for undefined routes - use a function instead of '*'
        this.app.use((req, res) => {
            logger_service_1.logger.warn('Route not found', {
                method: req.method,
                url: req.originalUrl
            });
            res.status(404).json({
                success: false,
                message: `Route ${req.method} ${req.originalUrl} not found`,
                data: null
            });
        });
    }
    /**
     * initialize error handling
     */
    initializeErrorHandling() {
        //Global error handler
        this.app.use(this.globalErrorHandler);
    }
    /**
     * Start the server
     */
    start() {
        this.app.listen(this.port, () => {
            logger_service_1.logger.info('Transfer service started successfully', {
                port: this.port,
                environment: environment_1.env.NODE_ENV,
                nodeVersion: process.version
            });
            console.log(`
                Transfer service is runnig! 
                Port: ${this.port}
                Environment: ${environment_1.env.NODE_ENV}
                API Documentation: http://localhost:${this.port}/api/v1/transfers/health
            `);
        });
    }
    ;
    /**
     * Graceful shutdown
     */
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_service_1.logger.info('shutting down transfer service...');
            //close database connections, cleanup resources here
            //await db.close();
            //await redis.quit();
            process.exit(0);
        });
    }
}
//create and start the server
const server = new TransferServer();
//Handle graceful shutdown
process.on('SIGTERM', () => {
    logger_service_1.logger.info('SIGTERM received');
    server.shutdown();
});
process.on('SIGINT', () => {
    logger_service_1.logger.info('SIGINT received');
    server.shutdown();
});
//start the server
server.start();
