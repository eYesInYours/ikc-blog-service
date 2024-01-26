const { articleListHandler } = require('../../controller/blog-backage/article')

const Router = require('koa-router')
const router = new Router({prefix: '/article'})

router.get(
    '/list',
    articleListHandler
)

module.exports = router