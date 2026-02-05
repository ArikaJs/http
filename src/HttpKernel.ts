import { Application, Kernel } from '@arikajs/foundation';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Request } from './Request';
import { Response } from './Response';
import { Pipeline } from './Pipeline';
import { MiddlewareHandler } from './Middleware';
import { Router } from './Router';
import { BodyParserMiddleware } from './Middleware/BodyParserMiddleware';

export class HttpKernel implements Kernel {
    protected app: Application;

    /**
     * The application's global HTTP middleware stack.
     */
    protected middleware: MiddlewareHandler[] = [];

    /**
     * The router instance.
     */
    protected router: Router;

    constructor(app: Application) {
        this.app = app;
        this.router = new Router().setApplication(app);

        // Register default middleware
        this.middleware.push(new BodyParserMiddleware());
    }

    /**
     * Get the router instance.
     */
    getRouter(): Router {
        return this.router;
    }

    /**
     * Add a global middleware to the beginning of the stack.
     */
    prependMiddleware(middleware: MiddlewareHandler): this {
        this.middleware.unshift(middleware);
        return this;
    }

    /**
     * Add a global middleware to the end of the stack.
     */
    pushMiddleware(middleware: MiddlewareHandler): this {
        this.middleware.push(middleware);
        return this;
    }

    /**
     * Bootstrap the HTTP kernel.
     */
    async bootstrap(): Promise<void> {
        if (!this.app.isBooted()) {
            await this.app.boot();
        }
    }

    /**
     * Handle an incoming HTTP request.
     */
    async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            // 1. Bootstrap if not already
            await this.bootstrap();

            // 2. Transform Node primitives into Framework objects
            const request = new Request(this.app, req);
            const response = new Response(res);

            // 3. Send the request through the middleware pipeline
            const finalResponse = await this.sendRequestThroughPipeline(request, response);

            // 4. Send the final response to the client
            finalResponse.terminate();

        } catch (error: any) {
            this.handleError(error, res);
        }
    }

    /**
     * Send the given request through the middleware pipeline.
     */
    protected async sendRequestThroughPipeline(request: Request, response: Response): Promise<Response> {
        return new Pipeline()
            .pipe(this.middleware)
            .handle(request, (req) => this.dispatchToRouter(req, response));
    }

    /**
     * Dispatch the request to the router.
     */
    protected async dispatchToRouter(request: Request, response: Response): Promise<Response> {
        return this.router.dispatch(request, response);
    }

    /**
     * Handle errors during request processing.
     */
    protected handleError(error: any, res: ServerResponse): void {
        console.error('HTTP Kernel Error:', error);

        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Internal Server Error',
                message: error.message,
            }));
        }
    }
}
