---
title: JavaScript中的剩余参数和默认参数
publishedAt: '2024-03-01'
---

JavaScript 从一开始就支持可变参数：如果实参数量少于形参数量，则多余的形参值为 `undefined`；如果实参数量多于形参数量，则多余的实参会被丢弃。但之前对可变参数的支持缺乏透明度和一致性，现代 JavaScript 
对此做了很大改进。

## 剩余参数

老式 JavaScript 使用 `arguments` 对象处理参数：

```js
const max = function() {
    console.log(arguments[0]) // 1
    console.log(arguments) // { '0': 1, '1': 2, '2': 3, '3': 4 }
    console.log(arguments instanceof Array) // false
    
    let large = arguments[0]
    for (let i = 0; i < arguments.length; i++) {
        if (arguments[i] > large) {
            large = arguments[i]
        }
    }
    
    return large
}

max(1, 2, 3, 4) // 4
```

可以看到使用 `arguments` 对象的一些显而易见的缺点：
- 函数签名无法反应函数意图：从签名中无法得知函数是否需要参数、需要多少参数。
- `arguments` 对象看起来像数组，但并不是，这极大的限制了 “如果它是数组” 可以达到的能力。

然而出于向后兼容性，不能直接修改 `arguments` 对象，于是 JavaScript 新增了*剩余参数* (**rest parameter**)。

在形参名称前面加上 `...` 就是剩余参数，剩余参数是对 `arguments` 对象的直接替代：显式的 `...` 占位符告诉我们它可以接受任意数量的参数，而且它是数组。使用剩余参数重写上面的代码：

```js
const max = function(...values) {
    console.log(values[0]) // 1
    console.log(values) // [ 1, 2, 3, 4 ]
    console.log(values instanceof Array) // true
    
    return values.reduce((large, n) => large > n ? large : n, values[0])
}

max(1, 2, 3, 4) // 4
```

可以看到作为数组的剩余参数让我们有更多的方法可以选择，使我们写出更优雅、更有表现力的代码。

JavaScript 对剩余参数的使用有一些合理的限制：
- 剩余参数只能放在形参的最后一位。
- 形参中最多只能有一个剩余参数。
- 剩余参数只会包含没有被显式命名的值。

## 扩展操作符

说到剩余参数，就不得不提与其外表一模一样的*扩展操作符* (**spread operator**)。

扩展操作符把一个集合中的值变为离散的值，主要用在函数调用端和任何可迭代对象；而剩余参数把离散的值收集为数组，且只用在参数接收端，两者的上下文不同，理论上不应该引起混淆。

如果需要把一个数组中的元素传递到函数中，与其使用索引逐个获取元素，我们可以直接使用扩展操作符把数组变为离散的值传入函数：

```js
const greet = function(...names) {
    console.log(`hi ${names.join(', ')}`)
}

const tj = ['zhang', 'wang', 'li', 'zhao']
greet(...tj) // 等同于 greet(tj[0], tj[1], tj[2], tj[3])
```

有了扩展操作符，没有任何理由再使用 `apply()` 函数了，它能做到 `apply()` 函数做到和做不到的，比如传递给构造函数：

```js
greet.apply(null, tj)

const patternandFlags = ['r', 'i']
const regexp = new RegExp(...patternandFlags) 
// `new RegExp.apply()`: RegExp.apply is not a constructor
```

即使不使用剩余参数，也不影响使用扩展操作符：

```js
const name1 = ['zhang', 'wang', 'li']
const name2 = ['zhao']

const sayHello = function(name1, name2) {
    console.log(`hello ${name1}, ${name2}`)
}

sayHello(...name1) // hello zhang, wang
sayHello(...name2) // hello zhao, undefined
```

扩展操作符可以和离散值混合使用：

```js
const mixed = function(name1, name2, ...names) {
    console.log(`name1: ${name1}\tname2: ${name2}\tnames: ${names}`)
}

mixed('zhang', ...['wang', 'li', 'zhao'])
// name1: zhang     name2: wang     names: li,zhao
```

