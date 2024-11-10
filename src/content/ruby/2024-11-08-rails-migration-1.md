---
title: Rails Migration (1/2) - 了解一点数据库迁移的知识
publishedAt: 2024-11-08
---

> 我第一次接触数据库迁移的概念是通过 Golang 的 [migrate](https://github.com/golang-migrate/migrate)，还记得当时被那些开源库作者们的奇思妙想所折服的瞬间，羡慕他们聪明伶俐的脑袋里蕴含着无尽的解决方案，仅仅一个数据库迁移问题就解决的这么毫无破绽。
>
> 直到我开始接触 Rails。
>
> 才知道什么叫 “简陋”，什么叫 “一山更比一山高”（我意不在批判 Go 或 migrate，但应当承认的是：正如 Ruby 永远不会在性能上超过 Go 一样，Go 在代码的优雅性上也永远难望 Ruby 之项背）。

在日常开发中，最常见的问题之一就是对数据库的修改：今天有个需求要添加一个字段，明天可能要更改一个数据类型，后天也许要加个索引 ... 而实际生产中一张表可能有几十上百个字段，要在很多开发人员之间 “对齐” 这张表，显然不能靠口口相传。

**数据库迁移** (*Migration*) 就是为了解决了这样一个问题： 它通过命令的方式自动化我们对数据库的修改，保存修改历史，使得仅需一行命令就能保持开发人员之间数据库结构的同步。

## 1. Rails Migration 基础

Rails Migration 的大体过程如下：

1. 在开发中我们使用命令生成迁移文件，文件被统一保存在 `db/migrate` 目录
2. 文件名以创建时的 UTC 时间戳和下划线开头，如 `20240529094628_xxx.rb`
3. 然后我们根据需要，手动修改生成的迁移文件，添加或补充字段
4. 之后运行 `rails db:migrate` 命令，指示数据库运行我们的迁移

> “迁移”、“迁移文件” 可能听起来有些陌生，其实就是：我们想要修改数据库，但是不想直接手写 SQL，于是用 Rails 命令生成一些代码，当我们运行这些代码时，这些代码被转化为 SQL 语句在数据库中运行，完成我们在数据库中创建表、修改字段等的需求。

### 1.1 生成迁移文件的命令

Rails 中把生成文件的命令叫**生成器 (generator)**。有两个可以创建迁移文件的生成器： `model` 和 `migration`。它们的用法如下：

```ruby
rails generate model/migration [model_name/MigrationName] [field]:[field_type]:[index]

# 即
rails g model/migration 数据库表名 字段:字段类型:索引
```

其中：

- `generate` 命令可以缩写为 `g`
- model 或 migration 的名字可以使用下划线分割或者驼峰式，如 `model_name`，`MigrationName`
- Rails 根据 model 后面的名字生成 (假设为 `event`)：
  - model 文件 `app/models/event.rb` (小写字母，可能带下划线)
  - model 文件中的类名 `class Event < ApplicationRecord` (首字母大写)
  - 数据库表的名字 `events` (复数)
- 字段类型如果为 `string`，可以省略
- 索引可以省略

更现实的例子是：

```bash
# model 生成器可以使用 `--skip-migration` 选项跳过生成迁移
rails g model event name:string:uniq location:string price:decimal

rails g migration AddFieldsToEvents starts_at:datetime description:text
```

我们一般使用 `model` 生成器创建数据库表，而使用 `migration` 生成器修改已存在的表，如添加、删除字段或索引。Rails 能够识别 `migration` 的两种特殊模式，即 `AddXXXToTABLE` 和 `RemoveXXXFromTABLE` (其中，`XXX` 是什么并不重要)，如果我们的 `migration` 名字符合这两个模式之一，那么 Rails 知道我们要向某个表中添加或删除字段，从而会在生成的迁移文件中自动为我们填写后面的字段和类型。

> - 在 Rails 项目目录内
>   - 运行 `rails g model -h` 命令可以查看 `model` 生成器的详细用法。
>   - 运行 `rails g migration -h` 命令可以查看 `migration` 生成器的详细用法。
> - 官方文档有更丰富的例子：[The Rails Command Line - generate](https://guides.rubyonrails.org/command_line.html#bin-rails-generate)

### 1.2 迁移文件名

我本地有一个项目的 `db/migrate` 目录如下：

```text
db/migrate
├── 20240527140216_create_events.rb
├── 20240528031744_add_fields_to_events.rb
├── 20240529094628_add_image_and_capacity_to_events.rb
├── 20240529141627_create_registrations.rb
├── 20240530041815_create_users.rb
├── 20240601132721_add_admin_to_users.rb
├── 20240601135646_make_registrations_a_join_table.rb
```

迁移文件前面的时间戳也被称为**版本号**，是由年月日时分秒组成的，一般是 14 个数字。这使得迁移文件能够有序排列，Rails 正是通过这个版本号来确定文件顺序并进行迁移的。虽然理论上存在版本号冲突的可能性，但**具有可确定性排序的时间戳的好处远远超过发生这种情况的微小风险**。

### 1.3 迁移文件的内容剖析

迁移文件的内容一般类似这样：

```ruby
# db/migrate/20240527140216_create_events.rb
class CreateEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :events do |t|
      t.string :name, null: false
      t.string :location
      t.decimal :price

      t.timestamps
    end
  end
end
```

这里的类名 `CreateEvents` 来自文件名 `create_events`，而所有迁移文件的类名都是 `ActiveRecord::Migration` 的子类。

Rails 不依赖于底层数据库，我们可以使用任何自己喜欢的数据库，但不同数据库支持的数据类型并不一致，所以 Rails 迁移通过使用**逻辑类型** (logical types) 来与底层数据库系统进行隔离。假如我们创建迁移时使用的某个字段是 `:datetime` 类型，那么如果使用的是 PostgreSQL 数据库，该字段就会被转换为 `timestamp` 类型。

在定义迁移中的列时，有几个*键值对*形式的常用选项：

- `null: true/false`：一般用 `null: false` 较多，转换成 SQL 就是添加 `NOT NULL` 约束。
  - 注意，model 层的 `presence: true` 只是基于代码层面的验证，如果我们绕过代码直接操作数据库字段，`presence: true` 是无能为力的
  - 要真正在数据库层面执行 `NOT NULL` 约束，`null: false` 是必须的
- `limit: size`：限制字段大小，基本上相当于 `VARCHAR(size)`
- `default: value`：设置默认值
  - 注意，这个默认值**只在运行迁移时执行一次**，所以如果我们使用 `default: Time.now`，结果可能不会让人满意

除了上面几个选项之外，在定义浮点数字段时，还强烈建议使用 `:precision` 和 `:scale` 选项，前者定义有效位数，后者定义小数点后的位数，如 `precision: 5, scale: 2` 限制存储的浮点数范围为 -999.99 到 +999.99。

此外比较重要的一点是：**迁移可以被执行，也可以被撤销**，Rails 使用 `up` 方法执行修改，使用 `down` 方法撤销修改。但在很多情况下，Rails 可以检测到如何撤销给定的操作，比如 `create_table` 的反向操作是 `drop_table`， `add_column` 的反向操作是 `remove_column`，而像 `rename_column` 操作也是可逆的，所以这些迁移只使用一个 `change` 方法就足够了。

但 `change_column` 操作就可能例外，比如整数可以转换为字符串，但反向操作字符串转整数就未必会成功。这种情况下，Rails 无法通过 `change` 方法发挥主观能动性，我们需要显式定义 `up` 和 `down` 方法，Rails 还为我们提供了一个这种情况下可以抛出的特殊异常：

```ruby
class ChangeOrderTypeString < ActiveRecord::Migration
  def up
    change_column :orders, :order_type, :string, null: false
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
```

> 当 Rails 无法通过 `change` 方法进行自动反向操作时，也会抛出 [ActiveRecord::IrreversibleMigration](https://api.rubyonrails.org/classes/ActiveRecord/IrreversibleMigration.html) 异常。

### 1.4 迁移命令

通过 `rails db:migrate` 迁移命令，我们可以执行迁移文件，即对数据库的修改。迁移代码在每个 Rails 数据库中维护一个名为 `schema_migrations` 的表，连接到数据库就可以查看这张表。这个表只有一列，即 `version`，列的内容正是前面讲的迁移文件的*时间戳/版本号*。

运行迁移命令时，Rails 会根据版本号查找 `db/migrate` 目录中的哪些文件还没有在 `schema_migrations` 表中，没有则执行，有则跳过。

可以通过 `VERSION=` 参数指定版本号 (如，`rails db:migrate VERSION=20221207000009`)，任何**小于等于这个版本号且还未被迁移的文件都会被运行，任何大于这个版本号且已经运行的迁移文件都会被撤销**，即**迁移会运行到这个版本号为止，少则加，多则删**。

如果你执行 `rails db:migrate` 修改了数据库，但由于发现了错误而想要撤销这个修改，可以使用 `rails db:rollback`，`STEP=` 参数可以撤销最近的多次迁移，如 `rails db:rollback STEP=3` 撤销最近三次迁移。

由于数据库服务器故障或其他原因导致我们的迁移没有执行成功，那么可以使用 `redo` 重试一次，`rails db:migrate:redo`，此命令同样支持 `STEP=` 参数。

## 2. 表的管理

### 2.1 表

再看一下创建表的方法：

```ruby
create_table :events do |t|
  t.string :name, null: false
  t.string :location
  t.decimal :price

  t.timestamps
end
```

`create_table` 方法接受表名和一个块作为参数，传递一个表定义对象到块，我们使用这个对象来定义列。Rails 迁移会自动将一个 `id` 列作为主键添加到我们创建的表中，而 `timestamps` 方法则会使用正确的时间戳类型创建 `created_at` 和 `updated_at` 列，所以默认情况下，每一张 Rails 迁移创建的表都会有 `id`，`created_at`，`updated_at` 这三列。

`create_table` 接受一个哈希选项作为第二个参数，常用的如下：

- `force: true`：如果要创建的表已存在，则删除它
- `temporary: true`：创建临时表 - 当应用程序和数据库的连接断开时，表就会消失。在迁移的背景下没有什么意义，但在其他地方有用武之地
- `options: "xxx"`：用来指定基础数据库的选项，被添加到 `CREATE TABLE` 语句的末尾，紧跟在右括号之后。
  - `create_table :tickets, options: "auto_increment = 10000" do |t| ...`
  - 这个选项和 MySQL 数据库一起使用时要小心，Rails MySQL Adapter 默认使用 `ENGINE=InnoDB`，如果使用 `:options` 而没有显式添加 `ENGINE=InnoDB`，那么将会使用配置的默认存储引擎。

还可以使用 `:primary_key` 选项修改主键名，但并不推荐；以及使用 `id: false` 告诉 Rails 不要自动添加 `id` 列，这在连接表的情况下可能常见，但要注意，对于不指定主键的表，那么我们最好加上索引，否则全表扫描令人昼夜不安。

除了创建表之外，还可以使用 `drop_table` 删除表，以及 `rename_table` 重命名表。

`rename_table` 虽然是可逆的，但在迁移时可能会有个小问题：

- 假设我们在 migration 4 中创建了 `order_histories` 表并写入一些数据
- 之后在 migration 7 时把这个表重命名为 `order_notes`，并把 model 层的类 `OrderHistory` 修改为 `OrderNote`
- 然后我们想要删除数据库并重新执行迁移，那么在执行到 migration 4 时会出现异常：因为我们的程序不再包含 `OrderHistory` 类，所以迁移失败。

这种情况的解决方案是我们可以在迁移中创建一个**迁移所需要的 model 类的虚拟版本**，例如：

```ruby
class CreateOrderHistories < ActiveRecord::Migration
  class Order < ApplicationRecord::Base; end
  class OrderHistory < ApplicationRecord::Base; end

  def change
    create_table :order_histories do |t|
     # ...
    end
  end
end
```

这种方法要求我们的 model 类中不能包含迁移中使用的任何附加功能，否则不会有效。

### 2.2 索引

说到表的管理，就不能不包含索引。在迁移中我们使用 `add_index` 方法来添加索引，其中一些值得注意的细节是：

- 使用可选参数 `unique: true` 会创建唯一索引
- 默认的索引名称是 `index_<table>_on_<column>`，可以使用 `:name` 参数覆盖
- 传递数组作为参数则会创建联合索引

如下：

```ruby
class AddPartNumberToProducts < ActiveRecord::Migration
  def change
    add_column :products, :part_number, :string
    add_index :products, :part_number
    # add_index :products, :part_number, unique: true
    # add_index :products, :part_number, name: "this_is_index_name"
    # add_index :products, [:part_number, :name]
  end
end
```

`remove_index` 则用来删除索引，由于用的不多，而且[官方文档](https://api.rubyonrails.org/classes/ActiveRecord/ConnectionAdapters/SchemaStatements.html#method-i-remove_index)列出了更丰富的例子，这里就不再赘述、徒增篇幅了。

> 写一篇文章并不像想象中那么简单，原本计划一天写完的内容，限于篇幅和精力，不得不把一些内容拆分到第二篇。
> 下一篇会总结一些 Rails Migration 的高级用法。
