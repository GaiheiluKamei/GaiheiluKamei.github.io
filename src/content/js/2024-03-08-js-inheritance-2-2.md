---
title: 深入理解 JavaScript 中的原型继承 (2/2)
publishedAt: 2024-03-08
---

[上篇文章](https://rubyist.run/js/2024-03-07-js-inheritance-1-2/)讲了 JavaScript 
中的原型继承和基于类的继承的重要区别，即原型继承的动态性。以及在继承一个类时如何利用其原型的构造函数、如何覆盖原型方法及修改原型链，其中最重要的是理解 Get 操作和 Set 操作的区别，这一点至关重要。

本篇继续讲一下如何决定基类方法中返回的类型。

## 实例类型的动态化

思考一下，在 JavaScript 中使用基类的方法创建一个实例时，这个实例的类型应该是和基类一致还是和派生类一致？

为了理解这个问题，先来看一下代码，一码胜千言。

#### 内置类的不同行为

不知道大家有没有注意，JavaScript 的两个内置类 **String** 和 **Array** 在各自的派生类的行为是不同的：

```js
class MyString extends String {}
class MyArray extends Array {}

const str = new MyString().concat(new MyString())
const arr = new MyArray().concat(new MyArray())

console.log(str instanceof MyString) // false
console.log(arr instanceof MyArray) // true
```

String 类上的 `concat()` 方法返回的实例仍然是 String 类型，即便这个方法是在派生类 MyString 上调用的，其返回的实例的类型仍然和其基类类型保持一致；而 Array 类上的 `concat()` 
方法返回的实例类型和其派生类 MyArray 一致。

一般来说，当在基类中实现一个方法时，我们可以做到：
1. 让方法返回的实例类型和基类一致
2. 让方法返回的实例类型和派生类一致
3. 让派生类来决定方法应该返回什么类型

虽然 Array 的行为像是第二种，但其实是第三种。我们的派生类 MyArray 可以告诉其基类 Array 的 `concat()` 方法应该返回什么类型。让我们分别看一下这些是如何做到的。

#### 和基类一致

```js
class Names {
    constructor(...names) {
        this.names = names
    }
    
    filter1(selector) {
        return new Names(...this.names.filter(selector))
    }
}

class ChildNames extends Names {}

const child = new ChildNames('Java', 'C#', 'JavaScript')

child.filter1(name => name.startsWith('Java'))
// Names { names: [ 'Java', 'JavaScript' ] }
```

Names 作为基类，其 `filter1()` 方法将返回值硬编码为 `new Names(...)`，所以即便是在 Names 的派生类上调用 `filter1()` 返回类型也是 Names。这和 String 类的 `concat
()` 方法有点像：无论运行时实例的类型是什么，返回类型都和基类保持一致。

方法就是将返回值类型硬编码为基类。

#### 和派生类一致

在运行时，如果我们想调用 `this` 的实际类型的构造函数，而不是硬编码的类名，我们必须获得对构造函数的引用。要访问一个对象的构造函数，就需要获取它的原型并查询其原型的 `constructor` 属性。

```js
class Names {
    constructor(...names) {
        this.names = names
    }
    
    filter2(selector) {
        const constructor = Reflect.getPrototypeOf(this).constructor
        return new constructor(...this.names.filter(selector))
    }
}

class ChildNames extends Names {}

const child = new ChildNames('Java', 'C#', 'JavaScript')

child.filter2(name => name.startsWith('Java'))
// ChildNames { names: [ 'Java', 'JavaScript' ] }
```

这段代码并不难理解，无非是把硬编码的类名改为运行时动态获取。

看到这里，我们可能会想到：如何做到兼而有之？即根据需要返回基类或派生类的类型。

#### 动态配置

一旦我们获取了构造函数 (注意，JavaScript 中的类实际上就是一个构造函数，只是 ES6 扩展了语法)，就可以进一步获取到 static 方法和属性。假设我们定义一个名为 `kindHint` 的 static 
方法来作为提示：如果实例有这个类属性，就根据这个属性值来决定返回值类型；否则就回退到派生类类型。

```js
class Names {
    constructor(...names) {
        this.names = names
    }
    
    filter3(selector) {
        const constructor = Reflect.getPrototypeOf(this).constructor.kindHint ||
            Reflect.getPrototypeOf(this).constructor
        return new constructor(...this.names.filter(selector))
    }
}

class ChildNames extends Names {}

const child = new ChildNames('Java', 'C#', 'JavaScript')

child.filter3(name => name.startsWith('Java'))
// ChildNames { names: [ 'Java', 'JavaScript' ] }

// 给 ChildNames1 类实现 kindHint 属性
class ChildNames1 extends Names {
    static get kindHint() { return Names }
}

const child1 = new ChildNames1('Java', 'C#', 'JavaScript')

child1.filter3(name => name.startsWith('Java'))
// Names { names: [ 'Java', 'JavaScript' ] }
```

基类 Names 的 `filter3()` 方法提供了选择：如果派生类存在 `kindHint` 属性，就根据属性来决定返回类型；否则直接返回派生类类型。

这个方法有点完美。唯一的遗憾是 `kindHint` 这个名字，如果派生类存在这个属性名但用于其他用途该怎么办？这就要求我们要有一个唯一、独特的名字。说到唯一、独特，不禁让人浮想联翩到 [**Symbol**](https://rubyist.run/js/2024-03-04-js-symbol-usages/)。

#### 这就是终极

我们可以创建自己的 Symbol，不过 JavaScript 已经提供了一个用于此目的的 Symbol：`Symbol.species`，`Symbol.species` 用于传递创建派生类的构造函数。于是上面的代码可以重写为：

```js
class Names {
    constructor(...names) {
        this.names = names
    }

    filter3(selector) {
        const constructor = Reflect.getPrototypeOf(this).constructor[Symbol.species] ||
            Reflect.getPrototypeOf(this).constructor
        return new constructor(...this.names.filter(selector))
    }
}

class ChildNames1 extends Names {
    static get [Symbol.species]() { return Names }
}
```

Array 类正是利用 `Symbol.species` 达到类似的目的。

```js
class MyArray extends Array {
    static get [Symbol.species]() { return Array }
}

const arr = new MyArray().concat(new MyArray())
console.log(arr instanceof Array) // true
```

本文开头我们从 Array 派生出的 MyArray 类调用 `concat()` 方法返回的是 MyArray 类，如今经过我们的一番操作，已然是 Array。真是令人不胜唏嘘。