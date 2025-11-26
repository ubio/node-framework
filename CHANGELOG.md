## 16.2.0

- feat: New route type decorator `@All()` to allow any HTTP method requests to be routed to handler

## 16.1.0

- feat: New `TrialClient` service to track client's trial usage of services (eg.: Recruitment, Hotel Universe, etc.)

## 16.0.0

- feat: New `AuthProvider` service to handle app auth. It's a generic and optional (not set by default) service
- feat: Endpoint `GET /status` is exposed from framework by default (this can be removed from apps)
- feat: `GlobalMetrics` is a now service (previously available in the `global` object)
- BREAKING CHANGES:
  - AcAuthProvider (and its dependencies) must be explicity setup (default implementation is available in the framework)
  - Auth object (previously `AcAuth`) has new format (check [Auth docs](./docs/auth.md#automation-cloud-authentication--authorisation))
  - `GlobalMetrics` removed from `global` object, now available as a service in mesh container

## 15.12.0

- feat: New `@AfterHook()` decorator to handle after request flows

## 15.8.0

- It is no longer necessary to inherit from ClientError to have error in response; any error with numeric `status` field will be presented as is.

## 15.7.0

- When using `NODE_ENV=test`, the `.env.test` is loaded on `app.start()`
- When using `NODE_ENV=development`, the `.env.dev` is loaded on `app.start()`

## 15.6.0

- Update transitive deps
- Env Generator works

## 15.0.0

- feat: Inversify ⇒ Mesh (#87)

## 14.0.0

- update to ESM + Logfmt Logging
- drop changelog generator

## 13.9.1

- remove timestamp from a gauge metric to prevent it's staleness in grafana

## 13.9.0

- migrate to mongodb@4

## 13.8.0

- Add HTTP_TEXT_LIMIT env variable
- Add Schema.create function

## 13.7.0

- Use a route path template instead of an actual path with params for the routes' execution histogram metric

## 13.6.0

- make altering middlewares a bit easier by moving them to the field on a HttpServer class as a list of objects

## 13.5.0

- add a HTTP_INCLUDE_UNPARSED_BODY config option

## 13.4.0

- feat: match requests with a trailing slash

## 7.1.0

- feat: multipart requests supported
- BREAKING CHANGE: new platform-wide auth conventions, and some more sneaked in
- BREAKING CHANGE: `@ubio/request` replaced `RequestFactory`

## 5.0.0

- BREAKING CHANGE: drop `RequestFactory`, `Request`, use @ubio/request instead
- BREAKING CHANGE: drop `Configuration`, see `env.md` for replacement
- BREAKING CHANGE: drop `ForwardRequestHeaderAuthService`, use `AutomationCloudAuthService` instead
- feat: add `AutomationCloudAuthService` to support both old and new auth

## 4.0.0

- BREAKING CHANGE: drop `.bind`, `.bindAll`, `.bindSingleton`, `.unbind` from Application

## 3.6.0

- feat: add `sortBy`

## 3.5.0

- chore: merge `@ubio/node-esseentials` into `@ubio/node-framework`.

## 3.4.0

- feat: add `generate-openapi` command

## 3.3.0

- feat: add `bindRouter` method
- deprecate: `Application.bind`, `Application.unbind`, `Application.bindAll`, `Application.bindSingleton` — use Inversify directly instead.

## 3.2.0

- feat: add APIs for Prometheus metrics

## 3.1.1

- fix: child loggers merge data with context (previously their data was sitting in additional `data` key)

## 2.1.4

- fix: allow router to capture special symbols like `:` in path params

## 2.1.1

- fix: error middleware expose `error.details`

## 2.1.0

- feat: add HTTP_SHUTDOWN_DELAY configuration to control the delay between receiving a signal and stopping accepting new http connections
- feat: automate changelog version numbers

## 2.0.0

- Breaking change: `Application` no longer bundles `HttpServer` (see docs)
- Breaking change: `Application` lifecycle is defined by overriding `beforeStart` and `afterStop` methods
- Breaking change: `.bind` methods family no longer return `this`, this is done to make apps more consistent in
  their binding syntax; they've also lost their type parameter because it is largely unused
- feat: `EnvConfig` is bundled in framework and is automatically bound to `Configuration` service identified
- feat: `HttpServer` is configured via default configuration instance, and understands `HTTP_TIMEOUT` and `PORT` parameters out of box
