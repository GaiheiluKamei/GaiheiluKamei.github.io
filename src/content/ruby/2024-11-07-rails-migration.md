---
title: Rails Migration - 了解一点数据库迁移的知识
publishedAt: 2024-11-07
---

> 我第一次接触数据库迁移的概念是通过 Golang 的 [migrate](https://github.com/golang-migrate/migrate)，还记得当时被那些开源库作者们的奇思妙想所折服的瞬间，羡慕他们聪明伶俐的脑袋里蕴含着无尽的解决方案，仅仅一个数据库迁移问题就解决的这么毫无破绽。
>
> 直到我开始接触 Rails。
>
> 才知道什么叫 “简陋”，什么叫 “一山更比一山高”（我意不在批判 Go 或 migrate，但应当承认的是：正如 Ruby 永远不会在性能上超过 Go 一样，Go 在代码的优雅性上也永远难望 Ruby 之项背）。

在日常开发中，最常见的问题之一就是对数据库的修改： 今天有个需求要添加一个字段，明天可能要更改一个数据类型，后天也许要加个索引 ... 而实际生产中一张表可能有几十上百个字段，要在很多开发人员之间 “对齐” 这张表，显然不能靠口口相传。

**数据库迁移** (*Migration*) 就是为了解决了这样一个问题： 它通过命令的方式自动化我们对数据库的修改，保存修改历史，使得仅需一行命令就能保持开发人员之间数据库结构的同步。

## 1. Rails Migration 基础

Rails Migration 的大体情况如下：

1. 在开发中我们使用命令生成迁移文件，文件被统一保存在 `db/migrate` 目录
2. 文件名以创建时的 UTC 时间戳和下划线开头，如 `20240529094628_xxx.rb`
3. 然后我们大概率会根据需要，手动修改生成的迁移文件
4. 之后运行 `rails db:migrate` 命令，指示数据库运行我们的迁移

> “迁移”、“迁移文件” 可能听起来有些陌生，其实就是： 我们想要修改数据库，但是不想直接手写 SQL，于是用 Rails 命令生成一些代码，当我们运行这些代码时，这些代码被转化为 SQL 语句在数据库中运行，完成我们在数据库中创建表、修改字段等的需求。

### 1.1 生成迁移文件的命令

Rails 中把生成文件的命令叫**生成器 (generator)**。有两个可以创建迁移文件的生成器： `model` 和 `migration`，分别如下：

```bash
# model 生成器可以使用 `--skip-migration` 选项跳过生成迁移
rails generate model event name:string:uniq locaiton:string price:decimal

rails g migration AddFieldsToEvents starts_at:datetime description:text
```

> 在 Rails 项目内运行 `rails g model -h` 命令可以查看 `model` 生成器的使用说明和细节。

上面的例子存在以下几点细节：

- `generate` 命令可以缩写为 `g`
- `model` 生成器即生成 MVC 模型中的“M"，Rails 根据后面的 `event` 名字决定并生成三样东西：
  - model 文件 `app/models/event.rb` (小写字母，可能带下划线)
  - model 文件中的类名 `class Event < ApplicationRecord` (首字母大写)
  - 数据库表的名字 `events` (复数)








































































还想说一句，以前的我总是陷于内耗，学习路上的一点坎坷和波折总是让我怀疑自己 “为什么这个我不知道，那个也没学过？为什么他们仿佛什么都会？我怎么这么差？” 直到后来我终于注意到了 [Rails](https://rubyonrails.org/) 官网首页的那句话： *Learn just what you need to get started, then keep leveling up as you go*。学习不必急于求成，也不必急于求全，我们不可能靠一篇文章甚至一本书就可以获得工作中需要的所有知识，所以从这里或那里学习一点点新知识，往前走一小步，就挺好。