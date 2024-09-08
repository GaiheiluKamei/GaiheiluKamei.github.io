---
title: Rails 日常错误收集
publishedAt: '2024-09-08'
---

Rails 是一个令人愉快的框架，尤其是没有遇到过什么错误或挑战的时候。但当棘手的问题扑面而来而不知所措时，实在令人难堪。本文旨在收集整理自己日常遇到的错误、解决过程和相关参考，便于以后查阅。

## PostgreSQL 数据库版本不一致导致错误 (2024/09/08)

今天在尝试一个 Rails 代码时，我本地的环境和其 Gemfile 中的版本分别如下：

- 我：Ruby-3.3.4，Rails-7.2.1
- 他：Ruby-3.1.2，Rails-7.1.1

直接运行 `bin/rails s` 报错 `Your Ruby version is 3.3.4, but your Gemfile specified 3.1.2`，考虑到版本差别不大，我直接修改了 `.ruby-version` 和 Gemfile 中的 Ruby 版本为 3.3.4，然后运行 `bundle` 命令安装相关依赖。

之后运行 `bin/rails db:create` 命令，报错如下：

```text
connection to server on socket "/run/postgresql/.s.PGSQL.5432" failed: FATAL:  role "o" does not exist
Couldn't create 'wiki_app_development' database. Please check your configuration.
```

这个错误表示 Rails 默认使用了我电脑的用户名连接数据库，于是我在 `config/database.yml` 中的 `default` 键下添加数据库配置：

```yml
default: &default
  username: postgres
  password: postgres
  # ...
```

再次运行 `bin/rails db:create` 命令，产生新的报错如下：

```
WARNING:  database "postgres" has a collation version mismatch
DETAIL:  The database was created using collation version 2.39, but the operating system provides version 2.40.
HINT:  Rebuild all objects in this database that use the default collation and run ALTER DATABASE postgres REFRESH COLLATION VERSION, or build PostgreSQL with the right library version.
PG::InternalError: ERROR:  template database "template1" has a collation version mismatch
```

根据这段错误的 **HINT** 的提示，在命令行中运行 `psql -U postgres` 连接到数据库，运行 `ALTER DATABASE postgres REFRESH COLLATION VERSION;` 命令，然后通过 `exit` 退出数据库连接，再次尝试 `bin/rails db:create` 命令，产生报错：

```
PG::InternalError: ERROR:  template database "template1" has a collation version mismatch
DETAIL:  The template database was created using collation version 2.39, but the operating system provides version 2.40.
HINT:  Rebuild all objects in the template database that use the default collation and run ALTER DATABASE template1 REFRESH COLLATION VERSION, or build PostgreSQL with the right library version.
Couldn't create 'wiki_app_development' database. Please check your configuration.
bin/rails aborted!
```

依然是根据 **HINT** 提示，在命令行中运行 `psql -U postgres` 连接到数据库，运行 `ALTER DATABASE template1 REFRESH COLLATION VERSION;` 命令 (数据库输出 *NOTICE:  changing version from 2.39 to 2.40*)，退出数据库连接，再次运行 `bin/rails db:create` 命令成功。

之后顺利运行 `bin/rails db:migrate && bin/rails server`。

> 详细解释可以参考： [Collation version mismatch](https://dba.stackexchange.com/questions/324649/collation-version-mismatch)