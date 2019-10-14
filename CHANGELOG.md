# 2.0.0

- Breaking change: `Application` no longer bundles `HttpServer` (see docs)
- Breaking change: `Application` lifecycle is defined by overriding `beforeStart` and `afterStop` methods
- Breaking change: `.bind` methods family no longer return `this`, this is done to make apps more consistent in
  their binding syntax; they've also lost their type parameter because it is largely unused
- feat: `EnvConfig` is bundled in framework and is automatically bound to `Configuration` service identified
- feat: `HttpServer` is configured via default configuration instance, and understands `HTTP_TIMEOUT` and `PORT` parameters out of box