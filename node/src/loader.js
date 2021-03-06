const {join} = require('path')
const {set} = require('object-access')
const {requireModule} = require('require-esmodule')

const {Client} = require('./client')
const {wrap} = require('./error-wrapping')
const {iterateProtos, define} = require('./utils')
const {CONFIG, CONTEXT} = require('./constants')
const {error} = require('./error')
const load = require('./load')

const STR_DOT = '.'

const packageToPaths = pkg => pkg.split(STR_DOT)

const wrapServerMethod = (method, error_props, context) =>
  (call, callback) => {
    Promise.resolve()
    .then(() => method.call(context, call.request, call))
    .then(
      res => callback(null, res),
      err => callback(wrap(err, error_props))
    )
  }

class Loader {
  constructor ({
    app,
    config,
    pkg,
    server
  }) {
    this._app = app
    this._context = this._app[CONTEXT]
    this._pkg = pkg
    this._config = config
    this._server = server
  }

  load () {
    this.loadPlugins()
    this.loadServices()
    this.loadControllers()
  }

  loadPlugins () {
    const {plugins} = this._config

    plugins.forEach(({
      path,
      config
    }) => {
      this._app[CONFIG] = config

      const entry = join(path, 'app.js')
      let create

      try {
        create = requireModule(entry)
      } catch (err) {
        throw error('ERR_LOAD_PLUGIN', err.stack)
      }

      create(this._app)

      this._app[CONFIG] = null
    })
  }

  _getServiceControllerMethods (package_name) {
    const p = join(
      this._config.controller_root,
      ...packageToPaths(package_name)
    )

    try {
      return {
        service_path: p,
        methods: requireModule(p, false)
      }
    } catch (err) {
      throw error('ERR_LOAD_CONTROLLER', p, package_name, err.stack)
    }
  }

  _addController (service, package_name, method_names) {
    const {
      service_path,
      methods
    } = this._getServiceControllerMethods(package_name)

    const {error_props} = this._pkg

    const wrapped = {}

    method_names.forEach(({name, originalName}) => {
      const method = methods[name] || methods[originalName]

      if (!method) {
        throw error('RPC_METHOD_NOT_FOUND', name, service_path)
      }

      wrapped[name] = wrapServerMethod(
        method, error_props, this._context)
    })

    set(this._context.controller, package_name, wrapped)
    this._server.addService(service, wrapped)
  }

  loadControllers () {
    iterateProtos(load(this._pkg), ({
      service,
      package_name,
      method_names
    }) => {
      this._addController(service.service, package_name, method_names)
    })
  }

  loadServices () {
    const {services} = this._config
    const context_services = this._context.service

    for (const [name, {
      host,
      path
    }] of Object.entries(services)) {
      define(
        context_services,
        name,
        new Client(path).connect(host),
        true
      )
    }
  }
}

module.exports = {
  Loader
}
