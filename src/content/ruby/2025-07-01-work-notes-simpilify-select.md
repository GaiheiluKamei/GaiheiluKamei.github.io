---
title: 工作笔记 — 一个下拉框的前世今生
publishedAt: 2025-07-01
---

有一段时间没写文章了，这并非是我有所懈怠或疏于精进，主要是目前的工作还处于万事开头、刀耕火种的初期。虽然项目不过五个月的时间，但仅就技术而言，已经历经了几次几乎等同于重写的调整。

目前后端已经似乎大约真的趋于稳定了，不过仍然取决于后续是否有新的数据结构变动；上周产品重新设计完成之后，当下也已经完成了部分页面的开发。这次在前端上，我从之前边查文档边手写 Tailwind 的冷兵器时代，进阶到了当前**模板 + Figma to Code + Cursor** 的小米步枪模式。

虽然 Cursor 这类工具在具体的代码实现上纰漏颇多，很容易在俄罗斯套娃式的 Bug 基础上引导着年轻人在迷途中愈走愈远，但前些日子我从领导对大模型的用法上获得了很大启发，即**不要无脑应用它的代码，而是先尝试理解它给出的原理及解释是否合理**，这和我之前“从一开始就迫不及待地运行模型生成的代码，如果有新的错误就再复制粘贴给它”的做法大相径庭，却颇为有效。自从以这种方式使用 Cursor，有很多次在它解答的基础上发现了新的更简洁的思路；也多次因为指出它的错误而获得称赞，这是之前没有过的情况。

也因此，我开始有些时间去思考、重构、清理上一轮技术实现中不好的方式，并记录一些“我觉得”无论是反思自己、还是回望来路时都值得一提的工作笔记。

本文主要反思当前项目中，我在一个下拉框上所做过的技术迭代。

## 1. 一个似简非简的需求

很多设计都不过是情急之下的仓促决策，具体到这个需求上也毫不例外。

当初看设计图时，发现这个页面不像我学过的 `form_with` 那么直接，我就知道这个事情也不会像表面那么简单：

- 它像一个传统的 Dashboard，每个页面都有同样的 Header 和 Sidebar
- Header 上只有一个下拉框，可以让用户选择不同的省份
- Sidebar 上有多个链接，对应右侧内容区不同类型的数据
- 右侧内容区有一个 Datepicker 以及展示数据的 Chart

之后经过多次沟通，我梳理出来这个需求是：

- 点击 Sidebar 的数据类型链接，应该展示下拉框所在省份的、Datepicker (假设有一个默认日期) 所在日期的 Chart
- 点击 Datepicker，应该展示当前下拉框所在省份的、侧边栏所处数据类型的 Chart
- 点击下拉框，...

## 2. 漏洞百出的原始实现

如果不是刚才翻看了五个月前的 Commit，很难想象这种“令人发指般别具一格”的方案是我的第一设计。

简单来说，我在 Header 下拉框和内容区的 Datepicker 之间做了数据绑定，有任意一个切换时，都用当前的**侧边栏数据类型 + 省份 + 日期**作为参数向后端发起请求；然后用后端生成的新图表更新内容区的整个图表所在的 DOM。下面是简化后的代码：

```ruby
<%= select_tag "province", province_options, 
    data: { data_sender_target: "province", action: "data-sender#update" } %>
```

```js

export default class extends Controller {
   // ...
    update() {
        const provinceValue = this.provinceTarget.value
        const targetDateValue = this.datepickerOutlet?.dateValue || null

        this.sendRequest(new URLSearchParams({
            province: provinceValue,  
            target_date: targetDateValue
        }))
    }

    async sendRequest(params) {
        const response = await fetch(`/dashboard/sidebar_type?${params}`, {
            headers: { Accept: "text/vnd.turbo-stream.html"  }
        })
        // ...
        const html = await response.text()
        Turbo.renderStreamMessage(html)
    }
}
```

**诚实地讲，无论是搜集页面上不同部分的数据组装在一个请求中进行发送的割裂感，还是用替换 DOM 而非 JSON 数据更新 Chart 带来的页面抖动，亦或是后端错综复杂的兼容逻辑所产生的调用开销，每一次的点击和交互，都像是对我能力的一声控诉，又像是对我灵魂的一次拷问**。

很难描述我此刻再次看到这两段代码时的震惊、难以置信，以及随之而来的惭愧和五味杂陈。

## 3. 进步，在错误的道路上

有相当长一段时间，路由都被我粗糙地设计成了 `/dashboard/sidebar_type?province=xxx&target_date=xxx` 的形式，所以我也在错误的优化泥潭里愈陷愈深。

继续查看几个月前的 Commit, 我发现自己已经通过下面直接刷新页面的粗暴方式解决了更新 Chart 时的页面抖动：

```js
// 优化前
this.sendRequest(...)
                 
// 优化后
Turbo.visit(`/dashboard/sidebar_type?${new URLSearchParams({target_date: targetDate})}`, {frame: "dashboard_content"})                
```

**再之后，我已经开始使用 JSON API 更新 Chart 了** (图表库为 `Chart.js`)：

```html
<%= turbo_frame_tag "dashboard_content", data: { turbo_cache: false } do %>
  <div
      data-controller="chart"
      data-chart-data-value="<%= @chart_data.to_json %>"
      data-chart-url-value="<%= sidebar_type_dashboard_path %>">

    <div class="flex justify-between">
      <div data-controller="datepicker" class="relative">
          <input data-datepicker-target="input" data-action="change->chart#update" />
          <!-- ... -->
```

