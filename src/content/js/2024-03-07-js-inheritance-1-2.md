---
title: 深入理解 JavaScript 中的原型继承 (1/2)
publishedAt: 2024-03-07
---

现代 JavaScript 在语法层面做了大量更新，但并没有改变其 “原型继承” 的本质。和基于类的继承不同，原型继承使用委派，有一本设计模式的书中说过：*委派比继承更好* (delegation is better than inheritance)
。

## 理解原型继承

类继承依赖于基类或超类，是静态的，一旦继承了一个类，就不能再改变；而原型继承依赖于原型链中的上一个对象，这个对象叫做它的原型 (prototype)，原型继承最强大的一点是可以在运行时动态修改对象的原型。

#### 原型链

要理解原型继承，先要理解对象是如何链接的：

```js
class Counter {}

const counter1 = new Counter()
const counter2 = new Counter()

const counter1Prototype = Reflect.getPrototypeOf(counter1)
const counter2Prototype = Reflect.getPrototypeOf(counter2)

console.log(counter1 === counter2) // false
console.log(counter1Prototype === counter2Prototype) // true
```

上面的代码可以看出，类的两个不同实例，共享同一个原型。实际上，JavaScript 形成了一个原型链，我们可以继续获取 `counter1` 原型的原型，从而形成一个 `counter1` -> `Counter {}` -> `{}
` -> `null` 的链。

```js
const counter1PrototypeParent = Reflect.getPrototypeOf(counter1Prototype)
console.log(counter1PrototypeParent) // [Object: null prototype] {}
Reflect.getPrototypeOf(counter1PrototypeParent) // null
```

在基于类的继承中，同一个类的两个实例共享同一个类层次结构；而在原型继承中，同一个类的两个实例共享同一个对象链。不过这只是默认行为，因为我们可以动态地修改这个链 — 在基于类的继承中很难想象这样的动态能力。

#### Get 和 Set 的区别

继承的目的是共用方法和属性。当访问对象的方法或属性时，对象可以将调用请求委托给它的原型。但，访问 (get) 属性和设置 (set) 属性的行为差别很大。了解这一点对于在 JavaScript 中有效的使用继承非常重要。

我们可以通过修改原型成员来看一下原型继承是如何作用的：

```js
class Counter {}

Counter.prototype.count = 0
Counter.prototype.increment = function() { this.count += 1 }

const counter1 = new Counter()
const counter2 = new Counter()

console.log(counter1.count) // 0
console.log(counter2.count) // 0

counter1.increment()

console.log(counter1.count) // ?
console.log(counter2.count) // ?
```

可以暂停思考一下上面代码最后两行的输出结果是什么？

理性告诉我们结果应该是 1 和 0，毕竟两个不同的实例不应该互相影响；但想到两个实例共享同一个原型，`counter1` 和 `counter2` 上都没有 `count` 属性，修改 
`counter1` 即修改了原型上的 `count` 属性，那么在 `counter2` 上访问 `count` 属性是不是应该得到...

不应该，结果就是 1 和 0。原因在于 JavaScript 是如何使用原型的：

> **Gets search deep, but sets are always shallow**.

当我们访问 (get) 实例成员时，如果该成员在实例上存在，则直接返回；如果不存在，会继续向上查找其原型链，直到找到或者到达原型链的顶部 `null`。

而当设置 (set) 实例成员的值时，不会做任何查找、而是就地设置：**如果成员存在，则覆盖其值；如果成员不存在，则在对象上创建成员并设置其值**。

这一点也可以通过代码证明：

```js
Object.keys(Reflect.getPrototypeOf(counter1)) // [ 'count', 'increment' ]
Object.keys(counter1) // []

counter1.increment()
Object.keys(counter1) // [ 'count' ]
```

`counter1` 最开始并没有任何直接成员，但当调用 `increment()` 方法之后，`count` 就诞生了。

## 继承一个类

现代 JavaScript 极大地简化了创建原型继承的方式，语法清晰、优雅。但这是一把双刃剑：好的一面是代码更简洁、容易维护；坏的一面是语法和基于类的继承太像了，很容易忘记 “JavaScript 基于原型继承” 的本质。

#### 继承类

继承类即是以一个类作为原型来派生出一个新的类，从而达到共用原型的目的。

