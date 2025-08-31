<p align="center">
  <img src="assets/logo.png" alt="React Native Package Checker Logo" width="150" height="150">
</p>

<h1 align="center">React Native Package Checker <br><small>VS Code Extension</small></h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-package-checker">
    <img src="https://img.shields.io/visual-studio-marketplace/v/sandipshiwakoti.vscode-react-native-package-checker?style=flat&color=black" alt="Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-package-checker">
    <img src="https://img.shields.io/visual-studio-marketplace/i/sandipshiwakoti.vscode-react-native-package-checker?style=flat&color=success&label=installs" alt="VS Code Installs">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-package-checker">
    <img src="https://img.shields.io/visual-studio-marketplace/d/sandipshiwakoti.vscode-react-native-package-checker?style=flat&color=success&label=downloads" alt="VS Code Downloads">
  </a>
  <a href="https://open-vsx.org/extension/sandipshiwakoti/vscode-react-native-package-checker">
    <img src="https://img.shields.io/open-vsx/dt/sandipshiwakoti/vscode-react-native-package-checker?style=flat&color=success&label=open%20vsx" alt="Open VSX Downloads">
  </a>
  <a href="https://github.com/sandipshiwakoti/vscode-react-native-package-checker/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/sandipshiwakoti/vscode-react-native-package-checker?style=flat&color=red" alt="MIT License">
  </a>
</p>

<p align="center">
  <strong style="font-size: 1.3em; max-width: 600px; display: inline-block;">
    Check New Architecture compatibility and version requirements for React Native packages - all in VS Code ⚡️
  </strong><br>
  <em>CodeLens Integration • Package Filtering • Version Requirements • One-Click Updates</em>
</p>

<p align="center">
  <img src="assets/demo/demo.gif" alt="React Native Package Checker Demo" width="800">
</p>

---

## ✨ Features

- 🎯 **New Architecture Status** - See which packages work with React Native's New Architecture right in your package.json
- 📊 **Package Summary** - Get instant overview of all dependencies with status counts and quick actions
- 🎨 **Visual Indicators** - Gutter icons and CodeLens overlays show compatibility at a glance
- 🔍 **Smart Filtering** - Browse packages by status (Supported, Untested, Unlisted, Unmaintained) with search
- ⚡ **Version Requirements** - Check what package versions you need for any React Native version
- 🔧 **Bulk Updates** - Apply all required version changes with preview and confirmation
- 📂 **Maintenance Status** - Spot unmaintained packages that might cause issues
- 🔗 **External Resources** - Quick access to NPM, GitHub, docs, and migration guides
- 🌐 **Upgrade Helper** - Direct links to React Native upgrade tools and community resources
- 📦 **Package Checker Website** - Open your project dependencies in the web-based package analyzer

## 🚀 Installation

**Install from VS Code Marketplace:**

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "React Native Package Checker"
4. Click Install

**Or install via command line:**

```bash
code --install-extension sandipshiwakoti.vscode-react-native-package-checker
```

