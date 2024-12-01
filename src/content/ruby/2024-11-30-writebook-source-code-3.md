---
title: 37signals Writebook 源码学习(3) - Model 层的完美抽象 (book/leaf)
publishedAt: 2024-11-30
---

Writebook 是一个用来写书的小型应用程序，所以它的主要业务逻辑是围绕 “book” 展开的。无论是从 `routes.rb` 上看还是从用户界面的使用上观察，book 都包含三种类型的内容：page、section、picture。但 Model 层 `book.rb` 中却只有如下两行**关联** (associations) 关系：

```ruby
# models/book.rb
class Book < ApplicationRecord
  # ...

  has_many :leaves, dependent: :destroy
  has_one_attached :cover, dependent: :purge_later

  # ...
end
```

`has_one_attached` 方法用来给 Model 添加**一对一的附件关联**，如图片、视频等。它**接受一个名字作为参数，我们用这个名字来访问对象的附件**。在此之上，Rails 还进一步提供了访问附件属性的简便方法，如：

- `book.cover.filename`
- `book.cover.content_type`
- `book.cover.url`

以及 `with_attached_*` (如本例 `Book.with_attached_cover`) 方法来避免 N+1 查询。

附件的实际存储是由 ActiveStorage 管理的，在 `rails console` 中运行 `Book.first.cover.filename` 的查询结果如下：

```ruby
writebook(dev)> Book.first.cover.filename
  Book Load (1.4ms)  SELECT "books".* FROM "books" ORDER BY "books"."id" ASC LIMIT ?  [["LIMIT", 1]]
  ActiveStorage::Attachment Load (0.3ms)  SELECT "active_storage_attachments".* FROM "active_storage_attachments" WHERE "active_storage_attachments"."record_id" = ? AND "active_storage_attachments"."record_type" = ? AND "active_storage_attachments"."name" = ? LIMIT ?  [["record_id", 1], ["record_type", "Book"], ["name", "cover"], ["LIMIT", 1]]
  ActiveStorage::Blob Load (0.8ms)  SELECT "active_storage_blobs".* FROM "active_storage_blobs" WHERE "active_storage_blobs"."id" = ? LIMIT ?  [["id", 1], ["LIMIT", 1]]
=> #<ActiveStorage::Filename:0x00007206e2944980 @filename="writebook-manual.jpg">

writebook(dev)> ActiveStorage::Blob.column_names
=> ["id", "key", "filename", "content_type", "metadata", "service_name", "byte_size", "checksum", "created_at"]
```

这里有以下几点值得了解：

- ActiveStorage 使用 `record_id`、`record_type`、`name` 三个列共同作用来确定 `blob_id`
- 通过 `blob_id` 在 `ActiveStorage::Blob` 中查询附件的元数据 (如文件名、文件类型、大小、校验和等)
- `ActiveStorage::Blob` 中的 `key` 列从配置的存储服务中检索实际的文件内容，它指向附件的实际位置