```js
class Person {
    constructor(firstName, lastName) {
        console.log('initializing Person fields')
        this.firstName = firstName
        this.lastName = lastName
    }
    
    toString() { return `Name: ${this.firstName} ${this.lastName}` }
    get fullName() { return `${this.firstName} ${this.lastName}` }
    get surname() { return this.lastName }
}

// 继承并 “扩展” Person 类
class GoodPerson extends Person {
    constructor(firstName, lastName, rating) {
        console.log('creating a GoodPerson')
        super(firstName, lastName)
        this.rating = rating
    }
}
```

上面的代码使用 `Person` 类作为原型，派生出 `GoodPerson` 类，有两点需要注意：
- 使用 `extends` 关键字继承类
- 在 `constructor()` 函数中必须调用 `super()` 方法，且在访问 `this` 之前。

> 如果调换上面 `GoodPerson` 类的 `super()` 和 `this` 位置，会得到：
> 
> `ReferenceError: Must call super constructor in derived class before accessing 'this' or returning from derived 
> constructor`.

#### 覆盖方法

要覆盖原型中提供的方法，只需要在派生类中写一个同名的方法即可：

```js
class GoodPerson extends Person {
    // ...
    toString() { return `${super.toString()} Rating: ${this.rating}` }
    
    get fullName() { return `GoodPerson ${this.surname}, ${super.fullName}` }
}
```

看起来很简单，不过关于 `this` 和 `super` 的使用有一些规则：
- 如果想访问派生类的成员，使用 `this` - 注意 `this` 是动态作用域。
- 如果想访问的成员在派生类中不存在，但在原型类中存在，使用 `this` - 因为 *Gets search deep*；另一方面，如果以后想覆盖原型类的成员，`this` 仍然继续适用。
- 如果确定想要绕过派生类中存在的成员，直接访问原型类的成员，使用 `super`。

#### 查看原型链

使用 `Reflect.getPrototypeOf()` 方法可以获得一个对象的原型，因为原型形成一个链，所以我们可以递归地调用这个方法来查看对象的原型链。

```js
const printPrototype = function(instance) {
    if (instance !== null) {
        console.log(instance)
        printPrototype(Reflect.getPrototypeOf(instance))
    }
}

const alan = new GoodPerson('Alan', 'Turing', 5)
printPrototype(alan)
/*
GoodPerson { firstName: 'Alan', lastName: 'Turing', rating: 5 }
Person {}
{}
[Object: null prototype] {}
 */
```

#### 修改原型链

上面提到过，和基于类的继承不同，原型继承可以动态修改。【“可以” 并不意味着 “应该”，小心风险！】

让我们试着修改上面 `alan` 的原型：

```js
class Demo {}

Reflect.getPrototypeOf(alan) // Person {}

Reflect.setPrototypeOf(Reflect.getPrototypeOf(alan), Demo.prototype)

Reflect.getPrototypeOf(alan) // Demo {}

printPrototype(alan)
/*
GoodPerson { firstName: 'Alan', lastName: 'Turing', rating: 5 }
Demo {}
{}
[Object: null prototype] {}
 */
```

修改了 `alan` 实例的原型，由于实例共享原型，那么由 `GoodPerson` 类创建的其他实例的原型也都变成了 `Demo`。

```js
const ada = new GoodPerson('Ada', 'Lovelace', 5)
Reflect.getPrototypeOf(ada) // Demo {}
```

> 话说回来，这么做真的很危险。

#### 使用默认构造函数

[上篇文章 - Javascript中的类 (class)](https://rubyist.run/js/2024-03-06-js-oop/) 中讲过，JavaScript 给每个类都提供了一个默认的构造函数。

对派生类也是如此。不仅如此，而且默认构造函数会把创建派生类实例时的参数自动通过 `super()` 调用传递给原型类。

```js
class AwesomePerson extends Person {
    get fullName() { return `Awesome ${super.fullName}` }
}

const ball = new AwesomePerson('Lucille', 'Ball')
ball.fullName // 'Awesome Lucille Ball'
```

#### 基于遗留类的继承

值得一提的是，`extends` 甚至还可以继承使用老式 JavaScript 语法创建的类，默认构造函数同样会处理参数。了解这点也许会对我们理解/重构遗留代码有用。

```js
function LegacyClass(value) { this.value = value }

class NewClass extends LegacyClass {}
console.log(new NewClass(1)) // NewClass { value: 1 }
```