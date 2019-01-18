import { MicroHostApplication } from './host-application';

export interface IMicroApplication {
    bootstrap(app: MicroHostApplication): void;
    resetRouting(): void;
    destroy(): void;
}

export interface ApplicationOptions {
    // 应用加载的宿主元素或者选择器
    host: string | HTMLElement;
    // 宿主元素附加样式
    hostClass?: string | string[];
    // 子应用的选择器
    selector: string;
    // 子应用路由前缀路径
    routerPathPrefix: string;
    // 样式资源加载前缀
    stylePathPrefix?: string;
    // 样式资源文件
    styles?: string[];
    // 脚本资源加载前缀
    scriptPathPrefix?: string;
    // 脚本资源文件
    scripts?: string[];
}

export interface ApplicationInfo {
    name: string;
    loaded?: boolean;
    bootstrapped?: boolean;
    options: ApplicationOptions;
}

export enum SwitchModes {
    default = 'default',
    coexist = 'coexist'
}
