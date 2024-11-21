---
title: 37signals Writebook 源码学习(2) - routes.rb
publishedAt: 2024-11-21
---

> 只是打开 `routes.rb` 浏览了一下，我就开始怀疑自己是否还能成为一个优秀的程序员。

Writebook 符合我对理想 Rails 程序的所有假设：**尽量只使用“纯粹”的 Rails 代码，避免使用第三方 gem**，这不仅有助于保持简单和可维护性，也会减少 Rails 版本升级所引起的问题。

从 *Gemfile* 可以看出，Writebook 所使用的堆栈大致如下：

- Thruster
  - 用作 HTTP/2 代理、静态文件缓存和 TLS，作用类似 Nginx 但更轻量级。
  - GitHub 文档中有一句话：**The goal is that simply running your Puma server with Thruster should be enough to get a production-ready setup**。所以对于不大的 Rails 项目来说，Thruster 无需调整 (可能要设置 TLS) 就是生产可用的。
  - [https://github.com/basecamp/thruster](https://github.com/basecamp/thruster)
- SQLite3
- ERB
- JavaScript：propshaft，importmaps，Stimulus
- Minitest

这是不能更纯粹的 Rails。

> 本笔记基于 Writebook `1.1.0`。

## 1. routes.rb

大致浏览了 *Gemfile* 之后，我就直奔 *routes.rb*，毕竟是一切操作的入口。

### 1.1 `resource` vs `resources`

> 我第一次见到 `resource` 时以为是笔误 🥲

代码第六行定义的路由如下：

```ruby
resource :session, only: %i[ new create destroy ] do
  scope module: "sessions" do
    resources :transfers, only: %i[ show update ]
  end
end
```

这段方法所对应的路由如下：

```ruby

new_session      GET      /session/new(.:format)    sessions#new
session          DELETE   /session(.:format)        sessions#destroy
                 POST     /session(.:format)        sessions#create

session_transfer GET   /session/transfers/:id(.:format)  sessions/transfers#show
                 PATCH ...                               sessions/transfers#update
                 PUT   ...                               ...

# 如果没有 scope 方法
session_transfer GET   /session/transfers/:id(.:format)  transfers#show
                 PATCH /session/transfers/:id(.:format)  transfers#update
                 PUT   ...                               ...

```

`resource` 和 `resources` 方法都用于定义 RESTful 资源的路由，它们的主要区别是生成的**路由数量**和 **URL 结构**：

|              | resource                   | resources                    |
| ------------ | -------------------------- | ---------------------------- |
| **资源名称** | 单数 (`resource :session`) | 复数 (`resources :sessions`) |
| **路由个数** | 六个 (不含 *index*)         | 七个        |
| **URL 示例** | `/session` (show)         | `/sessions/:id` (show)         |

> Rails 通过它们的参数 (即**资源名**) 推断出 controller 和 model 名称，并最终找到对应的数据库表。

`resource` 通常用于管理**单个资源**，如用户资料、购物车等，这些资源通常只有一个实例与当前用户关联 (当前用户不需要有一个 *index* 方法来列出所有其他用户的资料)；`resources` 用于管理**多个资源**，如产品、博客文章等。然而，如果一个资源只有一个实例，但需要支持多个操作，使用 `resource` 仍然是合适的。

所以 `resource :session` 加上后面的 `:only` 约束生成了上面的前三个路由。

而 `scope` 方法的主要作用是**创建命名空间**，从而避免控制器和路由的命名冲突，尤其是在大型应用中。它通过指定模块来组织控制器，提高代码的可组织性和可维护性。

以上面的路由为例，`scope module: "sessions"` 指定了 `transfers` controller 所在的命名空间。用 Rails 的约定来说，差异在于：

|              | 有 scope                           | 无 scope                  |
| ------------ | ---------------------------------- | ------------------------- |
| **文件位置** | `sessions/transfers_controller.rb` | `transfers_controller.rb` |
| **类名**     | `Sessions::TransfersController`    | `TransfersController`     |

> `resource` 和 `resources` 都可以接受很多 *options* 使得生成的路由更定制化，API 文档有详细的解释： [https://api.rubyonrails.org/classes/ActionDispatch/Routing/Mapper/Resources.html](https://api.rubyonrails.org/classes/ActionDispatch/Routing/Mapper/Resources.html)

#### 1.1.1 练习

下面的路由方法来自第十五行，思考一下会生成什么：

```ruby
resource :account do
  scope module: "accounts" do
    resource :join_code, only: :create
    resource :custom_styles, only: %i[ edit update ]
  end
end
```

#### 1.1.2 答案

```ruby
account_join_code POST /account/join_code(.:format)  accounts/join_codes#create

edit_account_custom_styles GET /account/custom_styles/edit(.:format) accounts/custom_styles#edit

account_custom_styles PATCH /account/custom_styles(.:format) accounts/custom_styles#update
...                   PUT ... ...
```

### 1.2 `namespace` vs `scope`

Writebook 的主要业务逻辑都与 *books* 相关，从路由方法上也可以看出来：

```ruby
resources :books, except: %i[ index show ] do
  resource :publication, controller: "books/publications", only: %i[ show edit update ]
  resource :bookmark, controller: "books/bookmarks", only: :show

  scope module: "books" do
    namespace :leaves do
      resources :moves, only: :create
    end

    resource :search
  end

  resources :sections
  resources :pictures
  resources :pages
end
```

这里 `namespace` 和 `scope` 的相似性困惑了我很久，看起来它们区别也不大，都可以创建命名空间，添加 URL 前缀等等，功能基本上是重叠的。看 API 文档和 Rails Guides 也没看出个子丑寅卯。

> API 文档： [https://api.rubyonrails.org/classes/ActionDispatch/Routing/Mapper/Scoping.html](https://api.rubyonrails.org/classes/ActionDispatch/Routing/Mapper/Scoping.html)
> 
> Rails Guides: [https://guides.rubyonrails.org/routing.html#controller-namespaces-and-routing](https://guides.rubyonrails.org/routing.html#controller-namespaces-and-routing)

查了很多资料之后，发现它们的区别其实就是一句话：**`namespace` 是定制版的 `scope`**。`scope` 支持三个选项：

- `:module`：指定**命名空间** (即类名或使用 *module*)
- `:path`：添加 **URL 前缀**
- `:as`：添加生成的 **path/url 前缀**

以下面的代码为例：

```ruby
scope module: "admin", path: "admin", as: "admin" do
  resources :articles
end
```

- `module: "admin"` 会使 `:articles` 的类名为 `Admin::ArticlesController` (当然也可以把 `class ArticlesController` 放到 `module Admin` 下)
- `path: "admin"` 会使生成的 URL 为 `/admin/articles/:id` 形式
- `as: "admin"` 会使生成的 path/url 为 `admin_articles_path` 形式

这里的关键是，**这三个选项都是用了才会生效**，所以如果只使用 `:module` 和 `:path` 选项，那么生成的 path 则依然是原先的 `articles_path`，而不会是 `admin_articles_path`。

了解了 `scope` 的这三个选项，就容易理解为什么 `namespace` 是定制版的 `scope` 了，因为 **`namespace` 是一个预设了这三个选项的 `scope`**。而 `scope` 没有为这三个选项的任何一个指定默认值，它允许我们**选择性地**使用这三个选项。也因此，`namespace` 更便捷，而 `scope` 更灵活。所以下面这两个代码片段结果是完全相同的：

```ruby
namespace "admin" do
  resources :articles
end

scope "/admin", as: "admin", module: "admin" do
  resources :articles
end
```

关于何时使用这两者，我的想法是根据资源的相关性：`namespace` 更适合表示**强关联**的资源，而 `scope` 更适合表示**弱关联或逻辑分组**的资源。如果一个资源是完全属于另一个资源的子类，`namespace` 比较合适；如果关联性不大只在 URL 或其他方面有共性，使用 `scope` 更灵活。举一个不知道是否恰当的例子：

- 比如美短和布偶都属于猫，它们既需要放到*猫*这个目录下，在访问上也需要 `/猫/布偶`，`/猫/美短` 这种形式，显然 `namespace` 更合适
- 而猫和狗都属于动物，除了 URL 需要 `/动物/猫`，`/动物/狗` 之外，其他方面关联性不大，这时候只使用 `scope path: '动物'` 可能更好点

> [https://courses.bigbinaryacademy.com/learn-rubyonrails/rails-routing-in-depth/](https://courses.bigbinaryacademy.com/learn-rubyonrails/rails-routing-in-depth/)

**TODO**: 除此之外，上面的代码还有一点是**我没搞明白**的，即 `resource :bookmark, controller: "books/bookmarks", only: :show` 这里为什么使用 `controller: "books/bookmarks"` 而不是直接把 `resource :bookmark` 放到 `scope module: "books"`，从 `rails routes` 的结果来看，它们没什么区别。

> 两者比较的结果：
>   - [https://railsrout.es/t6rLwDHQ3Z](https://railsrout.es/t6rLwDHQ3Z)
>   - [https://railsrout.es/RJc6qMLLow](https://railsrout.es/RJc6qMLLow)

一种可能的解释是 `scope` 指定**块中的所有内容都在指定模块内**，但这里的”模块“未必是 controller 或资源本身，比如 `Admin::UsersController` 中 "admin" 既不是 controller 也不是资源。而 `resource` 中的 `:controller` 选项直接指定 controller 路径，这种写法**避免了额外的路由层级，效率更高**。正如“一棵是枣树，另一棵也是枣树”，而不是“两棵枣树” 并非简单的文字选择，而是经过深思熟虑的艺术处理。

但也可能真的只是作者的个人偏好。

> 顺便提一下，使用 `rails g controller books/bookmarks"` 可以生成 `app/controllers/books/bookmarks_controller.rb`。

### 1.3 `direct`

这是我第一次见到 `direct` 方法。但也并不惭愧，看到一些盛赞的博主都是第一次见 🥹。

```ruby
get "/:id/:slug", to: "books#show", constraints: { id: /\d+/ }, as: :slugged_book

direct :book_slug do |book, options|
  route_for :slugged_book, book, book.slug, options
end
```

咋一看似懂非懂，其实明白了也并不复杂。`direct` 方法使我们能够定义**自定义的 URL 生成器**，它接受一个生成器名字和一个块作为参数，并返回一个 URL 字符串或 `url_for` 方法可以处理的其他数据结构，**调用这个生成器名字时传递的任何参数都会被传递给块**。

就像下面这样：

```ruby
direct :landing_page do
  "https://example.com/"
end

# >> landing_page_url
# => "https://example.com/"

direct :greeting_page do |user|
  "https://example.com/#{user.name}"
end

# >> greeting_page_path(matz)
# => "/yukihiro"
```

除了被视为 URL 的字符串之外，`direct` 方法还可以返回以下选项之一：

- 一个哈希，如 `{controller: "page"，action: "index"}`
- 一个数组，被传递给 `polymorphic_url`
- 一个 Active Model 实例
- 一个 Active Model 类

事实上，这些返回值都是 `url_for` 方法的有效参数，换句话说，只要 `url_for` 能够利用这些返回值构造出有效的 URL 字符串就行。

> [https://api.rubyonrails.org/classes/ActionDispatch/Routing/UrlFor.html#method-i-url_for](https://api.rubyonrails.org/classes/ActionDispatch/Routing/UrlFor.html#method-i-url_for)
>
> `route_for` 类似 `url_for`，只是前者生成 path，后者生成 URL。

所以，现在回头看一下 Writebook 中的 `direct` 方法代码，它定义了一个 `book_slug_path()` 路由名字，这个名字对应的字符串是 `route_for` 方法利用 `slugged_book_path()` 构造的。这样我们就可以**通过传递对象来构造 URL，而不是依次提取对象的属性**：

- `book_slug_path(book)` 而不是 `slugged_book_path(book, book.slug)`

> 注意，`rails routes` 的输出结果只有 `slugged_book` 而没有 `book_slug`，所以相当于 `direct` 只是为我们定义了一个”普通“的方法来简写路由。

如果这个说服力还不太强，那么下面这个路由方法同样是出自 Writebook：

```ruby
get "/:book_id/:book_slug/:id/:slug", to: "leafables#show", constraints: { book_id: /\d+/, id: /\d+/ }, as: :slugged_leafable

direct :leafable_slug do |leaf, options|
  route_for :slugged_leafable, leaf.book, leaf.book.slug, leaf, leaf.slug, options
end
```

`leafable_slug_path(leaf)` VS `slugged_leafable(leaf.book, leaf.book.slug, leaf, leaf.slug)`，这大概就是对**代码美学**的追求吧。

有一点需要注意的是 `direct` 方法不能在任何 *scope* 块内 (比如 `namespace` 或 `scope`) 使用，从源码可以看出：

```ruby
# actionpack/lib/action_dispatch/routing/mapper.rb

def direct(name, options = {}, &block)
  unless @scope.root?
    raise RuntimeError, "The direct method can't be used inside a routes scope block"
  end
  
  @set.add_url_helper(name, options, &block)
end
```

> DHH 有一篇文章 "Patek levels of finishing" 讲述对代码的雕琢: [https://world.hey.com/dhh/patek-levels-of-finishing-467e5dc0](https://world.hey.com/dhh/patek-levels-of-finishing-467e5dc0)
>
> `direct` 方法的文章：[https://www.writesoftwarewell.com/direct-custom-url-helpers-rails/](https://www.writesoftwarewell.com/direct-custom-url-helpers-rails/)
>
> `direct` API: [https://api.rubyonrails.org/classes/ActionDispatch/Routing/Mapper/CustomUrls.html#method-i-direct](https://api.rubyonrails.org/classes/ActionDispatch/Routing/Mapper/CustomUrls.html#method-i-direct)

### 1.4 如何只为子资源生成路由

最后一个值得注意的是：

```ruby
resources :pages, only: [] do
  scope module: "pages" do
    resources :edits, only: :show
  end
end
```

这里的 `only: []` 表示**避免生成任何与 `pages` 资源相关的标准 RESTful 路由**，但仍然允许嵌套 `pages/edits` 资源的路由。

生成的结果如下：

```ruby
page_edit   GET   /pages/:page_id/edits/:id(.:format)   pages/edits#show
```

这是一种常见的模式，用于创建一个仅通过嵌套资源访问的资源。

## 2. 总结

Rails Router 里有相当多的高级用法，包括 `concern`、`shallow` 等，但一般的入门书籍里很少有介绍到，只能是见招拆招，遇到了再学习印象会更深刻。如果一下子把官网的 "Rails Routing from the Outside In" 看完，好像用处也不大...

> Rails Routing from the Outside In: [https://guides.rubyonrails.org/routing.html](https://guides.rubyonrails.org/routing.html)
>
> The Rails Router: [https://books.writesoftwarewell.com/3/rails-router](https://books.writesoftwarewell.com/3/rails-router)