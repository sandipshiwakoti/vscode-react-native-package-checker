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
- 🔎 **Interactive CodeLens** - Clickable status segments that open filtered package browsers with real-time search
- 📊 **Smart Package Filtering** - Browse packages by compatibility status (Supported, Untested, Unlisted, Unmaintained)
- 🔍 **Quick Pick Interface** - Searchable package browser with instant navigation to package.json lines
- 🔧 **Maintenance Tracking** - Monitor package maintenance status and identify unmaintained dependencies
- 🔗 **Package Details** - Access NPM, GitHub, documentation, and New Architecture migration resources
- 🌐 **Migration Support** - Direct links to upgrade helpers, merged PRs, issues etc.
- 🔄 **Data Caching** - Always get the latest package information with intelligent data refresh
- ⚡ **Dependency Version Check** - Compare your current dependencies against React Native upgrade requirements using rn-diff-purge data
- 🎛️ **Quick Actions Menu** - Centralized access to common tasks like dependency checking and data refresh

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
3. **View** interactive CodeLens overlays showing compatibility info above each package
4. **Click** any status segment (e.g., "47 New Arch Supported") to browse filtered packages
5. **Search** and navigate packages using the Quick Pick interface
6. **Access** additional tools via `Ctrl+Shift+P` → "Package Checker: Browse Packages by Filter"

## 📋 Usage

### CodeLens Integration

Open your `package.json` to see interactive overlays above each dependency:

| CodeLens Display           | Meaning                                                   | Action                                      |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| ✓ **New Arch Supported**   | Package supports New Architecture                         | Click for detailed package info             |
| ⅹ **New Arch Unsupported** | Package doesn't support New Architecture                  | Click to see alternatives or migration info |
| ⚠ **New Arch Untested**   | Package has not been tested with New Architecture         | Click to check latest information           |
| ? **Unlisted**             | Package not found in the official React Native directory  | Click to check latest information           |
| 📂 **Unmaintained**        | Package is unmaintained                                   | See maintenance status                      |
| ✓ **Latest X.X.X**         | Package is up to date                                     | View package details                        |
| ↑ **Latest X.X.X**         | Update available                                          | Click to see upgrade options                |
| 🌐 **Upgrade Helper**      | Access React Native upgrade guidance                      | Open upgrade helper with current RN version |
| ✎ **Expected: X.X.X**      | Version mismatch detected for target React Native version | Click to update to expected version         |

**Interactive Summary CodeLens:**

The dependencies section shows a comprehensive summary with clickable segments:

| CodeLens Segment           | Meaning                                                        | Action                                     |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| 📦 **X packages**          | Total production dependencies count (excludes devDependencies) | Click to browse all packages in Quick Pick |
| ✓ **X New Arch Supported** | Count of packages supporting New Architecture                  | Click to browse only supported packages    |
| ⚠ **X Untested**          | Count of packages not tested with New Architecture             | Click to browse only untested packages     |
| ? **X Unlisted**           | Count of packages not in React Native directory                | Click to browse only unlisted packages     |
| 📂 **X Unmaintained**      | Count of unmaintained packages                                 | Click to browse only unmaintained packages |
| ⚙️ **Check deps version**  | Dependency version validation                                  | Enable/disable dependency checking         |
| 📋 **Quick actions**       | Access to common actions                                       | Open Quick Actions menu                    |

**Toggle CodeLens:**

- Use the toggle icon in the editor title bar for instant enable/disable

### Package Browsing & Filtering

**Quick Pick Interface:**

The extension provides a powerful Quick Pick interface for browsing and filtering packages:

- **Search Functionality**: Type to filter packages by name, version, or status in real-time
- **Status-Based Filtering**: Browse packages by specific compatibility status (Supported, Untested, Unlisted, Unmaintained)
- **Package Navigation**: Select any package to view detailed information and automatically navigate to its line in package.json
- **Comprehensive Information**: Each package shows name, current version, and compatibility status

**Access Methods:**

1. **From CodeLens**: Click any status segment in the dependencies summary (e.g., "47 New Arch Supported")
2. **From Command Palette**: Use "Browse All Packages" or "Browse Packages by Filter" commands
3. **Quick Actions Menu**: Access via the "Quick actions" CodeLens segment for additional tools

**Filter Categories:**

- **New Arch Supported**: Packages confirmed to work with React Native's New Architecture
- **Untested**: Packages that haven't been tested with the New Architecture yet
- **Unlisted**: Packages not found in the official React Native directory
- **Unmaintained**: Packages that are no longer actively maintained
- **All Packages**: Complete list of all project dependencies

