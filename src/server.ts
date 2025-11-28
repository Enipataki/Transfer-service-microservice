import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import {transferRoutes} from './routes/transfer-routes';
import {logger} from './services/logger-service';
import {env} from './config/environment'

/**
 * Transfer service server
 * Main entry point for the Transfer service microservice
 * Sets up Express server, middleware, routes and error handling
 */

class TransferServer{
    public app: express.Application;
    public port: number;

    constructor() {
        this.app = express();
        this.port = env.PORT;
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private requestlogger(req: express.Request, res: express.Response, next: express.NextFunction) {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.info('HTTp Request', {
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

    private globalErrorHandler(error: any, req: express.Request, res: express.Response, next: express.NextFunction) {
        logger.error('Unhandled error', {
            error: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method
        });
        //Don't leak error details in production
        const message = env.NODE_ENV === 'production' ? 'Internal server error' : error.message;

        res.status(error.status || 500).json({
            success: false,
            message,
            data: null,
            ...(env.NODE_ENV !== 'production') && {stack: error.stack}
        })
    }

    /**
     * Initialize all middleware
     */
    private initializeMiddleware() {
        //security middleware
        this.app.use(helmet())
        //Body parsing middleware
        this.app.use(express.json({limit: '10mb'}))
        this.app.use(express.urlencoded({extended: true}));

        //CORS middleware
        const corsOptions = {
            origin: true, // Allows ALL origins (use only in development)
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"]
        };
        this.app.use(cors(corsOptions))

        //Request logging middleware

        this.app.use(this.requestlogger);
    }

    /**
     * initialize all routes
     */
    private initializeRoutes() {
        //Transfer routes
        this.app.use('/api/v1/transfers', transferRoutes.getRouter());

        //Root endpoint
        this.app.get('/', (req: express.Request, res: express.Response) => {
            res.status(200).json({
                success: true,
                message: 'Transfer Service API',
                data: {
                    service: 'transfer-service',
                    version: '1.0.0',
                    status: 'operational',
                    documentation: '/api/docs'
                }
            })
        });
       // 404 handler for undefined routes - use a function instead of '*'
        this.app.use((req: express.Request, res: express.Response) => {
            logger.warn('Route not found', {
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

    private initializeErrorHandling() {
        //Global error handler
        this.app.use(this.globalErrorHandler);
    }

    /**
     * Start the server
     */
    public start() {
        this.app.listen(this.port, () => {
            logger.info('Transfer service started successfully', {
                port: this.port,
                environment: env.NODE_ENV,
                nodeVersion: process.version
            });
            
            console.log(`
                Transfer service is runnig! 
                Port: ${this.port}
                Environment: ${env.NODE_ENV}
                API Documentation: http://localhost:${this.port}/api/v1/transfers/health
            `);
        });
    };

    /**
     * Graceful shutdown
     */
    public async shutdown() {
        logger.info('shutting down transfer service...');

        //close database connections, cleanup resources here
        //await db.close();
        //await redis.quit();

        process.exit(0)
    }
}

//create and start the server
const server = new TransferServer();

//Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    server.shutdown()
});

process.on('SIGINT', () => {
    logger.info('SIGINT received');
    server.shutdown()
})

//start the server

server.start();
