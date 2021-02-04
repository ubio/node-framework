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
    import { MongoDb } from '@ubio/framework/out/modules/mongodb';

    export class App extends Application {

        constructor() {
            super();
            // ...
            this.container.bind(MongoDb).toSelf().inSingletonScope();
        }

        async beforeStart() {
            const mongo = this.container.get(MongoDb);
            await mongo.start();
            // ...
        }

        async afterStop() {
            // ...
            const mongo = this.container.get(MongoDb);
            await mongo.stop();
        }

    }
    ```

- Create a repository class to access a specific MongoDb collection:

    ```ts
    @injectable()
    export class UserRepo {
        constructor(
            @inject(MongoDb)
            protected mongo: MongoDb,
        ) {
        }

        protected get collection() {
            return this.mongo.db.collection('users');
        }

        // ...
    }
    ```

## Configuration

MongoDB is automatically configured using `MONGO_URL` env variable. It should be placed in application secrets.

## Collection Metrics

By default `MongoDb` service automatically collects and reports collection metrics, refreshed every 30 seconds. This can be disabled by setting environment variable `MONGO_METRICS_ENABLED=false`.

It is advisable to include `MONGO_METRICS_ENABLED=false` in `.env.test` so that refresh logic does not interfere with tests.
