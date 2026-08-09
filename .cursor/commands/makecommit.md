# makecommit

Generate exactly one commit command using this format:
`git commit -m "[icon] [type]: [detail]"`

- Use the chat history as context for `[detail]`.
- Output must be in English.
- `[type]` must be only `Fix` or `Feature`.
- `[detail]` must be short and at most 64 characters.
- Return only the final command, ready to copy.
- Do not modify code, files, or run git commands.

Use this emoji mapping for `[icon]`:

- Initial commit: 🎉
- Version tag: 🔖
- New feature: ✨
- Bugfix: 🐛
- Metadata: 📇
- Documentation: 📚
- Documenting source code: 💡
- Performance: 🐎
- Cosmetic: 💄
- Tests: 🚨
- Adding a test: ✅
- Make a test pass: ✔️
- General update: ⚡
- Improve format/structure: 🎨
- Refactor code: 🔨
- Removing code/files: 🔥
- Continuous Integration: 💚
- Security: 🔒
- Upgrading dependencies: ⬆️
- Downgrading dependencies: ⬇️
- Lint: 👕
- Translation: 👽
- Text: 📝
- Critical hotfix: 🚑
- Deploying stuff: 🚀
- Fixing on MacOS: 🍎
- Fixing on Linux: 🐧
- Fixing on Windows: 🏁
- Work in progress: 🚧
- Adding CI build system: 👷
- Analytics or tracking code: 📈
- Removing a dependency: ➖
- Adding a dependency: ➕
- Docker: 🐳
- Configuration files: 🔧
- Package.json in JS: 📦
- Merging branches: 🔀
- Bad code / need improvement: 💩
- Reverting changes: ⏪
- Breaking changes: 💥
- Code review changes: 👌
- Accessibility: ♿
- Move/rename repository: 🚚

This command will be available in chat with `/makecommit`
