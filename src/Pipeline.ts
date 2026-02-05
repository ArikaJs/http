import { Request } from './Request';
import { Response } from './Response';
import { MiddlewareHandler, Middleware } from './Middleware';

export class Pipeline {
    private handlers: MiddlewareHandler[] = [];

    /**
     * Add middleware to the pipeline.
     */
    pipe(middleware: MiddlewareHandler | MiddlewareHandler[]): this {
        if (Array.isArray(middleware)) {
            this.handlers.push(...middleware);
        } else {
            this.handlers.push(middleware);
        }
        return this;
    }

    /**
     * Run the pipeline through the given destination.
     */
    async handle(
        request: Request,
        destination: (request: Request) => Promise<Response> | Response
    ): Promise<Response> {
        const pipeline = this.handlers.reduceRight(
            (next: (req: Request) => Promise<Response> | Response, handler: MiddlewareHandler) => {
                return async (req: Request) => {
                    if (typeof handler === 'function') {
                        return handler(req, next);
                    }

                    if ('handle' in handler && typeof handler.handle === 'function') {
                        return (handler as Middleware).handle(req, next);
                    }

                    throw new Error('Invalid middleware handler provided to pipeline.');
                };
            },
            destination
        );

        return pipeline(request);
    }
}
