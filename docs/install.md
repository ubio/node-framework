## Installation

- Install dependencies and development tools:

    ```
    npm install --save @ubio/framework dotenv inversify
    npm install --save-dev typescript tslint mocha @types/node @types/koa @types/dotenv
    ```

- Configure TypeScript and TSLint (you may copy [tsconfig.json](../tsconfig.json) and [tslint.json](../tslint.json) from this repo).

- Add development scripts to `package.json`:

    ```json
    "scripts": {
        "start": "node out/main/entrypoint",
        "dev": "npm run clean && tsc -w",
        "check": "tslint --project ./tsconfig.json",
        "test": "NODE_ENV=test mocha --opts ./mocha.opts",
        "clean": "rm -rf out/",
        "compile": "npm run clean && tsc"
    }
    ```

