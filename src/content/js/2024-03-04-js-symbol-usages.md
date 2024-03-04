---
title: JavaScript中的Symbol、Iterator和Generator
publishedAt: 2024-03-04
---

ES6 之前 JavaScript 只有五种原语 (*primitive*): `number`, `string`, `boolean`, `null`, 和 `undefined`。`Symbol` 是 JavaScript 
出于特殊目的引入的一个新的原语，主要用于三个方面：
- 为对象定义隐藏属性 - 这里的隐藏属性并不是私有属性，只是在普通的迭代中不容易被发现。
- 定义对象的全局注册表。
- 在对象中定义一些众所周知 (well-known) 的方法，弥补 JavaScript 没有接口带来的不足，这是 Symbol 最重要的目的之一。

## Symbol 原语

#### 隐藏属性

在 Symbol 被添加之前，对象中的所有属性都可以通过 `for...in` 循环获得，Symbol 改变了这种行为，Symbol 属性不能通过这种迭代查看。

```js
const age = Symbol('age')
const email = 'email'

const sam = {
    first: 'Sam',
    [email]: 'sam@gmail.com',
    [age]: 2
}

for(const property in sam) {
    console.log(`${property}: ${sam[property]}`)
}
/*
first: Sam
email: sam@gmail.com
undefined
 */

Object.getOwnPropertyNames(sam) // [ 'first', 'email' ]
```

但隐藏属性并不代表 Symbol 属性就是私有的，它仍然可以被访问或修改。

```js
Object.getOwnPropertySymbols(sam) // [ Symbol(age) ]

sam[age] // 2
sam[age] = 3
sam[age] // 3
sam.age // undefined
```

#### 全局注册表

Symbol 不能通过 `new` 操作符创建，只能通过 `Symbol()` 函数创建，不过传递给此函数的参数没有什么意义，只是出于调试的目的，因为任何通过此函数创建的 Symbol 都互不相同。

然而 `Symbol.for()` 方法有点别致，这个方法接受一个键 (*key*) 作为参数，以此创建一个 Symbol：如果这个键对应的 Symbol 
在全局注册表中不存在，就创建并返回一个新的 Symbol；如果已存在，则返回已存在的 Symbol。在任何时候我们都能通过 `keyFor()` 方法查找一个键对应的 Symbol。

```js
Symbol('o') === Symbol('o') // false

const m = Symbol.for('o')
const n = Symbol.for('o')
console.log(m === n ) // true
console.log(Symbol.keyFor(m) === 'o') // true
```

