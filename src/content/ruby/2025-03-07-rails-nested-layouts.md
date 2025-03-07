---
title: Rails 中使用嵌套布局 (Nested Layouts) 的两种方式
publishedAt: 2025-03-07
---

今天又是被 AI 挖坑的一天。原因和上次一样：

- 我花十几分钟写提示，然后上传代码给 DeepSeek/Grok 两位大佬
- 在 DeepSeek 中不断重试，向 Grok 证明我不是机器人
- 等待并验证它们的方案
- 方案错误，在它们的基础上自己调整一下代码
- 继续错误，再写提示，把新的报错给它们看，等待它们的新方案
- 验证新方案，还有错误，再自己调整一下代码
- ...

基本上，**AI 每次都能在未解决我的原问题的情况下，引入新的错误，当我尝试纠正它们引入的错误时，又有更多层出不穷的新错误**。结果就是看起来我全神贯注地坐在电脑前忙碌了一整天，事实上什么也没做。这种努力的感觉很虚假。

到傍晚我实在忍无可忍，于是 `git reset --hard` 之后，认真阅读了 Rails 官方指南并查找了 StackOverflow，于是花了一个多小时终于让这一天变得有价值了！

> 需要承认的是，每当遇到一个新知识点时，问 AI 总能快速得到一个很全面、详细的回答，且附有清晰、完整的代码，让人一下子对相关的概念有一个系统而全面的认识；在帮助重构、优化**可以正常工作的代码**时，它们也的确做的不错，但是**解决问题的能力确实不怎么样**。

## 1. 提出问题

今天遇到的问题依然来自我正在独自开发的项目，之前我实现 dashboard 的方式如下：

- 点击侧边栏链接 (`link_to` 添加了 `data: {turbo_frame: "xxx"}` 属性)，服务端返回 Partial，通过 `<turbo_frame>` 更新右侧内容区

这个实现存在两个问题：

1. 浏览器地址没有变化，这导致使用浏览器的前进/后退按钮时的体验...可以说是没有体验。
2. 而如果用户通过某种方式在浏览器地址栏“意外”地访问到了侧边栏链接，假设 `dashboard/sidebar_item_xxx`，那么用户的页面上只会渲染一个 Partial 的内容而丢失所有其它的布局、样式和内容，这当然更是无法接受的。

因为甚至对 AI 产生了依赖，所以我不假思索地把上面的描述附上代码发给它们了，结果就是如开头所说的浪费一整天的情绪。下面说一下我自己的解决方案。

## 2. 解决问题

### 2.1 Turbo Frame 更新浏览器地址

第一个问题比较简单，官方文档写的一目了然，给 `link_to` 添加一个 `data: {turbo_action: "advance"}` 就可以了。

