<p align="center">
  <img src="assets/logo.png" alt="React Native Package Checker Logo" width="150" height="150">
</p>

<h1 align="center">React Native Package Checker <br><small>VS Code Extension</small></h1>

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
  <strong>Check React Native packages for New Architecture compatibility directly in VS Code ⚡️</strong><br>
</p>

---

## ✨ Features

- 🎯 **New Architecture Compatibility** - See which packages support React Native's New Architecture directly in your package.json
- 🔎 **CodeLens Integration** - Interactive overlays show package status, maintenance info, and available updates
- 📊 **Comprehensive Analysis** - Get detailed compatibility reports for all project dependencies
- 🔧 **Maintenance Tracking** - Monitor package maintenance status and identify unmaintained dependencies
- 🔗 **Package Details** - Access NPM, GitHub, documentation, and New Architecture migration resources
- 🌐 **Web Integration** - Direct access to React Native Package Checker and Upgrade Helper websites
- 🌐 **Migration Support** - Direct links to upgrade helpers, merged PRs, issues etc.
- 🔄 **Data Caching** - Always get the latest package information with intelligent data refresh

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
2. **Open** your `package.json` file
3. **View** CodeLens overlays showing compatibility info above each package
4. **Analyze** all packages with `Ctrl+Shift+P` → "Package Checker: Open Package Checker Website"

## 📋 Usage

### CodeLens Integration

Open your `package.json` to see interactive overlays above each dependency:

| CodeLens Display           | Meaning                                                  | Action                                      |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| ✓ **New Arch Supported**   | Package supports New Architecture                        | Click for detailed package info             |
| ⅹ **New Arch Unsupported** | Package doesn't support New Architecture                 | Click to see alternatives or migration info |
| ⚠ **New Arch Untested**   | Package has not been tested with New Architecture        | Click to check latest information           |
| ? **Unlisted**             | Package not found in the official React Native directory | Click to check latest information           |
| 📂 **Unmaintained**        | Package is unmaintained                                  | See maintenance status                      |
| ✓ **Latest X.X.X**         | Package is up to date                                    | View package details                        |
| ↑ **Latest X.X.X**         | Update available                                         | Click to see upgrade options                |
| 🌐 **Upgrade Helper**      | Access React Native upgrade guidance                     | Open upgrade helper with current RN version |

**Toggle CodeLens:**

- Use the package icon in the editor title bar

### Command Palette

Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac):

**Package Checker: Open Package Checker Website**

- Analyze all project dependencies in your browser
- Opens the React Native Package Checker website with your project's packages

**Package Checker: Refresh Package Data**

- Clear cache and fetch the latest package information
- Useful when package data seems outdated

**Package Checker: Show Logs**

- Open the extension's output channel to view detailed logs
- Useful for debugging and monitoring API calls

**Package Checker: Open Upgrade Helper**

- Opens the React Native Upgrade Helper website with intelligent version detection
- **From Command Palette**: Automatically reads React Native version from your currently open package.json
- **From CodeLens**: Uses the specific version from the package context
- **Smart Version Parsing**: Handles version prefixes (^, ~, >=) and extracts clean version numbers
- Perfect for planning React Native version upgrades and migrations

### Title Bar

**External Link Icon:**

- Click to open the React Native Package Checker website
- Analyzes all your project's packages in the browser

**Toggle Icon:**

- Toggle CodeLens display on/off

## 📊 Data Sources

This extension leverages data from trusted sources:

- **[React Native Directory](https://reactnative.directory)** - Official React Native package directory with comprehensive compatibility data
- **[NPM Registry](https://www.npmjs.com)** - Package version and metadata information
- **[React Native Upgrade Helper](https://react-native-community.github.io/upgrade-helper)** - Official upgrade guidance for React Native versions

_Special thanks to the React Native Directory team for maintaining the comprehensive package database that powers this extension._

## ⚙️ Configuration

Customize the extension in your VS Code settings (`settings.json`):

```json
{
    "reactNativePackageChecker.showLatestVersion": true,
    "reactNativePackageChecker.enableLogging": true,
    "reactNativePackageChecker.logLevel": "info"
}
```

| Setting             | Description                                                              | Default | Type      | Options                          |
| ------------------- | ------------------------------------------------------------------------ | ------- | --------- | -------------------------------- |
| `showLatestVersion` | Show CodeLens for latest version information and fetch from NPM registry | `true`  | `boolean` | `true`, `false`                  |
| `enableLogging`     | Enable logging of API calls and cache operations to the output channel   | `true`  | `boolean` | `true`, `false`                  |
| `logLevel`          | Set the logging level for the extension                                  | `info`  | `string`  | `debug`, `info`, `warn`, `error` |

**To access settings:**

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Preferences: Open Settings (JSON)"
3. Add the configuration above

## 🔧 Troubleshooting

### CodeLens not showing?

- Ensure you have a valid `package.json` in your workspace root
- Verify CodeLens is enabled: `"reactNativePackageChecker.showLatestVersion": true`
- Try reloading VS Code window (`Ctrl+Shift+P` → "Developer: Reload Window")

### Package data seems outdated?

- Use "Package Checker: Refresh Package Data" command to clear cache
- This fetches the latest information from all data sources

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
