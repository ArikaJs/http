import { Application } from './Contracts/Application';
import { Request } from './Request';
import { Response } from './Response';
import { MiddlewareHandler } from './Middleware';
import { Pipeline } from './Pipeline';

export type RouteHandler =
    | ((request: Request, ...params: any[]) => Promise<Response | any> | Response | any)
    | [any, string];

interface Route {
    method: string;
    path: string;
    handler: RouteHandler;
    middleware: MiddlewareHandler[];
    regex: RegExp;
    paramKeys: string[];
}

export class Router {
    private routes: Route[] = [];
    private currentGroupMiddleware: MiddlewareHandler[] = [];
    private app?: Application;

    /**
     * Set the application instance for container resolution.
     */
    setApplication(app: Application): this {
        this.app = app;
        return this;
    }

    /**
     * Register a GET route.
     */
    get(path: string, handler: RouteHandler): this {
        return this.addRoute('GET', path, handler);
    }

    /**
     * Register a POST route.
     */
    post(path: string, handler: RouteHandler): this {
        return this.addRoute('POST', path, handler);
    }

    /**
     * Register a PUT route.
     */
    put(path: string, handler: RouteHandler): this {
        return this.addRoute('PUT', path, handler);
    }

    /**
     * Register a DELETE route.
     */
    delete(path: string, handler: RouteHandler): this {
        return this.addRoute('DELETE', path, handler);
    }

    /**
     * Add middleware to the last registered route.
     */
    middleware(middleware: MiddlewareHandler | MiddlewareHandler[]): this {
        if (this.routes.length > 0) {
            const lastRoute = this.routes[this.routes.length - 1];
            if (Array.isArray(middleware)) {
                lastRoute.middleware.push(...middleware);
            } else {
                lastRoute.middleware.push(middleware);
            }
        }
        return this;
    }

    /**
     * Add a route to the collection.
     */
    private addRoute(method: string, path: string, handler: RouteHandler): this {
        const { regex, paramKeys } = this.compilePath(path);

        this.routes.push({
            method,
            path,
            handler,
            middleware: [...this.currentGroupMiddleware],
            regex,
            paramKeys
        });

        return this;
    }

    /**
     * Compile a path pattern into a regex and parameter keys.
     */
    private compilePath(path: string) {
        const paramKeys: string[] = [];
        const pattern = path
            .replace(/:([^/]+)/g, (_, key) => {
                paramKeys.push(key);
                return '([^/]+)';
            })
            .replace(/\//g, '\\/');

        return {
            regex: new RegExp(`^${pattern}$`),
            paramKeys
        };
    }

    /**
     * Dispatch the request to the matching route.
     */
    async dispatch(request: Request, response: Response): Promise<Response> {
        const { route, params } = this.match(request.method(), request.path());

        if (!route) {
            return response.status(404).json({ error: 'Route not found' });
        }

        // Add params to the request object for easy access
        request.setParams(params);

        // Run route-specific middleware
        return new Pipeline()
            .pipe(route.middleware)
            .handle(request, async (req) => {
                const handler = route.handler;
                let result: any;

                if (Array.isArray(handler)) {
                    const [controllerClass, methodName] = handler;

                    if (!this.app) {
                        throw new Error('Application instance required for controller resolution.');
                    }

                    const controller = this.app.make(controllerClass) as any;
                    result = await controller[methodName](req, ...Object.values(params));
                } else {
                    result = await handler(req, ...Object.values(params));
                }

                if (result instanceof Response) {
                    return result;
                }

                if (typeof result === 'string' || Buffer.isBuffer(result)) {
                    return response.send(result);
                }

                return response.json(result);
            });
    }

    /**
     * Match a request to a route.
     */
    private match(method: string, path: string): { route: Route | null; params: Record<string, string> } {
        for (const route of this.routes) {
            if (route.method !== method) continue;

            const match = path.match(route.regex);
            if (match) {
                const params: Record<string, string> = {};
                route.paramKeys.forEach((key, index) => {
                    params[key] = match[index + 1];
                });
                return { route, params };
            }
        }

        return { route: null, params: {} };
    }
}
