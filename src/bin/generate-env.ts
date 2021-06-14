#!/usr/bin/env node
import 'reflect-metadata';

import { promises as fs } from 'fs';
import path from 'path';

import { Application, ConfigDecl, getContainerConfigs } from '../main';

main();

async function main() {
    const appModulePath = path.join(process.cwd(), 'out/main/app');
    const appModule = require(appModulePath);
    const App = discoverAppClass(appModule);
    const app: Application = new App();
    const configs = getContainerConfigs(app.container);
    await writeEnv(configs);
}

function discoverAppClass(module: any): typeof Application {
    for (const obj of Object.values(module)) {
        if (Application.isPrototypeOf(obj as any)) {
            return obj as (typeof Application);
        }
    }
    throw new Error('App class not found');
}

async function writeEnv(configs: ConfigDecl[]) {
    const dotEnvPath = path.join(process.cwd(), '.env.example');
    const lines = configs.map(_ => `${_.key}=${_.defaultValue ?? ''}`);
    const text = lines.join('\n') + '\n';
    await fs.writeFile(dotEnvPath, text);
}
