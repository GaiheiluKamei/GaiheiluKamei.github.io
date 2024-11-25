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

事实上它更多的是一个内部的实现细节，而不是面向用户的。Book 只知道自己是由很多 Leaf 组成的，它不需要关心每一个、每一种 Leaf；而 Leaf 相当于提供了一个对外“暴露”的接口，凡是满足“某种约定”的模型都可以作为 Leaf，具体到代码里：

- Page 有 `ActionText::Markdown` 内容
- Section 有纯文本组成的 body
- Picture 有一个 image 附件和 caption 属性

但**它们都是 Leaf**。Writebook 通过 `delegated_type` 实现这个功能，要理解 `delegated_type`，最好一并理解一些相关的话题。

## 1. 多态关联 (Polymorphic Associations)

## 2. 单表继承 (Single Table Inheritance, STI)

## 3. 类型委托 (Delegated Types)

## 4. 总结