# Agent Instructions

本文件是仓库级工程约束，执行代码修改时优先遵守本文件。

## 项目结构

- `frontend/`：React/Vite 前端，负责编辑器、预览、Figma 转换流程 UI。
- `backend/`：Nest 后端，负责 Figma API、HTML 渲染、AI enhance 调用、日志。
- `design2code/`：Figma 数据解析与 HTML/CSS 生成，属于代码生成核心。
- `agent/`：视觉修复 agent，负责 observe -> plan -> apply -> polish 工作流。
- `contracts/`：跨包/跨进程共享的类型契约。

修改跨模块链路时，优先保持模块边界清晰，避免职责重叠混淆。


## `interface` 与 `type`

> Internal: types. External: interfaces.
> “Be conservative in what you do, be liberal in what you accept from others.”

- `interface`：用于表达对外稳定对象契约、跨模块共享结构、组件 `Props`、store state 和输入输出 DTO。
- `type`：用于表达联合类型、函数类型、条件类型、映射类型、工具类型，以及模块内部的中间态、组合态、派生态或局部类型别名。

| 场景 | 选择 |
| --- | --- |
| 联合类型、函数类型、条件类型、映射类型、工具类型 | `type` |
| Props、store state、DTO、跨模块稳定复用的对象契约 | `interface` |
| 模块内部使用的小型对象、中间态、组合态 | `type` |
| 普通对象结构两者都能写，且没有明显边界语义 | 先和同一语义层保持一致；没有既定写法时，对外契约用 `interface`，内部实现用 `type` |

## 命名规范

- 默认使用驼峰命名。
- 变量、函数、方法、对象字段使用 `camelCase`。
- 类型、接口、类、组件、枚举使用 `PascalCase`。
- 常量仅在表达稳定常量值时使用 `UPPER_SNAKE_CASE`，不要把普通变量写成全大写。
- 文件名优先和同目录既有风格保持一致；没有既定风格时，导出单个主符号的文件使用与主符号语义一致的驼峰变体。
- 配置类、约定类文件名不强制使用驼峰命名，遵循生态或工具链的既定命名方式，例如 `vite-env.d.ts`、`tsconfig.json`、`eslint.config.js`。

## 开发规范

- 当一个文件代码超过300行时，建议将其拆分成多个文件，每个文件负责一个功能模块。
