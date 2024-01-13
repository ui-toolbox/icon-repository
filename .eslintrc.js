module.exports = {
	env: {
		browser: true,
		es2021: true
	},
	extends: [
		"standard-with-typescript",
		"plugin:@stylistic/disable-legacy"
	],
	overrides: [
		{
			env: {
				node: true
			},
			files: [
				".eslintrc.{js,cjs}"
			],
			parserOptions: {
				sourceType: "script"
			}
		}
	],
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
		parser: "@typescript-eslint/parser",
		project: "./tsconfig.json"
	},
	plugins: [
		"node",
		"@stylistic"
	],
	rules: {
		"@stylistic/quotes": ["error", "double"],
		"@stylistic/semi": ["error", "always"],
		"@stylistic/indent": ["error", "tab"]
	},
	settings: {
		node: {
			version: "detect"
		}
	},
	"ignorePatterns": [".eslintrc.js"],
};
