#!/usr/bin/env node
import 'reflect-metadata';

import fs from 'fs';
import path from 'path';

import { generateOpenApiSpec } from '../main/index.js';

const packageJsonPath = path.join(process.cwd(), 'package.json');
const appModulePath = path.join(process.cwd(), 'out/main/app.js');
await import(appModulePath);

const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

const docs = {
    openapi: '3.1.0',
    info: {
        title: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
    },
    paths: generateOpenApiSpec(),
};
process.stdout.write(JSON.stringify(docs, null, 2));
