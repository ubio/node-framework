#!/usr/bin/env node
import 'reflect-metadata';

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';

import { Application, ConfigDecl, getContainerConfigs } from '../main';

interface Opts {
    silent: boolean;
    file: string;
}

const program = new Command()
    .option('-s, --silent', 'Do not throw if App is not found', false)
    .option('-f, --file [file]', 'File to generate', '.env.example')
    .parse();
const opts = program.opts() as Opts;

main()
    .catch(err => {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    });

async function main() {
    const appModulePath = path.join(process.cwd(), 'out/main/app');
    const appModule = require(appModulePath);
    const App = discoverAppClass(appModule);
    if (!App) {
        if (opts.silent) {
            return;
        }
        throw new Error('App class not found');
    }
    const app: Application = new App();
    const configs = getContainerConfigs(app.container);
    await writeEnv(configs);
}

function discoverAppClass(module: any): typeof Application | null {
    for (const obj of Object.values(module)) {
        if (Application.isPrototypeOf(obj as any)) {
            return obj as (typeof Application);
        }
    }
    return null;
}

async function writeEnv(configs: ConfigDecl[]) {
    const dotEnvPath = path.join(process.cwd(), opts.file);
    const lines = new Set(configs.map(_ => `${_.key}=${_.defaultValue ?? ''}`));
    const text = [...lines].join('\n') + '\n';
    await fs.writeFile(dotEnvPath, text);
}