**Alternative sources:**

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-package-checker)
- [Open VSX Registry](https://open-vsx.org/extension/sandipshiwakoti/vscode-react-native-package-checker)

**Requirements:**

- VS Code 1.74.0 or higher
- A package.json file in your workspace

---

## 🚀 Quick Start

1. **Open** your React Native project in VS Code
2. **Open** your `package.json` file - CodeLens overlays appear automatically
3. **Check New Architecture compatibility** - See status icons and clickable segments above each dependency
4. **Browse packages by status** - Click summary segments like "✓23 Supported" to filter and search
5. **Check version requirements** - Use `Ctrl+Shift+P` → "Show Requirements" to see what versions you need for target React Native version
6. **Apply bulk updates** - Use "Apply Requirements" to update all packages with preview and confirmation

**Key Actions:**

- Click any CodeLens segment to browse filtered packages
- Use Command Palette (`Ctrl+Shift+P`) for "Package Checker" commands
- Toggle CodeLens display with the title bar icon

## 📋 Usage

### 🔎 CodeLens Integration

Open your `package.json` to see interactive overlays above each dependency:

| CodeLens Display                                                                                     | Meaning                                                   | Action                                                    |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| ✓ **New Arch Supported**                                                                             | Package supports New Architecture                         | Click for detailed package info                           |
| ⅹ **New Arch Unsupported**                                                                           | Package doesn't support New Architecture                  | Click to see alternatives or migration info               |
| ⚠ **New Arch Untested**                                                                             | Package has not been tested with New Architecture         | Click to check latest information                         |
| ? **Unlisted**                                                                                       | Package not found in the official React Native directory  | Click to check latest information                         |
| 📂 **Unmaintained**                                                                                  | Package is unmaintained                                   | See maintenance status                                    |
| ✓ **Latest X.X.X**                                                                                   | Package is up to date                                     | View package details                                      |
| ↑ **Latest X.X.X**                                                                                   | Update available                                          | Click to see upgrade options                              |
| ✎ **Required: X.X.X**                                                                                | Version mismatch detected for target React Native version | Click to update to required version                       |
| 📦 **X packages** \| **✓X Supported** \| **⚠X Untested** \| **?X Unlisted** \| **📂X Unmaintained** | Summary of all dependencies with clickable status counts  | Click any segment to browse packages by that status       |
| 🎛️ **Quick Actions**                                                                                 | Access common tasks and tools                             | Show/Apply Requirements, Refresh Data, Open Website, etc. |

### 🎛️ Title Bar

**Toggle CodeLens display on/off:**

- Use the toggle icon in the editor title bar for instant enable/disable

### 🎨 Visual Status Decorations

Package status decorations appear as icons in the editor gutter next to each dependency line:

| Icon                                                                      | Status          | Meaning                                           |
| ------------------------------------------------------------------------- | --------------- | ------------------------------------------------- |
| <img src="assets/images/circle-check.png" width="20" height="20">         | **Supported**   | Package fully supports New Architecture           |
| <img src="assets/images/circle-x.png" width="20" height="20">             | **Unsupported** | Package does not support New Architecture         |
| <img src="assets/images/circle-alert.png" width="20" height="20">         | **Untested**    | Package has not been tested with New Architecture |
| <img src="assets/images/circle-question-mark.png" width="20" height="20"> | **Unlisted**    | Package not found in the React Native directory   |

**Configuration:**

- Toggle decorations: Command Palette → "Toggle Status Decorations"
- Setting: `reactNativePackageChecker.showStatusDecorations` (default: `true`)

### ⌨️ Command Palette

Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac):

| Command                                           | Description                                     |
| ------------------------------------------------- | ----------------------------------------------- |
| **Package Checker: Open Package Checker Website** | Analyze dependencies in browser                 |
| **Package Checker: Browse Packages**              | Filter and search packages by status            |
| **Package Checker: Refresh Package Data**         | Clear cache and fetch latest information        |
| **Package Checker: Apply Requirements**           | Bulk update dependencies with preview           |
| **Package Checker: Show Requirements**            | Display required versions for target RN version |
| **Package Checker: Hide Requirements**            | Clear requirements display                      |
| **Package Checker: Open Upgrade Helper**          | Access React Native upgrade guidance            |
| **Package Checker: Toggle Status Decorations**    | Show/hide gutter icons                          |
| **Package Checker: Show Logs**                    | View detailed extension logs                    |

## 📊 Data Sources

This extension leverages data from trusted sources:

