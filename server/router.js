const Router = require('koa-router')
const KoaBody = require('koa-body')
const validate = require('koa-json-schema')

const actions = require('./actions')
const schemas = require('./schemas')
const passport = require('./auth')

const router = new Router({ prefix: '/api' })
const bodyParser = new KoaBody()

const NODE_ENV = process.env.NODE_ENV

module.exports = router

// authenticate auth code
router.post(
  '/authenticate',
  passport.authenticate('auth0'),
  function user (ctx) {
    ctx.body = ctx.state.user
  }
)

if (NODE_ENV === 'test') {
  router.post(
    '/authenticate-test',
    async function user (ctx) {
      await ctx.login()
      ctx.status = 200
    }
  )
}

// logout
router.post(
  '/logout',
  function logout (ctx) {
    console.log('logging out')
    ctx.logout()
    ctx.status = 200
  }
)

// current user
router.get(
  '/user',
  requireAuth,
  function user (ctx) {
    ctx.body = ctx.state.user
  }
)

// list sheets
router.get(
  '/sheets',
  requireAuth,
  async function listSheets (ctx) {
    const sheets = await actions.listSheets(ctx.db)
    ctx.body = sheets
  }
)

// create sheet
router.post(
  '/sheets',
  requireAuth,
  bodyParser,
  validate(schemas.sheet.create),
  async function createSheet (ctx) {
    const payload = ctx.request.body
    const sheet = await actions.createSheet(ctx.db, payload)
    ctx.body = sheet
    ctx.status = 201
    ctx.set('Location', `/sheets/${payload.name}`)
  }
)

// get sheet
router.get(
  '/sheets/:sheetName',
  requireAuth,
  async function getSheet (ctx) {
    const sheetName = ctx.params.sheetName
    const sheet = await actions.getSheet(ctx.db, sheetName)
    ctx.body = sheet
  }
)

// update sheet
router.patch(
  '/sheets/:sheetName',
  requireAuth,
  bodyParser,
  validate(schemas.sheet.update),
  async function updateSheet (ctx) {
    const sheetName = ctx.params.sheetName
    const payload = ctx.request.body
    const sheet = await actions.updateSheet(ctx.db, sheetName, payload)
    ctx.body = sheet
  }
)

// delete sheet
router.delete(
  '/sheets/:sheetName',
  requireAuth,
  async function deleteSheet (ctx) {
    const sheetName = ctx.params.sheetName
    await actions.deleteSheet(ctx.db, sheetName)
    ctx.status = 204
  }
)

// get columns
router.get(
  '/sheets/:sheetName/columns',
  requireAuth,
  async function getColumns (ctx) {
    const sheetName = ctx.params.sheetName
    const columns = await actions.getColumns(ctx.db, sheetName)
    ctx.body = columns
  }
)

// create column
router.post(
  '/sheets/:sheetName/columns',
  requireAuth,
  bodyParser,
  validate(schemas.column.create),
  async function createColumn (ctx) {
    const sheetName = ctx.params.sheetName
    const payload = ctx.request.body
    const column = await actions.createColumn(ctx.db, sheetName, payload)
    ctx.body = column
    ctx.status = 201
    ctx.set('Location', `/sheets/${sheetName}/columns/${payload.name}`)
  }
)

// update column
router.patch(
  '/sheets/:sheetName/columns/:columnName',
  requireAuth,
  bodyParser,
  validate(schemas.column.update),
  async function updateColumn (ctx) {
    const { sheetName, columnName } = ctx.params
    const payload = ctx.request.body
    const column = await actions.updateColumn(ctx.db, sheetName, columnName, payload)
    ctx.body = column
  }
)

// delete column
router.delete(
  '/sheets/:sheetName/columns/:columnName',
  requireAuth,
  async function deleteColumn (ctx) {
    const { sheetName, columnName } = ctx.params
    await actions.deleteColumn(ctx.db, sheetName, columnName)
    ctx.status = 204
  }
)

// get rows
router.get(
  '/sheets/:sheetName/rows',
  requireAuth,
  async function getRows (ctx) {
    const sheetName = ctx.params.sheetName
    const rows = await actions.getRows(ctx.db, sheetName)
    ctx.body = rows
  }
)

// create row
router.post(
  '/sheets/:sheetName/rows',
  requireAuth,
  bodyParser, // validation handled by db
  async function createRow (ctx) {
    const sheetName = ctx.params.sheetName
    const payload = ctx.request.body
    const row = await actions.createRow(ctx.db, sheetName, payload)
    ctx.body = row
    ctx.status = 201
  }
)

// update row
router.patch(
  '/sheets/:sheetName/rows', // filtering handled by querystrings
  requireAuth,
  bodyParser, // validation handled by db
  async function updateRow (ctx) {
    const sheetName = ctx.params.sheetName
    const query = ctx.request.query
    const payload = ctx.request.body

    if (Object.keys(query).length < 1) {
      ctx.throw(400, 'Missing conditions')
      return
    }

    const row = await actions.updateRow(ctx.db, sheetName, query, payload)
    ctx.body = row
  }
)

// delete row
router.delete(
  '/sheets/:sheetName/rows',
  requireAuth,
  async function deleteRow (ctx) {
    const sheetName = ctx.params.sheetName
    const query = ctx.request.query

    if (Object.keys(query).length < 1) {
      ctx.throw(400, 'Missing conditions')
      return
    }

    await actions.deleteRow(ctx.db, sheetName, query)
    ctx.status = 204
  }
)

function requireAuth (ctx, next) {
  if (ctx.isAuthenticated()) {
    return next()
  } else {
    ctx.status = 401
  }
}
