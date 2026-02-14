
export interface Kernel {
    bootstrap(): Promise<void> | void;
    handle(...args: any[]): Promise<any> | any;
}
