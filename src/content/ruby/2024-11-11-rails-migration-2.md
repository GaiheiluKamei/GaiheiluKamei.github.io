---
title: Rails Migration (2/2) - 迁移的一些高级概念
publishedAt: 2024-11-11
---

> [上篇文章](https://mp.weixin.qq.com/s/-1UIRpAV9UdUB9FB3is0tg)概述了 Rails Migration 的全貌而没有深入具体的细节，比如生成器具体支持哪些字段类型等等，主要是因为没有比官方文档更面面俱到的细节了。
>
> 我希望通过简要描述迁移的全貌，使得遇到问题再看官方文档时能够有的放矢，抓住自己需要的部分，而不被连绵不绝仿佛鼠标永远也滚不到尽头的文档所吓倒。

## 1. SQL native syntax

迁移提供了一种独立于数据库的方式来维护应用程序的架构。有时针对特定的数据库问题，迁移也可能会“能力不足”，Rails 提供了两种方法来解决这个问题：

1. 为类似 `add_column()` 这样的方法提供了 `:options` 参数
2. 使用 `execute()` 方法直接执行原生数据库语句

> 使用这两种方法时，都要考虑数据库引擎，因为这两种方法都使用 SQL 的 *native syntax*，即：如果我们使用了 PostgreSQL 独有的语法，显然我们只能使用 PostgreSQL 数据库。

比如，Rails 对 Enum 类型的支持很好，不过如果我们想在迁移中创建 Enum 类型，需要使用原生 SQL，即需要使用 `execute()` 方法：

```ruby
class AddPayTypes < ActiveRecord::Migration
  def up
    # %{} 是字符串字面量，优点之一是在字符串中包含特殊字符时，无需使用转义字符
    execute %{
      CREATE TYPE pay_type AS ENUM ('check', 'credit card', 'purchase order')
    }
  end

  def down
    execute "DROP TABLE pay_type"
  end
end
```

但在迁移中使用 `execute()` 方法来**书写原生 SQL 以弥补 Rails Migration 表达力的不足** (如触发器、存储过程等)，还需要注意一个存在：`db/schema.rb`。

因为运行迁移命令之后，Rails 会自动更新 `db/schema.rb` 文件，使它与数据库结构保持一致，这个文件在默认情况下和迁移文件的语法一样，只不过是相当于把所有的迁移文件汇总成一个大“迁移”，所以**如果迁移文件不能表达原生 SQL，这个文件自然也不可以**。

> 迁移是数据库结构的**历史记录**，`db/schema.rb` 文件是数据库结构的**当前快照**，两者互相补充，共同维护数据库的结构。
>
> 通常建议使用迁移文件来管理数据库结构，而 `db/schema.rb` 文件主要用于快速创建数据库和查看数据库结构。例如在大型项目中，通过 `rails db:schema:load` 命令根据 `db/schema.rb` 文件创建数据库比重新运行所有迁移要快的多。

我们可以通过修改配置来解决这个问题：在 `config/application.rb` 文件中添加 `config.active_record.schema_format = :sql` (此配置的默认值是 `:ruby`)，Rails 在运行迁移之后就不会生成 `db/schema.rb` 文件，取而代之的是 `db/structure.sql`，从文件名上也可以看出来，这个文件里包含的是原生 SQL，类似这样：

```sql
CREATE TABLE public.addresses (
    id bigint NOT NULL,
    street text NOT NULL,
    zip text NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);
```

## 2. Benchmarks

默认情况下，运行迁移命令时会输出正在运行的迁移以及运行时间，Rails 提供了 `say_with_time()` 方法让我们自行控制输出消息和基准：

```ruby
def up
  say_with_time "Updating prices..." do
    Person.all.each do |p|
      p.update_attribute :price, p.lookup_master_price
    end
  end
end
```

`say_with_time()` 方法在块执行之前打印字符串消息，在块执行完毕之后打印基准。

> 其实这个功能我也没碰到相关使用场景。

## 3. 生产环境中的迁移

迁移本身似乎很完美，但是队友有一个严重的问题：**更新数据库 Schema 的 DDL 语句 (几乎都) 不是事务性的**。

> DML (Data Manipulation Language) 操作 (`INSERT`，`UPDATE`，`DELETE`) 的回滚相对简单，只需要根据数据库的事务日志中的信息进行反向操作即可。
>
> 但 DDL 操作 (`CREATE TABLE`，`ALTER TABLE`) 的回滚需要释放磁盘空间、删除索引、恢复数据等，需要消耗大量的系统资源，影响数据库的性能，由于实现的成本和复杂性过高，所以大多数数据库系统选择不支持 DDL 语句的回滚。

比如下面的迁移：

```ruby
def change
  create_table :one do; end

  create_table :two do; end
end
```

如果第一个表创建成功，第二个表创建失败该怎么办？最合适的选择是删除整个数据库，重新创建数据库，然后再运行所有迁移。前面这句话看似平平无奇，但它暗示了一个重要规则：**在生产数据库上运行迁移是很危险的**，如果我们确实要这样做，必须首先备份数据库，然后再使用 `RAILS_ENV=production rails db:migrate` 命令 (但仍然存在风险)。

> 迁移是保持开发人员之间数据库结构同步的绝佳方案，但最好不要在生产数据库执行。我之前的公司大都是通过 DBA 手动执行 SQL 语句完成生产数据库的更改。

## 4. 迁移之外的数据库 Schema 操作

目前为止所描述的迁移方法也都适用于 Active Record connection 对象，所以也都可以在 Rails 程序的 model、view 和 controller 层访问 (虽然可以，但自然是强烈**不推荐**在 view 层使用)。

假设内部需求需要我们根据数据库数据出一份报告，这个报告需要运行相当长的时间，而且我们需要为这个报告建立特定的索引；但我们的应用在业务中并不需要这个索引，而且测试表明这个索引会显著减慢应用的速度。

这时候我们可以编写一个这样的方法：这个方法首先创建索引，然后运行一段代码，最后再删除索引：

```ruby
# 这个方法可以作为 model 层的 private 方法实现；也可以在库中实现
def run_with_index(*columns)
  with_connection.add_index(:orders, *columns)
  begin
    yield
  ensure
    with_connection.remove_index(:orders, *columns)
  end
end

# 上面方法的用法 (假设这个方法也在 model 中)
def get_city_statistics
  run_with_index(:city) do
    # ...
  end
end
```

> 🤔 你可能想了解的 `connection` 对象知识：
>
> 1. `connection` 对象是一个更高级别的抽象，提供了许多方法来执行数据库操作，管理事务，并处理不同数据库系统的差异。它实际上是 `ActiveRecord::ConnectionAdapters::AbstractAdapter` 或其子类的实例，具体子类取决于我们使用的数据库系统。
>
> 2. 可以通过两种方式获取 `connection` 对象：
>     - `ActiveRecord::Base.connection`，获取默认数据库连接
>     - 在 model 层使用 `self.connection` 或直接使用 `connection` 获取数据库连接 (通常和 `ActiveRecord::Base.connection` 相同，除非使用了多数据库配置)
>
> 3. 主要功能 (可以对数据库进行任意操作)：
>     - 使用 `connection.execute(sql)` 执行任意的 SQL 查询，通常是 ActiveRecord 无法直接处理的复杂查询或者数据库特定的操作
>     - 使用 `connection.transaction()` 进行事务管理
>     - 执行 DDL 语句
>       - `connection.create_table()`
>       - `connection.add_index()`
>       - `connection.add_column()`
>       - ...
>       - (这些方法比直接使用 `execute()` 跟安全，因为它们会根据数据库类型自动生成正确的 SQL 语句，并处理潜在的错误)
>
> 4. `connection` 对象是连接池的一部分，Rails 使用连接池来管理数据库连接，提高效率并避免连接耗尽。这意味着每次我们调用 `connection` 时，并不一定都会创建一个新的数据库连接，而是从连接池中获取一个可用的连接。
>
> ⚠️**Warning**：
>
> 值得注意的是，通过 `ActiveRecord::Base.connection` 获取 *connection* 对象的方式已经处于**软弃用**状态，因为这种方式获取的数据库连接会持续到整个请求周期结束，进而降低并发性和资源利用率，所以很多人在实际需要时都使用 `ActiveRecord::Base.connection_pool.with_connection` 来获取对象。
>
> 今年 2 月份，官方的一个 pr [https://github.com/rails/rails/pull/51083](https://github.com/rails/rails/pull/51083) 添加了 `ActiveRecord::Base.with_connection` 作为指向 `connection_pool.with_connection` 的快捷方式，所以以后有需要使用 *connection*对象的需要，推荐使用 `with_connection()` 方法。
>
> **`with_connection()` 接受一个代码块，并将一个连接对象传递到该代码块中，它保证块内的所有操作都使用同一个连接，并确保在多线程环境下的线程安全。当代码块执行完毕之后，连接对象会被异步释放回连接池，从而避免连接泄漏，并通过防止不必要的连接保持来间接提高高 IO 场景下的并发处理能力**。
>
> 多线程环境中，多个线程同时使用同一个连接可能会导致数据不一致或死锁，`with_connection()` 通过为每个线程提供一个独立的连接来避免这个问题。**`with_connection()` 的线程安全特性是它在并发环境中至关重要的一个方面**。
