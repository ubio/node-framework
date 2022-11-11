# Using MongoDB

MongoDB is a popular database choice within UBIO infrastructure, so Framework provides a uniform way of using it in applications.

**Note:** Framework does not include MongoDB driver by default, because not all applications need MongoDB. This means that:

- application must have `mongodb` installed separately
- the `MongoDb` service must be imported from a separate module (see below)

## Usage

- Install the driver: `npm i --save mongodb @types/mongodb`

- Bind `MongoDb` singleton inside [composition root](./application.md) and add it to application lifecycle as follows (notice the different import path):

    ```ts
    import { Application } from '@ubio/framework';
    import { MongoDb } from '@ubio/framework/modules/mongodb';

    export class App extends Application {

        @dep() private mongodb!: MongoDb;

        constructor() {
            super();
            // ...
            this.mesh.service(MongoDb);
        }

        async beforeStart() {
            await this.mongodb.start();
            // ...
        }

        async afterStop() {
            // ...
            await this.mongodb..stop();
        }

    }
    ```

- Create a repository class to access a specific MongoDb collection:

    ```ts
    export class UserRepo {

        @dep() private mongodb!: MongoDb;

        protected get collection() {
            return this.mongodb.db.collection('users');
        }

        // ...
    }
    ```

## Configuration

MongoDB is automatically configured using `MONGO_URL` env variable. It should be placed in application secrets.

## Collection Metrics

By default `MongoDb` service automatically collects and reports collection metrics, refreshed every 30 seconds. This can be disabled by setting environment variable `MONGO_METRICS_ENABLED=false`.

It is advisable to include `MONGO_METRICS_ENABLED=false` in `.env.test` so that refresh logic does not interfere with tests.