> `has_one_attached` API: [https://api.rubyonrails.org/classes/ActiveStorage/Attached/Model.html#method-i-has_one_attached](https://api.rubyonrails.org/classes/ActiveStorage/Attached/Model.html#method-i-has_one_attached)

`has_one_attached` 方法不是本文的重点，我只是不想放过这个知识点。

所以回到 Writebook 的抽象上来：Book 模型 `has_many :leaves`，这里的 `:leaves` 是什么？为什么路由文件里没有这个模型的信息？

事实上它更多的是一个内部的实现细节，而不是面向用户的。一个 Book 由很多 Leaves 组成，很多 Leaves 组成了一个 Book；这在逻辑上是一种简单而直截了当的关系。

而深入到细节里，虽然：

- Page 有 `ActionText::Markdown` 内容
- Section 有纯文本组成的 body
- Picture 有一个 image 附件和 caption 属性

然而**它们都是 Leaf**。

Leaf 是一个简约而不简陋的包装，它提供了一个对外“暴露”的接口，让这些七零八碎都穿上 Leaf 的外衣，以统一的形象示人。

Writebook 通过 `delegated_type` 实现这个功能，要理解 `delegated_type`，先理解一些相关的知识或许更有帮助。

## 1. 多态关联 (Polymorphic Associations)

**Polymorphic** 这个词源自希腊语，就字面意思而言，**Poly = many**，**morph = form**，多态就是“许多形式的存在”。对应到编程中，就是“为不同的底层形式 (数据类型) 呈现相同接口的能力”。它的主要好处是**使我们可以以统一的 (多态) 方式引用实体，而无论所谓的实体在幕后存在多少不同的形式**。

要实际理解这一点，需要看看我们面临的问题，以及多态是如何解决的。

### 1.1 存在的问题

假设我们有 Post、Video 两个表，都可以被*评论 (Comment)*，当我们为 Comment 建立模型的时候，它可能是这样：

```ruby
class Comment < ApplicationRecord
  belongs_to :post
  belongs_to :video
end
```

这段代码意味着：

- `comments` 表存在两个外键列： `post_id`、`video_id`
- 这两个外键列不可能同时存在，必然是一列为空、另一列不能为空

想想看，这种情况带来的问题：

- 难以扩展：假设我们新增一个 Picture 表也可以被评论，那么就需要增加一个 `picture_id` 列，如果还有更多新增 ...
- 这会使我们的验证步骤变得无比复杂，因为必然是“只有一列外键可以存在，其他外键列都必须为空”
- 还可能会进一步引起数据的完整性问题

### 1.2 多态如何解决这个问题

假设我们这样设计 `comments` 表：添加两个固定的列 `commentable_id` 和 `commentable_type`，id 列用来保存**被评论的相关存在的数据库 id**，type 列用来保存**被评论的相关存在的类型**。通过这样的设计，无论有多少东西需要被 Comment，`comments` 表都是可扩展的：

- 第一篇文章的评论：`commentable_id = 1, commentable_type = Post`
- 第一个视频的评论：`commentable_id = 1, commentable_type = Video`
- 第五张图片的评论：`commentable_id = 5, commentable_type = Picture`
- ...

id 和 type 列是缺一不可的，只有这两个列一起作用才能“唯一”确定一个引用关系：当 Rails 执行 `Comment.find(n).commentable` 时，它首先从 `comments` 表中读取读取第 n 行的记录，利用这个记录的 `commentable_type` 值确定关联模型的类型 (如 'Post')，然后使用 `commentable_id` 的值去查找关联模型中对应的记录。**这种机制使得我们可以用统一的接口访问不同类型的关联记录**。

在 Rails 中，我们只需要一个选项就可以使得模型是多态的：

```ruby
class Comment < ApplicationRecord
  belongs_to :commentable, polymorphic: true
end
```

这里我们的 Comment “属于一个 commentable”，什么是 commentable？**什么都可以是 commentable，只要它声明自己是就行了**。而 `polymorphic: true` 会使 Rails 自动推断出 Comment 存在两个外键列，列名是 `belongs_to` 后面声明的名字分别加上 `_id`、`_type`，即 `commentable_id`、`commentable_type`。

当 Picture (或 Post 等) 需要评论功能时，它用 `:as` “声明自己是 commentable”，`:as` 选项指定了多态关联的名称，它告诉 Rails 把 `comments` 表中的 `commentable_id` 和 `commentable_type` 字段与当前模型关联起来，这使我们可以用 `has_many :comments, as: :commentable` 在不同的模型定义中与 `comments` 表关联，从而实现多态关联：

```ruby
class Picture < ApplicationRecord
  has_many :comments, as: :commentable
end

class Post < ApplicationRecord
  has_many :comments, as: :commentable
end
```

除此之外，要在数据库中确实存在这两个外键列，可以使用 Rails 生成器：

```ruby
bin/rails generate model product supplier:references{polymorphic}
```

要在数据库迁移中手动添加，可以使用：

```ruby
create_table :comments do |t|
  # ...
  t.references :commentable, polymorphic: true, foreign_key: true
  t.timestamps
end
```

迁移文件中的 `polymorphic: true` 会使得数据库自动创建 `_id`、`_type` 列。

> StackOverflow - [https://stackoverflow.com/questions/1031273/what-is-polymorphism-what-is-it-for-and-how-is-it-used](https://stackoverflow.com/questions/1031273/what-is-polymorphism-what-is-it-for-and-how-is-it-used)
> 
> Polymorphic Associations in Rails: Why, What, and How - [https://www.writesoftwarewell.com/rails-polymorphic-associations-why-what-how/](https://www.writesoftwarewell.com/rails-polymorphic-associations-why-what-how/)
> 
> 从前我一直不理解 `:as`，以为是别名之类的东西，仔细思考一下 API 文档中关于 `:as` 的解释，它就是指定了多态的接口： *Specifies a polymorphic interface* - [https://api.rubyonrails.org/classes/ActiveRecord/Associations/ClassMethods.html#method-i-has_one](https://api.rubyonrails.org/classes/ActiveRecord/Associations/ClassMethods.html#method-i-has_one)

## 2. 单表继承 (Single Table Inheritance, STI)

其实可以完全跳过**单表继承** (STI)，但基本上你看到 `delegated_type` 的相关文章都会先讲一番单表继承，因为 `delegated_type` 是对 STI 的改进。你当然可以只了解什么是更好的就行了，但你不会甘心别人都知道，偏你不知道。

STI 是 Rails 中的一种模式，这种模式是把多个模型存到一张数据库表中，之所以这样做是因为这些模型**有共同的属性和行为，也有特定的行为**。以猫为例，假设我们有**猫 (Cat)**、**缅因猫 (Maine Coon Cat)**、**波斯猫 (Persian Cat)**，很显然，这三个模型的特点很显然：

- 它们都是猫，拥有猫的共性，可能 99% 的特点都一样
- 缅因猫和波斯猫都是猫的一种

我们的数据库表可以这样设计：

```ruby
bin/rails g model Cat type:string color:string shape:string
```

这里别的字段不重要，但 `type` 是 STI 要求**必须有的字段**，Rails 用这个字段来存储模型的名称以区分不同的模型 (比如本例中 `type` 列存储的可能是 `MainCoonCat` 或 `PersianCat`)，**它决定了 Rails 如何将数据库记录实例化为正确的模型类**。

我们可以建立下面这种形式的模型：

```ruby
# cat.rb
class Cat < ApplicationRecord
end

# maine_coon_cat.rb
class MaineCoonCat < Cat
  def special_character
    "I'm special"
  end
end

# persian_cat.rb
class PersianCat < Cat
end
```

如此这般，MainCoonCat 和 PersianCat 都继承了 Cat 模型的 `color` 和 `shape` 属性，如果它们还有别的共同的行为，那就在 Cat 中为这个行为定义方法。反之，也可以在它们各自的模型里定义自己特有的行为，比如 MainCoonCat 的 `special_character` 就是 PersianCat 不具备的。

如果波斯猫有缅因猫所没有的某些属性，我们当然可以扩展数据库表，添加一列来存储波斯猫的属性，缅因猫的这列值为空。

基本上这就是单表继承的概念。

## 3. 类型委托 (Delegated Types)

### 3.1 理念

了解了 STI，就很容易看出它的局限性：**它只在子模型之间相似性很高的情况下才能发挥最大作用**。它的缺点很多：

- 数据库表可能会越来越大，影响查询性能
- 查询特定子模型的数据需要根据 `type` 列过滤，这可能降低查询效率
- 修改父模型会影响所有的子模型，增加了维护的复杂性
- 子模型差异越大，数据库冗余字段可能会越多，STI 就越不适合
- ...

Rails 6.1 推出了 `delegated_type` 来解决这个问题，它的理念并不复杂：

- 像 STI 一样，它有一张表来存储所有模型的共同属性
- **但每个子模型也都有一张表来存储自己独有的属性**

这样就不需要在一张表中定义所有子模型之间共享的属性 (因为有些属性对于其他子模型是毫无意义的)。Writebook 中 Leaf 模型被委托给了其他三个模型，可以看到它们的数据库字段分别是：

```ruby
writebook(dev)> Page.column_names
=> ["id", "created_at", "updated_at"]

writebook(dev)> Section.column_names
=> ["id", "created_at", "updated_at", "theme", "body"]

writebook(dev)> Picture.column_names
=> ["id", "created_at", "updated_at", "caption"]

writebook(dev)> Leaf.column_names
=> ["id", "book_id", "leafable_type", "leafable_id", "position_score", "status", "created_at", "updated_at", "title"]
```

Page、Section、Picture 三个模型共享 Leaf 中的属性，同时也都有自己的私有属性。`leafable_type`、`leafable_id` 这两个列很难不让人想到多态。

> 如果这是你第一次了解 `delegated_type`，大概也会有一种“这个方案真的不错！”的感慨。

### 3.2 了解一点 Concern

类型委托需要使用 `ActiveSupport::Concern`，是因为类型委托存在“共同”的属性或方法，在编程中只有提取出“共性”才能减少重复，只有减少重复才能增加可维护性。所以要理解类型委托，还需要了解点 **Concern**。

> **这个世界每天都有很多新的概念产生，面对这些层出不穷的新概念，最重要的不是如何追赶它，而是如何抓住其本质**。我一直觉得太阳底下无新鲜事，人类也没有那么多的新可创，所谓的新概念，无非是旧瓶装新酒。
>
> `ActiveSupport::Concern` 也无非是一个模块，一个提取了一些通用方法或逻辑以供其他模块或类使用的模块。

在 Ruby 中，有 `include` 和 `extend` 这两个关键字，一般来说：

- `include` 扩展**实例方法**，即如果一个类 `include A`，那么模块 A 中定义的实例方法都可以被这个类的实例使用
- `extend` 扩展**类方法**，即如果一个类 `extend A`，那么模块 A 中定义的类方法都可以被这个类使用

但如果想要一个类既使用模块 A 的实例方法又使用它的类方法，只能同时 `include A` 且 `extend A`。

`ActiveSupport::Concern` 简化了这个问题：通过 Concern 我们可以只使用 `include` 就既包含模块的实例方法又包含其类方法，而且**无需打开类** (避免直接修改类的定义，减少了代码冲突和维护难度)。

看一下 Writebook 的 `leafable.rb` 代码：

```ruby
module Leafable
  extend ActiveSupport::Concern

  TYPES = %w[ Page Section Picture ]

  included do
    has_one :leaf, as: :leafable, inverse_of: :leafable, touch: true
    has_one :book, through: :leaf

    delegate :title, to: :leaf
  end

  def searchable_content
    nil
  end

  class_methods do
    def leafable_name
      @leafable_name ||= ActiveModel::Name.new(self).singular.inquiry
    end
  end

  def leafable_name
    self.class.leafable_name
  end
end
```

Leafable 模块 `extend ActiveSupport::Concern` 之后，就可以使用 `included` 创建实例方法，使用 `class_methods` 创建类方法；之后，所有 `include Leafable` 的类都包含这些实例方法和类方法。

如果不需要考虑那么复杂，那么这就是 Concern。

### 3.3 Writebook 中的 `delegated_type`

理解了类型委托的思想和 Concern 这个工具，`delegated_type` 的用法就水到渠成了，还是看代码吧：

```ruby
# leaf.rb
class Leaf < ApplicationRecord
  include Editable, Positionable, Searchable

  belongs_to :book, touch: true
  delegated_type :leafable, types: Leafable::TYPES, dependent: :destroy

  delegate :searchable_content, to: :leafable

  # ...
end

# leafable.rb 代码见 3.2 小节

# picture.rb
class Picture < ApplicationRecord
  include Leafable

  # ...
end

# section.rb
class Section < ApplicationRecord
  include Leafable

  def searchable_content
    body
  end
end

# page.rb
class Page < ApplicationRecord
  include Leafable
end
```

此时此刻，很多概念和前面的都已经很相似了：

- `leaf.rb`
  - `delegated_type :leafable, types: Leafable::TYPES, dependent: :destroy` 指定了一个多态关联 (甚至也可以认为定义了一个接口名 `:leafable`)
  - Rails 根据这个关联利用 leaves 表中的 `leafable_type`，`leafable_id` 两个字段
  - 但和多态不同的是，并非谁都可以关联 Leaf，只有 `types:` 参数里的模型才可以关联
  - `dependent: :destroy` 确保当 Leaf 被删除时，关联的 leafable 记录也会被删除，这对于维护数据一致性至关重要，防止出现孤儿记录
- `page.rb`
  - `include Leafable` 把 `leafable.rb` 模块中的方法和属性都包含到 Page 模型中
  - 所以 Page 模型中就有这样一个方法：`has_one :leaf, as: :leafable, inverse_of: :leafable, touch: true`
  - 这里的 `as:` 指定了多态的接口
  - `inverse_of:` 指定了反向关联关系，虽然 Rails 可以推断出来反向关系，但显式声明确实使得代码更明确，提高了关联效率，避免潜在的无限循环问题
  - `touch: true` 表示当 Page (leafable) 模型更新时，关联的 Leaf 模型的 `updated_at` 字段会被更新

如果这里甚至还有点不好理解，如果你已经理解了多态关联，把 `delegated_type :xxx, types: [xx]` 想象成 `belongs_to :xxx, polymorphic: true` 似乎就豁然开朗了。

而这里如果不使用 Concern，基本上就需要把 `leafable.rb` 中的代码复制三份分别到 Page、Section、Picture 模型里。

除此之外，`leaf.rb` 还通过 `delegate :searchable_content, to: :leafable` 把 `:searchable_content` 方法进一步委托给其子类，在 Leaf 实例上调用 `:searchable_content` 方法时，会调用子类中的同名方法，子类中的同名方法都是在 `leafable.rb` 实现的，只有 Section 用自己的 `:searchable_content` 覆盖了从 `leafable.rb` 中得到的方法。 

## 4. 总结

多态关联是一种关联关系：

- 在被关联对象上使用 `belongs_to :xx, polymorphic: true` 声明自己是一个多态关联
- 在关联对象上使用 `has_one :xxx, as: xx` 声明自己通过 xx 接口关联了一个对象 (也可以使用 `has_many`)
- 在数据库表上**默认**使用被关联对象的 `xx_id`、`xx_type` 列

单表继承是一种模式：

- 子类继承父类的所有属性和方法，同时也可以有自己的方法
- 所有子类都在一张数据库表上，通过 `type` 字段区分

类型委托是利用了多态关联的改良版的单表继承，它和单纯的多态关联的区别在于，它限制了可以关联的类型，并为每个类型创建单独的表来存储其特定属性，这避免了 STI 中单表过大导致的性能问题和数据冗余问题，更像是一种**受限的多态关联**：

- 使用 `delegated_type :xx, types: []` 声明类型委托和允许的类型 (Rails 文档把这个叫超类，把其它类型叫子类)
- 一般在子类上使用 `has_one :xx, as: xx, inverse_of: xx, touch: true` 声明和超类的关系
- 数据库表默认使用超类的 `xx_id`、`xx_type` 列

> API: [https://api.rubyonrails.org/classes/ActiveRecord/DelegatedType.html](https://api.rubyonrails.org/classes/ActiveRecord/DelegatedType.html)
>
> Rails Guides 也是用的这种介绍顺序，不过更详细点： [https://guides.rubyonrails.org/association_basics.html](https://guides.rubyonrails.org/association_basics.html)