由于扩展操作符可以用在任何可迭代对象上，所以，它可以用来复制、连接、修改数组；还可以修改对象字段的值或者添加新的字段：

```js
const a = [1, 2, 3]
const b = [4, 5]
console.log([...a, 0]) // [ 1, 2, 3, 0 ]
console.log([...a, ...b]) // [ 1, 2, 3, 4, 5 ]
console.log([...a, 100, ...b]) // [ 1, 2, 3, 100, 4, 5 ]

const l = { name: 'Liu', age: 18 }
console.log({...l, age: 19}) // { name: 'Liu', age: 19 }
console.log({...l, age: 19, height: 182}) // { name: 'Liu', age: 19, height: 182 }
```

## 默认参数

默认参数有三个好处：
- 作为函数调用者，如果要传递的参数和默认参数值相同，可以免于传参。
- 作为函数作者，可以在不破坏代码的情况下修改函数签名。
- 默认参数可以使我们对同一个函数传递不同数量的参数，弥补 JavaScript 不支持函数重载的不足。

假设我们有一个根据书名排序的函数：

```js
const sortByTitle = function(books) {
    const byTitle = function(book1, book2) {
        return book1.title.localeCompare(book2.title)
    }
    // sort() 函数会修改调用对象，而修改函数输入是一种不好的实践
    // 使用 slice() 函数获取输入副本，在副本的基础上进行修改
    return books.slice().sort(byTitle)
}

books = [
    { title: 'Who Moved My Cheese' },
    { title: 'Great Expectations' },
    { title: 'The Power of Positive Thinking' }
]

console.log(sortByTitle(books))
```

假设有一个新的需求，需要支持按书名降序排列，如果我们直接修改函数签名添加一个新的参数，也许会破坏现有代码，或者即使不立即破坏现有代码，也可能需要修改代码实现，对新参数做 `undefined` 检查。使用默认参数可以完美的解决这个问题：

```js
const sortByTitle = function(books, ascending = true) {
    const multiplier = ascending ? 1 : -1
    const byTitle = function(book1, book2) {
        return book1.title.localeCompare(book2.title) * multiplier
    }
    return books.slice().sort(byTitle)
}
```

第一个字符串大于、等于、或小于第二个字符串时，`localCompare()` 函数会分别返回正数、0、或负数。`multiplier` 的引入使得函数的默认升序功能不变，同时增加降序功能。

函数可以有任意数量的默认参数，如：

```js
const fetchData = function(id, location = { host: 'a.com', port: 80 }, uri = 'x') {}
```

但这种情况下，如果我们想给 `uri` 参数赋值，而 `location` 参数使用默认值，该如何做？JavaScript 针对默认参数的传参规则是：
- 如果一个合适的值，则采用这个值。
- 如果传递 `null`，则这个形参的值就是 `null` - 所以不要传递 `null`。
- 如果传递 `undefined`，则使用默认值。

所以，使 `location` 参数保持默认的方式是：`fetchData(1, undefined, 'example')`。顺便提一下，虽然这样是合法的，但并不是一种好的编程实践，良好的编码方式是把默认参数放在最后。

提供给默认参数的值不仅限于字面量，也可以是表达式（在调用时求值），甚至是其左侧的参数值：

```js
const fileTax = function(papers, dateOfFiling = new Date()) {
    // ...
}

const computeTax = function(amount, aTax = .15, bTax = amount * (aTax + .10)) {
    console.log(bTax)
}

computeTax(10) // 2.5
```

但不能使用右侧的参数值：

```js
const computeTax1 = function(amount, aTax = bTax *.15, bTax = amount * .10) {
    console.log(bTax)
}

computeTax1(10)
// Uncaught ReferenceError: Cannot access 'bTax' before initialization
```

有一点需要注意的是，剩余参数不能有默认值：

```js
// IDE会直接提示：Rest parameter should not be initialized
// const notAllowed = function(first, second, ...more = [1,2,3]) {}
```

因为剩余参数如果没有被提供值，其默认是空数组，不必多此一举。