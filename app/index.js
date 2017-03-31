import express from 'express';
import proxy from 'express-http-proxy';
import timeout from 'connect-timeout';
import path from 'path';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import AV from 'leanengine';
AV.init({
  appId: process.env.LEANCLOUD_APP_ID || 'ouy08OrFpGAJNxS1T69ceUH7-gzGzoHsz',
  appKey: process.env.LEANCLOUD_APP_KEY || 'JNUXol0O66lg5H24kxcmcnOt',
  masterKey: process.env.LEANCLOUD_APP_MASTER_KEY || 'F0aA83DrHS5w31FfCGdOO3wh',
});

// 如果不希望使用 masterKey 权限，可以将下面一行删除
AV.Cloud.useMasterKey();

import './cloud';
// 加载云函数定义，你可以将云函数拆分到多个文件方便管理，但需要在主文件中加载它们

export default () => {
  const app = express();

  app.use(express.static('public'));

  // 设置默认超时时间
  app.use(timeout('20s'));

  // 加载云引擎中间件
  app.use(AV.express());

  app.enable('trust proxy');
  // 需要重定向到 HTTPS 可去除下一行的注释。
  // app.use(AV.Cloud.HttpsRedirect());

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: false}));
  app.use(cookieParser());

  app.use(proxy('https://api.leancloud.cn', {
    intercept: function (rsp, data, req, res, callback) {
      // rsp - original response from the target
      callback(null, data);
    }
  }));

  app.use(function (req, res, next) {
    // 如果任何一个路由都没有返回响应，则抛出一个 404 异常给后续的异常处理器
    if (!res.headersSent) {
      var err = new Error('Not Found');
      err.status = 404;
      next(err);
    }
  });

  // error handlers
  app.use(function (err, req, res, next) {
    if (req.timedout && req.headers.upgrade === 'websocket') {
      // 忽略 websocket 的超时
      return;
    }

    var statusCode = err.status || 500;
    if (statusCode === 500) {
      console.error(err.stack || err);
    }
    if (req.timedout) {
      console.error('请求超时: url=%s, timeout=%d, 请确认方法执行耗时很长，或没有正确的 response 回调。', req.originalUrl, err.timeout);
    }
    res.status(statusCode);
    // 默认不输出异常详情
    var error = {}
    if (app.get('env') === 'development') {
      // 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
      error = err;
    }
    res.render('error', {
      message: err.message,
      error: error
    });
  });

  return app;
};
