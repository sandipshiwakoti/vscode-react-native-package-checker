<p align="center">
  <img src="assets/logo.png" alt="React Native Package Checker Logo" width="150" height="150">
</p>

<h1 align="center">React Native Package Checker</h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-package-checker">
    <img src="https://img.shields.io/visual-studio-marketplace/v/sandipshiwakoti.vscode-react-native-package-checker?style=flat-square&label=version" alt="Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-package-checker">
    <img src="https://img.shields.io/visual-studio-marketplace/d/sandipshiwakoti.vscode-react-native-package-checker?style=flat-square&color=success&label=vscode%20downloads" alt="VS Code Downloads">
  </a>
  <a href="https://open-vsx.org/extension/sandipshiwakoti/vscode-react-native-package-checker">
    <img src="https://img.shields.io/open-vsx/dt/sandipshiwakoti/vscode-react-native-package-checker?style=flat-square&color=success&label=openvsx%20downloads" alt="Open VSX Downloads">
  </a>
  <a href="https://github.com/sandipshiwakoti/vscode-react-native-package-checker/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/sandipshiwakoti/vscode-react-native-package-checker?style=flat-square&color=blue&label=license" alt="MIT License">
  </a>
</p>

<p align="center">
  <strong>Check ALL React Native packages for New Architecture compatibility in seconds ⚡️</strong><br>
</p>

---

## ✨ Features

- 🎯 **New Architecture Status Check** - See instantly if a package supports the New Architecture with clear color indicators

- 🖥️ **In-Editor Panel**: Check compatibility status right in VS Code

- 🌐 **Browser View**: Full analysis on the React Native Package Checker website

- 🔎 **CodeLens Integration** - Status indicators right in your package.json

- 📝 **Detailed View** - Click any package to see comprehensive status and compatibility details

## 🚀 Installation

**Install from:**

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-package-checker)
- [Open VSX Registry](https://open-vsx.org/extension/sandipshiwakoti/vscode-react-native-package-checker)

**Or install manually:**

```bash
code --install-extension sandipshiwakoti.vscode-react-native-package-checker
```

**Requirements**:

- VS Code 1.74.0 or higher
- A React Native project with `android/` and/or `ios/` folders, or an Expo project with `app.json`, `app.config.js`, or `app.config.ts`
- Package.json is optional

---

## ⚡ Quick Start

1. **Install** from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-package-checker) or [Open VSX](https://open-vsx.org/extension/sandipshiwakoti/vscode-react-native-package-checker)
2. **Open** your React Native project in VS Code
3. **Open** package.json to see status indicators automatically
4. **Click** on any indicator for detailed package information

### 📊 Status Color Indicators at a Glance

- 🟢 **Green**: Package fully supports New Architecture
- 🔴 **Red**: Package doesn't support New Architecture
- 🟡 **Yellow**: Package hasn't been tested with New Architecture
- ⚫ **Black**: Status couldn't be determined

## 🛠️ Development Setup

- **Tools**: Bun, VS Code, TypeScript.
- **Build**: `bun run compile`
- **Test**: `bun run test`
- **Package**: `bun run package` (creates `.vsix`)
- **Publish**: `bun run publish` (for maintainers)

---

## 🙌 Contributing

Contributions are welcome! Please see [Contributing Guidelines](.github/CONTRIBUTING.md) for details.

---

## 📜 License

This project is licensed under the [MIT License](https://github.com/sandipshiwakoti/vscode-react-native-package-checker/blob/main/LICENSE).

---

<p align="center">
  <strong>Made with ❤️ for the React Native & Expo community</strong><br>
  <a href="https://github.com/sandipshiwakoti">@sandipshiwakoti</a>
</p>