这个特性通常用来创建 [Well-known Symbols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#well-known_symbols)。

#### Well-known Symbols

其他语言中类之间的协作大多通过接口来实现，JavaScript 有点直率，如果一个类希望别的类有一个方法，那么它就会在那个类中找那个方法。虽然这很简单，但由于缺乏清晰、唯一地定义一个方法或属性名的方式，很容易引起错误和歧义，这就是 
Symbol 的用武之地。比起查找一个类中是否存在 `myMethod`，查找全局唯一的 `[Symbol.for('myMethod')]` 显然不会有歧义。

JavaScript 定义了很多 “众所周知” (*well-known*) 的 Symbol，如：`Symbol.iterator`, `Symbol.match`, `Symbol.replace`, `Symbol.search`。一些函数或方法期望类实现某些 Symbol，以便可以把类的实例作为参数传递给这些函数或方法。

以 String 的 [`search()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/search) 方法为例，此方法期望其参数是一个 `RegExp` 对象，或者是一个有 `Symbol.search` 方法的对象，String 会通过此方法执行搜索。

```js
class SuperHero {
    constructor(name, realName) {
        this.name = name
        this.realName = realName
    }
    toString() { return this.name }
    
    [Symbol.search](value) {
        console.log(`this: ${this}, value: ${value}`)
        return value.search(this.realName)
    }
}

const superHeroes = [
    new SuperHero('Superman', 'Clark Kent'),
    new SuperHero('Batman', 'Bruce Wayne'),
    new SuperHero('Iron Man', 'Tony Stark'),
    new SuperHero('Spiderman', 'Peter Parker')
]
const names = 'Peter Parker, Clark Kent, Bruce Wayne'

for(const superHero of superHeroes) {
    console.log(`Result: ${names.search(superHero)}`)
}
/*
this: Superman, value: Peter Parker, Clark Kent, Bruce Wayne
Result: 14
this: Batman, value: Peter Parker, Clark Kent, Bruce Wayne
Result: 26
this: Iron Man, value: Peter Parker, Clark Kent, Bruce Wayne
Result: -1
this: Spiderman, value: Peter Parker, Clark Kent, Bruce Wayne
Result: 0
 */
```

> - `toString()` 方法可以被显式调用以返回对象的字符串表示；而在模板字符串或者需要将对象转换为字符串的上下文中会被自动调用。
> - [Object.prototype.toString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString)

## 自定义迭代器 (Iterators) 和生成器 (Generators)

数组之所以可以使用 `for...of` 语法进行迭代，是因为其实现了 `Symbol.iterator` 方法。如果一个类实现了这个方法，那么它的实例就可以被迭代。

```js
class Demo {
    constructor() {
        this.chars = ['a', 'b', 'c', 'd']
    }
}

const demo = new Demo()
for(const d of demo) {
    console.log(d)
} // Uncaught TypeError: demo is not iterable
```

添加 `Symbol.iterator` 方法之后，JavaScript 会自动查找实例的此方法，利用此方法执行迭代：

```js
class Demo {
    constructor() {
        this.chars = ['a', 'b', 'c', 'd']
    }
    
    [Symbol.iterator]() {
        let index = -1;
        const self = this;
        return {
            next() {
                index++;
                return {
                    done: index >= self.chars.length,
                    value: self.chars[index]
                }
            }
        }
    }
}

const demo = new Demo()
for(const d of demo) {
    console.log(d)
}
/*
a
b
c
d
 */
```

抛开这个方法扑面而来的繁琐和冗长不谈，可以看到这种动态性赋予了类强大的力量和灵活性。

不过如果真的要在自己的类中实现这个方法，冗长和繁琐的问题就不得不谈。还好 JavaScript 有一个 `yield` 关键字让我们可以避免手写这种实现代码。但迭代器的调用方需要知道自己拿到的是一个带有 `next()` 
方法的对象，还是一个 `yield` 关键字返回的结果。为了帮助调用方区分这两种情况，使用 `yield` 关键字的方法前面需要添加一个 `*` 符号。

使用 `yield` 关键字重写上面的方法如下：

```js
class Demo {
    constructor() {
        this.chars = ['a', 'b', 'c', 'd']
    }

    *[Symbol.iterator]() {
        for (const c of this.chars) {
            yield c
        }
    }
}
```

`yield` 将其后面的值返回给调用者，然后暂停自己，等待调用者使用这个值；调用者使用完毕之后，再通过 `yield` 获取下一个值，如此往复。

除了 `Symbol.iterator` 方法之外，类还可以实现任意的方法作为生成器，生成器的特点是：方法名以 `*` 开头，且函数体内有至少一个 `yield` 调用。

```js
class Demo {
    constructor() {
        this.chars = ['a', 'b', 'c', 'd']
    }

    *[Symbol.iterator]() {
        for (const c of this.chars) {
            yield c
        }
    }
    
    *oneGenerator() {
        yield 'x'
        yield 'y'
        yield 'z'
        
        for (let i = 3; i > 1; i--) {
            yield i.toString()
        }
    }
}

const demo = new Demo()

for(const d of demo) {}
for(const d of demo.oneGenerator()) {}
```

类的可迭代性默认是通过 `Symbol.iterator` 方法来实现的，如果没有这个方法，类就是不可迭代的。上面的例子中，如果 `Demo` 类没有 `Symbol.iterator` 方法而只有 `oneGenerator()` 
方法，那么就不能直接使用 `for(const d of demo)` 来迭代，但可以通过显式调用 `demo.oneGenerator()` 来迭代。

类可以有多个生成器方法，这些生成器方法还可以组合使用：

```js
class Demo {
    constructor() {
        this.chars = ['a', 'b', 'c', 'd']
    }
    
    *oneGenerator() {
        yield 'x'
        yield 'y'
        yield 'z'
        
        for (let i = 3; i > 1; i--) {
            yield i.toString()
        }
    }
    
    *anotherOneGenerator() {
        for(const c of this.chars) {
            yield c
        }
    }
    
    *combineGenerator() {
        yield* this.oneGenerator()
        yield* this.anotherOneGenerator()
    }
}

const demo = new Demo()
for (const d of demo.combineGenerator()) {
    console.log(d)
}
```

上述代码有两点需要说明：
- `yield*` 关键字的作用是一次从一个集合中取出一个值返回给调用者。
- `combineGenerator()` 方法被调用时，会先消耗 `oneGenerator()` 结果中的值，消耗完毕之后再继续消耗 `anotherOneGenerator()` 中的值。

可以认为：

```js
const arr = [1, 2, 3, 4]
yield* arr

// 等价于
for (const n of arr) {
    yield n
}
```

JavaScript 中的迭代器是惰性的，即 `yield` 生成一个值，等待调用方消耗这个值，调用方继续请求，再返回下一个值。我们可以据此实现一个无限生成器，然后在调用端控制其行为：

```js
const isPrime = function(n) {
    for(let i = 2; i < n; i++) {
        if (n % i === 0 ) return false
    }
    return n > 1
}

const primesStartingFrom = function*(start) {
    let index = start
    while(true) {
        if(isPrime(index)) yield index;
        index++
    }
}

// 调用
for(const n of primesStartingFrom(10)) {
    process.stdout.write(`${n}, `)
    if(n > 25) break
} // 11, 13, 17, 19, 23, 29, 
```

上面代码需要说明的是：`function` 关键字后跟 `*` 表示这个函数是生成器。这里的重点依然是惰性 (*laziness*)。