- **[React Native Directory](https://reactnative.directory)** - Official React Native package directory with comprehensive compatibility data
- **[NPM Registry](https://www.npmjs.com)** - Package version and metadata information
- **[React Native Upgrade Helper](https://react-native-community.github.io/upgrade-helper)** - Official upgrade guidance for React Native versions
- **[rn-diff-purge](https://github.com/react-native-community/rn-diff-purge)** - Community-maintained diffs between React Native versions for requirements checking

_Special thanks to the React Native Directory team and rn-diff-purge maintainers for providing the comprehensive data that powers this extension._

## ⚙️ Configuration

Customize the extension in your VS Code settings (`settings.json`):

```json
{
    "reactNativePackageChecker.showLatestVersion": true,
    "reactNativePackageChecker.showStatusDecorations": true,
    "reactNativePackageChecker.enableLogging": true,
    "reactNativePackageChecker.logLevel": "info",
    "reactNativePackageChecker.requirements.cacheDuration": 24
}
```

| Setting                      | Description                                                              | Default | Type      | Options                          |
| ---------------------------- | ------------------------------------------------------------------------ | ------- | --------- | -------------------------------- |
| `showLatestVersion`          | Show CodeLens for latest version information and fetch from NPM registry | `true`  | `boolean` | `true`, `false`                  |
| `showStatusDecorations`      | Show gutter decorations for package New Architecture status              | `true`  | `boolean` | `true`, `false`                  |
| `enableLogging`              | Enable logging of API calls and cache operations to the output channel   | `true`  | `boolean` | `true`, `false`                  |
| `logLevel`                   | Set the logging level for the extension                                  | `info`  | `string`  | `debug`, `info`, `warn`, `error` |
| `requirements.cacheDuration` | Cache duration for requirements data in hours                            | `24`    | `number`  | `1-168` hours                    |

**To access settings:**

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Preferences: Open Settings (JSON)"
3. Add the configuration above

## ❓ FAQ

### 1. How accurate are the version requirements?

The extension uses the same data source as [React Native Upgrade Helper](https://react-native-community.github.io/upgrade-helper) - specifically the [rn-diff-purge](https://github.com/react-native-community/rn-diff-purge) repository - ensuring the requirements are as reliable as the official upgrade tool. The extension focuses on packages that are part of React Native project templates, providing targeted guidance for the most commonly used dependencies. Packages not included in these templates won't have version requirements available.

### 2. How does the extension get New Architecture and version data?

The extension fetches New Architecture compatibility status through the [Package Checker website](https://react-native-package-checker.vercel.app/) API, which uses [React Native Directory](https://reactnative.directory) data. This includes support status, maintenance information, and alternative package suggestions. Latest version information comes directly from the [NPM Registry](https://www.npmjs.com) to provide up-to-date package versions. Packages not listed in React Native Directory will show as "Unlisted" status.

### 3. What if my React Native version isn't supported for requirements checking?

Version requirements depend on data availability in the [rn-diff-purge](https://github.com/react-native-community/rn-diff-purge) repository. Very new or very old React Native versions might not have complete diff data available, so try targeting a well-established version that's known to be supported.

## 🛠️ Development

**Tech Stack:**

<p>
  <a href="https://bun.sh">
    <img src="https://img.shields.io/badge/Bun-FF6B35?style=flat-square&logo=bun&logoColor=white" alt="Bun" />
  </a>
  <a href="https://www.typescriptlang.org">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
  <a href="https://code.visualstudio.com/api">
    <img src="https://img.shields.io/badge/VS_Code_API-007ACC?style=flat-square&logo=visual-studio-code&logoColor=white" alt="VS Code API" />
  </a>
</p>

**Commands:**

```bash
bun install          # Install dependencies
bun run compile      # Build the extension
bun run watch        # Watch mode for development
bun run test         # Run tests
bun run lint         # Run ESLint
bun run lint:fix     # Fix ESLint issues
bun run format       # Format code with Prettier
bun run format:check # Check code formatting
bun run fix          # Run lint:fix and format together
bun run package      # Create .vsix file
bun run publish      # Publish to marketplace
```

## 🙌 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For detailed guidelines, see [Contributing Guidelines](.github/CONTRIBUTING.md).

**Found a bug?** Please [open an issue](https://github.com/sandipshiwakoti/vscode-react-native-package-checker/issues) with:

- VS Code version
- Extension version
- Steps to reproduce
- Expected vs actual behavior

---

## 📜 License

This project is licensed under the [MIT License](https://github.com/sandipshiwakoti/vscode-react-native-package-checker/blob/main/LICENSE).

---

<p align="center">
  <strong>Made with ❤️ for the React Native community</strong><br>
  <a href="https://github.com/sandipshiwakoti">@sandipshiwakoti</a>
</p>
