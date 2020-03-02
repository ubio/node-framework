#!/usr/bin/env node
import path from 'path';
import { generateOpenApiSpec } from '../main';

const packageJsonPath = path.join(process.cwd(), 'package.json');
const appModulePath = path.join(process.cwd(), 'out/main/app');
// tslint:disable-next-line
require(appModulePath);
// tslint:disable-next-line
const packageJson = require(packageJsonPath);

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
