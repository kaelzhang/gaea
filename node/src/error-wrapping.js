const grpc = require('grpc')
const {isString} = require('core-util-is')

// `KEY_GAIA` should not contains special characters, such as `:`
const KEY_GAIA = '__is_gaia'
const KEY_METADATA = 'metadata'

// Ref
// https://www.grpc.io/docs/guides/error/

const get = (metadata, key) => {
  const [ret] = metadata.get(key)
  if (!isString(ret)) {
    return
  }

  return JSON.parse(ret)
}

const set = (metadata, key, value) => {
  metadata.set(key, JSON.stringify(value))
}

const wrap = (err, props) => {
  const metadata = new grpc.Metadata()
  set(metadata, KEY_GAIA, true)

  props.forEach(prop => {
    const value = err[prop]
    // `grpc.Metadata` will fail if the value is undefined
    if (value === undefined) {
      return
    }

    set(metadata, prop, value)
  })

  return {
    metadata
  }
}

const unwrap = (err, props) => {
  const metadata = err[KEY_METADATA]
  if (!metadata) {
    return err
  }

  const is_gaia = get(metadata, KEY_GAIA)

  if (!is_gaia) {
    return err
  }

  const wrapped = new Error('unknown error')
  props.forEach(prop => {
    const value = get(metadata, prop)
    if (value === undefined) {
      return
    }

    wrapped[prop] = value
  })

  return wrapped
}

module.exports = {
  wrap,
  unwrap
}
