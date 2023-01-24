## Installation

- Install dependencies and development tools:

    ```
    npm init
    npm install --save \
        @ubio/framework \
        inversify \
        koa \
        @types/koa \
        dotenv
    npm install --save-dev \
        typescript \
        @types/node \
        npm-run-all \
        mocha \
        eslint \
        @nodescript/eslint-config
    ```

- Configure TypeScript and ESLint (you may copy [tsconfig.json](../tsconfig.json) and [.eslintrc.json](../.eslintrc.json) from this repo).

- Add following common metadata to `package.json`:

    ```json
    "main": "out/bin/serve.js",
    "scripts": {
        "start": "node out/bin/serve",
        "dev": "npm run clean && tsc -w",
        "lint": "eslint --ext=.js,.ts --cache .",
        "clean": "rm -rf out",
        "compile": "npm run clean && tsc",
        "test": "NODE_ENV=test mocha",
        "docs": "npm run docs:openapi && npm run docs:api",
        "docs:openapi": "generate-openapi > openapi.json",
        "docs:api": "generate-docs > API.md",
        "preversion": "npm run lint && npm run compile && npm run docs && git add openapi.json API.md",
        "postversion": "git push origin $(git rev-parse --abbrev-ref HEAD) --tags"
    }
    ```
