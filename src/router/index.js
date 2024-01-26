const fs = require('fs')

const Router = require('koa-router')
const router = new Router()

// 迭代出当前路径文件夹下的所有文件
function returnFiles(dir = __dirname){

  // 文件和当前目录的相对路径
  const relativeSplit = dir.split(__dirname)[1].split('\\')

  const prefix = '.' + relativeSplit.join('/') + '/'
  // console.log(relativeSplit, prefix);

  let files = fs.readdirSync(dir)
  let fileArr = []
  files.forEach(file => {
    if(file.includes('.js')){
      file!='index.js' && (fileArr.push(prefix + file))
    }else {
      fileArr = fileArr.concat(returnFiles(dir + '\\' + file))
    }
  })
  return fileArr
}


returnFiles().forEach(file => {
    let r = require(file)
    if(r && r.routes)
      router.use(r.routes())
})


module.exports = router