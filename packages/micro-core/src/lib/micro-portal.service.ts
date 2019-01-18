import { Injectable, NgZone, ApplicationRef, Injector } from '@angular/core';
import { NavigationEnd, RouterEvent, Router } from '@angular/router';
import { AssetsLoader, AssetsLoadResult } from './assets-loader';
import { MicroHostApplication } from './host-application';
import { GlobalEventDispatcher } from './global-event-dispatcher';
import { getHTMLElement, coerceArray } from './helpers';
import { of, Observable, BehaviorSubject, Subject } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { IMicroApplication, ApplicationInfo, ApplicationOptions, SwitchModes } from './micro.class';

export interface MicroPortalOptions {
    preload?: boolean;
    switchMode?: SwitchModes;
    errorHandler: (error: Error) => void;
}

@Injectable({
    providedIn: 'root'
})
export class MicroPortalService {
    private options: MicroPortalOptions;

    private apps: ApplicationInfo[] = [];

    private appsMap: { [key: string]: ApplicationOptions } = {};

    private currentApp: ApplicationInfo;

    private hostApp = new MicroHostApplication();

    public loadingDone: boolean;

    public appLoad$ = new Subject<ApplicationInfo>();

    private switchModeIsCoexist() {
        return this.options.switchMode === SwitchModes.coexist;
    }

    private getMicroApplication(app: ApplicationInfo): IMicroApplication {
        const appInstance = (window as any)[app.name] as { app: IMicroApplication };
        return appInstance && appInstance.app;
    }

    private hideApplication(appInfo: ApplicationInfo) {
        const appRootElement = document.querySelector(appInfo.options.selector);
        if (appRootElement) {
            appRootElement.setAttribute('style', 'display:none;');
        }
    }

    private showApplication(appInfo: ApplicationInfo) {
        const appRootElement = document.querySelector(appInfo.options.selector);
        if (appRootElement) {
            appRootElement.setAttribute('style', '');
        }
    }

    constructor(
        private assetsLoader: AssetsLoader,
        private ngZone: NgZone,
        private router: Router,
        private globalEventDispatcher: GlobalEventDispatcher,
        private applicationRef: ApplicationRef
    ) {
        this.hostApp.ngZone = ngZone;
        this.hostApp.router = router;

        this.hostApp.globalEventDispatcher = globalEventDispatcher;
        this.options = {
            switchMode: SwitchModes.default,
            preload: true,
            errorHandler: (error: Error) => {
                console.error(error);
            }
        };
    }

    setOptions(options: Partial<MicroPortalOptions>) {
        this.options = {
            ...this.options,
            ...options
        };
    }

    registerApplication(appName: string, options: ApplicationOptions) {
        if (this.appsMap[appName]) {
            throw new Error(`${appName} has be registered.`);
        }
        this.apps.push({
            name: appName,
            options: options
        });
        this.appsMap[appName] = options;
    }

    loadApp(app: ApplicationInfo): Observable<AssetsLoadResult[]> {
        if (app.loaded) {
            return of([]);
        }
        let scripts = app.options.scripts;
        if (app.options.scriptPathPrefix) {
            scripts = scripts.map(script => {
                return `${app.options.scriptPathPrefix}/${script}`;
            });
        }
        return this.assetsLoader.loadScripts(scripts);
    }

    bootstrapApp(appInfo: ApplicationInfo): IMicroApplication {
        const app = this.getMicroApplication(appInfo);
        if (app && app.bootstrap) {
            const container = getHTMLElement(appInfo.options.host);
            if (container) {
                let appRootElement = container.querySelector(appInfo.options.selector);
                if (!appRootElement) {
                    appRootElement = document.createElement(appInfo.options.selector);
                    if (appInfo.options.hostClass) {
                        appRootElement.classList.add(...coerceArray(appInfo.options.hostClass));
                    }
                    container.appendChild(appRootElement);
                }
            }
            app.bootstrap(this.hostApp);
            return app;
        }
        return null;
    }

    loadAndBootstrapApp(appInfo: ApplicationInfo) {
        this.ngZone.runOutsideAngular(() => {
            this.loadingDone = false;
            this.currentApp = appInfo;
            if (appInfo.loaded && this.switchModeIsCoexist()) {
                this.showApplication(appInfo);
                const app = this.getMicroApplication(appInfo);
                app.resetRouting();
                return;
            }
            this.loadApp(appInfo).subscribe(
                result => {
                    this.bootstrapApp(appInfo);
                    appInfo.loaded = true;
                    this.loadingDone = true;
                },
                error => {
                    this.options.errorHandler(error);
                }
            );
        });
    }

    destroyApplication(appInfo: ApplicationInfo) {
        const app = this.getMicroApplication(appInfo);
        if (app) {
            app.destroy();
        }
        const container = getHTMLElement(appInfo.options.host);
        const appRootElement = container.querySelector(appInfo.options.selector);
        if (appRootElement) {
            container.removeChild(appRootElement);
        }
    }

    destroyCurrentApplication() {
        if (this.currentApp) {
            this.destroyApplication(this.currentApp);
        }
    }

    resetRouting(event: RouterEvent) {
        const matchedApp = this.apps.find(app => {
            return event.url.includes(app.options.routerPathPrefix);
        });

        if (this.currentApp) {
            if (this.switchModeIsCoexist()) {
                const app = this.getMicroApplication(this.currentApp);
                if (app) {
                    this.hideApplication(this.currentApp);
                    app.resetRouting();
                }
            } else {
                this.destroyApplication(this.currentApp);
            }
            this.currentApp = null;
        }

        if (matchedApp) {
            this.loadAndBootstrapApp(matchedApp);
        }
    }
}