> Promoting a Frame Navigation to a Page Visit: [https://turbo.hotwired.dev/handbook/frames#promoting-a-frame-navigation-to-a-page-visit](https://turbo.hotwired.dev/handbook/frames#promoting-a-frame-navigation-to-a-page-visit)

### 2.2 嵌套布局问题

关于第二个问题，我之前的实现大概如下：

```ruby
# dashboards_controller.rb
class DashboardsController < ApplicationController
  def a
    respond_to do |format|
      format.html { render_partial }
      format.json { render json: {xxx} }
    end
  end

  def b
    respond_to do |format|
      format.html { render_partial }
      format.json { render json: {xxx} }
    end
  end

  # ...
  private
    def render_partial
      render partial: "item_#{action_name}"
    end
end
```

`app/views/dashboards/` 目录存在 `_item_a.html.erb`，`_item_b.html.erb` 等 Partial。

我的思路是无论如何不能返回 Partial 了，因为那样的话只要用户在浏览器直接输入地址，就会失去所有布局。所以我把代码调整成这样：

```ruby
# dashboards_controller.rb
class DashboardsController < ApplicationController
  def a
    respond_to do |format|
      format.html
      format.json { render json: {xxx} }
    end
  end
  # ...
end
```

即删除 `render_partial` 方法，同时删除 `format.html` 的块，这样每个 action 都会渲染自己的默认模板，所以把 `_item_a.html.erb` 重命名为 `a.html.erb`。

但这样一来，这些 action 原先的布局就不适用了，需要给它们一个统一的布局，之后 `a.html.erb` 里只写少许代码就够了。但：

- 我不想直接修改 `application.html.erb`，因为会影响其它非 dashboard 页面的布局。
- 也不想把 `application.html.erb` 的内容再复制到一个单独的 `dashboard.html.erb` layout 里，毕竟 **DRY**。

我希望实现一个**继承 `application.html.erb` 并添加自己的少许内容的 `dashboard` 布局**。现在看来这个问题确实不复杂，下面是两种方案：

无论哪一种方案，都要先在 controller 声明布局：

```ruby
# dashboards_controller.rb
class DashboardsController < ApplicationController
  layout "dashboard"
end
```

#### 2.2.1 方案一 - 来自官方文档

根据官方文档的指示，我把 `dashboard.html.erb` 的内容修改为：

```html
<% content_for :dashboard do %>
  <div class="">
    <%= render "dashboards/sidebar" %>

    <main class="">
      <%= render "dashboards/content_header" %>
      <%= turbo_frame_tag "dashboard_content" do %>
        <%= yield %>
      <% end %>
    </main>

  </div>
<% end %>

<%= render template: "layouts/application" %>
```

而在 `application.html.erb` 模板里使用 `content_for` 方法进行条件渲染：

```html
<!-- ... -->
<body>
  <%= content_for?(:dashboard) ? yield(:dashboard) : yield %>
</body>
<!-- ... -->
```

本方法直接来自官方文档，链接如下：

> Using Nested Layouts: [https://guides.rubyonrails.org/layouts_and_rendering.html#using-nested-layouts](https://guides.rubyonrails.org/layouts_and_rendering.html#using-nested-layouts)

#### 2.2.2 方案二 - 来自 StackOverflow 8 年前的回答

新增一个 `app/helpers/layouts_helper.rb`，内容如下：

```ruby
# layouts_helper.rb
module LayoutsHelper
  def parent_layout(layout)
    @view_flow.set(:layout, output_buffer)
    output = render(:file => "layouts/#{layout}")
    self.output_buffer = ActionView::OutputBuffer.new(output)
  end
end
```

`application.html.erb` 布局保持不变，即仍为 Rails 自动生成的：

```html
<!-- ... -->
<body>
  <%= yield %>
</body>
<!-- ... -->
```

`dashboard.html.erb` 布局的内容改为：

```html
<div class="">
  <%= render "dashboards/sidebar" %>

  <main class="">
    <%= render "dashboards/content_header" %>
    <%= turbo_frame_tag "dashboard_content" do %>
      <%= yield %>
    <% end %>
  </main>

</div>

<% parent_layout "application" %>
```

这个方案来自 StackOverflow 2017 年的回答，也即是下面链接的最后一个回答 (也许前几个答案也能用，我并没有一一尝试)。Rails 的持久力说实话令人感动，这在其它框架上是不可想象的。

> [https://stackoverflow.com/questions/20480961/nested-layouts-in-rails](https://stackoverflow.com/questions/20480961/nested-layouts-in-rails)

虽然这两种方案都最终有效，但我选择方案一的原因是显而易见的：**一是因为它直接来自官方文档，简单易懂；二是因为方案二的代码我没看懂**。根据 DeepSeek 的解释，这段代码的意思是：

- `@view_flow.set(:layout, output_buffer)`: 将当前视图的输出内容 `output_buffer` 保存到 Rails 的内容流管理对象 `@view_flow` 中，键为 `:layout`。
- `render(template: "layouts/#{layout}")`: 渲染指定的父布局模板，如 `layouts/application.html.erb`。
- `self.output_buffer = ...`: 将父布局渲染后的结果设置为新的输出缓冲区，从而将子布局内容嵌入父布局中。

看起来解释的挺合理的，不过它还是又骗了我一次，它告诉我可以这样用这段代码：

```html
<% parent_layout "application" do %>
  <!-- 子布局内容 -->
  <%= yield %>
<% end %>
```

事实证明根本不行，且不说 `parent_layout` 方法也根本没有接收块参数。

不过方案二本身，似乎对多层嵌套的布局很有用处。

## 3. 目前的不完美之处

虽然目前为止，视觉以及功能上的问题都完美解决了，不过有一点让我不满意的是：**虽然我只使用了响应页面的 `<turbo_frame>` 部分，但服务器传到浏览器的每个 action 的模板都是完整的页面，这当然导致了带宽浪费**。遗憾的是，我暂时还没有想到好的解决办法。

> 其它参考：
>
> - Easier Nested Layouts in Rails [https://mattbrictson.com/blog/easier-nested-layouts-in-rails](https://mattbrictson.com/blog/easier-nested-layouts-in-rails)
