---
title: 使用 RubyXL 修改 Excel - 如何删除 Formula
publishedAt: 2025-03-21
---

这是昨天工作中遇到的关于使用 RubyXL 修改 Excel 内容的问题，由于有点小众网上也不怎么有相关信息，所以记录一下。

## 1. 需求

此项需求是解析用户上传的 Excel，对其中的某一列数字根据一定的规则进行就地修改，然后再把 Excel 返回给用户下载。

## 2. 出现问题

原本我的实现是通过 RubyXL 解析 Excel，遍历行，对目标列的单元格使用 `cell.change_contents()` 方法修改其内容，这个实现方式在一段时间内没有发现问题。

直到前几天的一次周会，一位同事提出当目标列的数值是利用 Excel 的 `RAND()` 函数随机生成时，通过我们的服务处理后的 Excel 列值仍然是随机数。

当时我对这个问题似懂非懂，主要是因为我并没有使用过 Excel，所以不懂；但 `RAND()` 这个在任何一种编程语言中都耳熟能详的存在又让我觉得有点熟悉，所以似懂非懂。

之后经其他同事演示讲解我才明白问题所在：**可以理解为单元格内实际保存的是 `RAND()` 函数，每次打开 Excel 时虽然我们看到的是一个数字，但这个数字是 Excel 打开时 `RAND()` 函数运行并把产生的值插入所在的单元格才得到的；这就导致只要 `RAND()` 函数藏在单元格幕后，那么无论如何修改其值，每次打开 Excel 得到的结果都会被 `RAND()` 函数的结果所覆盖**。

也许还有其他函数或方式会造成这种结果，但目前这个例子已经足以说明这个 Bug 了。

## 3. 尝试解决

RubyXL 的 READMD 文档里给出了相当多的例子，**除了我真正需要的那一个**。但我仍然通过搜索引擎和一些蛛丝马迹，了解到 `RAND()` 函数这种概念在 Excel 里的专业称呼是 **Formula**。

由于实在没有找到可供参考的相关资料，所以我直接搜索了源码 [https://github.com/weshatheleopard/rubyXL/blob/v3.4.33/lib/rubyXL/convenience_methods/cell.rb#L21](https://github.com/weshatheleopard/rubyXL/blob/v3.4.33/lib/rubyXL/convenience_methods/cell.rb#L21)，得到的这个方法确实令人心动：

```ruby
def remove_formula
  self.formula = nil

  calculation_chain = workbook && workbook.calculation_chain
  calculation_cells = calculation_chain && calculation_chain.cells
  calculation_cells && calculation_cells.reject! { |c|
    c.ref.col_range.c == self.column && c.ref.row_range.begin == self.row
  }
end
```

但遗憾的是，当我在单元格上通过 `cell.remove_formula if cell.formula` 调用时，它报错：`NoMethodError (undefined method 'c' for an instance of Range)`，时间紧急，我自然是没有时间和精力去排查库里的问题。

所以我直接使用 `cell.formula = nil`，然后用之前精心保存的同事赠送的带 `RAND()` 函数的 Excel 文档进行测试，然后搜索 `Excel online viewer`，打开被处理后的 Excel，似乎...用浏览器打开 Excel 不太能说明问题到底解决了没有。

> 当初用 Manjaro 就图它有点好看，现在确是成了阻力。

但还好我还有一台老旧的 Windows，我用它打开这个被处理的 Excel，虽然数据显示正常，点击单元格也没有 `RAND()` 函数出现了，但我多次尝试之后发现每次打开这个文件，Excel 都会提示： *Removed Records: Formula from /xl/calcChain.xml part (Calculation properties)* 信息，要点击 *Yes* 再等 Excel 处理几秒钟才能正常打开。

我以为是 Office 版本的问题，但原始的 Excel 没有这个问题。这显然是无法接受的。

## 4. 解决问题

到这里我觉得其实就差临门一脚问题应该就能解决，但确实没有头绪。所以我把那个提示信息发给两位老师，其中一位老师说 Excel 中存在一种称为**计算链**的概念，保存着相关函数的链式调用，直接设置 `formula = nil` 会破坏这个计算链对象，所以最简单的方式是完全移除计算链对象，即使用 `workbook.calculation_chain = nil`。

相关代码大致如下：

```ruby
require "rubyXL/convenience_methods/cell"

def process_excel(file)
  workbook = RubyXL::Parser.parse(file)
  worksheet = workbook[0]

  (1..worksheet.count - 1).each do |r|
    # ...

    # 假设要处理第 6 列单元格
    worksheet[r][6].formula = nil
    worksheet[r][6].change_contents(some_value)
  end

  workbook.calculation_chain = nil

  # ...
end
```

问题确实被解决了。但我隐约觉得这种方式也许有点粗暴，可能有机会还是应该看一下 `remove_formula` 方法。

> 除此之外，我还找到一篇对解决这个问题没有帮助但也许对其它使用 RubyXL 的方式有帮助的文章，虽然是日语，但可以用翻译： [https://www.issoh.co.jp/tech/details/3381/](https://www.issoh.co.jp/tech/details/3381/)。

之所以想记录一下这个问题，还有一个原因是我觉得这个 Bug 发现的方式确实很有趣：**你永远也不知道用户会以怎样的方式使用你的系统**；而它的解决过程也同样有趣：**在充满知识盲点的领域寻找突围**。