## Installation

- Install dependencies and development tools:

    ```
    npm init
    npm install --save @ubio/framework \
        inversify \
        dotenv @types/dotenv \
        koa @types/koa \
        node-fetch @types/node-fetch
    npm install --save-dev typescript tslint mocha @types/node @ubio/tslint-config
    ```

- Configure TypeScript and TSLint (you may copy [tsconfig.json](../tsconfig.json) and [tslint.json](../tslint.json) from this repo).

- Add following common metadata to `package.json`:

    ```json
    "main": "out/main",
    "scripts": {
        "start": "node out/bin/serve",
        "dev": "npm run clean && tsc -w",
        "check": "tslint --project ./tsconfig.json",
        "test": "NODE_ENV=test mocha --opts ./mocha.opts",
        "clean": "rm -rf out/",
        "compile": "npm run clean && tsc"
    }
    ```

### Peer Dependencies

Since framework just combines multiple libraries together, these libraries are left as peer dependencies in an effort to reduce the possibility of version conflicts.

These libraries include:

- `koa`
- `inversify`
- `node-fetch`
- `dotenv`
