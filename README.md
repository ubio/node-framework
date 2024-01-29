# ubio Microservices Framework

**Important!** Check out the [roadmap](#roadmap) below to see what's coming next.

## Synopsis

A library shared across ubio microservices which encapsulates common conventions in following areas:

- domain-driven design
- application structuring
- environment variables handling
- logging
- http routing and validation
- entity validation, presentation, (de)serialization

## Usage

See [documentation](docs) for detailed usage information.

## Known Issues

- ESNext breaks decorators. `mesh-ioc` does not work with TypeSCript target ES2022 and onwards. Please use `"target": "es2020" in `tsconfig.json` for now.

## Roadmap

We have a high-level plan to introduce changes to better align the applications we build across the stack, along with simultaneously bringing in some DX.

Our plan is to bring the following:

- [x] ESM — a breaking change to existing applications, but a necessary step in future-proofing
- [x] Standardized logging in [logfmt](https://brandur.org/logfmt) format
- [x] Changing IoC libary from [Inversify](https://inversify.io/) to [Mesh](https://github.com/flexent/mesh)
- [ ] Changing schema validation library from [AJV](https://ajv.js.org/) to [Airtight](https://github.com/flexent/schema) (Q2 2023)

## License

ubio Limited © 2019
