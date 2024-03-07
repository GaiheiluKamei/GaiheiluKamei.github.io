---
title: JavaScript 中的模块 (Modules)
publishedAt: 2024-03-05
---

JavaScript 模块是一个封装好的文件，在模块内通过 `import` 引入要使用的第三方代码，同时通过 `export` 导出自己希望暴露到外部的对象。

## 创建模块

JavaScript 模块的创建不需要额外的仪式感或关键字，创建一个 `.js` 文件就是一个模块。模块默认启用严格模式，所以不需要在文件顶部指定 `'use strict'`。

模块中如果要使用 `import` 关键字导入其他模块，则所有的依赖声明都需要放在文件顶部，有两点值得注意：
- `import` 不允许嵌套。
- 在执行流中，一个模块只会被加载一次。如果模块 `a` 引用模块 `b`、`c`，模块 `b` 中也引用模块 `c`，那么当执行模块 `a` 时，模块 `c` 只会被加载一次。

> 如果要使用 Node 运行 JavaScript 模块，有两种方法：
> - 将文件扩展名修改为 `.mjs`，然后直接使用 `node xxx.mjs` 运行模块代码。
> - 或者保持模块扩展名为 `.js`，在同一目录内添加一个 `package.json` 文件，其顶层包含 `"type": "module"` 声明 (如最简单的 `package.json` 文件：`
     { "type":"module" }`)，然后使用 `node xxx.js` 运行模块。

## 导出 (Export) 模块

#### 行内导出 (inlining exports)

在创建常量/函数/类时直接在前面添加 `export` 关键字导出指定的常量/函数/类。

```js
export const FREEZING_POINT = 0

export function f2c(n) {}

export class Demo {}
```

#### 直接导出

除了在声明时导出之外，还可以在模块内（一般在底部）汇总指定要导出的对象。

```js
const FREEZING_POINT = 0
function f2c(n) {}
class Demo {}

export { FREEZING_POINT, f2c, Demo }
```

#### 重命名导出

在导出时可以指定不同的名字，类似在家里使用小名，江湖上还是要有个正式的名字。

```js
function c2k(n) {}

export {  c2k as celsiusToKelvin }
```

#### 默认导出 (default export)

默认导出有几点需要注意：
- 一个模块最多只能有一个默认导出。
- 行内默认导出只能应用于函数和类，不能用于变量和常量。
- 默认导出的函数/方法被别的模块 `import` 时，可以被随意命名。
- 如果一个函数或类被默认导出，那么其名字就是外部不可见的，如果本模块内也不使用这个函数或类，那么这个函数或类的名字就可以忽略。

```js
// 这个例子只是展示默认导出的不同方式，依然要记住：一个模块最多只能有一个默认导出。
export default function someName() {}

// 如果函数在模块内没有被使用，函数名可以忽略
export default function() {}

// 导出箭头函数
export default () => {}

// 导出无名类
export default class {}
```

#### 重新导出其他模块

为了减少 `import` 的调用次数和传递依赖，还可以重新导出其他模块中的内容。甚至可以使用 `export *` 将其他模块的所有导出内容从自己的模块中导出，但要注意的是：这里的 “所有” 不包括默认导出。

```js
export { aLongName as name, default as default } from './b'

// 还可以把其他模块的引用作为自己的默认导出
export { aLongName as name, Demo as default } from './b'

// 当然也可以把其他模块的默认导出重命名后再导出
export { default as Demo } from './b'
```

## 导入 (Import) 模块

`import` 指令指定要导入的模块的路径，可以是相对路径、绝对路径，或者模块名。当导入模块名时，模块的位置由运行时的配置决定，比如 Node 会在 `node_modules` 目录查找模块名。路径一般不包含文件扩展名。

#### 导入命名导出

导入其他模块的命名导出时，有两条规则：
- 导入的名字应该和导出的名字一致。
- 名字应该包含在 `{}` 中。

```js
import { FREEZING_POINT, f2c } from './weather'
```

#### 解决冲突

有两种可能的冲突：
- 导入的名字和本模块中的名字冲突。
- 导入的两个外部模块中的名字存在冲突。

```js
// 一种解决方案是至少为其中的一个名字重命名
import { A } from './a'
import { A as B } from './b'

// 另一种方案是给其中的一个模块增加命名空间，如下，访问 b 模块中的导出 A 需要使用 `b.A`
import { A } from './a'
import * as b from './b'
```

#### 导入 “默认导出”

```js
import { default as weather } from './weather'

// 可以简写为
import weather from './weather'
```

#### 同时导入 “默认导出” 和命名导出

`{}` 语法用于命名导出，不带 `{}` 用于默认导出。

```js
import weather, { f2c } from './weather'
```

#### 导入到命名空间

如果第三方模块中有很多我们需要的导出，那么逐个在 `{}` 中列出就很繁琐，可以使用 `*` 通配符将一切导出导入到指定的命名空间中。这里的 “一切导出” 依然是不包含 “默认导出”，默认导出需要单独导出。

```js
import * as weather from './weather'

// * 通配符导入一切，除了默认导出
// 这里把默认导出命名为 w
import w, * as weather from './weather'
```

#### 导入副作用模块

有时候我们需要导入一个有副作用的模块 (比如一个在执行时会给浏览器的 `window` 对象添加一些类的模块)，但并不真正使用这个模块中的导出，这种情况下可以使用下面的语法：

```js
import 'some-side-effect-module'
```

虽然 JavaScript 允许我们这样做，但要注意：编写、使用带有副作用的模块是一种不好的实践，容易导致错误和难以维护的代码。
