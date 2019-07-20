const fs = require('fs-extra')
const {
  shape,
  arrayOf,
  objectOf
} = require('skema')
const {resolve, dirname, join} = require('path')
const {isArray, isString} = require('core-util-is')
const access = require('object-access')
const glob = require('glob')
const protoLoader = require('@grpc/proto-loader')
const makeArray = require('make-array')
const resolveFrom = require('resolve-from')

const {error} = require('./error')

const DEFAULT_LOADER_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}

const load = (proto_path, root) => {
  try {
    return protoLoader.loadSync(proto_path, {
      ...DEFAULT_LOADER_OPTIONS,
      includeDirs: [root]
    })
  } catch (err) {
    throw error('FAILS_LOAD_PROTO', proto_path, err.stack)
  }
}

const isArrayString = array => isArray(array) && array.every(isString)

const isDirectory = dir => {
  let stat

  try {
    stat = fs.statSync(dir)
  } catch (err) {
    return false
  }

  return stat.isDirectory()
}

const COMMON_SHAPE = {
  proto_root: {
    validate (proto_root) {
      if (!isString(proto_root)) {
        throw error('INVALID_PROTO_ROOT', proto_root)
      }
    },
    default (root) {
      return resolve(root, 'proto')
    },
    set (proto_root) {
      return resolve(this.parent.root, proto_root)
    }
  },

  error_props: {
    default: ['code', 'message'],
    validate (props) {
      if (!isArrayString(props)) {
        throw error('INVALID_ERROR_PROPS', props)
      }

      if (props.length === 0) {
        throw error('EMPTY_ERROR_PROPS')
      }

      return true
    }
  },

  protos: {
    default () {
      return glob.sync('*.proto', {
        cwd: this.parent.proto_root,
        mark: true
      })
    },
    set (protos) {
      return makeArray(protos).map((p, i) => {
        if (!isString(p)) {
          throw new TypeError(`config.protos[${i}] must be a string`)
        }

        const {proto_root} = this.parent

        const resolved = resolve(proto_root, p)

        return {
          path: resolved,
          def: load(p, proto_root)
        }
      })
    }
  }
}

const resolvePackage = (from, package_name) => {
  try {
    const pkgFile = resolveFrom(from, `${package_name}/package.json`)
    return dirname(pkgFile)
  } catch (err) {
    if (err.ENOENT) {
      throw error('PACKAGE_NOT_FOUND', package_name)
    }

    throw err
  }
}

const ensurePath = errorCode => path => {
  const resolved = resolve(path)

  if (!isDirectory(resolved)) {
    throw error(errorCode, path)
  }

  return resolved
}

const Plugin = shape({
  enable: {
    type: 'boolean',
    default: true
  },

  config: {
    type: 'object',
    default () {
      return {}
    }
  },

  path: {
    optional: true,
    set: ensurePath('PLUGIN_PATH_NOT_DIR')
  },

  package: {
    when () {
      return !this.parent.path
    },
    default () {},
    set (package_name, root) {
      if (!package_name) {
        throw error('PACKAGE_OR_PATH_REQUIRED', 'plugin')
      }

      this.parent.path = resolvePackage(root, package_name)
    }
  }
})

const Plugins = arrayOf(Plugin)

const Service = shape({
  // The path contains gaea service code
  path: {
    optional: true,
    set: ensurePath('SERVICE_PATH_NOT_DIR')
  },

  package: {
    // We don't actually use service.package
    enumerable: false,
    when () {
      return !this.parent.path
    },
    default () {},
    set (package_name, root) {
      if (!package_name) {
        throw error('PACKAGE_OR_PATH_REQUIRED', 'service')
      }

      const pkgRoot = resolvePackage(root, package_name)
      const pkg = fs.readJsonSync(join(pkgRoot, 'package.json'))

      const path = access(pkg, 'gaea.path')

      this.parent.path = path
        ? resolve(path)
        : pkgRoot
    }
  }
})

const Services = objectOf(Service)

const SERVER_SHAPE = {
  ...COMMON_SHAPE,

  plugins: {
    type: Plugins,
    default: () => []
  },
  services: {
    type: Services,
    default: () => ({})
  }
}

const ServerConfig = shape(SERVER_SHAPE)
const ClientConfig = shape(COMMON_SHAPE)

module.exports = {
  serverConfig (config, root) {
    return ServerConfig.from(config, [root])
  },

  clientConfig (config, root) {
    return ClientConfig.from(config, [root])
  },

  root (root) {
    if (!isString(root)) {
      throw error('INVALID_ROOT', root)
    }

    const resolved = resolve(root)

    try {
      fs.accessSync(root, fs.constants.R_OK)
    } catch (err) {
      throw error('ROOT_NO_ACCESSIBLE', root)
    }

    const stat = fs.statSync(resolved)
    if (!stat.isDirectory()) {
      throw error('ROOT_NOT_DIR', root)
    }

    return resolved
  }
}