### Command Palette

Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac):

**Package Checker: Open Package Checker Website**

- Analyze all project dependencies in your browser
- Opens the React Native Package Checker website with your project's packages
- Also accessible via the package summary CodeLens

**Package Checker: Browse Packages**

- Opens a filter selection menu to browse packages by specific status or access Quick Actions
- Choose from: All Packages, New Arch Supported, New Arch Unsupported, Untested, Unlisted, Unmaintained, or Quick Actions
- Each filter shows the count of matching packages (e.g., "New Arch Supported (47)")
- Provides focused views for different package categories with searchable Quick Pick interface
- Click any package to view detailed information and navigate to its line in package.json
- Access Quick Actions menu for common tasks like dependency checking and data refresh

**Package Checker: Refresh Package Data**

- Clear cache and fetch the latest package information

**Package Checker: Bulk Update Dependencies**

- **Preview-First Approach**: Shows all required changes before applying them
- **Comprehensive Updates**: Handles version updates, package additions, and removals
- **User Confirmation**: Allows selective updates with checkboxes for each change
- **Smart Package Management**: Automatically sorts dependencies alphabetically
- **Safe Operations**: Validates package.json structure before making changes
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

**Package Checker: Enable Dependency Check**

- Enables dependency version checking against a target React Native version
- Prompts you to enter the target React Native version (e.g., 0.75.1)
- **Version Validation**: Only allows upgrades - prevents downgrading to older React Native versions
- Uses rn-diff-purge data to compare your current dependencies with expected versions
- **Comprehensive Change Detection**: Identifies version updates, package additions, and removals
- Shows inline decorations for packages that need version updates, additions, or removals
- **Smart Package Management**: Excludes @react-native/new-app-screen from additions (used for scratch projects)
- **Auto-Disable**: Automatically disables when all dependencies meet the target React Native version requirements

**Package Checker: Disable Dependency Check**

- Disables dependency version checking and clears all version mismatch indicators
- Removes inline decorations from package.json
- **Note**: Dependency check also auto-disables when all requirements are satisfied

### Title Bar

**Toggle Icon:**

- Toggle CodeLens display on/off

## 📊 Data Sources

This extension leverages data from trusted sources:

- **[React Native Directory](https://reactnative.directory)** - Official React Native package directory with comprehensive compatibility data
- **[NPM Registry](https://www.npmjs.com)** - Package version and metadata information
- **[React Native Upgrade Helper](https://react-native-community.github.io/upgrade-helper)** - Official upgrade guidance for React Native versions
- **[rn-diff-purge](https://github.com/react-native-community/rn-diff-purge)** - Community-maintained diffs between React Native versions for dependency version checking

_Special thanks to the React Native Directory team and rn-diff-purge maintainers for providing the comprehensive data that powers this extension._

## ⚙️ Configuration

Customize the extension in your VS Code settings (`settings.json`):

```json
{
    "reactNativePackageChecker.showLatestVersion": true,
    "reactNativePackageChecker.enableLogging": true,
    "reactNativePackageChecker.logLevel": "info",
    "reactNativePackageChecker.dependencyCheck.cacheDuration": 24
}
```

| Setting                         | Description                                                              | Default | Type      | Options                          |
| ------------------------------- | ------------------------------------------------------------------------ | ------- | --------- | -------------------------------- |
| `showLatestVersion`             | Show CodeLens for latest version information and fetch from NPM registry | `true`  | `boolean` | `true`, `false`                  |
| `enableLogging`                 | Enable logging of API calls and cache operations to the output channel   | `true`  | `boolean` | `true`, `false`                  |
| `logLevel`                      | Set the logging level for the extension                                  | `info`  | `string`  | `debug`, `info`, `warn`, `error` |
| `dependencyCheck.cacheDuration` | Cache duration for dependency check diff data in hours                   | `24`    | `number`  | `1-168` hours                    |

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

### Dependency check not working?

- Ensure you have a valid `package.json` with React Native as a dependency
- Verify the target React Native version exists in rn-diff-purge repository
- Check that your current React Native version is different from the target version
- Use "Package Checker: Show Logs" to view detailed error messages

### Target React Native version not found?

- The extension uses rn-diff-purge data, which may not have diffs for very new or very old React Native versions
- Check the [rn-diff-purge repository](https://github.com/react-native-community/rn-diff-purge) for available versions
- Try a different target version that's known to be available

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
