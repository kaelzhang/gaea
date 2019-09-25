const {join} = require('path')
const {
  test, check, fixture
} = require('./check')

const read = require('../src/package')
const getServerConfig = require('../src/server-config')
const load = require('../src/load')

const serverConfig = (root, config) => {
  const pkg = read(root)
  return getServerConfig(pkg, config)
}

const loadProto = root => load(read(root))

check(['INVALID_ROOT', () => read(1)], 'invalid root')

const host = 'localhost:8888'

const SERVER_CONFIG_CASES = [
  ['PATH_NOT_DIR', 'err-not-dir'],
  ['ERR_READ_PKG', 'err-read-pkg'],
  ['INVALID_GAIA', 'err-invalid-pkg-gaia'],
  ['PATH_NO_ACCESSIBLE', 'err-path-no-access'],
  ['PATH_NOT_DIR', 'err-gaia-path-not-dir'],
  ['ERR_LOAD_PROTO', 'err-load-proto', loadProto],
  // ['INVALID_ERROR_PROPS', 'empty', {
  //   error_props: 1
  // }],
  // ['EMPTY_ERROR_PROPS', 'empty', {
  //   error_props: []
  // }],
  // ['INVALID_PROTO_ROOT', 'empty', {
  //   proto_root: 1
  // }],
  ['PLUGIN_PATH_NOT_DIR', 'empty', serverConfig, {
    plugins: [
      {
        path: fixture('empty', 'not-exists')
      }
    ]
  }],
  ['PACKAGE_OR_PATH_REQUIRED', 'empty', serverConfig, {
    plugins: [{}]
  }],
  ['SERVICE_PATH_NOT_DIR', 'empty', serverConfig, {
    services: {
      foo: {
        host,
        path: fixture('empty', 'not-exists')
      }
    }
  }],
  ['PACKAGE_OR_PATH_REQUIRED', 'empty', serverConfig, {
    services: {
      foo: {
        host
      }
    }
  }],
  ['ERR_LOAD_CONFIG', 'err-load-config'],
  ['MODULE_NOT_FOUND', 'empty', serverConfig, {
    services: {
      foo: {
        host,
        package: 'package-not-found'
      }
    }
  }],
  ['INVALID_PROTO_DEPS', 'err-invalid-proto-deps'],
  ['DEP_OUT_RANGE', 'err-dep-out-range']
]

SERVER_CONFIG_CASES.forEach(([code, dir, runner = serverConfig, config], i) => {
  check([code, () => runner(fixture(dir), config)],
    `serverConfig: ${i}: ${code}`)
})

test('config servie package', t => {
  const config = serverConfig(fixture('empty'), {
    services: {
      foo: {
        host,
        package: 'egg-bog'
      }
    }
  })

  const path = join(__dirname, '..', 'node_modules', 'egg-bog')

  t.is(config.services.foo.path, path)
})
