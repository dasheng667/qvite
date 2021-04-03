const fs = require('fs');
const path = require('path');
const koa = require('koa');
const DOM = require('@vue/compiler-dom');
const SFC = require('@vue/compiler-sfc');
const app = new koa();

const imageRE = /\.(png|jpe?g|gif|svg|ico|webp)(\?.*)?$/;
const mediaRE = /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/;
const fontsRE = /\.(woff2?|eot|ttf|otf)(\?.*)?$/i;
const isStaticAsset = (file) => {
  return imageRE.test(file) || mediaRE.test(file) || fontsRE.test(file)
}

app.use((ctx) => {
  const {
    request: { url, query }
  } = ctx;

  if (url == '/') {
    ctx.type = 'text/html';
    ctx.body = readFile('./index.html');
  }
  else if(url.endsWith('.js')){
    ctx.type = 'application/javascript';
    const res = readFile(url);
    ctx.body = rewriteImports(res);
  }
  else if (url.startsWith('/@modules')){
    // 解析module
    const prefix = path.resolve(
      __dirname,
      'node_modules',
      url.replace('/@modules/', '')
    );

    // 获取 package.json 内的 module 属性
    const module = require(prefix + '/package.json').module;
    const p = path.resolve(prefix, module);
    // 读取文件
    const res = fs.readFileSync(p, 'utf-8');
    ctx.type = 'application/javascript';
    // 读取的文件可能还会有依赖，递归替换。
    ctx.body = rewriteImports(res);
  }

  // 解析vue的模板和样式
  else if(url.includes('.vue') && query.type){
    ctx.type = 'application/javascript';
    const newUrl = url.substr(0, url.indexOf('?'));
    const { descriptor } = SFC.parse(readFile(newUrl))
    
    if (query.type === 'template'){
      const render = DOM.compile(descriptor.template.content, { mode: 'module'}).code;
      ctx.type = 'application/javascript';
      ctx.body = rewriteImports(render);
    }

    else if(query.type === 'style'){
      const style = descriptor.styles[0];
      ctx.type = 'application/javascript';
      ctx.body = `${updateStyle.toString()};
        const __css = ${JSON.stringify(style.content)};
        updateStyle(__css);
        export default __css;
      `;
    }
  }

  // 解析vue
  else if (url.endsWith('.vue')) {
    // vue 文件包含了三个部分，template script style。我们需要多每个进行单独处理
    const { descriptor } = SFC.parse(readFile(url))

    ctx.type = 'application/javascript';
    const script = descriptor.script.content.replace('export default ', 'const __script = ');

    ctx.body = `
      ${rewriteImports(script)}
      // 将vue的template单独作为一个请求来解析
      import { render as __render } from '${url}?type=template';

      ${descriptor.styles.length > 0 ? `import '${url}?type=style'`: ''}

      __script.render = __render;

      export default __script;
    `
  }

  // 解析静态文件
  else if (isStaticAsset(url)){
    ctx.body = fs.readFileSync(path.join(__dirname, 'src', url));
  }

})

app.listen(3000, () => {
  console.log('Koa listen 3000');
})

function readFile(srcPath){
  return fs.readFileSync(path.join(__dirname, srcPath), 'utf-8');
}

function rewriteImports(content){
  return content.replace(/from ['"](.*)['"]/g, function ($0, $1) {
    if ($1[0] !== '.' && $1[1] !== '/') {
      return `from '/@modules/${$1}'`;
    } else {
      return $0;
    }
  });
}

function updateStyle(content) {
  let style = document.createElement('style')
  style.setAttribute('type', 'text/css')
  style.innerHTML = content
  document.head.appendChild(style)
}