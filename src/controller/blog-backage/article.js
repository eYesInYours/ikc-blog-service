class ArticleHandler{
    // 获取文章列表
    articleListHandler(ctx, next){
        const { pageNum, pageSize, type } = ctx.request.query
        // 如何限制query中type的值

        ctx.body = {
            code: 200,
            msg: "success",
            data: "hello world"
        }
        console.log('get article list')
    }
}

module.exports = new ArticleHandler()