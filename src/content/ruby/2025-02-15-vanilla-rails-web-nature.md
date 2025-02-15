---
title: Vanilla Rails - 让 Web 开发回归本质
publishedAt: 2025-02-15
---

最近一直在做一个纯 Rails 项目，纯度是 `rails new xx -c tailwind -d mysql`。项目虽然还没完成，但已经有很多感受想记录一下。

## 1. 项目介绍

项目本身类似于一个后台管理系统，大致需求是：

- 登录、注册、忘记密码、修改密码 (账号为手机号)
- 侧边栏是一系列带有链接的标题，点击链接，右侧会显示相应的内容
- 右侧内容有一个用于过滤日期的 Date Picker，选择不同的日期下方会展示不同的图表
- 另有允许用户上传文件，然后根据文件内容进行计算，并返回给用户下载

似乎不复杂的需求，但做的过程中还是有很多取舍，也探索到了一些有趣的知识。

## 2. 难搞的前端

前端是我花时间很多的地方，因为后端功能实现了就 OK，而前端样式调不好就不好看。

前天我花了一整天的时间才把登录页的前端写好，即便如此，背景图的位置比起设计图也不太精确。

另一个难点是登录框左右侧有两个 Rotation，虽然我对 Flex/Grid 布局甚至有点熟悉，但旋转、动画这些操作却是有点棘手。一开始我把设计图截图丢给 DeepSeek，效果并不好，后来我找了一个网站 [https://css-transform.moro.es](https://css-transform.moro.es) 在上面操作旋转，然后把它的 CSS 转成 Tailwind，最后经过精心调制，终于差强人意。

还有一个问题是在还原设计图上，原本我是追求“像素级还原”的，但实操下来发现问题很多：比如设计图尺寸是 1500x800，这在我 27 寸的显示器上，右侧就会有一片空白，这样 Flex 布局的 Gap 就要增加。但如果要把网页收窄，写死的 px 又会把布局弄乱。

因为暂时没有响应式的需求，所以也没有响应式的设计图，所以大部分情况下我都是用设计图上的固定 px 来做尺寸。

另一个问题是字号，Tailwind 的默认字体大小是 16px，其 `text-xs` 是 12px，行高为 1。但我们有很多 12px 行高 14px 大小的字，所以我就有很多 `text-[12px] leading-[14px]` 这样的代码。虽然我确实应该在 `tailwind.config.js` 里设置好字体、间距等信息，但由于字体大小没有一个阶梯值信息，所以我暂时没有去统计并做这样的规范化。

凡此种种，一一列举并没有什么意义。总的来说，我在前端上的欠缺很大，要走的路也才刚开始。不过我初步的感受是：

- **对于对样式要求不太严格的项目来说，如果只把设计图当作一个布局参考，明白大概的元素位置，不过于追求细节而用一些现成的组件也许会事半功倍**，做出来的界面也往往更漂亮。我已经见过很多基于 shadcn/ui 的网站，甚至连黑白色都没有更换。
- **而大部分项目，样式都不太重要**，有多少人在用一些常用网站时是用样式来做取舍的？百度、12306、DeepSeek... 99% 的人在用这些网站时应该都不会在意它们的登录框像素、布局、颜色，而只会在乎搜到的结果是否满意、能不能买到票、给的答案怎么样。甚至当你在手机上浏览一些完全没有响应式的网站，你会放大网页或者换成电脑查看它，而不是想着它怎么没有响应式我不看这个垃圾网站了。

这并非是在宣扬样式无用论，只是说和功能比起来，它的重要性显然逊一筹。

## 3. 我的前端思路

### 3.1 All in Vanilla

出于可维护性的目的和总是想尽力搞明白一切的心态，我更喜欢 Vanilla 之类的技术，尤其是在前端领域。这另一方面也是因为如果开始跳入“现代前端”的生态圈，这种刨根问底的心态往往会让人筋疲力尽、狼狈不堪。

比如我看到 React Icons 有这样的一个图标：

```js
import { FiAirplay } from "react-icons/fi"

<FiAirplay />
```

我会想知道 `<FiAirplay />` 背后怎么写的，是个 SVG 吗？还能接受其它参数吗？那就可能要去找找它的文档、甚至源码。而如果我使用 Hero Icons 这样的图标，只需要复制粘贴 SVG 就行了，把它保存成 SVG 图片也行，总之我知道它就是个图片，就不会再去深究它了。

图标这种小东西还好，如果碰到 shadcn/ui 这样的组件：

```js
export function AccordionDemo() {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>Is it accessible?</AccordionTrigger>
        <AccordionContent>
          Yes. It adheres to the WAI-ARIA design pattern.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Is it styled?</AccordionTrigger>
        <AccordionContent>
          Yes. It comes with default styles that matches the other
          components&apos; aesthetic.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Is it animated?</AccordionTrigger>
        <AccordionContent>
          Yes. It's animated by default, but you can disable it if you prefer.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

不知道别人什么感受，我自己是挺害怕的。这还只是一个 Accordion 小功能组件。事实上这种折叠功能用原生的 Web API `<details>` 和 `<summary>` 就可以实现，再花点时间调样式，甚至比去弄懂这里每一个 JSX 的时间要少很多，而它的可复用性显然也更加长远。

比起所有这些，我更在乎的是作为开发者，那种了解这个技术来龙去脉的“明镜”似的感觉，令人畅快通透。

所以相比 shadcn/ui，我更喜欢 HyperUI 这种只需要复制粘贴的组件，或者 CSS-Zero 这种基本属于 Native 的组件。

虽然我比较青睐上面那种组件，但涉及到非私人项目时就不能从心所欲了。目前在做的这个项目，让我觉得在真正了解 Rails 之前，不要轻易说 Rails 不可以。比如我的登录页、注册页和忘记密码页面几乎一样，但有一些文字上的区别，所以我写了一个这样的 layout:

```html
<div class="flex items-center pl-[160px] pr-[300px] md:pr-[160px] justify-between min-h-screen">
  <%= render "shared/auth_bg_logo" %>

  <div class="bg-white rounded-lg shadow-lg p-8 w-[350px] h-[<%= request.path.include?("registration") ? "460px" : "444px" %>] relative border-[2px] border-[#F1F1F4]">
    <%= render "shared/auth_thumbnails" %>

    <h1 class="text-center text-[16px] leading-[14px] text-[#071437] mb-4 font-semibold"><%= title %></h1>
    <p class="text-center text-[#4B5675] text-[12px] leading-[14px]">
      <%= if request.path == new_session_path
            "没有账号？"
          else
            request.path == new_registration_path ? "已有账号？" : ""
          end %><%= link_to back_text, back_path, class: "text-[#1B84FF]" %>
    </p>

    <%= yield %>
  </div>

</div>
```

然后这样调用：

```ruby
<%= render layout: "shared/auth_layout", locals: {
  title: "登录",
  back_text: "点此注册",
  back_path: new_registration_path,
} do %>

  <%= form_with(url: session_path) do |f| %>
    <%# ... %>
  <% end %>

<% end %>
```

虽然远非完美，还有很多可调优的空间，但对于一个小型项目来说，清晰度和可维护性已然足够了。对于更复杂的即便是中型项目，ViewComponent 也应该可以把控 (很多人喜欢 Phlex，但我还没欣赏到它的语法)。

我很欣赏 Erb。就像我一开始看到有人攻击 DHH 时，感觉他们说的似乎有道理，但深入了解之后，发现至少是在技术水平和视野上，没有一个攻击者能达到他的水平。**如果你没有达到一定的高度就去批判更高维度的人，那结果几乎就是你错了**。

### 3.2 精进原生能力

很多年前我学 CSS 时，被 Float 布局折磨的身心俱疲，之后再也不碰前端了。但如今现代 CSS、JavaScript 以及越来越强大的 Web API 竟然进化的如此耀眼、令人爱不释手，以前要花很大力气实现的一些布局和效果，现在用原生技术就可以轻而易举地做到：

- CSS 有 Flex/Grid，甚至一些浏览器已经支持了 SubGrid，而且它还吸收了很多 SCSS 的语法，比如嵌套
- Fetch API 使 Axios 黯然失色
- 对于 URL 和路由，有 `URLSearchParams` 和 `URLPattern`
- Form 甚至有 `setCustomValidity()`
- 关于 UI 元素，浏览器还提供了 Dialog, Popover
- ...

**虽然我还只了解了一些皮毛，但我仿佛已经看见星辰大海**。对我来说，这远比“为啥 React 19 中 useXXX hook 变了”之类的问题更有意义。

顺便提一句 Tailwind，一开始我很反感它，原本整洁的 HTML 标签被弄得混乱不堪，尤其是要在一大堆 class 中找到目标标签时，更令人厌恶。但慢慢地，我发现它有两个突出的优点：

- 第一，**它保持甚至提高了你的原生 CSS 能力**，你不会盲目的去用一个 Tailwind 类，当你用它的时候，你一定知道它在做什么。这和用 BootStrap 或 Bulma 是截然不同的。
- 第二，**它一定程度上提高了效率**，不知道别人是怎么开发的，但我之前写 HTML/CSS 是屏幕左右对照着两个文件写的，现在就不需要来回切换了。

CSS 之外，Rails 也让我找到了写 JavaScript 的乐趣。每当我在 Erb 写下 `data-controller`，再去写 Controller 时，我甚至有一种兴奋： **这不就是 JavaScript 原本的使命和意义吗？为网页提供交互**！

比如我的注册页和忘记密码页面都需要发送手机验证码，发送之后有一个倒计时：

```js
// verification_code_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { endpoint: String }

  async send(event) {
    const button = event.currentTarget
    const phone = this.element.querySelector('input[name*="phone"]').value

    try {
      const response = await fetch(this.endpointValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector("meta[name='csrf-token']")
            .content,
        },
        body: JSON.stringify({ phone }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      if (data.error) {
        this.#showErrorMessage(data.error)
        return
      }

      this.#startCountdown(button)
    } catch (error) {
      this.#showErrorMessage(error.message)
    }
  }

  #startCountdown(button) {
    let seconds = 60
    button.disabled = true

    const interval = setInterval(() => {
      seconds--
      button.textContent = `${seconds}s后重新发送`
      button.classList.add("text-[#99A1B7]")

      if (seconds <= 0) {
        clearInterval(interval)
        button.disabled = false
        button.textContent = "发送验证码"
        button.classList.remove("text-[#99A1B7]")
      }
    }, 1000)
  }

  #showErrorMessage(message) {
    document.getElementById(
      "flash-message"
    ).innerHTML = `<span class="text-red-500">${message}</span>`
  }
}
```

这就是全部的代码，加上空格一共 59 行，提供了所有发送验证码需要的交互逻辑，任何有点 JavaScript 基础的人、甚至不需要了解 Stimulus 都能看懂这种代码，如果让他们多看两个例子，很难保证他们不会写。

## 4. 总结

原本是做项目的间隙休息时想的文章，断断续续写到了十一点半，有点乱，但就这样吧。

我并非对微服务、Kubernetes、高可用一无所知，也亲手搭建过 EKS 集群。但我越来越觉得，如果想要一个人做点什么，或是一个精英小队想做成点什么，还是 Rails 这种技术更实在，更能回归本质：

- 用 HTML 书写内容
- 用 CSS 美化样式
- 用 JavaScript 加点交互
- 用 Ruby 构建后端

它可能不如用 NextJS 一把梭，`npx xx add xx` 来的快，但它的确会让你**即便一个人也能走的很远、很踏实**，如果你来自 BAT 或者 FANNG，你当然可以对我的想法不屑一顾，但我也并不打算用 Rails 建立下一个 Google。