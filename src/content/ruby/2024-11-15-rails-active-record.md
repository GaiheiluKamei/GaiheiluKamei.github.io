---
title: Rails ActiveRecord - CRUD 中的常识与细节
publishedAt: 2024-11-15
---

> 正如我第一次接触 migration 的概念是通过 Go 的 migrate 库，GORM 也是我第一次了解 ORM 是如何简化数据库操作的。还记得那时候 `new` 完一个结构体，一番操作之后 `return db.Model(X).First(&result)` 的酣畅，顿觉编程也不过如此。
>
> 直到多年前一个寻常的下午，我像往常一样在网上冲浪，看到一句话：“了解了 Rails，才算是看到 Web 开发的巅峰”。
>
> 之后，我就再也没有回头。

不知道 ActiveRecord 是否是 ORM 的鼻祖，但它是毫无疑问的典范。ActiveRecord 中有很多常用的 CRUD 方法，这些方法中既有众所周知的用法，也有值得注意的细节，本文尝试进行一些粗浅的总结。

## 1. ApplicationRecord

### 1.1 修改数据库表名

默认情况下，ActiveRecord 假定**数据库表名是相应的 Model 类名的小写复数形式；驼峰式 (CamelCase) 大小写会被转换为蛇形 (snake_case) 小写并复数化**。

虽然 Rails 可以处理大多数不规则复数形式，但偶尔我们可能会发现不正确的复数，这种情况下我们可以自行添加规则：

```ruby
# conifg/initializers/inflections.rb
ActiveSupport::Inflector.inflections do |inflect|
  inflect.irregular 'person', 'people'
end
```

如果不喜欢这种方式，或者我们的 Rails 应用连接的是已存在的数据库表，也可以在 Model 中直接指定表名：

```ruby
class Sheep < ApplicationRecord
  self.table_name = 'sheep'
end
```

### 1.2 了解表信息

ActiveRecord 类的实例对应数据库表中的行，可以通过多种方式来了解一个行的信息 (尤其是加入一家文档残缺的公司时)：

```ruby
# 假设我们有张 orders 表，如下
create_table "orders", force: :cascade do |t|
  t.string "name"
  t.text "address"
  t.string "email"
  t.integer "pay_type"
  t.datetime "created_at", null: false
  t.datetime "updated_at", null: false
end

# 1. 用`column_names` 查看有哪些列
Order.column_names
# ["id", "name", "address", "email", "pay_type", "created_at", "updated_at"]

# 2. `columns_hash` 返回一个 hash，键是列名，值是元信息
# 元信息包括列的 name，type，sql_type，null，default 等信息
Order.columns_hash

# 结果大致如下：
{
"id"=>
  #<ActiveRecord::ConnectionAdapters::SQLite3::Column: ...
    #<ActiveRecord::ConnectionAdapters::SqlTypeMetadata:...>,

"name" => #<...>,
}
```

> Rails 通过 `columns()` 方法获取列信息，并基于这些信息为列动态生成 *accessor* 方法。例如，*orders* 表有一个 `name` 列，那么 Rails 自动为我们生成 `order.name`，`order.name=` 方法。

除此之外，还有 `columns()`、`column_for_attribute()`、`column_defaults()` 等方法，这些方法都是顾名思义的。

### 1.3 了解列信息

假设 *orders* 表的 `pay_type` 是 Enum 类型：

```ruby
enum :pay_type, {
  "Check"          => 0,
  "Credit card"    => 1,
  "Purchase order" => 2
}, validate: true

# reader 方法获取列值
Order.first.pay_type # "Check"
```

当使用上面的 *reader* 方法获取列值时，值通常是被 ActiveRecord *转换* (cast) 后的结果；如果我们想要获取转换之前的列值，可以使用 `列名_before_type_cast`，即：

```ruby
Order.first.pay_type_before_type_cast # 0
```

