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
