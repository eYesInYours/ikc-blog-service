const path = require("path");
const Router = require("koa-router");
const router = new Router();
// 处理前端传来的 formData
const multiparty = require("multiparty");
// fs拓展
const fse = require("fs-extra");

const UPLOAD_DIR = path.resolve(__dirname, "../", "upload");

/* 解析文件切片，并放置指定文件夹下 */
function multipartParse(ctx) {
  const multipart = new multiparty.Form();
  return new Promise((resolve, reject) => {
    multipart.parse(ctx.req, async (err, fields, files) => {
      if (err) {
        reject({
          code: 500,
          msg: "解析切片失败",
        });
      }
      
      const [chunk] = files.chunk;
      const [hash] = fields.hash;
      const [filename] = fields.filename;

      const chunkDir = path.resolve(UPLOAD_DIR, "chunkDir_" + filename);

      if (!fse.existsSync(chunkDir)) {
        await fse.mkdirs(chunkDir);
      }

      // fs-extra 中的 move 方法可以实现文件移动的功能
      if (!`${chunkDir}/${hash}`)
        await fse.move(chunk.path, `${chunkDir}/${hash}`);
      resolve({
        code: 200,
        msg: "上传切片成功",
      });
    });
  });
}

/**
 * 工具函数：在指定文件位置，写入文件流 
 * @param {path} 文件路径
 * @param {writeStream} 文件写入流
*/
function pipeStream(path, writeStream){
  new Promise(resolve => {
    // 创建读取流，读取指定文件
    const readSteam = fse.createReadStream(path);
    // 读取流通过管道写入文件流中
    readSteam.pipe(writeStream)
    readSteam.on('end', () => {
      // 完成后删除原始文件
      fse.unlinkSync(path)
      resolve()
    })
  })
}

/**
 * 工具函数：合并切片
 * @param {filePath} 文件路径
 * @param {filename} 文件名
 * @param {size} 文件大小
 * */
async function mergeFileChunk(filePath, filename, size){
    const chunkDir = path.resolve(UPLOAD_DIR, "chunkDir_" + filename)
    // 获取文件切片
    const chunkPaths = await fse.readdir(chunkDir)

    chunkPaths.sort((a, b) => a.split('-')[1] - b.split('-')[1])
    
    // 并发写入
    await Promise.all(
      chunkPaths.map((chunkPath, index) => 
        pipeStream(path.resolve(chunkDir, chunkPath),  fse.createWriteStream(filePath, {
            // 指定位置创建写入
            start: index * size,
        }))) 
    )

    // 合并所有切片成功后，删除切片文件夹
    fse.rmdirSync(chunkDir)

}

/* 上传文件切片 */
router.post("/upload", async (ctx, next) => {
  // 设置跨域
  ctx.set("Access-Control-Allow-Origin", "*");

  try {
    const res = await multipartParse(ctx);

    console.log("res", res);
    ctx.response.status = 200;
    ctx.response.body = {
      ...res,
      data: null,
    };
    // 结束前端请求
    await next();
  } catch (err) {
    console.log("err", err);

    ctx.response.status = err.code;
    ctx.response.body = {
      ...err,
      data: null,
    };
    // 结束前端请求
    await next();
  }
});

/* 合并文件切片 */
router.post("/merge", async (ctx, next) => {
  // 设置跨域
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Headers", "*")
  // 获取请求中的body数据

  ctx.body = {
    code: 200,
    msg: "合并切片成功",
    data: null,
  };
  await next();
});

module.exports = router;
