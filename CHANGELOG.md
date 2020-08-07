- BREAKING CHANGE: drop `RequestFactory`, `Request`, use @automationcloud/request instead
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
