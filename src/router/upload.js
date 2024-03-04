const path = require("path");
const Router = require("koa-router");
const router = new Router();
// 处理前端传来的 formData
const multiparty = require("multiparty");
// fs拓展
const fse = require("fs-extra");
const fs = require("fs");
const rimraf = require("rimraf");

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
        // 本应该reject后终止，却没有
        return
      }

      /* 取出前端请求中相应的字段数据 */
      console.log("debugger", files);
      const [chunk] = files.chunk;
      // const [hash] = fields.hash;
      // const [filename] = fields.filename;
      const [fileHash] = fields.fileHash;
      const [index] = fields.index;

      const chunkDir = path.resolve(UPLOAD_DIR, "chunkDir_" + fileHash);

      if (!fse.existsSync(chunkDir)) {
        await fse.mkdirs(chunkDir);
      }

      // fs-extra 中的 move 方法可以实现文件移动的功能

      // 判断chunkDir下是否存在hash文件
      /* 若指定文件内已经有，则更新；若没有，则增加 */
      if (!fse.existsSync(`${chunkDir}/${fileHash}-${index}`))
        await fse.move(chunk.path, `${chunkDir}/${fileHash}-${index}`);
      // else console.log(`${chunkDir}/${hash}切片存在，跳过`)

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
function pipeStream(path, writeStream) {
  new Promise((resolve) => {
    // 创建读取流，读取指定文件
    const readSteam = fse.createReadStream(path);
    // 读取流通过管道写入文件流中
    readSteam.pipe(writeStream);
    readSteam.on("end", () => {
      // 完成后删除原始文件
      // fse.unlink(path);
      resolve();
    });
  });
}

/**
 * 工具函数：合并切片
 * @param {filePath} 文件路径
 * @param {filename} 文件名
 * @param {size} 文件大小
 * */
async function mergeFileChunk(filePath, fileHash, size) {
  const chunkDir = path.resolve(UPLOAD_DIR, "chunkDir_" + fileHash);
  // 获取文件切片
  const chunkPaths = await fse.readdir(chunkDir);

  chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1]);

  // 并发写入
  await Promise.all(
    chunkPaths.map((chunkPath, index) => {
      console.log(`合并顺序：${index}, 合并位置：${index*size}`)
      return pipeStream(
        path.resolve(chunkDir, chunkPath),
        fse.createWriteStream(filePath, {
          // 指定位置创建写入
          start: index * size,
        })
      );
    })
  );

  // await fse.remove(chunkDir);

  // 合并所有切片成功后，删除切片文件夹
  setTimeout(() => {
    fse.removeSync(chunkDir);
  }, 2000);
}

/* 上传文件切片 */
router.post("/upload", async (ctx, next) => {
  // 设置跨域
  ctx.set("Access-Control-Allow-Origin", "*");

  try {
    const res = await multipartParse(ctx);

    console.log("chunk res", res);
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
  ctx.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

  console.log("merge", ctx.request.body);
  const multipart = new multiparty.Form();
  const fields = await new Promise((resolve, reject) => {
    multipart.parse(ctx.req, async (err, fields, files) => {
      resolve(fields);
    });
  });
  console.log("fields", fields);

  try {
    // const [filename] = fields.filename;
    const [fileHash] = fields.fileHash
    const [size] = fields.size;
    const [suffix] = fields.suffix;
    const filePath = path.resolve(UPLOAD_DIR, `${fileHash}.${suffix}`);
    await mergeFileChunk(filePath, fileHash, size);
    const res = {
      code: 200,
      msg: "合并切片成功",
    };
    console.log("merge res", res);
    ctx.body = {
      ...res,
      data: null,
    };
  } catch (error) {
    console.log(error);
    ctx.body = {
      code: 500,
      msg: "合并故障",
      data: null,
    };
  }

  await next();
});

/* 验证文件是否存在 */
router.get('/verify', async (ctx, next) => {
  ctx.set("Access-Control-Allow-Origin", "*");
  const { filename } = ctx.query;
  console.log('query', ctx.query)
  const filePath = path.resolve(UPLOAD_DIR, filename);
  const isExist = fse.existsSync(filePath);
  ctx.body = {
    code: 200,
    msg: '验证成功',
    data: isExist
  }
  await next()
})

module.exports = router;
