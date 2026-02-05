import { Application } from '@arikajs/foundation';
import { IncomingMessage } from 'node:http';
import { URL } from 'node:url';
import * as cookie from 'cookie';

export class Request {
    private readonly app: Application;
    private readonly req: IncomingMessage;
    private readonly searchParams: URLSearchParams;
    private _cookies: Record<string, string | undefined> | null = null;
    private _body: any = null;
    private _params: Record<string, string> = {};

    constructor(app: Application, req: IncomingMessage) {
        this.app = app;
        this.req = req;

        // Config-driven behavior: Trust Proxy check
        const trustProxy = app.config().get('http.trustProxy', false);
        const protocol = trustProxy ? (this.header('x-forwarded-proto') as string || 'http') : 'http';
        const host = trustProxy ? (this.header('x-forwarded-host') as string || req.headers.host) : req.headers.host;

        const fullUrl = `${protocol}://${host || 'localhost'}${req.url || '/'}`;
        this.searchParams = new URL(fullUrl).searchParams;
    }

    /**
     * Get the application instance.
     */
    getApplication(): Application {
        return this.app;
    }

    /**
     * Get the underlying Node request.
     */
    getRaw(): IncomingMessage {
        return this.req;
    }

    /**
     * Get the HTTP method.
     */
    method(): string {
        return this.req.method || 'GET';
    }

    /**
     * Get the request path.
     */
    path(): string {
        const url = new URL(this.req.url || '/', `http://${this.req.headers.host || 'localhost'}`);
        return url.pathname;
    }

    /**
     * Get all headers.
     */
    headers(): Record<string, string | string[] | undefined> {
        return this.req.headers;
    }

    /**
     * Get a specific header.
     */
    header(name: string): string | string[] | undefined {
        return this.req.headers[name.toLowerCase()];
    }

    /**
     * Get all cookies.
     */
    cookies(): Record<string, string | undefined> {
        if (this._cookies === null) {
            const cookieHeader = this.header('cookie');
            this._cookies = typeof cookieHeader === 'string' ? cookie.parse(cookieHeader) : {};
        }
        return this._cookies;
    }

    /**
     * Get a specific cookie.
     */
    cookie(name: string): string | undefined {
        return this.cookies()[name];
    }

    /**
     * Get a query parameter.
     */
    query(key: string): string | null {
        return this.searchParams.get(key);
    }

    /**
     * Set the route parameters.
     */
    setParams(params: Record<string, string>): void {
        this._params = params;
    }

    /**
     * Get all route parameters.
     */
    params(): Record<string, string> {
        return this._params;
    }

    /**
     * Get a specific route parameter.
     */
    param(key: string, defaultValue: string | null = null): string | null {
        return this._params[key] ?? defaultValue;
    }

    /**
     * Set the parsed body (usually set by middleware).
     */
    setBody(body: any): void {
        this._body = body;
    }

    /**
   * Get an input value from route params, body, or query.
   */
    input(key: string, defaultValue: any = null): any {
        // 1. Check route parameters
        if (this._params[key] !== undefined) {
            return this._params[key];
        }

        // 2. Check body
        if (this._body && typeof this._body === 'object' && key in this._body) {
            return this._body[key];
        }

        // 3. Check query string
        return this.query(key) ?? defaultValue;
    }
}
