
export interface Application {
    config(): {
        get<T = any>(key: string, defaultValue?: T): T;
    };
    isBooted(): boolean;
    boot(): Promise<void>;
    make<T = any>(token: any): T;
    singleton<T = any>(token: any, factory: any): void;
}