> 顺便提一下，Rails 提供了大量令人震惊的追踪 Model 中列信息变化的方法：
> 
> [https://api.rubyonrails.org/classes/ActiveRecord/AttributeMethods/Dirty.html](https://api.rubyonrails.org/classes/ActiveRecord/AttributeMethods/Dirty.html)

### 1.4 表之间的关系

在众所周知的 *one-to-one*，*one-to-many*，*many-to-many* 关系中，*one-to-one* 有一个我一直搞不清楚但记住这个规则之后就明白了的规则： **包含外键的表的 Model 始终应该声明为 `belongs_to`**。

## 2. Create

有两种创建数据库记录的方式：

- `create()`
- `new()` + `save()`

`create()` 应该被优先使用，它是**原子操作**，原子性在处理事务和数据一致性方面至关重要，因此它更简单安全；但如果在保存记录之前需要进行一些额外的操作，如验证、数据处理等，那么 `new()` + `save()` 的方式更灵活。

下面是分别用这两种方法创建数据库记录的例子：

```ruby
# -------------------- new() + save() ----------------------- #

# 1. 经典方式
order = Order.new
order.name = 'Jack'
order.save

# 2. 使用块来避免创建新的局部变量
Order.new do |order|
  order.name = 'Jack'
  order.save
end

# 3. 通过 hash 对象进行构造，多用于直接存储 HTML 表单数据到数据库
order = Order.new(
    name: 'Jack',
    email: 'jack@example.com'
)
order.save

# ---------------------- create() ------------------------- #

# 1. 创建单个记录
order = Order.create(
    name: 'Jack',
    email: 'jack@example.com'
)

# 2. 传递 hash 数组来一次性创建多个记录
orders = Order.create!([
    {
        name: 'Jack',
        email: 'jack@example.com'
    }
])
```

> `new()` 和 `create()` 方法接受 hash 作为参数的真正原因是**使我们可以通过表单参数直接构造 Model 对象**：`@order = Order.new(order_params)`。

## 3. Read

### 3.1 基础

查找记录主要是通过 `find()` 和 `where()` 方法：

- `find()` 在接受一组 *id* 作为参数时，任何一个 *id* 找不到都会引发 `RecordNotFound` 异常。
- `where()` 作为国之重器，可以接受多种形式的参数：
  - String
  - Array
  - Hash
  - 还可以不接受参数，返回一个 `WhereChain` 实例：`Post.where.missing(:author)`

> [https://api.rubyonrails.org/classes/ActiveRecord/QueryMethods.html#method-i-where](https://api.rubyonrails.org/classes/ActiveRecord/QueryMethods.html#method-i-where)

`where()` 还有两个值得注意的地方：

```ruby
# 1. 不要使用这种方式构造字符串，容易受到 SQL 注入 攻击
Order.where("name = '#{name}'")

# 2. Rails 不会解析条件中的 SQL，所以：
Order.where("name LIKE '?%'", params[:name]) # 无效
Order.where("name LIKE ?", params[:name] + "%") # 有效
```

ActiveRecord 有种类繁多的基于 SQL 概念命名的方法，如果我们对 SQL 有较好的理解，那么理解这些方法就易如反掌；毕竟没有 SQL，ORM 就是空中楼阁。

```ruby
# 1. limit
# limit 方法一般和 order 方法一起使用，以保持查询结果的一致性
Order.where(name: 'jack').order('pay_type, created_at DESC').limit(10)

# 2. offset
# 可以基于 offset 方法构建方便的分页方法
def Order.find_on_page(page_num, page_size)
  order(:id).limit(page_size).offset(page_num * page_size)
end

# 3. select
# ActiveRecord 默认查询所有列，可以用 select 方法指定要查询的列
Talk.select('title, speaker, recorded_on')

# 4. joins
# joins 方法的参数直接插入到表名之后，任何查询条件之前
# 注意：查询语法是特定于数据库的，即不同数据库的 join 语法不同
LineItem
  .select('li.quantity')
  .where("pr.title = 'Programming Ruby'")
  .joins('as li inner join products as pr on li.product_id = pr.id')
  .to_sql
# 输出结果如下 (注意 "as li ..." 直接被插入到 "line_items" 表明之后)
# SELECT "li"."quantity" 
# FROM "line_items" as li 
# inner join products as pr on li.product_id = pr.id 
# WHERE (pr.title = 'Programming Ruby')

# 5. readonly
# readonly 方法返回的对象不能再被保存回数据库中
# 使用 joins 和 select 方法返回的对象被自动标记为 'readonly'
# 但已经被标记为 'readonly' 的对象也可以通过 false 参数使其可写
.readonly(false)

# 6. lock
# lock 方法默认参数是 true，表示使用数据库的默认锁 (一般是 "FOR UPDATE")
# 但也可以自行指定，比如下例 "share mode" 在 MySQL 中表示：给出一行的
# 最新数据，并保证在持有锁期间这一行不会被修改
Account.transaction do
  ac = Account.where(id:).lock("LOCK IN SHARE MODE").first
  ac.balance -= amount if ac.balance > amount
  ac.save
end

# 7. 链式调用
# 下面这个语句是基于 SQLite 语法
Order.group(:state).order("max(amount) DESC").limit(3)
```

> `？` 是占位符，Rails 会对它进行参数化查询，防止 SQL 注入。直接把参数拼接进 SQL 字符串会绕过参数化查询，导致 SQL 注入漏洞。
>
> 参数化查询：参数化查询把 SQL 语句的结构和数据值分离，数据库首先解析和编译 SQL 语句的结构，然后在执行时再将参数值填充到占位符中。这样，攻击者无法通过修改参数值来改变 SQL 语句的原始结构，从而避免了 SQL 注入漏洞。
>
> `readonly()` 主要用于防止意外修改数据，提高安全性；且只读操作可以避免不必要的数据库更新操作，从而提高性能。 
>
> 使用 `joins()` 方法时，利用 ActiveRecord 提供的更高级的关联方法可以提高代码的可移植性及可读性，如 `joins(:associated_model)` 比直接使用 SQL JOIN 语句更好。
>
> 上面这些查询方法的 API 都在 [https://api.rubyonrails.org/classes/ActiveRecord/QueryMethods.html](https://api.rubyonrails.org/classes/ActiveRecord/QueryMethods.html)。

### 3.2 Scope

我刚接触 *scope* 这个概念的时候感觉有点神奇，又似懂非懂，后来想明白了才知道：它其实相当于定义一个方法，这个方法返回可被链式调用的对象 `ActiveRecord::Relation`，不过是定义方法的方式有点别致。

```ruby
scope :last_n_days, ->(days) { where('updated_at < ?', days.days.ago)}

# 把上面的 scope 想象成下面的方法，或许更容易理解
def last_n_days(days)
  where('updated_at < ?', days.days.ago)
end
```

> 上面例子中 *scope* 和 `last_n_days()` 方法并不一样：
>   - *scope* 是类方法，通过类直接调用，而上面定义的 `last_n_days()` 只是一个实例方法
>   - 即便把 `last_n_days()` 定义成类方法，它们的返回值也不一样，我在这里只是**试图通过一个更易于理解的方式来说明 scope**
>   - 最关键的一点在于： `scope` 是 Rails 提供的特殊方法，它允许 Rails 在内部进行优化，例如缓存查询结果，这和简单的类方法有**本质区别**。
>
> 刚看了一下官方文档也是用类方法来“比喻” *scope*：[https://guides.rubyonrails.org/active_record_querying.html#using-conditionals](https://guides.rubyonrails.org/active_record_querying.html#using-conditionals)

### 3.3 `find_by_sql()` 和 `reload()`

有时候 ActiveRecord 提供的查询方法可能不足以支持我们的需求，Rails 总是提供一个“逃生舱”，这次也不例外：可以使用 `find_by_sql()` 方法进行原生 SQL 查询。

`find_by_sql()` 的细节是：**只有被查询的字段才会被写入内存中的对象**，可以使用下面三个方法确定属性是否存在于查询结果：

- `attributes()`
- `attribute_names()`
- `attribute_present?()`

```ruby
first_order = Order.find_by_sql("SELECT name FROM orders").first
first_order.attributes # {"name"=>"Jack", "id"=>nil}
first_order.attribute_present?("id") # false

# 有趣的是，如果我们给列一个派生名字，那么查询对象上也只能用派生名访问列
# 这实际增加了代码复杂度，属于非必要不使用
first_order = Order.find_by_sql("SELECT name as n FROM orders").first
first_order.n # "Jack"
```

> 所以我们在使用 `find_by_sql()` 时要注意总是显式查询 *id* 列，否则 *id* 就是 *nil*，没有 *id* 属性大概率会导致后续操作出现问题。

在执行完某些操作之后，需要验证数据库的数据是否被正确更新，这时候可以使用 `reload()` 方法来获取数据库中的最新数据。`reload()` **重新从数据库中查询记录，并用查询结果更新内存中的对象**，多用在验证数据库更改、处理并发更新、避免脏数据等方面，但比较多的是在单元测试中。

```ruby
user = User.find(1)
user.name = 'New Name'
user.save

reloaded_user = user.reload
puts reloaded_user.name # 'New Name'

user.name = 'Another Name' # 再次修改内存中的对象，但没保存
puts user.name # 'Another Name' (内存中的数据)
puts user.reload.name # 'New Name' (数据库中的数据)
```

> `reload()` 会产生额外的查询，所以在性能敏感的场景中要三思而后用。
>
> `reload()` 也会忽略掉内存中对象上的**任何未保存的更改**。

## 4. Update

更新操作主要有三个方法：

- `save()`：会根据对象的 `id` 属性判断是更新还是创建。如果 `id` 为 `nil`，则创建新记录，否则更新现有记录
- `update()` 类方法
- `update()` 实例方法

```ruby
# update 实例方法
order = Order.find(1)
order.update(name: 'Tom')

# update 类方法相当于 find + update 实例方法
# 它的第一个参数是单个 id (也可以是 id 数组)
order = Order.update(1, name: 'Tom')

# update_all 方法
# 批量更新，效率更高，但不会触发回调和验证
result = Product.update_all("price = 1.1 * price", "title LIKE '%Ruby%'")
```

> 我们都知道 `save()`，`create()` 方法不会引发异常，而 `save!()`，`create!()` 会，原因是：ActiveRecord 假设我们通常在 controller action 中调用 `save()` 方法，相关错误会由 view 层呈现给用户。
>
> 如果我们想要在代码中以受控的方式明确处理潜在的 `RecordInvalid` 异常，应该使用 `save!()` 之类的方法，这在以下几种场景中非常重要：
>   - API 端点 (我们可能不希望直接向客户端返回 `500` 错误码，而是返回带有 `422` 之类错误码的 JSON 响应)
>   - 后台作业 (`save!()` 会使得作业失败，使我们可以记录错误日志、重试或发送通知)
>   - 复杂的事务操作 (`save!()` 会触发整个事务的回滚)
>   - 测试等其他场景

## 5. Delete

有两类删除方法：

- `delete()/delete_all()` (类方法)
- `destroy()/destroy_all()` (类方法和实例方法)

> `destroy()` 类方法也是把要删除的行读取到对象中，然后调用这些实例的 `destroy()` 方法。

区别是 `delete()` 相关方法不会触发回调、验证等方法，**直接删除，速度很快**；`destroy()`相关方法会确保回调、验证方法全部被调用，所以速度较慢。一般来说，**如果想确保数据库与 Model 类中定义的业务逻辑一致，最好使用 `destroy()` 方法**。

> `destroy()` 方法会触发 `before_destroy`，`after_destroy` 回调，以及相关的依赖关系 (例如，如果有 `has_many` 关联，`destroy` 会默认删除关联的记录)，这些都是 `delete()` 方法不会做的。

```ruby
Order.destroy_all(["shipped_at < ?", 30.days.ago])
```

## 6. Callback

**回调 (Callback)** 用于控制 Model 对象的生命周期，通过回调，可以执行复杂的验证，映射或转换列值，甚至阻止某些操作的完成。

`before_validation` 和 `after_validation` 这两个回调的 `on:` 选项可以接受 `:create`，`:update`，`:save` 等值，甚至是这些值组成的数组，以限制在指定操作上调用回调。

回调有三种定义方式：

- 方法引用 (symbol，被引用的方法必须是 *protected* 或 *private* 方法)
- 回调对象
- 内联方法 (使用 proc)

```ruby
class Order < ApplicationRecord
  # 1. 方法引用： 通过 symbol 引用方法名，也被称为 handler
  before_validation :normalize_credit_card_number

  # 2. 内联方法： 块内接受的参数为 Model 的对象
  after_create do |order|
    logger.info "Order #{order.id} created"
  end

  private

  def normalize_credit_card_number
    self.cc_number.gsub!(/[-\s]/, '')
  end
end
```

一个回调可以有多个 handler，按照传递给回调的顺序被调用，在 `before_*` 回调上 `throw :abort` 可以使得回调链提前中断。

如果有多个 Model 应用一组相同的回调逻辑，那么可以把这组回调逻辑单独抽出到一个 handler 类中 (一般也放在 `app/models` 目录)，使用时把 handler 类的实例传递给回调方法，回调方法会调用实例中的同名方法 (即 `before_validation` 回调只会调用 handler 类中的 `before_validation` 实例方法)：

```ruby
# 定义一个 handler 类
class CreditCardCallbacks
  # 方法接受一个单独的参数，即 Model 对象
  def before_validation(model)
    model.cc_number.gsub!(/[-\s]/, '')
  end
end

# 在多个 Model 中使用
class Order < ApplicationRecord
  # CreditCardCallbacks 中的 before_validation 方法会被使用
  before_validation CreditCardCallbacks.new
end

class Subscription < ApplicationRecord
  before_validation CreditCardCallbacks.new
end
```

举一个更现实的例子，假设我们要使用凯撒密码创建一个有加密和解密功能的 handler 类，在把相关字段存入数据库前进行加密，存入数据库后进行解密以返回给调用者 (这意味着我们要实现 `before_save`，`after_save`，`after_find` 回调)：

```ruby
# encrypter.rb
class Encrypter
  # 传递一组字段作为参数
  def initialize(attrs_to_manage)
    @attrs_to_manage = attrs_to_manage
  end

  # 使用凯撒密码，存储前加密
  def before_save(model)
    @attrs_to_manage.each do |field|
      model[field].tr!("a-z", "b-za")
    end
  end

  # 存储后解密
  def after_save(model)
    @attrs_to_manage.each do |field|
      model[field].tr!("b-za", "a-z")
    end
  end

  alias_method :after_find, :after_save
end

# 在 Model 中使用上述 handler 类
require "encrypter"
class Order < ApplicationRecord
  encrypter = Encrypter.new([:name, :email])

  before_save encrypter
  after_save  encrypter
  after_find  encrypter

  protected

  def after_find
  end
end
```

> 每次从数据库中加载 *Order* 对象之后，都会调用 `encrypter.after_find` 方法，但 Rails 在执行完所有注册的 `after_find` 回调后，还会再次调用自身的 `after_find` 方法，如果不存在，会尝试再次调用 `encrypter.after_find`，从而导致**无限递归调用**，所以这里我们在 *Order* 类中放一个 `after_find` 空方法作为占位符。

我们甚至可以进一步优化这个例子：定义一个 helper method 以对所有 ActiveRecord Model 可用：

```ruby
class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true

  def self.encrypt(*attr_names)
    encrypter = Encrypter.new(attr_names)

    before_save encrypter
    after_save  encrypter
    after_find  encrypter

    define_method(:after_find) {}
  end
end

# 使用
class Order < ApplicationRecord
  encrypt(:name, :email)
end
```

> `self.abstract_class = true` 用于声明一个 ActiveRecord Model 是抽象类，这意味着这个 Model 本身不能被实例化，只能作为其他模型的基类存在，用于定义公共属性、方法和关联。
>
> 上面的示例代码远非可用，比如实际上应该避免在 `ApplicationRecord` 中定义空方法，而是让每个 Model 自己处理 `after_find` 回调。
> 
> 如果使用回调较多，那么官方文档很值得一看的：[https://guides.rubyonrails.org/active_record_callbacks.html](https://guides.rubyonrails.org/active_record_callbacks.html)

## 7. 事务

关于事务，唯一一点需要说明的是：ActiveRecord 会自动为 `save()`，`create()`，`destroy()` 等方法添加事务，保证**单个 Model 操作的原子性**，但当涉及多个 Model 的关联操作、复杂的业务逻辑，或者需要更细粒度的控制时，仍然需要使用显式事务 (`ActiveRecord::Base.transaction`) 来保证数据一致性和完整性。

## 8. 总结

Rails Guides 中的 Models 部分对验证、回调、查询接口等做了完全的描述和讲解，任何一篇文章甚至一本书都很难描述其万一，也正因为如此，令人 (wo) 望而生畏。我一直强调这点，是因为刚接触 Rails 时留下的阴影：Rails 的文档真的太长长长了 (Rails 8 开始的新版文档可读性才更好点)，感觉总也看不完，看了前面的忘了后面的，看了这一章忘了上一章。后来开始加快速度，但又觉得这种蜻蜓点水式的浏览不过是自欺欺人。

直到我无意中看到一本书，作者说他用了 Rails 十多年，但也还有很多东西不知道，我才意识到自己是错的。不知道大家有没有注意到 Rails 官网首页的那句硕大的黑体字： *Ruby on Rails scales from HELLO WORLD to IPO*，我以前一直被这句话澎湃着，想努力学完所有的 Rails 知识。

但真正让我沉静平和下来的，是我最近才注意到的它前面还有一句： **Learn just what you need to get started, then keep leveling up as you go**.

> [https://guides.rubyonrails.org/](https://guides.rubyonrails.org/)