```js
  async update(event) {
    // ...
      const response = await fetch(`${this.urlValue}?target_date=${event.target.value}`, {
        headers: {
          Accept: "application/json",
      })

      const data = await response.json()
      this.chart.data = newData
      this.chart.update("active")
  }
```

**然后，由于要为下拉框的 Options 使用自定义样式，我还实现了一个更复杂的下拉框**，即在普通的 `<input>` 下绝对定位了一个 `<ul>` 包裹的省份列表，然后用 Stimulus 控制它的显示与隐藏：

```html
<div class="xxx" data-controller="select">
    <%= hidden_field_tag :province, params[:province], data: { select_target: "hiddenInput" } %>
    <div data-action="click->select#showList" >
      <div class="xxx">
        <%= text_field_tag :province, province_array.find { it.first == params[:province] }&.first, readonly: true, data: { select_target: "input" } %>
      </div>
      <%= image_tag "icons/select.svg", size: 14 %>
    </div>
    <ul class="absolute xxx hidden overflow-hidden" data-select-target="list">
      <% province_array.each do |name, value| %>
        <% disabled = !user_province_codes.include?(value) %>
        <li class="xxx <%= 'bg-gray-100 opacity-50 cursor-not-allowed' if disabled %>" data-value="<%= value %>"
            <% unless disabled %>
              data-action="click->select#select"
            <% end %>>
          <span class="xxx"><%= name %></span>
        </li>
      <% end %>
    </ul>
  </div>
```

当然，所有这些一步一步的努力，都无法掩盖或彻底解决最初设计上的缺陷所带来的遗毒，如同一个苟延残喘的破风箱，不是糊两块色彩斑斓的补丁就能解决漏风的事实。

## 4. 黎明， 拨乱也反正

终于，两个月前的某一天，领导说“**这个下拉框的省份，放到路由里是不是更好点？**”。

黑暗的日子过久了，骤然而至的黎明反倒让人不适。所以对于这个明智的建议，一开始我是抗拒的，毕竟 _**It just works**_；而重写，就相当于把项目重写一遍。但仔细思考之后，我觉得无论是从用户在产品上本应有的体验，亦或是仅从技术上的维护性来说，用 `/dashboard/:province/:sidebar_type?target_date=xxx` 的方式重构无疑是最适合当前产品的决定。

所以我在原来自定义的下拉框基础上，花了几天时间重构了几乎所有的代码。这样以来，逻辑就变的简单：

- 用户登录之后跳转到默认省份的首页：`/dashboard/:province`
- 点击侧边栏跳转到对应类型的图表：`/dashboard/:province/:sidebar_type`
- 通过 Datepicker 选择当前省份下指定日期的该类型数据
- 如果在 Header 的下拉框选择不同的省份，就跳转到对应省份的首页

```js
// select_controller.js
export default class extends Controller {
  static targets = ["list"]

  connect() {
    document.addEventListener("click", (e) => {
      if (!this.element.contains(e.target)) {
        this.hideList()
      }
    })
  }

  showList() {
    this.listTarget.classList.remove("hidden")
  }

  hideList() {
    this.listTarget.classList.add("hidden")
  }

  async select(event) {
    const item = event.currentTarget
    if (item.classList.contains("cursor-not-allowed")) return

    const province = item.dataset.value
    this.hideList()

    const currentPath = window.location.pathname
    if (currentPath.match(/\/dashboard\/[^\/]+$/)) {
      window.location.href = `/dashboard/${province}`
    } else {
      const action = currentPath.split("/").pop()
      window.location.href = `/dashboard/${province}/${action}`
    }
  }
}
```

这种实现在近两个月的产品体验及代码维护性上，无疑是良好的。

## 5. 终章？也是下一站的开始

上周由于产品换了新的设计风格，要重写一版代码，我又有机会重新审视这个下拉框的实现。

由于这次用了社区模板提供的下拉框组件，这样一来，就又可以用回原先朴素的 `<select>` 标签了。考虑到仅仅为了切换下拉框选项就要使用一个 Stimulus Controller 并不必要，所以我想是否可以通过 HTML 元素的事件“在一个地方”达到目的。仔细查阅 [MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement#events) 文档之后，我发现了下面一段话：

> Listen to these events using `addEventListener()` or by assigning an event listener to the `oneventname` property of this interface.

> [https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement#events](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement#events)

所以可以通过 JavaScript 监听 `<select>` 的 `change` 事件，**也可以直接在 `<select>` 标签上定义 `onchange` 属性**，经过几次测试和调整，我最终确定了下面的代码方案:

```ruby
<%= select_tag :province,
	province_options(selected: params[:province], disabled: Current.user.invalid_province_codes), 
        class: "kt-select min-w-[180px]",
        onchange: <<~JS.strip.html_safe
            if (this.value && this.value !== "#{params[:province]}" && document.hasFocus()) {
               window.location.href = `/dashboard/${this.value}`
            }
        JS
%>
```

得益于技术方案上的一点点改良，就能仅用这几行代码完成之前几十上百行代码才能完成的工作，这种成就感无疑令人印象深刻！也让我意识到在工作和实践中，**比起潦草地开始，更重要的或许是谋定而后动**。

目前我在前端上的积累还很薄弱，所以在几个月后的我眼里，这也许又会成为新的“粗弊代码、丑陋实现”，但暂时我觉得这已经是我当前能力范围内的最优解。

人总是在不断成长，但**成长并不意味着一定要掩盖来时的泥泞**。所以不管代码是好的、坏的、平庸或非凡的，都是我在某个曾经的瞬间一字一符敲出来的，**那些真实的代码，也都是真实的我**。