const {credentials} = require('grpc')
const {set} = require('object-access')

const {iterateProtos} = require('./utils')
const {unwrap} = require('./error-wrapping')
const read = require('./package')
const load = require('./load')

const wrapClientMethods = (real_client, methods, error_props) => {
  const client = {}

  methods.forEach(({name, originalName}) => {
    const method = req => new Promise((resolve, reject) => {
      real_client[name](req, (err, res) => {
        if (err) {
          const error = unwrap(err, error_props)

          return reject(error)
        }

        resolve(res)
      })
    })

    client[name] = method

    if (name !== originalName) {
      client[originalName] = method
    }
  })

  return client
}

class Client {
  constructor (root) {
    this._root = root
  }

  connect (host) {
    const pkg = read(this._root)
    const {error_props} = pkg

    const clients = Object.create(null)

    iterateProtos(load(pkg), ({
      service: Service,
      package_name,
      method_names
    }) => {
      const client = new Service(host, credentials.createInsecure())

      set(
        clients, package_name,
        wrapClientMethods(client, method_names, error_props)
      )
    })

    return clients
  }
}

module.exports = {
  Client
}
