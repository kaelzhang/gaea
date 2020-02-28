const {join} = require('path')
const log = require('util').debuglog('gaia')
const test = require('ava')

const check = ([code, run], i) => {
  test(String(i), t => {
    try {
      run()
    } catch (err) {
      log(err.stack)
      t.is(err.code, code)
      return
    }

    t.fail('should fail')
  })
}

const createFixture = base => (...sub) => join(base, ...sub)

const fixture = createFixture(join(__dirname, 'fixtures'))
const example = createFixture(join(__dirname, '..', 'example'))

module.exports = {
  test,
  check,
  fixture,
  example,
  createFixture
}
