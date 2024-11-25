---
title: 没有人不需要了解如此全面的 SQLite 知识
publishedAt: 2024-11-25
---

SQLite 是最常用的数据库没有之一。它不是和 PostgreSQL、MySQL 一样的 CS 架构，而只是一个设计成附加到应用程序上的库，即只是在本地创建一个数据库文件，所以它**不需要网络访问**，也不处理端口、连接等问题，因此速度极快，查询只需要微秒而非毫秒。

最近，随着 Web 开发回归简单性的风头渐起，越来越多的文章和实践证明了在 SQLite 上构建大型生产应用程序是非常可行的。

本文旨在总结 SQLite 的基础知识、特殊性、以及生产环境的备份问题。

> GitHub 上有一个仓库 *chinook-database* 包含了设计完整的数据集，可以用作 SQLite 或其他数据库查询的练习。
>
> [https://github.com/lerocha/chinook-database/](https://github.com/lerocha/chinook-database/releases/download/v1.4.5/Chinook_Sqlite.sqlite)

## 1. SQLite 命令

安装完 SQLite 之后，在终端 (Linux 或 macOS) 运行 `sqlite3` 命令会启动一个在内存中的数据库；要运行已有的数据库 (以上面下载的练习数据库为例)，可以执行： `sqlite3 Chinook_Sqlite.sqlite`。

SQLite 自身的命令都采用 `.` 开头，被称为 *dot commands*，连接数据库之后可以运行以下几个命令一番体验：

```bash
.help

.tables

.schema <table_name> # 查看表信息

.mode box # 用表格的方式显示查询结果，只对当前连接有效

.read ./Chinook_Sqlite.sql

.shell clear

.exit
```

## 2. 基础

每个关系数据库的绝大多数语法都符合 SQL 标准，所以至少 95% 的语法都是通用的，SQLite 也不例外。也许这里的例子甚至有点乏味，但值得注意的细节都在注释里：

### 2.1 SELECT

```sql
-- 1. 不区分大小写
SeLeCt aRtIsTiD FrOm aRtIsT;

-- 2. SQL 中 (不仅 SQLite) 的双引号指的是列名，所以引用字符串值须用单引号
-- 下面两个都是有效的查询
SELECT artistID FROM artist WHERE name = 'The Postal Service';
SELECT artistID FROM artist WHERE "name" = 'The Postal Service';

-- 下面这个则报错 Parse error: no such column: "The Postal Service"
SELECT artistID FROM artist WHERE name = "The Postal Service";

-- 3. SQLite 只有 LIKE，没有 ILIKE; LIKE 不区分大小写
SELECT artistid FROM artist WHERE name LIKE '%PostAL ServiCE%';

-- 4. LIMIT 和 OFFSET 也没什么特别的
SELECT * FROM artist LIMIT 5 OFFSET 10;

-- 5. ORDER BY 也是一样的默认升序
SELECT * FROM artist ORDER BY name DESC LIMIT 5;
```

> `OFFSET` 的效率通常较低，尤其是在大型数据集上，数据库需要先扫描并计数前 N 行，然后再返回后续的行。这会导致性能问题，特别是当 N 很大时。
>
> 在分页场景中，更推荐使用基于主键或唯一索引的范围查询，而不是 `OFFSET`。例如，记住上次查询的最后一条记录的 ID，然后使用 `WHERE id > last_id LIMIT 10` 来获取下一页的数据，这比使用 `OFFSET` 高效的多。

### 2.2 INSERT，UPDATE，DELETE

```sql
-- 1. INSERT、UPDATE 和 DELETE 都可以使用 RETURNING 返回指定列
INSERT INTO artist (name) VALUES ('Jack') RETURNING artistID;

UPDATE artist SET name = 'Tom' WHERE name = 'The Postal Service' RETURNING *;

DELETE FROM artist WHERE name = 'Tom' RETURNING artistID;
```

### 2.3 数据类型和表的管理

SQLite 实际上只有 4 种数据类型：

- Integer：整数
- Real：浮点数
- Text：字符串
- Blob：二进制，如图片、视频等
- (Null 表示空值)

但在实践中，它的数据类型非常灵活，比如：

- 可以把字符串存储到 Integer 列
- `varchar(255)` 即使存储更多的字符也没关系，因为在底层实际存储的是 TEXT 类型
- 没有时间类型，可以存储为 Unix 时间戳

这样做的好处是它可以接受其他数据库编写的大多数 SQL 查询。虽然 SQLite 在 2021 年添加了 *Strict table* 功能，但核心团队并不觉得它很重要，下面的链接详细阐述了 SQLite 作者认为灵活类型的好处以及严格类型的非必要性。

> - [https://www.sqlite.org/datatype3.html](https://www.sqlite.org/datatype3.html)
> - [https://www.sqlite.org/stricttables.html](https://www.sqlite.org/stricttables.html)
> - 灵活类型的好处：[https://www.sqlite.org/flextypegood.html](https://www.sqlite.org/flextypegood.html)

```sql
-- 1. 创建表
CREATE TABLE BandMember (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    role TEXT VARCHAR
)

-- 2. SQLite 不允许在一条语句中多次修改表，这种情况需要使用多个 ALTER TABLE 命令
ALTER TABLE BandMember ADD COLUMN nationality TEXT NOT NULL DEFAULT 'UK';

-- 3. 删除表
DROP TABLE BandMember;
```

### 2.4 JOIN

`JOIN` 操作和其他数据库一样，可以使用别名、可以连接多个表、可以在任何一个连接的表上应用 `WHERE` 过滤。

只要表之间有关系，就可以一直 `JOIN`。

```sql
SELECT
    Artist.Name, Album.Title, Track.Name, Genre.Name
FROM
    Album
JOIN
    Artist ON
        Album.ArtistId = Artist.ArtistId
JOIN
    Track ON
        Track.AlbumId = Album.AlbumId
JOIN
    Genre ON
        Track.GenreId = Genre.GenreId
WHERE
    Artist.Name = 'Foo Fighters';
```

> 一般所说的 `JOIN` 是指 `INNER JOIN`，结果是两个表的交集。
>
> 左右连接中的 *left* 指的是 `FROM` 的表； *right* 指的是 `JOIN` 的表。
>
> `NATURAL JOIN` 是指“使用两个表中具有相同名称的列来连接这两个表”，这种隐式连接比较脆弱，应该极少被使用。

### 2.5 外键

SQLite 支持外键，但出于历史兼容性的原因，**默认情况下外键功能没有开启，只能在每次连接数据库时显式打开，且不能通过配置或其他方式保持永远打开**。

连接 SQLite 之后，使用 `PRAGMA foreign_keys=on;` 打开外键。

SQLite 的外键约束功能为下列之一：

- `NO ACTION`
- `RESTRICT`
  - 有多个子键映射到父键时，禁止修改或删除父键
- `SET NULL`
- `SET DEFAULT`
- `CASCADE`

```sql
CREATE TABLE parent_table (
    id INTEGER PRIMARY KEY
);

CREATE TABLE child_table (
    id INTEGER PRIMARY KEY,
    parent_id INTEGER,
    FOREIGN KEY (parent_id) REFERENCES parent_table(id) ON DELETE CASCADE
)
```

> 官方文档有详细的关于复合外键、延迟约束等主题的介绍，可以参考：[https://www.sqlite.org/foreignkeys.html](https://www.sqlite.org/foreignkeys.html)。

### 2.6 聚合函数

```sql
-- 1. SQLite 的聚合函数没什么特别的
SELECT COUNT(DISTINCT genreID) FROM track;

-- 2. 如果想用 GROUP BY 进行分组查询，那么作为“一组”的列要放在 GROUP BY 之后
SELECT
  Track.GenreId, Genre.Name, COUNT(Track.GenreId)
FROM
  Track
JOIN
    Genre
ON
    Genre.GenreId = Track.GenreId
GROUP BY
  Track.GenreId;

-- 3. 聚合函数的执行发生在 WHERE 语句之后，所以要在聚合函数的结果上过滤，只能使用 HAVING
SELECT
  Track.GenreId, Genre.Name, COUNT(Track.GenreId) AS TrackCount
FROM
  Track
JOIN
  Genre
ON
  Genre.GenreId = Track.GenreId
GROUP BY
  Track.GenreId
HAVING
  TrackCount > 300;
```

### 2.7 子查询 (SUBQUERY)

子查询其实就是把一个查询语句用括号括起来作为其他查询的源，一定程度上可以和 `JOIN` 互换使用，但性能优劣还需要具体问题具体分析。

```sql
-- 子查询
SELECT
  *
FROM
  Invoice
WHERE
  CustomerId = (
    SELECT CustomerId FROM Customer WHERE Email = 'hholy@gmail.com'
  );

-- 等价的 JOIN
SELECT
  *
FROM
  Invoice i
JOIN
  Customer c
ON
  c.CustomerId = i.CustomerId
WHERE
  c.Email = 'hholy@gmail.com';
```

## 3. 有点高级的知识

### 3.1 上限

SQLite 在很多方面的上限都很高，基本上都是我们永远不会触及的天花板：

- Text 类型的最大长度是 1GB
- 一张表最多可以有 2000 列，如果自己编译 SQLite 源码解除限制，最多可以有 32,767 列
- SQL 查询的最大长度是 1,000,000,000 个字符
- 最多可以 `JOIN` 64 张表
- `LIKE` 最多可以使用 50,000 个字符
- 最大 **ATTACH** 数据库数量是 10 个
  - ATTACH：如果有两个数据库文件，想像查询一个数据库那样查询它们，可以使用 ATTACH 功能
  - [https://www.sqlite.org/lang_attach.html](https://www.sqlite.org/lang_attach.html)

> 还有很多其他上限，我觉得列出来的意义不大，甚至是没有：[https://www.sqlite.org/limits.html](https://www.sqlite.org/limits.html)。
>
> 这里的重点是 **SQLite 强大到足以解决任何问题**。

### 3.2 视图 (VIEW)

我发现不同的学科都有自己五花八门的专有名词令初学者虎躯一震、望而生畏，但一旦把它“类比”成已知的东西，就会发现也不过尔尔。第一次见到数据库“视图”这个词的时候，觉得很新鲜，甚至有点高端。用数据库的话来说，“视图是一个利用其他表中的数据的虚拟表”，但其实就相当于“把一个长的字符串赋值给一个变量，每次访问这个变量都是在访问这个字符串”。

SQLite 的视图功能不像其他数据库那样功能丰富，因为它的理念是“轻量级、嵌入式、自包含”。比如 SQLite 不像 PostgreSQL 那样支持**物化视图** (即一个预先计算并存储查询结果的特殊类型的视图，可以避免重复计算，显著提高查询速度)，因为物化视图要求额外的存储空间，且需要机制来管理物化视图的刷新和一致性，这增加了数据库的复杂性，不符合 SQLite 的设计理念。

但 SQLite 的视图功能对于简单的查询场景已经足够且有余。

```sql
-- 1. 创建一个视图: `CREATE VIEW <view_name> AS <查询语句>`
CREATE VIEW
  easy_tracks
AS

SELECT
  t.TrackId as id,
  ar.Name as artist,
  al.Title as album,
  t.Name as track
FROM
  Track t

JOIN
  Album al
ON
  t.AlbumId = al.AlbumId

JOIN
  Artist ar
ON
  ar.ArtistId = al.ArtistId;

-- 2. 使用视图 (调用)
SELECT * FROM easy_tracks LIMIT 10;
```

> 因为 SQLite 视图不存储数据，所以也不支持插入数据。

### 3.3 性能分析 (EXPLAIN)

一般来说，即使在大型数据集上，SQLite 也非常快。但有时候你可能想做一些性能分析来查看一下查询是否可以更快：

```sql
-- 1. EXPLAIN：这个输出的结果我看不懂 
EXPLAIN SELECT * FROM Track Where name ='Black Dog';

-- 2. EXPLAIN QUERY PLAN：用这个
-- 比如，`scan` 表示在进行全表扫描； `index` 表示用了索引
EXPLAIN QUERY PLAN SELECT * FROM Track Where name ='Black Dog';

-- 3. 在 CLI 中，还可以使用 `.eqp on` 命令开启本次连接内所有的查询都会显示查询计划
.eqp on
SELECT * FROM Track Where name ='Black Dog';
```

### 3.4 索引 (INDEX)

如果分析出来查询需要优化，那么大概率要加索引。索引创建了 B 树 (平衡树)，使查找速度从 **O(n)** 降低到 **O(logn)**。

> 创建索引需要额外的存储且创建过程会影响 CRUD 的速度，所以只有在真正出现问题时再添加索引，而不是一开始就试图解决所有问题。
> 
> “索引就像阿司匹林，当你遇到问题时它们很有帮助，但如果用的太多，它们就会成为问题本身”。

```sql
-- 创建索引
CREATE INDEX idx_track_name ON track ('name');

-- 在 SQLite CLI 中查看 'Track' 表的索引
PRAGMA index_list('Track');
```

### 3.5 全文搜索 (Full Text Search - FTS)

假设我们的某几个列都包含类似的数据，要聚合这几个列的搜索结果，一种方法是使用多个 `LIKE` 查询；另一种方法就是使用 FTS。

FTS 是 SQLite 的扩展功能，但被包含在安装包中，所以无需额外安装。它**允许我们对数据库中的文本数据进行高效的全文搜索，而无需编写复杂的 `LIKE` 查询或使用外部搜索引擎**。目前共有 FTS3、FTS4、FTS5 三个版本，当然 FTS5 是最强的。

FTS 模块的原理是：

1. **创建虚拟表**：使用 `CREATE VIRTUAL TABLE` 创建一个 FTS 虚拟表，这个虚拟表并不实际存储数据，而是作为全文索引的接口，在这里指定哪些列需要进行全文索引。
2. **填充数据**：可以使用标准的 `INSERT` 语句将数据插入 FTS 虚拟表中，FTS 模块会自动将这些数据进行索引。
3. **执行搜索**：使用 `MATCH` 运算符或 `=` (FTS5) 来执行全文搜索。

FTS 的优势在于更快的速度和更小的内存占用、更丰富的查询语法、自定义词法分析器等，以及提供了很多的辅助函数，如：

- `bm25()` 计算匹配度
- `snippet()` 提取包含关键词的文本片段
- `highlight()` 对匹配的关键词进行高亮显示

```sql
-- 1. 创建虚拟表 (使用上文的 `easy_tracks` 视图)
CREATE VIRTUAL TABLE track_search USING FTS5(
    content="easy_tracks",
    content_rowid="id",
    track,
    album,
    artist
);

-- 2. 插入数据 (创建表不会自动填充数据)
INSERT INTO track_search SELECT album, artist, track FROM easy_tracks;

-- 3. 执行查询
SELECT * FROM track_search WHERE track_search MATCH 'black';
SELECT * FROM track_search WHERE track_search = 'white';
SELECT * FROM track_search('red');
SELECT bm25(track_search), * FROM track_search WHERE track_search MATCH
'black' ORDER BY bm25(track_search);
```

> - `content` 表示数据源
> - `content_rowid` 指定 `easy_tracks` 中作为 rowid 的列是 id；FTS5 需要一个唯一的 rowid 来关联索引和原始数据
> - `track，album，artist` 这些列名指定 `easy_tracks` 表中哪些列的内容将被索引用于全文搜索。这意味着搜索时，FTS5 会在这三列中查找匹配的关键词
>
> 虚拟表不会自动同步数据，理论上，我们可以创建一个 cron job 来不断更新虚拟表，也可以使用触发器，查看 [https://stackoverflow.com/questions/69980854/sqlite-fts5-match-is-returning-nothing/69981377#69981377](https://stackoverflow.com/questions/69980854/sqlite-fts5-match-is-returning-nothing/69981377#69981377)
>
> FTS5 文档：[https://www.sqlite.org/fts5.html](https://www.sqlite.org/fts5.html)

### 3.6 扩展 (EXTENSION)

SQLite 有丰富的扩展生态系统，可以填补你可能需要的其他功能的空白，其中许多是 SQLite 开发人员自己编写的。

> - 非官方 SQLite 包管理器： [https://sqlpkg.org/](https://sqlpkg.org/)
> - 扩展 Demo 参考：[https://github.com/asg017/sqlite-hello](https://github.com/asg017/sqlite-hello)
> - 使用 `.load` 语法加载扩展，注意，每次打开数据库文件都需要加载扩展，因为**它不是服务器，而是写入文件的库**。

### 3.7 JSON

JSON 从前是扩展，但现在已经内置于 SQLite 中了。一些 JSON 操作如下：

```sql
SELECT json_array(1, 2, 3);

SELECT json_array_length('{"username": "btholt", "favorites":["Daft Punk", "Radiohead"]}', '$.favorites');

SELECT json_insert('{"username": "btholt", "favorites":["Daft Punk", "Radiohead"]}', '$.city', 'Sacramento');

SELECT json_remove('{"username": "btholt", "favorites":["Daft Punk", "Radiohead"]}', '$.favorites');

SELECT json_replace('{"username": "btholt", "favorites":["Daft Punk", "Radiohead"]}', '$.username', 'holtbt');
```

> 事实上我也还没用过这些功能，所以只能把文档放这：[https://sqlite.org/json1.html](https://sqlite.org/json1.html)

JSON 有两个从 MySQL 和 PostgreSQL 复制的便利运算符，以保持语法兼容。它们使我们可以从 JSON 中提取特定值：

```sql
SELECT json('{"username": "btholt", "favorites":["Daft Punk", "Radiohead"]}') -> 'username';

SELECT json('{"username": "btholt", "name": { "first": "Brian" }, "favorites":["Daft Punk", "Radiohead"]}') -> 'name' -> 'first';

SELECT json('{"username": "btholt", "name": { "first": "Brian" }, "favorites":["Daft Punk", "Radiohead"]}') -> 'name' ->> 'first';
```

`->` 和 `->>` 的区别是：

- `->` 的返回值仍然带有双引号，被视为 JSON，方便我们进一步提取对象
- `->>` 使我们获取最终值，一般用作最后一次提取以获得实际数据

#### 3.7.1 JSONB

但实际存储上，我们一般使用 JSONB，它难以阅读，但更紧凑、更快速、更节省空间。下面是一个创建表、插入数据并查询的例子：

```sql
CREATE TABLE users (email, data);

INSERT INTO
  users
  (email, data)
VALUES
  ('brian@example.com', jsonb('{"favorites":["Daft Punk", "Radiohead"], "name": {"first": "Brian", "last": "Holt"}}')),
  ('bob@example.com', jsonb('{"favorites":["Daft Punk"], "name": {"first": "Bob", "last": "Smith"}}'));

SELECT
  data -> 'name' ->> 'first' AS first_name,
  data -> 'name' ->> 'last' AS last_name 
FROM
  users
WHERE
  json_array_length(data, '$.favorites') < 2;
```

#### 3.7.2 高级查询

下面这个查询查找最受喜爱的乐队：

```sql
SELECT
  COUNT(f.value) AS count, f.value
FROM
  users, json_each(data ->> 'favorites') f
GROUP BY
  f.value
ORDER BY
  count DESC;
```

普通的标量函数只返回一个单一的值 (例如数字、字符串等)，而这里的 `json_each()` 是**表值函数**，表值函数返回一个结果集，以“表”的形式返回结果使得 SQL 查询更加简洁和易于理解。

`json_each()` 采用 JSON 数组作为输入，并返回一个表，其中数组的每个元素占一行，每行包含元素的索引作为 *key*，值作为 *value*。所以这里使用 *users* 作为主表，提取其 *data* 列 (JSON) 的 "favorites" 的值进行分组计算。

> `json_each` 文档：[https://www.sqlite.org/json1.html#jeach](https://www.sqlite.org/json1.html#jeach)
> 
> 表值函数文档：[https://www.sqlite.org/vtab.html#tabfunc2](https://www.sqlite.org/vtab.html#tabfunc2)

下面是更新 JSON 的例子：

```sql
UPDATE
  users
SET
  data = json_insert(
    (SELECT data FROM users WHERE email ='brian@example.com'),
    '$.favorites[#]',
    'xxx'
  )
WHERE
  email ='brian@example.com';
```

JSON 类型并不存在，不是像 JavaScript 那样的对象，所谓的 JSON 只是一个字符串，所以更新 JSON 必须进行整体设置。

这里的 `#` 表示添加到数组末尾，也可以使用数字来表示索引位置。

> 上面的 `json_each()` 文档页面还包含 `json_set()` 函数，其实是更新 JSON 的首选。

## 4. 备份和副本 (BACKUP vs. REPLICATION)

SQLite 在生产中应用的一个障碍是备份问题：服务器挂了，可能数据库文件就没了。幸运的是，总有一些人替我们负重前行，一些卓越且伟大的人已经解决了这个问题。

### 4.1 Litestream

Litestream 是一款用于 SQLite 数据库的独立式灾难恢复工具。它作为后台进程运行，安全地将 SQLite 数据库的更改增量复制到另一个文件或云存储服务（例如 AWS S3、Azure Blob Storage 等）。它主要解决了 SQLite 本身缺乏内置复制和灾难恢复机制的问题。

Litestream 通过监控 SQLite 数据库的 WAL 文件来工作。它读取 WAL 文件中的更改，并将这些更改复制到一个或多个副本。它使用一种称为“影子 WAL”的技术，在复制过程中防止主数据库进行检查点操作，从而确保数据的一致性。它还定期创建快照，以提供多个恢复点。

它的功能是如此简单且专一，所以**非常适合需要简单、可靠且经济高效的 SQLite 数据库灾难恢复解决方案的场景**。

可以使用 MinIO 在本地测试一番： MinIO 是一款高性能、开源的对象存储服务器，与 Amazon S3 兼容。它旨在提供与大型云提供商（如 AWS）相同的可扩展性和性能，但可以在本地或私有云环境中运行，其实就是**在你自己的计算机上运行一个AWS S3**。

> Litestream：[https://litestream.io/](https://litestream.io/install/)
> 
> MinIO：[https://min.io/](https://min.io/)

确保已经安装了 Litestream 和 Docker。

```bash
# 0. 顺便记录一下我本机的 Manjaro 系统安装 Litestream 的步骤
sudo pacman -S go
go install github.com/benbjohnson/litestream@latest
# ~/.zshrc 末尾追加两行
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin
# 最后 source 一下
source ~/.zshrc

# 1. 运行 MinIO
docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"

# 2. 打开 `http://localhost:9001/` 登录，默认用户名和密码都是 `minioadmin`

# 3. 点击 "Create Bucket" 创建一个存储桶，注意设置为 "Public"

# 4. 在数据库目录运行以下命令即可开始备份：假设数据库文件为 data.db
export LITESTREAM_ACCESS_KEY_ID=minioadmin
export LITESTREAM_SECRET_ACCESS_KEY=minioadmin

litestream replicate data.db s3://chinook-backup.localhost:9000/data.db

# 5. 另打开一个终端窗口恢复数据
export LITESTREAM_ACCESS_KEY_ID=minioadmin
export LITESTREAM_SECRET_ACCESS_KEY=minioadmin
litestream restore -o data2.db s3://chinook-backup.localhost:9000/data.db
```

> 注意，Litestream 只是做可恢复的数据备份 (**backup**)，不是提供高可用性的业务副本 (**replication**)。
>
> 看一下 Litestream 作者的文章 - Why I Built Litestream，令人敬仰: [https://litestream.io/blog/why-i-built-litestream/](https://litestream.io/blog/why-i-built-litestream/)。

### 4.2 LiteFS

Litestream 主要是对 SQLite 备份 (backup)；而 LiteFS使 SQLite 变成“分布式”数据库，即跨多个主机可用，有主节点和副本节点 (replication)。

这个我暂时用不到，所以没有深究。

> Litestream 的作者也参与 LiteFS 的开发： [https://github.com/superfly/litefs](https://github.com/superfly/litefs)。

### 4.3 libSQL

SQLite 是开源的，但不开放贡献，即不接受除核心开发组以外的代码贡献。但有些人想在 SQLite 上添加自己渴望的功能，于是就有了 libSQL。

libSQL 更类似于 PostgreSQL 和 MySQL，因为它有 server，通过 HTTP 工作；它还添加了很多其他我没有详细了解的功能因为我目前只想专注于 SQLite 和 Litestream。

libSQL 支持本地优先的开发，即优先考虑在用户的本地设备（例如电脑、手机或平板电脑）上存储和处理数据，而不是依赖于远程服务器 (有点超前了)。

> libSQL 的宣言：[https://turso.tech/libsql-manifesto](https://turso.tech/libsql-manifesto)
>
> 本地优先的概念： [https://localfirstweb.dev/](https://localfirstweb.dev/)
>
> 另一个支持本地优先开发的，但基于 PostgreSQL 的数据库是 **Electric SQL**：[https://electric-sql.com/](https://electric-sql.com/)
